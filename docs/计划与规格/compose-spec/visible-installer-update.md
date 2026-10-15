---
feature: visible-installer-update
status: delivered
updated: 2026-09-28
branch: feat/visible-installer-update
commits: 51e15eb..384254d # reviewed implementation range
---

# 应用内更新改为可见安装向导

## Report

**What was built** — 应用内自动更新放弃 NSIS `/S` 静默安装与 PowerShell bootstrap（卸载→静默装→强重启）。下载并 SHA256 校验后，`run_installer` → `launch_installer_wizard` 以 `CREATE_BREAKAWAY_FROM_JOB | CREATE_NEW_PROCESS_GROUP` 直接拉起 Setup **完整向导**（无 `/S`、无 `/D=`、不预卸载）；Popen 失败回退 `ShellExecuteW`。响应 `mode=wizard`（`installerPid` 仅在 popen 路径有值，shellexecute 时为 `shellHandle`）。前端确认框/Toast/进度阶段改为「安装向导」语义；应用拉起向导后退出，由向导完成页「立即启动」进入新版本。`python/auto_update.py` 与 `build/auto_update.py` 双副本同步；模块说明、apps-code-map、项目开发经验已改写。

**Verification** — `python -m pytest python/tests -q`：85 passed。`python -m pytest python/tests/test_auto_update.py -q`：28 passed。`npm test`：399 passed / 47 files（含向导文案断言）。`filecmp` 双副本：True。独立审查 verdict：**pass-with-minor**（前端文案断言已补测；ShellExecute 的 HINSTANCE 改存 `shellHandle`，`installerPid` 保持真 PID 语义）。

**Journey log** — 1) `DETACHED_PROCESS` 不脱离 Windows Job；静默 bootstrap 在 Tauri 退出时仍可能被 Job/`taskkill /T` 带走。2) `/S /D=` 无引号拼参对空格/中文路径脆弱，失败不可见。3) 产品改为可见向导后，安装契约大幅简化：拉起→退出→用户点向导。4) 覆盖安装与清进程继续交给 NSIS hook，应用内不再预卸载。5) `CREATE_BREAKAWAY_FROM_JOB` 是向导在主程序退出后仍可见的关键。

## [S1] Problem

PC 应用内自动更新在下载安装包后静默安装（NSIS `/S` + bootstrap 卸载/覆盖/强重启）仍会出现「应用退出、安装未执行、无重启」黑盒故障。根因包括：`DETACHED_PROCESS` 未配合 `CREATE_BREAKAWAY_FROM_JOB` 时 bootstrap/Setup 易被 Job 或 `taskkill /T` 连带杀掉；`/S /D=` 无引号拼参脆弱；退出前不校验安装是否真正拉起。产品决策：**放弃静默安装，改为弹出安装向导**，让用户可见、可操作。

## [S2] Design

### 行为目标

```text
下载完成并 SHA256 校验
  → 进度弹窗进入 installing
  → 后端拉起 Setup.exe（完整向导，无 /S、无 /D=、不预卸载）
  → 返回 success（mode=wizard）
  → 主程序退出（释放文件锁；清进程交给 NSIS hook）
  → 用户在向导中完成安装
  → 完成页可选「立即启动」进入新版本
```

### 已定决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 安装形态 | 可见向导，禁用 `/S` | 产品明确要求；失败可被用户看见 |
| 安装目录 | 由向导选择，不传 `/D=` | 避开 NSIS 末尾无引号 `/D=` 脆弱性 |
| 预卸载 | 不做应用内 `uninstall.exe /S` | 覆盖安装交给向导；锁文件由 NSIS hook 清进程 |
| 完成后启动 | 依赖向导完成页「立即启动」 | 不再强启；与常见 Windows 软件一致 |
| 进程脱离 | `CREATE_BREAKAWAY_FROM_JOB \| CREATE_NEW_PROCESS_GROUP`，失败回退 `ShellExecuteW` | 保证 Setup 在主程序退出后仍存活并显示窗口 |
| API `expectedVersion` | 保留字段兼容，安装路径不再使用 | 向导负责版本与目录 |

### 契约

