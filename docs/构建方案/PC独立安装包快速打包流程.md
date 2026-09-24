# PC 独立安装包快速打包流程

> 正式发包唯一 SOP：**[PC发包规范-Tauri主路径](./PC发包规范-Tauri主路径.md)**。  
> 本文只保留日常速查，不再描述 PyInstaller 全量旧壳。

## 适用场景

Windows 下快速产出可分发的 `PromptImageManager-Setup-<version>.exe`（Tauri + Sidecar）。

```text
Vite → server.spec（Sidecar）→ src-tauri/server/ → npx tauri build → releases/PromptImageManager-Setup-<ver>.exe
```

## 一键构建

```powershell
python scripts\build_pc_package.py
```

产物：

```text
releases\PromptImageManager-Setup-<version>.exe
src-tauri\server\PromptImageManager-Server.exe
src-tauri\target\release\bundle\nsis\生图提示词管理器_<version>_x64-setup.exe
```

## 常用参数

| 参数 | 作用 |
|------|------|
| `--skip-frontend` | 复用已有 `dist/` |
| `--skip-sidecar` | 复用已有 `dist-server/` |
| `--skip-tauri` | 仅整理已有 NSIS 产物到 `releases/` |
| `--skip-env-check` | 跳过工具链检查 |

## 发布

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_release.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_release.ps1
```

## 注意

- 产物约 **28MB** 为正常；约 **38MB** 表示误用 DEPRECATED 全量旧壳，作废重打。  
- 禁止 `python -m PyInstaller build/app.spec` 或 `makensis build/installer.nsi` 作为正式发包。
