# 工具脚本说明

本目录存放不属于运行时源码的一次性或专项维护脚本。

## 脚本清单

- `compress_icon.py`：压缩 `src/assets/icons/图标.svg` 内嵌的 PNG 数据。会直接改写图标文件，运行前应确认当前工作区状态。
- `patch-java-version.ps1`：将 Capacitor 相关 Gradle 配置中的 Java 版本从 21 修补为 17。该脚本会修改 `android` 和 `node_modules` 下的 Gradle 文件，仅在 Android 构建遇到 Java 版本兼容问题时使用。
- `start_dev_server.py`：本地开发服务器启动入口，优先复用现有 `5173/8888` 服务，缺失时启动 Python 后端与 Vite 前端，并验证 PC / 移动端预览地址。
- `一键启动-服务器和网页.bat`：Windows 双击入口，直接调用 `scripts/start_dev_server.py --pc-only`，一键启动后端和前端并打开 PC 预览页。
- `build_pc_package.py`：非交互式 PC 独立安装包构建入口，按 `Vite -> PyInstaller -> NSIS -> releases` 顺序执行，并在每一步校验关键产物。
- `build_installer_shell_package.py`：Tauri 安装器壳发布产物构建入口，可将现有 NSIS 安装核心嵌入自定义安装器壳，并输出到 `releases/`。
- `build_android_package.py`：非交互式 Android 安装包构建入口，按 `Vite -> Capacitor sync -> Java 版本修补 -> Gradle assembleRelease -> releases` 顺序执行，并校验版本、签名配置和 APK 产物。
- `build_release_packages.py`：发布包总构建入口，可构建 PC、Android 或全部安装包。

## 使用原则

- 从项目根目录运行脚本。
- 运行前先检查 `git status`。
- 有副作用的脚本不要接入自动流程，除非已确认构建链确实依赖它。

## 本地开发服务器

从项目根目录运行：

```powershell
python scripts\start_dev_server.py
```

Windows 双击入口：

```powershell
一键启动-服务器和网页.bat
```

只检查现有服务是否可用：

```powershell
python scripts\start_dev_server.py --check-only
```

## PC 快速打包

```powershell
python scripts\build_pc_package.py
```

只生成 PyInstaller 可执行目录、不生成 NSIS 安装包时使用：

```powershell
python scripts\build_pc_package.py --skip-nsis
```

## Tauri 安装器壳打包

默认会先构建标准 PC 安装核心，再生成双击后显示自定义安装器壳 UI 的发布产物：

```powershell
python scripts\build_installer_shell_package.py
```

只复用已有 `build\PromptImageManager-Setup-{version}.exe` 时使用：

```powershell
python scripts\build_installer_shell_package.py --skip-pc-build
```

## Android 快速打包

```powershell
python scripts\build_android_package.py
```

仅在临时验证时允许导出未签名 APK：

```powershell
python scripts\build_android_package.py --allow-unsigned
```

## 发布包总入口

默认构建 PC 与 Android 两类安装包：

```powershell
python scripts\build_release_packages.py
```

只构建单端：

```powershell
python scripts\build_release_packages.py --pc
python scripts\build_release_packages.py --android
```
