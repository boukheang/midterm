<#
.SYNOPSIS
  Installs the official Kubernetes Dashboard, copies a login token to the clipboard
  and opens it at https://localhost:8443.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\dashboard.ps1
#>
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Invoke-Native {
    param([string]$Description, [scriptblock]$Command)
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit code $LASTEXITCODE)" }
}

Write-Host '==> Installing Kubernetes Dashboard v2.7.0' -ForegroundColor Cyan
Invoke-Native 'dashboard' { kubectl.exe apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml }
Invoke-Native 'dashboard admin' { kubectl.exe apply -f k8s/dashboard/dashboard-admin.yaml }
Invoke-Native 'dashboard rollout' { kubectl.exe -n kubernetes-dashboard rollout status deployment/kubernetes-dashboard --timeout=180s }

# Wait for Kubernetes to fill in the token.
$token = ''
for ($i = 0; $i -lt 20 -and -not $token; $i++) {
    $encoded = kubectl.exe -n kubernetes-dashboard get secret dashboard-admin-token -o jsonpath='{.data.token}'
    if ($encoded) { $token = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)) }
    else { Start-Sleep -Seconds 1 }
}
if (-not $token) { throw 'Could not read the dashboard login token.' }

Set-Clipboard -Value $token
Write-Host ''
Write-Host 'Login token copied to the clipboard.' -ForegroundColor Green
Write-Host '1. Your browser opens https://localhost:8443 (accept the self-signed certificate warning).'
Write-Host '2. Choose "Token", paste (Ctrl+V), Sign in.'
Write-Host '3. Pick namespace "smart-campus" in the top-left dropdown.'
Write-Host 'Press Ctrl+C here to stop the dashboard tunnel.'
Write-Host ''

Start-Job { Start-Sleep -Seconds 3; Start-Process 'https://localhost:8443' } | Out-Null
kubectl.exe -n kubernetes-dashboard port-forward svc/kubernetes-dashboard 8443:443
