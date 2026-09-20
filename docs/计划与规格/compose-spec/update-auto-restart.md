---
feature: update-auto-restart
status: delivered
updated: 2026-09-20
branch: main
commits: f5f85ea..f5f85ea # reviewed uncommitted working tree on main
---

# 更新安装完成后自动重启新版本

## Report

**What was built** — PC 应用内自动更新在 NSIS `/S` 静默安装后自动尝试进入新版本。`run_installer` 会解析安装目录（frozen exe 目录 → 注册表 `InstallDir` → `%LOCALAPPDATA%\PromptImageManager`），以 `/S` + `/D=<目录>` 拉起安装包，再分离启动 PowerShell helper；helper 等待安装器 PID 结束，settle 后校验可选 `expectedVersion`（frontend meta），通过则 `Start-Process` 启动 `PromptImageManager.exe`。当前应用仍在 HTTP 响应后约 0.3 秒退出。开发环境/非 Windows 不启用 helper。前端确认弹窗、Toast 与进度 ready 文案已改为「自动重启」语义，安装请求携带 `expectedVersion`。`python/` 与 `build/` 双副本已同步。

**Verification** — `python -m pytest python/tests/test_auto_update.py -q`：23 passed（审查后补测注册表优先级 / detach flags / helper 清理）；`python -m pytest python/tests -q`：75 passed（收口前）；`npm test`：307 passed / 39 files；`npm run build`：vite 生产构建成功；`auto_update.py` 双副本 SHA256 一致。独立审查 verdict：**pass-with-minor**（次要项已回补测试与文档表述）。

**Journey log** — 1) 用户选定分离 helper 方案，并明确在 main 上直接改、不建 worktree。2) 生产包安装目录以 frozen `sys.executable` 所在目录优先，避免自定义路径被 `/S` 默认目录覆盖。3) helper 用 PowerShell + PID 轮询，不改 NSIS，兼容现网安装包。4) 审查指出 NSIS `/D=` 在路径含空格时可能被 CreateProcess 引号干扰——默认安装路径无空格，作为手测项保留。5) helper 失败或版本 meta 不一致时不阻断安装进程退出。

## [S1] Problem

PC 应用内自动更新确认后，后端以 NSIS `/S` 静默启动安装包，并在约 0.3 秒后 `os._exit(0)` 退出当前进程。安装结束后**不会**自动拉起新版本，用户必须手动从桌面/开始菜单再次打开。实施计划中的闭环是「静默安装 → 退出 → 进入新版本」，当前实现只到「退出」。

## [S2] Design

### 决策

- 用户已选定：**分离 helper 等待安装器退出后再拉起主程序**。
- 直接在 `main` 上实现（用户明确不要 worktree）。
- 不改 NSIS 脚本、不改 Tauri 安装器壳；仅改应用内更新链路。

### 行为目标

```text
确认更新 → 下载/校验（既有）→ 进度弹窗 installing
  → 后端解析安装目录与主程序路径
  → Popen 安装包：/S  +  /D=<当前安装目录>
  → 分离启动 helper（PowerShell），传入 installer PID / 目标 exe / 可选期望版本
  → 返回 HTTP 响应
  → 约 0.3s 后退出当前应用（os._exit，保持既有）
  → helper 等待安装器进程结束
  → 短暂 settle 后若主程序存在则 Start-Process 启动新版本
  → 用户直接进入新版界面
```

### 安装目录解析（`resolve_install_dir`）

优先级：

1. `sys.frozen` 时：`os.path.dirname(sys.executable)`（生产包覆盖安装的同一位置）
2. Windows 注册表：`HKCU\Software\PromptImageManager\InstallDir`
3. 默认：`%LOCALAPPDATA%\PromptImageManager`

目标可执行文件：`<install_dir>\PromptImageManager.exe`

### NSIS 参数

- 继续使用 `/S` 静默安装。
- 追加 `/D=<install_dir>`，确保覆盖到**当前实际安装位置**（自定义路径时避免装回默认目录）。
- 以 `subprocess` 列表参数传递（`["/S", f"/D={install_dir}"]`），不手工拼引号。
- `/D` 路径中的空格由列表 argv 处理；保持 `/D=` 为安装包启动参数之一。

### Helper 生成与分离启动

仅在 **Windows + `sys.frozen`** 时启用自动重启 helper；开发环境/非 Windows 保持「启动安装器后退出、不自动重启」。

实现要点：

1. 在系统临时目录写入一次性 PowerShell 脚本（UTF-8；路径经 argv 传入，不写入脚本正文）。
2. 脚本参数：`InstallerPid`、`TargetExe`、`ExpectedVersion`（可选）、`TimeoutSec`（默认 900）、`SettleSec`（默认 2，与 `HELPER_SETTLE_SEC` 对应）。
3. 脚本逻辑：
   - 轮询等待 `InstallerPid` 进程退出（间隔约 500ms），超时则放弃重启。
   - 按 `SettleSec` 等待，降低文件占用竞态。
   - 若 `ExpectedVersion` 非空，尝试读取 `<exe_dir>\frontend\index.html` 或 `<exe_dir>\_internal\frontend\index.html` 中的 `meta[name=version]`；版本不一致且 meta 可读则**不**启动。
   - 版本未指定或读取失败时：只要 `TargetExe` 存在即启动。
   - 启动：`Start-Process -FilePath $TargetExe -WorkingDirectory $exeDir`。
   - 脚本尽力自删除；`Popen` 失败时清理临时脚本。
