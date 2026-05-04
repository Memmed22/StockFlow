#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLISH_DIR="$SCRIPT_DIR/publish"
WEB_DIR="$SCRIPT_DIR/StockFlow.Web"
API_DIR="$SCRIPT_DIR/StockFlow.API"

echo ""
echo "  =========================================="
echo "       StockFlow - Build & Publish"
echo "  =========================================="
echo ""

# --- Prerequisites ---
if ! command -v dotnet &>/dev/null; then
  echo "  [ERROR] .NET SDK not found."
  echo "  Install: https://dotnet.microsoft.com/download/dotnet/8.0"
  exit 1
fi
if ! command -v node &>/dev/null; then
  echo "  [ERROR] Node.js not found."
  echo "  Install: https://nodejs.org"
  exit 1
fi

# --- Clean previous output ---
echo "  [1/4] Cleaning previous publish folder..."
rm -rf "$PUBLISH_DIR"

# --- Build React frontend ---
echo "  [2/4] Building React frontend..."
cd "$WEB_DIR"
npm install --silent
npm run build

# --- Copy build into wwwroot ---
echo "  [3/4] Copying frontend to wwwroot..."
rm -rf "$API_DIR/wwwroot"
cp -r "$WEB_DIR/dist" "$API_DIR/wwwroot"

# --- Publish .NET backend (cross-compile for Windows x64) ---
echo "  [4/4] Publishing backend (Windows x64 self-contained)..."
cd "$API_DIR"
dotnet publish -c Release -r win-x64 --self-contained true \
  -o "$PUBLISH_DIR" \
  /p:DebugType=None \
  /p:DebugSymbols=false

# --- Write start.bat into the publish folder ---
echo "  Writing start.bat..."
cat > "$PUBLISH_DIR/start.bat" << 'EOF'
@echo off
title StockFlow
echo.
echo  Starting StockFlow...
echo  This window must stay open while the app is running.
echo.
start "" "StockFlow.API.exe"
timeout /t 2 >nul
start "" "http://localhost:5000"
echo  App is running at http://localhost:5000
echo  Close this window to stop the server.
echo  Database is stored in the data\ folder - do not delete it.
echo.
pause
EOF

# --- Write update.bat into the publish folder ---
echo "  Writing update.bat..."
cat > "$PUBLISH_DIR/update.bat" << 'EOF'
@echo off
title StockFlow Updater
echo.
echo  ==========================================
echo       StockFlow - Update Installer
echo  ==========================================
echo.
echo  This will copy the new version over your existing
echo  installation. Your database (data\ folder) will
echo  NOT be touched.
echo.
echo  IMPORTANT: Close StockFlow before continuing!
echo.
set /p "DEST=Enter the full path to your existing StockFlow folder: "
if not exist "%DEST%" (
    echo [ERROR] Folder not found: %DEST%
    pause & exit /b 1
)
echo.
echo  Copying new files to: %DEST%
echo  Skipping: data\
echo.
robocopy "%~dp0" "%DEST%" /e /xd data /xf update.bat /njh /njs
echo.
echo  ==========================================
echo   Update complete!
echo   Run %DEST%\start.bat to launch StockFlow.
echo  ==========================================
echo.
pause
EOF

echo ""
echo "  =========================================="
echo "   Publish complete!"
echo ""
echo "   Output folder : publish/"
echo "   First install : copy publish/ to Windows PC, run start.bat"
echo "   Update        : run publish/update.bat on the Windows PC"
echo ""
echo "   Database is stored in data/ and survives updates."
echo ""
echo "   Default login:"
echo "     Username : admin"
echo "     Password : admin123"
echo "  =========================================="
echo ""
