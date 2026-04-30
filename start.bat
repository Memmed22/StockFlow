@echo off
title StockFlow Launcher
echo.
echo  ==========================================
echo       StockFlow - Local Launcher
echo  ==========================================
echo.

:: Check for .NET SDK
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET 8 SDK not found.
    echo.
    echo  Download and install it from:
    echo  https://dotnet.microsoft.com/download/dotnet/8.0
    echo.
    pause
    exit /b 1
)

:: Check for Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo.
    echo  Download and install it from:
    echo  https://nodejs.org  (LTS version recommended)
    echo.
    pause
    exit /b 1
)

echo  Prerequisites:  .NET OK  /  Node.js OK
echo.

:: Install frontend dependencies if missing
if not exist "%~dp0StockFlow.Web\node_modules" (
    echo [1/3] Installing frontend dependencies (first run only)...
    pushd "%~dp0StockFlow.Web"
    call npm install
    popd
    echo.
) else (
    echo [1/3] Frontend dependencies are ready.
)

:: Start the API server in a new window
echo [2/3] Starting API server  ^(http://localhost:5000^)...
start "StockFlow - API" cmd /k "cd /d "%~dp0StockFlow.API" && dotnet run"

:: Give the API a few seconds to start
timeout /t 5 /nobreak >nul

:: Start the frontend dev server in a new window
echo [3/3] Starting frontend    ^(http://localhost:5173^)...
start "StockFlow - Web" cmd /k "cd /d "%~dp0StockFlow.Web" && npm run dev"

:: Wait for Vite to be ready, then open browser
timeout /t 4 /nobreak >nul
echo.
echo  Opening http://localhost:5173 in your browser...
start "" "http://localhost:5173"

echo.
echo  ==========================================
echo   StockFlow is running!
echo.
echo   Web app : http://localhost:5173
echo   API     : http://localhost:5000
echo.
echo   Default login:
echo     Username : admin
echo     Password : admin123
echo.
echo   To stop: close the two server windows
echo   (titled "StockFlow - API" and "StockFlow - Web")
echo  ==========================================
echo.
pause
