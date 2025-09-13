@echo off
:: ================================================
:: run.bat - Launch OSS_LABS (Simple Version)
:: ================================================

echo.
echo Checking for required tools...
where python >nul
if %errorlevel% neq 0 (
    echo ❌ Python not found. Please install Python from https://python.org
    pause
    exit /b 1
)

where node >nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Python and Node.js detected. Starting OSS_LABS...
echo.

python run_all.py

pause
