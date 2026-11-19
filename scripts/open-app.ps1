<#
.SYNOPSIS
  Opens Smart Campus through the Ingress (browser -> Ingress Controller -> API Gateway).
  Use this when the Ingress Controller has no EXTERNAL-IP on localhost
  (kind-mode Docker Desktop, minikube). Keep the window open while you use the app.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1               # http://localhost
  powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1 -Port 8080    # if port 80 is busy
  powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1 -Direct       # skip the Ingress, straight to the gateway on :4000
#>
param(
    [int]$Port = 0,
    [switch]$Direct
)

if ($Direct) {
    if ($Port -eq 0) { $Port = 4000 }
    $url = "http://localhost:$Port"
    Write-Host "Smart Campus (direct to the API Gateway, bypassing the Ingress): $url   (Ctrl+C to stop)" -ForegroundColor Yellow
    Start-Job -ArgumentList $url { param($u) Start-Sleep -Seconds 3; Start-Process $u } | Out-Null
    kubectl.exe -n smart-campus port-forward svc/api-gateway "${Port}:4000"
    return
}

if ($Port -eq 0) { $Port = 80 }
$url = if ($Port -eq 80) { 'http://localhost' } else { "http://localhost:$Port" }
Write-Host "Smart Campus through the Ingress: $url   (Ctrl+C to stop)" -ForegroundColor Green
Write-Host "Named host (browser, no setup): http://smartcampus.localhost$(if ($Port -ne 80) { ":$Port" })" -ForegroundColor DarkGray
Start-Job -ArgumentList $url { param($u) Start-Sleep -Seconds 3; Start-Process $u } | Out-Null
kubectl.exe -n ingress-nginx port-forward svc/ingress-nginx-controller "${Port}:80"