4. 分离启动 helper：`powershell -NoProfile -ExecutionPolicy Bypass -File <script> ...`，Windows 使用 `CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP`，`close_fds=True`。
5. helper 启动失败：不阻断安装；返回 `helperSpawned=false`，行为退回「仅退出」。

### 后端 API 契约

`run_installer(installer_path, *, expected_version=None) -> dict`

```json
{
  "success": true,
  "message": "installer launched",
  "installerPid": 12345,
  "installDir": "C:\\Users\\...\\AppData\\Local\\PromptImageManager",
  "targetExe": "C:\\...\\PromptImageManager.exe",
  "helperSpawned": true,
  "autoRestart": true
}
```

- `autoRestart=false`：非 Windows / 非 frozen / 路径解析失败但仍成功拉起安装器。
- 安装包不存在时保持抛错：`FileNotFoundError("安装包不存在")`。

HTTP 路由 `POST /api/update/install`：

- 请求体在既有 `{path}` 上增加可选 `{expectedVersion}`。
- `main.py` / `build/app_main.py` 调用 `run_installer(path, expected_version=...)`。
- 响应返回后仍 `threading.Timer(0.3, exit_app_after_install).start()`，**退出时机不变**。

### 前端文案

| 位置 | 新文案 |
| --- | --- |
| 确认弹窗 `auto-updater.js` | 安装完成后应用会自动退出，并尝试重启进入新版本。 |
| Toast（安装已启动） | 安装程序已启动，完成后将自动重启进入新版本 |
| 进度弹窗 ready 状态 | 安装程序已启动，应用即将退出并自动重启 |

安装请求携带 `expectedVersion: latest.version`，供 helper 校验。

### 双副本与文档

- 必须同步：`python/auto_update.py` ↔ `build/auto_update.py`；`python/main.py` ↔ `build/app_main.py`。
- 更新 `docs/模块说明/应用内自动更新模块.md`：安装接口说明改为「静默安装后分离 helper 自动重启新版本」。
- 前端确认/Toast/进度文案与模块说明一致。

### 错误与边界

| 场景 | 行为 |
| --- | --- |
| 开发环境 / 非 frozen | 不写 helper、不自动重启；安装器行为与现网一致 |
| helper 脚本写入或启动失败 | 安装仍进行；应用退出；用户手动打开 |
| 安装器非 0 退出 / 版本 meta 不一致 | 有 expectedVersion 且 meta 可读时不启动；无 expectedVersion 或 meta 不可读时仅当 exe 存在才启动 |
| 安装超时（>15min） | helper 放弃重启 |
| 自定义安装目录 | 用解析出的 installDir 传 `/D=`，helper 启动该目录下的 exe |

### 测试边界

Python（`python/tests/test_auto_update.py`，mock `subprocess.Popen` / 注册表 / `sys`）：

- `resolve_install_dir` 优先级（frozen exe 目录 > 注册表 > LOCALAPPDATA 默认）。
- `run_installer` 在 Windows+frozen 下：调用安装器带 `/S` 与 `/D=`；创建 helper；`Popen` 分离启动 helper；返回字段正确。
- 非 Windows 或非 frozen：`helperSpawned=False`，`autoRestart=False`。
- helper 脚本生成：版本校验路径、SettleSec、Start-Process；Popen 失败清理脚本。

前端：

- 既有 auto-updater / settings 用例保持通过；不为文案单独扩大量产 API。

### 不做的范围

- 不修改 `build/installer.nsi` 静默结束后自动 Exec。
- 不改安装器壳 `launch_installed_app` 交互流程。
- 不改下载 Job、校验、取消、进度轮询逻辑。
- 不做真实 NSIS E2E 静默安装；以单测 + 手测清单验收。

## [S3] Out of Scope

- Android / 移动端更新。
- 改变检查更新频率、强制更新策略、跳过版本逻辑。
- 安装失败后的自动回滚或数据迁移。
- NSIS 脚本与 Tauri 安装器壳能力。
- 安装目录路径含空格时 NSIS `/D=` 引号语义的手工全矩阵验证（默认路径已覆盖）。

## Tasks

- [x] T1: `auto_update.py` 增加安装目录解析、helper 脚本生成与 `run_installer` 自动重启 — acceptance: Windows+frozen 下 `run_installer` 返回 `autoRestart=true` 且 mock Popen 见到安装器 `/D=` 与 helper 分离启动；非 Windows 不生成 helper (covers: S2)
- [x] T2: 同步 `build/auto_update.py`，并让 `python/main.py` / `build/app_main.py` 传递 `expectedVersion` — acceptance: 双副本关键函数一致；install 路由请求可选字段生效 (covers: S2; depends: T1)
- [x] T3: 前端确认弹窗/Toast/进度 ready 文案与 install 请求 `expectedVersion` — acceptance: UI 文案含自动重启语义；`installDownloadedUpdate` 可带版本号 (covers: S2)
- [x] T4: Python 单测覆盖解析/helper/run_installer 分支 — acceptance: `pytest python/tests/test_auto_update.py` 新增用例通过 (covers: S2; depends: T1)
- [x] T5: 更新 `docs/模块说明/应用内自动更新模块.md` — acceptance: 接口与行为描述与实现一致 (covers: S2; depends: T1)
- [x] T6: 运行相关 pytest + vitest，确认无回归 — acceptance: auto-update 相关测试通过或标注 PRE-EXISTING (covers: S2; depends: T1,T3,T4)
