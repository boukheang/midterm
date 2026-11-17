<#
.SYNOPSIS
  One-command deployment of Smart Campus Access Control to the local Kubernetes cluster.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -SkipBuild -InstallMetricsServer
#>
param(
    [switch]$SkipBuild,              # re-use the images from the last build-images.ps1 run
    [switch]$InstallMetricsServer,   # needed for the HorizontalPodAutoscaler and Dashboard CPU graphs
    [string]$AdminEmail = 'admin@campus.edu',
    [string]$AdminPassword = 'Password123!',   # demo default - matches the dashboard's quick-login button
    [string]$MongoUri = 'mongodb://mongodb:27017/smart_campus_access_db',
    [switch]$ResetSecret             # recreate the Secret (logs everyone out: new JWT key)
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$ns = 'smart-campus'

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

if (-not $SkipBuild) {
    & (Join-Path $PSScriptRoot 'build-images.ps1')
}

# Image tag produced by the last build (falls back to ':local').
$tagFile = Join-Path $PSScriptRoot '.image-tag'
$imageTag = if (Test-Path $tagFile) { (Get-Content $tagFile -Raw).Trim() } else { 'local' }
Write-Host "==> Deploying images tagged '$imageTag'" -ForegroundColor Cyan

Write-Host '==> Namespace and configuration' -ForegroundColor Cyan
Invoke-Native 'namespace' { kubectl.exe apply -f k8s/00-namespace.yaml }
Invoke-Native 'configmap' { kubectl.exe apply -f k8s/01-config.yaml }

$secretExists = Test-Native { kubectl.exe -n $ns get secret campus-secrets }
if ($ResetSecret -and $secretExists) {
    Invoke-Native 'delete secret' { kubectl.exe -n $ns delete secret campus-secrets }
    $secretExists = $false
}
if (-not $secretExists) {
    # Random 48-character signing key, generated fresh for this cluster.
    $chars = [char[]]'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 48
    $rng.GetBytes($bytes)
    $jwt = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
    Write-Host '==> Creating Secret campus-secrets (random JWT key)' -ForegroundColor Cyan
    Invoke-Native 'create secret' {
        kubectl.exe -n $ns create secret generic campus-secrets `
            "--from-literal=MONGO_URI=$MongoUri" `
            "--from-literal=JWT_SECRET=$jwt" `
            "--from-literal=ADMIN_EMAIL=$AdminEmail" `
            "--from-literal=ADMIN_PASSWORD=$AdminPassword"
    }
}
else {
    Write-Host '==> Secret campus-secrets already exists (kept). Use -ResetSecret to recreate it.' -ForegroundColor DarkGray
}

Write-Host '==> Storage, database, services' -ForegroundColor Cyan
foreach ($file in '03-storage.yaml', '04-mongodb.yaml', '10-services.yaml', '20-deployments.yaml', '21-gateway.yaml', '25-autoscaling.yaml', '30-network-policy.yaml') {
    # Point our images at this build's tag; everything else is applied unchanged.
    $yaml = (Get-Content "k8s/$file" -Raw) -replace 'image: smart-campus/([a-z-]+):local', "image: smart-campus/`$1:$imageTag"
    Invoke-Native "apply $file" { $yaml | kubectl.exe apply -f - }
}

if ($InstallMetricsServer) {
    Write-Host '==> Installing metrics-server' -ForegroundColor Cyan
    Invoke-Native 'metrics-server' { kubectl.exe apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.7.2/components.yaml }
    # Local clusters use self-signed kubelet certificates.
    # The patch goes through a file: Windows PowerShell 5.1 strips the double quotes
    # from JSON passed as a command-line argument, which kubectl then rejects.
    $args0 = kubectl.exe -n kube-system get deploy metrics-server -o jsonpath='{.spec.template.spec.containers[0].args}'
    if ($args0 -notmatch 'kubelet-insecure-tls') {
        $patchFile = Join-Path ([System.IO.Path]::GetTempPath()) 'metrics-server-patch.json'
        Set-Content -Path $patchFile -Encoding ASCII -Value '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
        try {
            Invoke-Native 'patch metrics-server' { kubectl.exe -n kube-system patch deployment metrics-server --type=json --patch-file $patchFile }
        }
        finally { Remove-Item $patchFile -Force -ErrorAction SilentlyContinue }
    }
    else {
        Write-Host 'metrics-server already configured for local clusters.' -ForegroundColor DarkGray
    }
}

Write-Host '==> Waiting for everything to become ready (first start can take a few minutes)' -ForegroundColor Cyan
Invoke-Native 'mongodb rollout' { kubectl.exe -n $ns rollout status statefulset/mongodb --timeout=300s }
$deployments = kubectl.exe -n $ns get deploy -o jsonpath='{.items[*].metadata.name}'
foreach ($d in ($deployments -split ' ' | Where-Object { $_ })) {
    Invoke-Native "rollout $d" { kubectl.exe -n $ns rollout status "deployment/$d" --timeout=300s }
}

kubectl.exe -n $ns get pods,svc,hpa,pvc
Write-Host ''
Write-Host 'Smart Campus is running.' -ForegroundColor Green

# Docker Desktop (kubeadm mode) publishes LoadBalancer Services on localhost.
# Other clusters (kind mode, minikube) leave EXTERNAL-IP pending -> use a port-forward.
$lb = $null
for ($i = 0; $i -lt 10 -and -not $lb; $i++) {
    $lb = kubectl.exe -n $ns get svc api-gateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}'
    if (-not $lb) { Start-Sleep -Seconds 2 }
}
if ($lb) {
    Write-Host '  Open the app   : http://localhost:4000'
}
else {
    Write-Host '  This cluster does not publish LoadBalancer Services on localhost.' -ForegroundColor Yellow
    Write-Host '  Open the app   : powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1   (keeps a tunnel open on http://localhost:4000)'
}
Write-Host "  Admin login    : $AdminEmail (password from -AdminPassword)"
Write-Host '  Kubernetes Dashboard: powershell -ExecutionPolicy Bypass -File scripts\dashboard.ps1'
