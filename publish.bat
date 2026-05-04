@echo off
title StockFlow Publisher
echo.
echo  ==========================================
echo       StockFlow - Build ^& Publish
echo  ==========================================
echo.

:: Check prerequisites
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET 8 SDK not found.
    echo  Download: https://dotnet.microsoft.com/download/dotnet/8.0
    pause & exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo  Download: https://nodejs.org
    pause & exit /b 1
)

:: Clean previous publish output
if exist "%~dp0publish" (
    echo [1/4] Cleaning previous publish folder...
    rmdir /s /q "%~dp0publish"
)

:: Build React frontend
echo [2/4] Building React frontend...
pushd "%~dp0StockFlow.Web"
call npm install --silent
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    popd & pause & exit /b 1
)
popd

:: Copy frontend build into wwwroot
echo [3/4] Copying frontend to wwwroot...
if exist "%~dp0StockFlow.API\wwwroot" rmdir /s /q "%~dp0StockFlow.API\wwwroot"
xcopy /e /i /y "%~dp0StockFlow.Web\dist" "%~dp0StockFlow.API\wwwroot" >nul

:: Publish .NET backend (self-contained Windows x64 exe)
echo [4/4] Publishing backend (self-contained Windows x64)...
pushd "%~dp0StockFlow.API"
dotnet publish -c Release -r win-x64 --self-contained true -o "%~dp0publish" /p:DebugType=None /p:DebugSymbols=false
if errorlevel 1 (
    echo [ERROR] Backend publish failed.
    popd & pause & exit /b 1
)
popd

:: Write start.bat into the publish folder
echo.
echo Writing start.bat into publish folder...
(
    echo @echo off
    echo title StockFlow
    echo echo.
    echo echo  Starting StockFlow...
    echo echo  This window must stay open while the app is running.
    echo echo.
    echo start "" "StockFlow.API.exe"
    echo timeout /t 2 ^>nul
    echo start "" "http://localhost:5000"
    echo echo  App is running at http://localhost:5000
    echo echo  Close this window to stop the server.
    echo echo  Database is stored in the data\ folder - do not delete it.
    echo echo.
    echo pause
) > "%~dp0publish\start.bat"

:: Write update.bat into the publish folder
echo Writing update.bat into publish folder...
(
    echo @echo off
    echo title StockFlow Updater
    echo echo.
    echo echo  ==========================================
    echo echo       StockFlow - Update Installer
    echo echo  ==========================================
    echo echo.
    echo echo  This will copy the new version over your existing
    echo echo  installation. Your database ^(data\ folder^) will
    echo echo  NOT be touched.
    echo echo.
    echo echo  IMPORTANT: Close StockFlow before continuing^^!
    echo echo.
    echo set /p "DEST=Enter the full path to your existing StockFlow folder: "
    echo if not exist "%%DEST%%" ^(
    echo     echo [ERROR] Folder not found: %%DEST%%
    echo     pause ^& exit /b 1
    echo ^)
    echo echo.
    echo echo  Copying new files to: %%DEST%%
    echo echo  Skipping: data\
    echo echo.
    echo robocopy "%%~dp0" "%%DEST%%" /e /xd data /xf update.bat /njh /njs
    echo echo.
    echo echo  ==========================================
    echo echo   Update complete^^!
    echo echo   Run %%DEST%%\start.bat to launch StockFlow.
    echo echo  ==========================================
    echo echo.
    echo pause
) > "%~dp0publish\update.bat"

echo.
echo  ==========================================
echo   Publish complete!
echo.
echo   Output folder : publish\
echo   First install : copy publish\ to target PC, run start.bat
echo   Update        : run publish\update.bat on the target PC
echo.
echo   Database is stored in data\ and survives updates.
echo.
echo   Default login:
echo     Username : admin
echo     Password : admin123
echo  ==========================================
echo.
pause
