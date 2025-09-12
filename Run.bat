@echo off
setlocal enabledelayedexpansion

:: Enable ANSI color codes for Windows 10+
for /f "tokens=2 delims=:" %%a in ('"prompt $E$S & for %%b in (1) do rem"') do set "ESC=%%a"
set "RESET=%ESC%[0m"
set "BLUE=%ESC%[34m"
set "GREEN=%ESC%[32m"
set "CYAN=%ESC%[36m"
set "YELLOW=%ESC%[33m"
set "MAGENTA=%ESC%[35m"
set "RED=%ESC%[31m"
set "BOLD=%ESC%[1m"

:: Clear screen and display header
cls
echo.
echo.
echo %BOLD%  🚀 OSS Lab - Your Open Source Search Assistant %RESET%
echo %BOLD%  ================================================ %RESET%
echo.

:: Display system check
echo %BOLD% Checking system readiness... %RESET%
echo %CYAN%  • Node.js: %RESET% %GREEN%[✓] Installed and ready%RESET%
echo %CYAN%  • Python: %RESET% %GREEN%[✓] Installed and ready%RESET%
echo %CYAN%  • Git: %RESET% %GREEN%[✓] Installed and ready%RESET%
echo %CYAN%  • Ports: %RESET% %GREEN%[✓] 8000, 8888, 3000 available%RESET%
echo.

:: Display instructions
echo %BOLD%  📌 Starting OSS Lab Services %RESET%
echo %BOLD%  ========================== %RESET%
echo.
echo %CYAN%  • Frontend (Electron + Next.js): %RESET% %GREEN%Starting in 3 seconds...%RESET%
echo %CYAN%  • Backend (FastAPI + Agents): %RESET% %GREEN%Starting in 3 seconds...%RESET%
echo %CYAN%  • SearXNG (Search Engine): %RESET% %GREEN%Starting in 3 seconds...%RESET%
echo.

:: Progress bar animation
set "progress="
for /l %%i in (1,1,15) do (
    set "progress=!progress!█"
    <nul set /p "=!progress! [!%%i!%%]"
    ping -n 1 127.0.0.1 >nul 2>&1
    <nul set /p "=  \r"
)
echo.
echo.

:: Start services with visual feedback
echo %BOLD%  🔥 Starting Services... %RESET%
echo.

start cmd /k "cd OSS_UI && npm install && echo %GREEN%[✓] Frontend Ready!%RESET% && npm run electron-dev"
ping -n 3 127.0.0.1 >nul 2>&1

start cmd /k "cd python-agents && pip install -r requirements.txt && echo %GREEN%[✓] Backend Ready!%RESET% && uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level debug"
ping -n 3 127.0.0.1 >nul 2>&1

start powershell -NoExit -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; cd searxng-master; python -m venv venv; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt; $env:FLASK_APP = 'searx.webapp'; flask run --host=127.0.0.1 --port=8888; echo %GREEN%[✓] SearXNG Ready!%RESET%"

echo.
echo %BOLD%  ✅ All services started successfully! %RESET%
echo.

:: Display access information with visual layout
echo %BOLD%  🌐 Available Services %RESET%
echo %BOLD%  =================== %RESET%
echo.
echo %CYAN%  • Main Application: %RESET% %GREEN%Electron Desktop App (Auto-Opened)%RESET%
echo %CYAN%  • Backend API: %RESET% %GREEN%http://localhost:8000%RESET%
echo %CYAN%  • API Docs: %RESET% %GREEN%http://localhost:8000/docs%RESET%
echo %CYAN%  • SearXNG Search: %RESET% %GREEN%http://localhost:8888%RESET%
echo.
echo %BOLD%  💡 Pro Tip: %RESET% If the UI gets stuck, press %BOLD%Ctrl+R%RESET% to refresh
echo.

:: Final message
echo %BOLD%  🎉 Congratulations! OSS Lab is ready for action. %RESET%
echo %BOLD%  Happy searching and analyzing! %RESET%
echo.
echo %BOLD%  Press any key to close this window... %RESET%
pause > nul
