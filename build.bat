@echo off
chcp 65001 >nul
title 生图提示词管理器 - 构建

echo ╔══════════════════════════════════════════╗
echo ║     生图提示词管理器 · Tauri 主路径构建脚本   ║
echo ╚══════════════════════════════════════════╝
echo.

:menu
echo 请选择构建目标：
echo   1. 构建 PC 安装包（Tauri + Python Sidecar）★唯一正式发包路径
echo   2. 构建 Android 端（Capacitor）
echo   3. 仅构建前端（Vite）
echo   4. 开发模式（前端 + Python 后端）
echo   5. 退出
echo.
set /p choice=请输入选项 (1-5):

if "%choice%"=="1" goto build_tauri
if "%choice%"=="2" goto build_android
if "%choice%"=="3" goto build_frontend
if "%choice%"=="4" goto dev_mode
if "%choice%"=="5" goto end
echo 无效选项
goto menu

:build_tauri
echo.
echo ══════════════════════════════════════════
echo   构建 PC 安装包（Tauri + Python Sidecar）
echo ══════════════════════════════════════════
echo.

where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Rust/Cargo，请先安装 Rust: https://rustup.rs/
    goto menu
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Python（打包 Sidecar 需要）
    goto menu
)

echo [1/4] 构建前端（Vite）...
call npx vite build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    goto menu
)
echo ✅ 前端构建完成

echo [2/4] 构建 Python Sidecar（无头后端）...
python -m PyInstaller build\server.spec --workpath build\build-server --distpath build\dist-server --clean -y
if %errorlevel% neq 0 (
    echo ❌ Sidecar 构建失败
    goto menu
)
echo ✅ Sidecar 构建完成

echo [3/4] 拷贝 Sidecar 到 Tauri 资源目录...
if not exist src-tauri\server mkdir src-tauri\server
copy /Y build\dist-server\PromptImageManager-Server.exe src-tauri\server\PromptImageManager-Server.exe >nul
if %errorlevel% neq 0 (
    echo ❌ Sidecar 拷贝失败
    goto menu
)
echo ✅ Sidecar 已就位：src-tauri\server\PromptImageManager-Server.exe

echo [4/4] 构建 Tauri 桌面端 + NSIS...
call npx tauri build
if %errorlevel% neq 0 (
    echo ❌ Tauri 构建失败
    goto menu
)
echo.
echo ✅ PC 安装包构建完成！
echo 输出目录：src-tauri\target\release\bundle\nsis\
if not exist releases mkdir releases
rem 规范发布名：PromptImageManager-Setup-<package.json version>.exe（用 Python 读 version，避免 cmd 引号坑）
for /f "usebackq delims=" %%V in (`python -c "import json;print(json.load(open('package.json',encoding='utf-8'))['version'])"`) do set VER=%%V
if not defined VER (
    echo ❌ 无法从 package.json 读取 version
    goto menu
)
set SETUPNAME=PromptImageManager-Setup-%VER%.exe
set FOUND=
for %%F in ("src-tauri\target\release\bundle\nsis\*.exe") do (
    if not defined FOUND (
        copy /Y "%%F" "releases\%SETUPNAME%" >nul
        set FOUND=1
        echo 发布副本：releases\%SETUPNAME%（源：%%~nxF）
    )
)
if not defined FOUND (
    echo ❌ 未找到 Tauri NSIS 安装包
)
echo 规范见 docs\构建方案\PC发包规范-Tauri主路径.md
echo.
goto menu

:build_android
echo.
echo ══════════════════════════════════════════
echo   构建 Android 端（Capacitor）
echo ══════════════════════════════════════════
echo.

echo [1/5] 构建前端...
call npx vite build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    goto menu
)
echo ✅ 前端构建完成

echo [2/5] 同步到 Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ❌ Capacitor 同步失败
    goto menu
)
echo ✅ Capacitor 同步完成

echo [3/5] 修补 Java 版本兼容性...
powershell -ExecutionPolicy Bypass -File scripts\patch-java-version.ps1
echo ✅ Java 版本修补完成

echo [4/5] 构建 Release APK...
cd android
call gradlew assembleRelease
cd ..
if %errorlevel% neq 0 (
    echo ❌ APK 构建失败
    echo 提示：请确保已安装 JDK 17+ 并设置 JAVA_HOME
    goto menu
)
echo ✅ APK 构建完成

echo [5/5] 验证 APK...
if exist android\app\build\outputs\apk\release\app-release.apk (
    echo.
    echo ✅ Android APK 构建完成！
    echo 输出：android\app\build\outputs\apk\release\app-release.apk
    for %%A in (android\app\build\outputs\apk\release\app-release.apk) do echo 大小：%%~zA 字节
) else if exist android\app\build\outputs\apk\release\app-release-unsigned.apk (
    echo.
    echo ⚠️ APK 已构建但未签名
    echo 输出：android\app\build\outputs\apk\release\app-release-unsigned.apk
    echo 请检查 keystore.properties 配置
) else (
    echo.
    echo ❌ 未找到 APK 输出文件
)
echo.
goto menu

:build_frontend
echo.
echo [1/1] 构建前端...
call npx vite build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    goto menu
)
echo.
echo ✅ 前端构建完成！输出目录：dist/
echo.
goto menu

:dev_mode
echo.
echo 启动开发模式...
echo 前端：http://localhost:5173
echo 后端：http://localhost:8888
echo.
start /b python python\main.py
call npx vite --host
goto menu

:end
echo 再见！
