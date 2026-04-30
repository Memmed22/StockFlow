# StockFlow Local Launcher (PowerShell)
# Run with: Right-click -> "Run with PowerShell"
# Or in a terminal: powershell -ExecutionPolicy Bypass -File start.ps1

$root = $PSScriptRoot

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "       StockFlow - Local Launcher"           -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""

# --- Prerequisite checks ---

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] .NET 8 SDK not found." -ForegroundColor Red
    Write-Host "  Install from: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
    Read-Host "`n  Press Enter to exit"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] Node.js not found." -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org  (LTS version recommended)" -ForegroundColor Yellow
    Read-Host "`n  Press Enter to exit"
    exit 1
}

Write-Host "  Prerequisites:  .NET OK  /  Node.js OK" -ForegroundColor Green
Write-Host ""

# --- Install frontend dependencies if needed ---

$webPath = Join-Path $root "StockFlow.Web"
$apiPath = Join-Path $root "StockFlow.API"

if (-not (Test-Path (Join-Path $webPath "node_modules"))) {
    Write-Host "  [1/3] Installing frontend dependencies (first run only)..." -ForegroundColor Yellow
    Push-Location $webPath
    npm install
    Pop-Location
    Write-Host ""
} else {
    Write-Host "  [1/3] Frontend dependencies are ready." -ForegroundColor Green
}

# --- Start API ---

Write-Host "  [2/3] Starting API server  (http://localhost:5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "& { `$Host.UI.RawUI.WindowTitle = 'StockFlow - API'; Set-Location '$apiPath'; dotnet run }"
)

Start-Sleep -Seconds 5

# --- Start frontend ---

Write-Host "  [3/3] Starting frontend    (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "& { `$Host.UI.RawUI.WindowTitle = 'StockFlow - Web'; Set-Location '$webPath'; npm run dev }"
)

Start-Sleep -Seconds 4

# --- Open browser ---

Write-Host ""
Write-Host "  Opening http://localhost:5173 in your browser..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   StockFlow is running!"                    -ForegroundColor Green
Write-Host ""
Write-Host "   Web app : http://localhost:5173"          -ForegroundColor White
Write-Host "   API     : http://localhost:5000"          -ForegroundColor White
Write-Host ""
Write-Host "   Default login:"                           -ForegroundColor White
Write-Host "     Username : admin"                       -ForegroundColor Gray
Write-Host "     Password : admin123"                    -ForegroundColor Gray
Write-Host ""
Write-Host "   To stop: close the two server windows"    -ForegroundColor White
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Read-Host "  Press Enter to close this launcher"
