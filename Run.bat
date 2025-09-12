@echo off
echo Starting OSS_Lab setup... Make sure you're running it inside the OSS_Lab folder and if your app gets stuck in UI window click Ctrl+R for refresh (that will fix the problem)
echo.

REM Start Frontend (Electron + Next.js) in new terminal
start cmd /k "cd OSS_UI && npm install && npm run electron-dev"

REM Start Backend (FastAPI + Agents) in new terminal
start cmd /k "cd python-agents && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level debug"

REM Start SearXNG (Search Engine) in PowerShell terminal
start powershell -NoExit -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; cd searxng-master; python -m venv venv; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt; $env:FLASK_APP = 'searx.webapp'; flask run --host=127.0.0.1 --port=8888"

echo Setup complete! Three terminals have been launched:
echo - Frontend (Electron) in first terminal
echo - Backend (FastAPI) in second terminal
echo - SearXNG Search Engine in PowerShell terminal
echo.
echo Press any key to close this window...
pause > nul
