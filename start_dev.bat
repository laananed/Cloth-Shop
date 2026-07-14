@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_dev.ps1"
if errorlevel 1 (
    echo Startup failed. Check the error messages above.
    pause
)
