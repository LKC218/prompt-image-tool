# 构建方案索引

本目录存放项目构建、安装包和平台打包方案。

## 文档清单

- [PC端安装包构建方案](./PC端安装包构建方案.md)：PC 端 PyInstaller + NSIS 完整构建方案，包含架构、环境、产物和常见问题。
- [PC独立安装包快速打包流程](./PC独立安装包快速打包流程.md)：面向日常发版的非交互式快速打包流程，对应 `scripts/build_pc_package.py`。
- [PC端构建流程](./PC端构建流程.md)：PC 端构建、调试和产物检查流程。
- [Android安装包构建方案](./Android安装包构建方案.md)：Android 端 Capacitor + Gradle 构建方案。

## 常用命令

PC 独立安装包：

```powershell
python scripts\build_pc_package.py
```

仅生成 PC 可执行目录：

```powershell
python scripts\build_pc_package.py --skip-nsis
```

Android 安装包仍按 Android 构建方案执行。

Android 安装包：

```powershell
python scripts\build_android_package.py
```

PC 与 Android 发布包总入口：

```powershell
python scripts\build_release_packages.py
```
