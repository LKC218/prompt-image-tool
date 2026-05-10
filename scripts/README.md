# 工具脚本说明

本目录存放不属于运行时源码的一次性或专项维护脚本。

## 脚本清单

- `compress_icon.py`：压缩 `src/assets/icons/图标.svg` 内嵌的 PNG 数据。会直接改写图标文件，运行前应确认当前工作区状态。
- `patch-java-version.ps1`：将 Capacitor 相关 Gradle 配置中的 Java 版本从 21 修补为 17。该脚本会修改 `android` 和 `node_modules` 下的 Gradle 文件，仅在 Android 构建遇到 Java 版本兼容问题时使用。
- `build_pc_package.py`：非交互式 PC 独立安装包构建入口，按 `Vite -> PyInstaller -> NSIS -> releases` 顺序执行，并在每一步校验关键产物。

## 使用原则

- 从项目根目录运行脚本。
- 运行前先检查 `git status`。
- 有副作用的脚本不要接入自动流程，除非已确认构建链确实依赖它。

## PC 快速打包

```powershell
python scripts\build_pc_package.py
```

只生成 PyInstaller 可执行目录、不生成 NSIS 安装包时使用：

```powershell
python scripts\build_pc_package.py --skip-nsis
```
