#!/usr/bin/env pwsh
# CodeLens AI - Quick Start Script
# Usage: .\scripts\start.ps1

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         CodeLens AI - Starting...        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$demoProject = Join-Path $root "demo-project"

# Install backend deps
Write-Host "`n[1/4] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location $backend
pip install -r requirements.txt --quiet

# Install demo-project deps  
Write-Host "[2/4] Installing demo-project dependencies..." -ForegroundColor Yellow
Set-Location $demoProject
pip install -r requirements.txt --quiet

# Install frontend deps
Write-Host "[3/4] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location $frontend
npm install --silent

# Start servers
Write-Host "[4/4] Starting servers..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backend'; Write-Host 'CodeLens Backend - http://localhost:8000' -ForegroundColor Cyan; python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontend'; Write-Host 'CodeLens Frontend - http://localhost:5173' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal

Write-Host "`n✅ CodeLens AI is starting!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "`nPress any key to open the browser..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "http://localhost:5173"
