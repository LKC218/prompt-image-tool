@echo off
chcp 65001 >nul 2>&1
title 提示词管家 - 开发服务器

set PROJECT_DIR=%~dp0

where python >nul 2>&1
if errorlevel 1 (
    echo  [错误] 未找到 Python，请安装后重试
    pause
    exit /b 1
)

echo.
cd /d "%PROJECT_DIR%"
python "%PROJECT_DIR%scripts\start_dev_server.py" %*

pause