1. **`launch_installer_wizard(installer_path) -> dict`**
   - 校验 `installer_path` 为已存在文件，否则 `FileNotFoundError("安装包不存在")`。
   - `subprocess.Popen([installer_path], close_fds=True, creationflags=CREATE_BREAKAWAY_FROM_JOB|CREATE_NEW_PROCESS_GROUP)`，**不**传 `/S`、**不**传 `/D=`。
   - Windows 上 `CREATE_NO_WINDOW` **不**用于 Setup（GUI 安装包需可见窗口）。
   - Popen 失败时回退 `ctypes.windll.shell32.ShellExecuteW(None, "open", path, None, workdir, SW_SHOWNORMAL)`。
   - 写诊断日志 `%TEMP%\prompt-image-update.log`。
   - 返回：
     ```json
     {
       "success": true,
       "message": "installer wizard launched",
       "mode": "wizard",
       "installerPid": 12345,
       "installerPath": "C:\\...\\PromptImageManager-Setup-2.5.31.exe",
       "launchMode": "popen",
       "shellHandle": null
     }
     ```
   - `launchMode=="shellexecute"` 时 `installerPid=null`，`shellHandle` 为 ShellExecuteW 返回值（HINSTANCE，非 PID）。

2. **`run_installer(installer_path, *, expected_version=None) -> dict`**
   - 直接调用 `launch_installer_wizard`。
   - `expected_version` 仅签名兼容，不参与安装。
   - **删除**静默链路：`INSTALL_BOOTSTRAP_SCRIPT` 卸载/`/S`/`/D=`/强重启、`spawn_install_bootstrap`、`run_uninstall_existing` 在安装路径中的调用、helper 版本软校验重启。
   - 保留下载 Job、`resolve_install_dir` / `resolve_target_exe`（供诊断；安装不依赖 `/D=`）。
   - `exit_app_after_install` 行为不变（HTTP 后约 0.3s `os._exit`）。

3. **HTTP `POST /api/update/install`**
   - 请求 `{path, expectedVersion?}` 不变。
   - 成功响应含 `mode: "wizard"`；随后后端退出、前端关窗（既有 `closeShellAfterInstall`）。

4. **前端文案与阶段**
   - 确认框：下载并打开安装向导；应用会退出，按向导完成安装。
   - Toast / 进度 `ready`：安装向导已打开，请按向导完成安装。
   - `installing`：正在启动安装向导…
   - 不再宣传「自动重启进入新版本」。

5. **NSIS**
   - 生产 Tauri NSIS hooks（清进程）保持不变。
   - 应急 `build/installer.nsi` 的 `LaunchInstalledApp` 对非静默完成页仍可启动；本特性不改向导页结构。

### 错误行为

| 场景 | 行为 |
| --- | --- |
| 安装包路径不存在 | `FileNotFoundError("安装包不存在")`，前端 400，不退出 |
| Popen 失败且 ShellExecute 失败 | 抛错，前端显示失败，不退出 |
| 用户在向导中取消 | 应用已退出；用户手动打开旧版或重试更新 |
| 开发环境 / 非 Windows | 测试以 mock Popen 覆盖；生产 Windows 走真实启动 |

### 测试边界

- Python：`run_installer`/`launch_installer_wizard` 无 `/S`/`/D=`；含 `CREATE_BREAKAWAY_FROM_JOB`；缺失路径抛 FileNotFoundError；ShellExecute 回退；`mode=="wizard"`；shellexecute 时 `installerPid` 为空。
- 前端：进度 installing/ready 文案含「安装向导」、不含「自动重启」。
- 双副本 `python/auto_update.py` 与 `build/auto_update.py` 一致。
- 不强制 E2E 真装；手测：下载 → 弹出向导 → 应用退出 → 向导可完成并启动。

## [S3] Out of Scope

- `tauri-plugin-updater` / 签名增量更新
- Android
- 修改 Tauri NSIS 向导页结构或 hooks 名单
- 下载 Job、校验、取消、进度轮询逻辑
- 应用内强制拉起新版本 / 版本 meta 硬门闩
- A/B 回滚

## Tasks

- [x] T1: `python/auto_update.py` 新增 `launch_installer_wizard` 并简化 `run_installer` — acceptance: 无 `/S`、含 BREAKAWAY、mode=wizard；缺失路径抛 FileNotFoundError (covers: S2-1, S2-2)
- [x] T2: 同步 `build/auto_update.py` — acceptance: 与 `python/auto_update.py` 字节一致 (covers: S2-2; depends: T1)
- [x] T3: 前端文案与进度阶段改为向导语义 — acceptance: 确认框/Toast/ready 不含自动重启，含安装向导 (covers: S2-4)
- [x] T4: 重写安装相关 Python/前端测试并全绿 — acceptance: pytest + npm test 相关套件通过 (covers: S2-5; depends: T1-T3)
- [x] T5: 更新模块说明 / apps-code-map / 项目开发经验 — acceptance: 文档不再声称静默 `/S` 强重启契约 (covers: S2; depends: T1-T4)
