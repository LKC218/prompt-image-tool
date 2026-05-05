@echo off
chcp 65001 >nul
title 生图提示词管理器

echo ╔══════════════════════════════════════════╗
echo ║     生图提示词管理器 - 快捷启动           ║
echo ╚══════════════════════════════════════════╝
echo.

echo 请选择启动模式：
echo   1. 浏览器模式（前端 + Python 后端）
echo   2. 桌面端模式（Tauri 开发窗口）
echo   3. 仅 Python 后端
echo.
set /p mode=请输入选项 (1-3): 

if "%mode%"=="1" goto browser_mode
if "%mode%"=="2" goto tauri_mode
if "%mode%"=="3" goto backend_only
echo 无效选项，退出
goto end

:browser_mode
echo.
echo [1/2] 启动 Python 后端...
start /b python python\main.py
echo [2/2] 启动前端开发服务器...
echo.
echo ✅ 启动完成！
echo    前端：http://localhost:5173
echo    后端：http://localhost:8888
echo.
echo 浏览器将自动打开，关闭此窗口可停止服务
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173
call npx vite --host
goto end

:tauri_mode
echo.
echo 启动 Tauri 桌面端开发模式...
echo Python 后端将由 Tauri 自动启动
echo.
call npx tauri dev
goto end

:backend_only
echo.
echo 启动 Python 后端...
echo 后端地址：http://localhost:8888
echo.
call python python\main.py
goto end

:end
