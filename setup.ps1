<#
setup.ps1 - Helper to check for Node/npm and attempt installation via winget on Windows.

Usage: Run in PowerShell from the project root:
  .\setup.ps1

This script will:
- Check for `node` and `npm`.
- If missing and `winget` is available, attempt to install Node.js LTS.
- Print the next commands to install project dependencies and start the app.
#>

function Check-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        Write-Host "Node is installed:" -ForegroundColor Green
        & node -v
        & npm -v
        return $true
    }
    else {
        Write-Host "Node not found." -ForegroundColor Yellow
        return $false
    }
}

if (-not (Check-Node)) {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Attempting to install Node.js LTS with winget..." -ForegroundColor Cyan
        winget install -e --id OpenJS.NodeJS.LTS
        Start-Sleep -Seconds 2
        if (Check-Node) {
            Write-Host "Node installed successfully." -ForegroundColor Green
        }
        else {
            Write-Host "Node installation failed or requires manual steps. Visit https://nodejs.org to install." -ForegroundColor Red
        }
    }
    else {
        Write-Host "winget not found. Please install Node.js manually from https://nodejs.org" -ForegroundColor Red
    }
}

Write-Host "`nNext steps (run these in PowerShell from project root):" -ForegroundColor Cyan
Write-Host "cd \"$PWD\"" -ForegroundColor White
Write-Host "npm install" -ForegroundColor White
Write-Host "npm --prefix client install" -ForegroundColor White
Write-Host "npm run dev" -ForegroundColor White

Write-Host "`nIf you prefer a GUI installer, download Node LTS from https://nodejs.org and re-run this script or the commands above." -ForegroundColor Gray
