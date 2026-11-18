<#
.SYNOPSIS
  Builds every Smart Campus Docker image and loads it into the local Kubernetes cluster.

.DESCRIPTION
  Works for the common local clusters:
    - Docker Desktop (kind mode, node "desktop-control-plane") -> images are imported into the node
    - Docker Desktop (kubeadm mode)                            -> images are shared automatically
    - minikube                                                 -> minikube.exe image load
    - kind                                                     -> kind.exe load docker-image
  Also pre-loads the third-party images (mongo, busybox) so the demo works offline.

  With -Registry <dockerhub-username> -Push it also publishes all 9 images to
  Docker Hub as <username>/smart-campus-<service>:<build-tag> (and :latest) and
  points the Kubernetes YAML at those exact images. Log in first with `docker login`.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\build-images.ps1
  powershell -ExecutionPolicy Bypass -File scripts\build-images.ps1 -Registry yourname -Push
#>
param(
    [switch]$NoLoad,          # only build, do not load into the cluster
    [string]$Registry = '',   # Docker Hub username (or registry/namespace) to publish to
    [switch]$Push             # push to $Registry and update the YAML image references
)
if ($Push -and -not $Registry) { throw 'Use -Push together with -Registry <dockerhub-username>.' }

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Invoke-Native {
    param([string]$Description, [scriptblock]$Command)
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit code $LASTEXITCODE)" }
}

# Runs a probe command and returns $true if it succeeded. Errors are expected here,
# so they must not stop the script (Windows PowerShell 5.1 treats redirected
# native stderr as a terminating error when ErrorActionPreference is 'Stop').
function Test-Native {
    param([scriptblock]$Command)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Command *> $null; return ($LASTEXITCODE -eq 0) }
    catch { return $false }
    finally { $ErrorActionPreference = $previous }
}

# image name -> service folder (all built from the repository root so shared/ is included)
$services = [ordered]@{
    'api-gateway'    = 'APIGateway_Microservice'
    'registration'   = 'Registration_Microservice'
    'authentication' = 'Authentication_Microservice'
    'room'           = 'Room_Microservice'
    'permission'     = 'Permission_Microservice'
    'access-log'     = 'AccessLog_Microservice'
    'emergency'      = 'EmergencyAlert_Microservice'
    'student'        = 'Student_Microservice'
    'teacher'        = 'Teacher_Microservice'
}
$thirdParty = @('mongo:7.0', 'busybox:1.36')

# Every build also gets a unique tag. Kubernetes only pulls/uses an image when the
# tag changes, so re-using ':local' after a code change could keep running old code.
$buildTag = 'build-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$images = @()
foreach ($name in $services.Keys) {
    $tag = "smart-campus/${name}:$buildTag"
    Write-Host "==> Building $tag" -ForegroundColor Cyan
    Invoke-Native "docker build $tag" { docker.exe build -f "$($services[$name])/Dockerfile" -t $tag -t "smart-campus/${name}:local" . }
    $images += $tag
}
# deploy.ps1 reads this to point the Deployments at the images just built.
Set-Content -Path (Join-Path $PSScriptRoot '.image-tag') -Value $buildTag -Encoding ASCII

if ($Registry) {
    foreach ($name in $services.Keys) {
        $remote = "$Registry/smart-campus-${name}"
        Invoke-Native "tag $remote" { docker.exe tag "smart-campus/${name}:$buildTag" "${remote}:$buildTag" }
        Invoke-Native "tag $remote latest" { docker.exe tag "smart-campus/${name}:$buildTag" "${remote}:latest" }
        if ($Push) {
            Write-Host "==> Pushing ${remote}:$buildTag" -ForegroundColor Cyan
            Invoke-Native "push ${remote}:$buildTag" { docker.exe push "${remote}:$buildTag" }
            Invoke-Native "push ${remote}:latest" { docker.exe push "${remote}:latest" }
        }
    }
    if ($Push) {
        # Point the committed YAML at the exact published images (pinned tag, not
        # :latest, so every cluster runs the same build).
        foreach ($file in 'k8s/20-deployments.yaml', 'k8s/21-gateway.yaml') {
            $yaml = Get-Content $file -Raw
            $yaml = [regex]::Replace($yaml, 'image: (?:[\w.-]+/)?smart-campus[/-]([a-z-]+):\S+', "image: $Registry/smart-campus-`$1:$buildTag")
            [System.IO.File]::WriteAllText((Resolve-Path $file), $yaml)
        }
        Write-Host "Published all images to $Registry and updated k8s/*.yaml (tag $buildTag)." -ForegroundColor Green
    }
}

foreach ($img in $thirdParty) {
    Write-Host "==> Pulling $img" -ForegroundColor Cyan
    Invoke-Native "docker pull $img" { docker.exe pull $img }
    $images += $img
}

if ($NoLoad) {
    Write-Host 'Built all images (not loaded into a cluster because -NoLoad was given).' -ForegroundColor Green
    return
}

$context = (kubectl.exe config current-context).Trim()
Write-Host "==> Loading images into Kubernetes context '$context'" -ForegroundColor Cyan

if ($context -eq 'minikube') {
    foreach ($img in $images) { Invoke-Native "minikube image load $img" { minikube.exe image load $img } }
}
elseif ($context -like 'kind-*') {
    $cluster = $context.Substring(5)
    foreach ($img in $images) { Invoke-Native "kind load $img" { kind.exe load docker-image $img --name $cluster } }
}
else {
    # Docker Desktop. In kind mode each node is a hidden container named after the
    # node; its containerd does NOT see images from `docker build`, so import them.
    # @() keeps this an array even with a single node (otherwise $nodes[0] is one character).
    $nodes = @((kubectl.exe get nodes -o jsonpath='{.items[*].metadata.name}') -split ' ' | Where-Object { $_ })
    if (-not (Test-Native { docker.exe exec $nodes[0] ctr --version })) {
        Write-Host 'Docker Desktop (kubeadm mode): images are shared with the cluster automatically.' -ForegroundColor Green
    }
    else {
        # Save to a file and copy it in: Windows PowerShell corrupts binary data in pipes.
        $tar = Join-Path ([System.IO.Path]::GetTempPath()) 'smart-campus-images.tar'
        Write-Host "==> Saving $($images.Count) images to $tar"
        Invoke-Native 'docker save' { docker.exe save -o $tar @images }
        foreach ($node in $nodes) {
            Write-Host "==> Importing images into node $node"
            Invoke-Native "copy to $node" { docker.exe cp $tar "${node}:/smart-campus-images.tar" }
            Invoke-Native "import on $node" { docker.exe exec $node ctr -n k8s.io images import /smart-campus-images.tar }
            docker.exe exec $node rm -f /smart-campus-images.tar | Out-Null
        }
        Remove-Item $tar -Force
    }
}

Write-Host "All images built and loaded (tag $buildTag)." -ForegroundColor Green
