<#
.SYNOPSIS
  Opens the Smart Campus dashboard through a kubectl port-forward.
  Use this when the api-gateway Service has no EXTERNAL-IP (kind-mode Docker Desktop, minikube).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
  powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1 -Port 8080   # if 4000 is busy
#>
param([int]$Port = 4000)

Write-Host "Smart Campus: http://localhost:$Port   (press Ctrl+C to stop)" -ForegroundColor Green
Start-Job -ArgumentList $Port { param($p) Start-Sleep -Seconds 3; Start-Process "http://localhost:$p" } | Out-Null
kubectl.exe -n smart-campus port-forward svc/api-gateway "${Port}:4000"
