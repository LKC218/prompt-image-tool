# PC 发包规范 — Tauri 主路径

> **唯一正式发包 SOP**。其它构建文档只允许链接本文，不得再复制「PyInstaller 全量 pywebview」步骤。  
> 发布命名、`latest.json`、README 下载区由 `scripts/publish_release.ps1` 衔接。

---

## 1. 适用范围

| 产物 | 路径 | 状态 |
|------|------|------|
| Windows 正式安装包 | `releases/PromptImageManager-Setup-<version>.exe` | **唯一** |
| 应用内更新元数据 | `releases/latest.json` | 发布脚本生成 |
| Android APK | `build_android_package.py` | 按需 |
| PyInstaller 全量 pywebview 壳 | `build/app.spec` + `build/app_main.py` + `build/installer.nsi` | **DEPRECATED**，禁止发包 |

`build/server.spec` 仅用于打包 **无头 Sidecar**（`PromptImageManager-Server.exe`），属于 Tauri 主路径一步，**不是**全量旧壳。

---

## 2. 环境

| 工具 | 用途 |
|------|------|
| Node.js 18+ | Vite / Tauri CLI |
| Python 3.9+ + PyInstaller | Sidecar |
| Rust / Cargo | Tauri 编译 |
| NSIS（Tauri 自动下载或本机 PATH） | `npx tauri build` 打 NSIS |

---

## 3. 正式发包步骤（必须按序）

在仓库根目录：

```powershell
# 1) 前端
npx vite build

# 2) 无头后端 Sidecar（仅 server.spec）
python -m PyInstaller build/server.spec --workpath build/build-server --distpath build/dist-server --clean -y

# 3) 拷贝 Sidecar 到 Tauri 资源
New-Item -ItemType Directory -Force src-tauri/server | Out-Null
Copy-Item build/dist-server/PromptImageManager-Server.exe src-tauri/server/PromptImageManager-Server.exe -Force

# 4) Tauri + NSIS
npx tauri build

# 5) 规范发布名并落入 releases/
#    Tauri 原始产物示例：src-tauri/target/release/bundle/nsis/生图提示词管理器_<ver>_x64-setup.exe
#    发布名固定：releases/PromptImageManager-Setup-<ver>.exe
```

一键封装：

```powershell
python scripts\build_pc_package.py
# 或 build.bat → 选项 1
```

脚本行为：

1. 执行上表 1–4 步（或复用已有产物，见参数）。  
2. 将 NSIS 产物 **复制为** `releases/PromptImageManager-Setup-<version>.exe`（`version` 读 `package.json`）。  
3. **禁止**调用 `build/app.spec` 或 `build/installer.nsi`。

---

## 4. 发布（GitHub + 首页版本）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_release.ps1 -DryRun
# 确认附件与 SHA256 后去掉 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_release.ps1
```

前置一致：`package.json` / `meta[name=version]` / `RELEASE_NOTES[0].version` 相同。  
`latest.json.url` 必须指向 **本次** `PromptImageManager-Setup-<version>.exe`。

---

## 5. 验收清单

- [ ] 产物体积约 **28MB 量级**（Tauri）；若约 **38MB** 说明误打了全量旧壳，**作废重打**  
- [ ] 安装后主程序为无边框自绘顶栏（无系统标题栏/顶栏黑边）  
- [ ] 覆盖安装 + 应用内更新可自动重启进入新版本  
- [ ] Release 含 Setup 与 `latest.json`；README「当前最新」已更新  

---

## 6. 相关文档

- [PC端构建流程](./PC端构建流程.md)（架构与开发模式）  
- [版本发布与更新记录维护指南](../工程指南/版本发布与更新记录维护指南.md)  
- [应用内自动更新模块](../模块说明/应用内自动更新模块.md)  
