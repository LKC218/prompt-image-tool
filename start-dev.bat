@echo off
chcp 65001 >nul 2>&1
title 生图提示词管理器 - 开发服务器

echo ============================================
echo   生图提示词管理器 - 一键启动
echo ============================================
echo.

set PYTHON_EXE=C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe
set PROJECT_DIR=%~dp0
set PYTHON_DIR=%PROJECT_DIR%python
set MAX_WAIT=15

echo [1/4] 检查 Python ...
if not exist "%PYTHON_EXE%" (
    echo [错误] 未找到 Python: %PYTHON_EXE%
    echo 请修改脚本中 PYTHON_EXE 变量为你的 Python 路径
    pause
    exit /b 1
)
"%PYTHON_EXE%" --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Python 无法运行
    pause
    exit /b 1
)
echo       Python OK

echo.
echo [2/4] 检查 Node.js ...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装
    pause
    exit /b 1
)
echo       Node.js OK

echo.
echo [3/4] 启动 Python 后端 (端口 8888) ...
start /b "" "%PYTHON_EXE%" "%PYTHON_DIR%\main.py" >nul 2>&1

set WAITED=0
:wait_backend
if %WAITED% geq %MAX_WAIT% (
    echo [错误] Python 后端启动超时
    pause
    exit /b 1
)
"%PYTHON_EXE%" -c "import urllib.request; urllib.request.urlopen('http://localhost:8888/api/health')" >nul 2>&1
if not errorlevel 1 (
    echo       后端已就绪 http://localhost:8888
    goto backend_ok
)
timeout /t 1 /nobreak >nul
set /a WAITED+=1
goto wait_backend

:backend_ok
echo.
echo [4/4] 启动 Vite 开发服务器 ...
cd /d "%PROJECT_DIR%"
call npx vite --host 0.0.0.0 --port 5173 --open "/?mobile"

echo.
echo 服务已停止
pause
