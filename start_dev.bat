@echo off
setlocal
chcp 65001 >nul

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%"

start "Backend 8050" cmd /k "cd /d ""%BACKEND_DIR%"" && python -m uvicorn app.main:app --reload --port 8050"
start "Frontend 5500" cmd /k "cd /d ""%FRONTEND_DIR%"" && python -m http.server 5500"

echo 后端地址：http://127.0.0.1:8050
echo 前端地址：http://127.0.0.1:5500/index.html
pause
