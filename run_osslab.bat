@echo off
title OSS Lab - Complete Prototype Launcher
echo.
echo =========================================
echo    OSS LAB - AI Research Assistant
echo =========================================
echo.
echo Starting all components...
echo.

REM Set color for better visibility
color 0A

REM Start SearXNG Search Engine (Port 8888)
echo [1/3] Starting SearXNG Search Engine...
start "SearXNG - Search Engine" cmd /k "cd /d "%~dp0searxng-master" && venv\Scripts\activate.bat && set FLASK_APP=searx.webapp && echo SearXNG Starting... && flask run --host=127.0.0.1 --port=8888"

REM Wait 3 seconds between starts
timeout /t 3 /nobreak >nul

REM Start Python Backend (Port 8000)
echo [2/3] Starting Python Backend...
start "OSS Lab - Backend API" cmd /k "cd /d "%~dp0python-agents" && echo Backend Starting... && uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level debug"

REM Wait 3 seconds between starts
timeout /t 3 /nobreak >nul

REM Start Frontend UI (Port 3000)
echo [3/3] Starting Frontend UI...
start "OSS Lab - Frontend UI" cmd /k "cd /d "%~dp0OSS_UI" && echo Frontend Starting... && npm run dev"

echo.
echo =========================================
echo All components are starting!
echo.
echo Services:
echo   - SearXNG:  http://127.0.0.1:8888
echo   - Backend:  http://127.0.0.1:8000
echo   - Frontend: http://localhost:3000
echo.
echo Press any key to open the application...
echo =========================================
pause >nul

REM Open the application in default browser
start http://localhost:3000

echo.
echo OSS Lab is now running!
echo Close this window or press Ctrl+C to stop the launcher.
echo (Individual services will continue running in their own windows)
echo.
pause
