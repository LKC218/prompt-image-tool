@echo off
chcp 65001 >nul 2>&1
title 提示词管家 - 开发服务器

echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║       提示词管家 - 一键启动               ║
echo  ╚═══════════════════════════════════════════╝
echo.

set PROJECT_DIR=%~dp0
set MAX_WAIT=20
set BACKEND_PID=

where python >nul 2>&1
if errorlevel 1 (
    echo  [错误] 未找到 Python，请安装后重试
    pause
    exit /b 1
)
echo  [OK] Python 已就绪

where node >nul 2>&1
if errorlevel 1 (
    echo  [错误] 未找到 Node.js，请安装后重试
    pause
    exit /b 1
)
echo  [OK] Node.js 已就绪

echo.
echo  [1/3] 启动 Python 后端 (端口 8888) ...
start /b "" python "%PROJECT_DIR%python\main.py" 2>nul

set WAITED=0
:wait_backend
if %WAITED% geq %MAX_WAIT% (
    echo  [错误] 后端启动超时，请检查端口 8888 是否被占用
    pause
    exit /b 1
)
python -c "import urllib.request; urllib.request.urlopen('http://localhost:8888/api/health')" >nul 2>&1
if not errorlevel 1 (
    echo  [OK] 后端已就绪  http://localhost:8888
    goto backend_ok
)
timeout /t 1 /nobreak >nul
set /a WAITED+=1
goto wait_backend

:backend_ok
echo.
echo  [2/3] 启动 Vite 前端 (端口 5173) ...
echo.
echo  ────────────────────────────────────────────
echo   PC  端:  http://localhost:5173
echo   移动端:  http://localhost:5173/?ui=mobile
echo  ────────────────────────────────────────────
echo.
echo  按 Ctrl+C 停止所有服务
echo.

echo  [3/3] 打开浏览器 ...
start "" "http://localhost:5173"
timeout /t 1 /nobreak >nul
start "" "http://localhost:5173/?ui=mobile"

cd /d "%PROJECT_DIR%"
call npx vite --host 0.0.0.0 --port 5173

echo.
echo  服务已停止
pause
