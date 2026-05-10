# PC独立安装包快速打包流程

## 适用场景

用于在 Windows 环境下快速构建 PC 独立安装包。当前主线为：

```text
Vite -> PyInstaller -> NSIS -> releases
```

该流程会生成可直接分发的安装向导 `.exe`，同时保留 PyInstaller 产出的免安装可执行目录。

## 一键构建

从项目根目录执行：

```powershell
python scripts\build_pc_package.py
```

构建完成后检查以下产物：

```text
build\dist\PromptImageManager\PromptImageManager.exe
build\dist\PromptImageManager\_internal\frontend\index.html
build\PromptImageManager-Setup-2.3.1.exe
releases\PromptImageManager-Setup-2.3.1.exe
```

## 只构建可执行目录

如果本机未安装 NSIS，或只需要免安装目录：

```powershell
python scripts\build_pc_package.py --skip-nsis
```

此模式只生成：

```text
build\dist\PromptImageManager\
```

## 跳过环境检查

本机环境稳定后，可跳过前置检查以缩短构建输出：

```powershell
python scripts\build_pc_package.py --skip-env-check
```

也可以组合使用：

```powershell
python scripts\build_pc_package.py --skip-env-check --skip-nsis
```

## 环境要求

- Node.js：用于执行前端构建。
- npm：用于运行 `npm run build`。
- Python：用于运行 PyInstaller 和快速构建脚本。
- PyInstaller：用于生成 PC 可执行目录。
- pywebview：用于桌面窗口壳。
- pythonnet：用于 Windows 桌面运行时依赖。
- NSIS：用于生成安装向导 `.exe`。

脚本会在默认模式下自动检查上述工具，缺失时会在对应步骤中断。

## 构建步骤

`scripts/build_pc_package.py` 内部按以下顺序执行：

1. 读取 `package.json` 的 `version`。
2. 校验 `build/installer.nsi` 已启用 Unicode、简体中文语言、安装器图标、桌面快捷方式图标、开始菜单快捷方式图标和卸载项图标。
3. 检查 Node、npm、Python、PyInstaller、pywebview、pythonnet、NSIS。
4. 执行 `npm run build`，生成 `dist/`。
5. 执行 `python -m PyInstaller build\app.spec --workpath build\build --distpath build\dist --clean -y`。
6. 校验 `PromptImageManager.exe` 与内置前端 `index.html`。
7. 执行 `makensis /INPUTCHARSET UTF8 installer.nsi`。
8. 将 `build\PromptImageManager-Setup-{version}.exe` 复制到 `releases/`。

## 快捷方式与中文显示校验

PC 安装包正式交付前需确认：

- `build/icon.ico` 存在。
- `build/installer.nsi` 包含 `Unicode true` 和 `!insertmacro MUI_LANGUAGE "SimpChinese"`。
- 桌面快捷方式、开始菜单快捷方式和卸载项均指向 `$INSTDIR\icon.ico`。
- NSIS 构建命令使用 `makensis /INPUTCHARSET UTF8 installer.nsi`。
- 安装器界面、快捷方式名称和 Windows 卸载项显示中文无乱码。

## 当前构建结果

2026-05-10 本机已成功构建：

```text
build\PromptImageManager-Setup-2.3.1.exe
releases\PromptImageManager-Setup-2.3.1.exe
```

安装包大小：`21412654` 字节。

2026-05-10 当前构建脚本加固后重新构建：

```text
build\PromptImageManager-Setup-2.3.1.exe
releases\PromptImageManager-Setup-2.3.1.exe
```

安装包大小：`23803459` 字节。

## 常见问题

### npm 在 subprocess 中找不到

Windows 下 `npm` 可能实际解析为 `npm.cmd`。快速打包脚本已内置命令解析，会优先查找原命令，再尝试 `.cmd`。

### 安装包没有生成

先检查是否安装 NSIS：

```powershell
makensis /VERSION
```

如果暂时不需要安装包，可使用：

```powershell
python scripts\build_pc_package.py --skip-nsis
```

### 打包后打开空白

优先检查 PyInstaller 内置前端是否存在：

```powershell
dir build\dist\PromptImageManager\_internal\frontend\index.html
```

如果缺失，重新执行完整快速构建命令。
