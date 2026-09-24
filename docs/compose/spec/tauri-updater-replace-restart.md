---
feature: tauri-updater-replace-restart
status: delivered
updated: 2026-09-24
branch: fix/auto-update-bugs
commits: 5eb819d..working-tree # reviewed implementation range（实现尚未提交）
---

# Tauri 主包自动更新替换与重启

## Report

**What was built** — 将 PC 应用内自动更新契约对齐 Tauri 主包：主 exe 多候选（`生图提示词管理器.exe` / `PromptImageManager.exe`）；`resolve_install_dir` 走父进程主壳 → 上溯跳过 server 旁路 → 注册表 → 本地默认目录，且 **无主 exe 不返回安装根**。`run_installer` 禁止 Popen 前 `taskkill`，仅在目录内已有主 exe 时追加末尾无引号 `/D=`，否则仅 `/S`。helper Settle=3，`expectedVersion` 软校验写 `%TEMP%\prompt-image-update.log` 后仍重启。前端 `closeShellAfterInstall` 关闭 Tauri 主窗；NSIS hook 清进程名单补中文主 exe。`python/auto_update.py` 与 `build/auto_update.py` 双副本同步。

**Verification** — `python -m pytest python/tests -q`：88 passed。`python -m pytest python/tests/test_auto_update.py -q`：31 passed。`npm test`：393 passed / 45 files。`npm test -- src/js/release/auto-updater.test.js`：27 passed。`filecmp` 双副本：True。独立审查 2 轮：初审 3 critical（/D= 门闩、软校验日志、不可信仅 /S 测试）→ 修复后复审 C2/C3 关闭，C1 收紧安装根回落并补测。

**Journey log** — 1) 根因是 PyInstaller 布局契约残留于 Tauri 主包发布链。2) 安装前 `taskkill /T` 会触发 Tauri Exit 自杀 Sidecar，必须改为「先 Popen + helper，再关窗」。3) Tauri 无 `frontend/index.html`，helper 版本硬门闩会稳定导致不重启，只能软校验。4) `/D=` 必须末尾无引号，且仅当安装根含主 exe 时传入。5) 初审指出「无主 exe 仍返回默认目录」会误装；收紧为返回 `""`。

## [S1] Problem

## [S1] Problem

Tauri 主包应用内自动更新无法可靠覆盖替换旧版，也无法在安装后自动重启进入新版本。根因是更新链路仍按旧 PyInstaller 布约：硬编码 `PromptImageManager.exe`、把 Sidecar 的 `sys.executable` 当安装根、helper 用 `frontend/index.html` 版本门闩、安装前 `taskkill /T` 可能自杀，NSIS 清进程名单缺少中文主 exe。

## [S2] Design

### 契约

1. **主 exe 候选**（按序取第一个存在的文件）  
   `MAIN_APP_EXE_CANDIDATES` / 别名 `MAIN_APP_IMAGE_NAMES` = `生图提示词管理器.exe`、`PromptImageManager.exe`。  
   `APP_EXE_NAME` 保留为兼容别名（英文名，供旧测试/调用引用）。

2. **`resolve_target_exe(install_dir) -> str`**  
   在目录内按候选返回绝对路径；都不存在返回 `""`。

3. **`resolve_install_dir() -> str`**（Windows 生产包优先）  
   1. 父进程可执行文件目录（非 `PromptImageManager-Server*` 时视为 Tauri 主壳安装根）  
   2. `sys.executable` / 本模块目录向上最多 3 级，直到目录含主 exe  
   3. 注册表 HKCU：`Software\PromptImageManager\InstallDir`；Uninstall 下 `InstallLocation` / `DisplayIcon` / `UninstallString`（匹配 `com.promptimagemanager` 或「生图提示词管理器」）  
   4. 默认：`%LOCALAPPDATA%\生图提示词管理器`、`%LOCALAPPDATA%\PromptImageManager`  
   仅当目录内 `resolve_target_exe` 非空才返回该目录；否则返回 `""`。

4. **`run_installer` 时序**  
   - **禁止**在 Popen Setup 之前 `taskkill` 主程序树。  
   - Popen `"<setup>" /S`；**仅当** `install_dir` 可信且 **目录内已有主 exe** 时追加 `/D=<install_dir>`（末尾、无引号）；否则仅 `/S`。  
   - `targetExe` 为已存在的真实主 exe（可为空）；helper 传入 `helperTargetExe`（缺省时为首选候选预期路径，helper 落盘后再探测）。  
   - 分离启动 helper；返回字段兼容旧结构。  
   - 写诊断日志 `%TEMP%\prompt-image-update.log`。  
   - `kill_main_app_for_install()` 保留（无 `/T` 多镜像名），但 **不**在 `run_installer` 内调用；清进程靠前端关窗 + NSIS hook。

5. **Helper**  
   - `SettleSec` 默认 **3**。  
   - `TargetExe` 优先已存在主 exe；不存在则按候选探测后启动。  
   - `ExpectedVersion` **软校验**：mismatch 写 `%TEMP%\prompt-image-update.log`，**不**拒绝启动。  
   - `Test-Path` 通过则 `Start-Process`。

6. **前端退出**  
   `installDownloadedUpdate` 成功且 ready 后，关闭 Tauri 窗口（`getCurrentWindow().close()`，失败则 `window.close()`）。开发环境可走同一路径（测试 mock）。Sidecar `os._exit` 仍为 HTTP 后 0.3s 兜底。

7. **NSIS 清进程**  
   `installer-hooks.nsh` / `build/installer.nsi` 在既有名单上增加 `生图提示词管理器.exe`。

### 错误行为

- 安装包不存在仍 `FileNotFoundError`。  
- helper 启动失败不阻断安装。  
- 解析不到安装根：不传 `/D=`，仍 `/S` 静默安装。  
- 日志写失败静默忽略。

### 测试边界

- Python：目标解析、安装根优先级（mock 父进程/注册表/目录）、`/D=` 条件化与无引号、Popen 前不 taskkill、helper 脚本软校验文案。  
- 前端：ready 后调用窗口 close（mock）。  
- 不强制 E2E 真静默安装；手测清单见实施计划。

## [S3] Out of Scope

- `tauri-plugin-updater` / 签名增量更新  
- Android  
- 下载 Job 与进度弹窗交互重构  
- 发布脚本大改（仅要求 `latest.json.url` 与真实 Setup 一致）  
- A/B 双目录、自动回滚

## Tasks

- [x] T1: `auto_update.py` 主 exe 候选 + `resolve_target_exe` + `resolve_install_dir` — acceptance: 单测覆盖四级解析与候选顺序 (covers: S2-1, S2-2, S2-3)
- [x] T2: `run_installer` 去自杀时序 + `/D=` 条件化 + 诊断日志 — acceptance: mock Popen 前无 taskkill；可信目录末尾无引号 `/D=`；不可信仅 `/S` (covers: S2-4)
- [x] T3: helper Settle=3 且版本软校验 — acceptance: 脚本含 SettleSec=3；无 meta 仍 Start-Process (covers: S2-5)
- [x] T4: 前端 ready 后关窗 — acceptance: vitest 见 close 被调用 (covers: S2-6)
- [x] T5: NSIS hook 名单补中文主 exe — acceptance: 两处 hook 文本含 `生图提示词管理器.exe` (covers: S2-7)
- [x] T6: 同步 `build/auto_update.py` 并回归测试 — acceptance: 双副本一致；pytest + vitest 绿 (covers: S2; depends: T1-T5)
