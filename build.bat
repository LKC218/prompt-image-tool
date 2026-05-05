@echo off
chcp 65001 >nul
title 生图提示词管理器 - 构建

echo ╔══════════════════════════════════════════╗
echo ║     生图提示词管理器 v2.3.1 构建脚本        ║
echo ╚══════════════════════════════════════════╝
echo.

:menu
echo 请选择构建目标：
echo   1. 构建 PC 安装包（PyInstaller + NSIS）
echo   2. 构建 PC 桌面端（Tauri）
echo   3. 构建 Android 端（Capacitor）
echo   4. 仅构建前端（Vite）
echo   5. 开发模式（前端 + Python 后端）
echo   6. 退出
echo.
set /p choice=请输入选项 (1-6): 

if "%choice%"=="1" goto build_pc
if "%choice%"=="2" goto build_tauri
if "%choice%"=="3" goto build_android
if "%choice%"=="4" goto build_frontend
if "%choice%"=="5" goto dev_mode
if "%choice%"=="6" goto end
echo 无效选项
goto menu

:build_pc
echo.
echo ══════════════════════════════════════════
echo   构建 PC 安装包（PyInstaller + NSIS）
echo ══════════════════════════════════════════
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Python，请先安装 Python 3.9+
    goto menu
)

where pip >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 pip
    goto menu
)

echo [1/4] 检查/安装 PyInstaller...
pip show pyinstaller >nul 2>nul
if %errorlevel% neq 0 (
    echo 正在安装 PyInstaller...
    pip install pyinstaller
    if %errorlevel% neq 0 (
        echo ❌ PyInstaller 安装失败
        goto menu
    )
)
echo ✅ PyInstaller 已就绪

echo [2/4] 构建前端（Vite）...
call npx vite build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    goto menu
)
echo ✅ 前端构建完成

echo [3/4] 构建 PyInstaller 可执行文件...
python -m PyInstaller build\app.spec --workpath build\build --distpath build\dist --clean -y
if %errorlevel% neq 0 (
    echo ❌ PyInstaller 构建失败
    goto menu
)
echo ✅ PyInstaller 构建完成

if not exist build\dist\PromptImageManager\_internal\frontend (
    echo ⚠️ 警告：前端文件未包含在构建输出中
    echo 检查 dist/ 目录是否存在前端文件...
    if exist dist\index.html (
        echo dist/ 目录存在，但 PyInstaller 未正确打包
    ) else (
        echo dist/ 目录不存在，请先运行前端构建
    )
    goto menu
)

echo [4/4] 构建 NSIS 安装包...
where makensis >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ 未找到 makensis，跳过安装包构建
    echo 可执行文件位于：build\dist\PromptImageManager\
    echo 如需构建安装包，请安装 NSIS: https://nsis.sourceforge.io/
    goto menu
)
pushd build
makensis installer.nsi
set NSIS_RESULT=%errorlevel%
popd
if %NSIS_RESULT% neq 0 (
    echo ❌ NSIS 安装包构建失败
    goto menu
)
echo.
echo ✅ PC 安装包构建完成！
echo 安装包：build\PromptImageManager-Setup-2.3.0.exe
echo.
goto menu

:build_tauri
echo.
echo ══════════════════════════════════════════
echo   构建 PC 桌面端（Tauri）
echo ══════════════════════════════════════════
echo.

where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Rust/Cargo，请先安装 Rust: https://rustup.rs/
    goto menu
)

echo [1/2] 构建前端 + Tauri 桌面端...
call npx tauri build
if %errorlevel% neq 0 (
    echo ❌ Tauri 构建失败
    goto menu
)
echo.
echo ✅ PC 桌面端构建完成！
echo 输出目录：src-tauri\target\release\bundle\
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
powershell -ExecutionPolicy Bypass -File patch-java-version.ps1
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
