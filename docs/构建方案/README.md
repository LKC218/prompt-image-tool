# 构建方案索引

## 正式发包（唯一）

- [PC发包规范-Tauri主路径](./PC发包规范-Tauri主路径.md)：**Windows 正式安装包唯一 SOP**（Tauri + Sidecar → `PromptImageManager-Setup-<ver>.exe`）。
- [PC独立安装包快速打包流程](./PC独立安装包快速打包流程.md)：日常速查与 `build_pc_package.py` 参数。

## 架构与开发

- [PC端构建流程](./PC端构建流程.md)：架构说明、环境准备、开发模式。
- [Android安装包构建方案](./Android安装包构建方案.md)：Capacitor + Gradle。

## DEPRECATED

- [PC端安装包构建方案](./PC端安装包构建方案.md)：原 PyInstaller + NSIS 全量旧壳，已废止，禁止发包。

## 快速命令

```powershell
# 正式 PC 包（Tauri 主路径）
python scripts\build_pc_package.py

# 或
build.bat   # 选项 1
```

Android 见 Android 构建方案。
