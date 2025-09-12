@echo off
:: Batch file to run Python script silently (no terminal window)

:: Path to your Python script
set PY_SCRIPT=run_all.py

:: Use Windows Script Host to launch Python silently
:: This hides the console window completely
start "" wscript //B //E:vbscript "%~dp0invisible_launcher.vbs"
