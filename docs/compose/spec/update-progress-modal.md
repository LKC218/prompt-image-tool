---
feature: update-progress-modal
status: delivered
updated: 2026-09-16
branch: feature/update-progress
commits: 028aed6..2a9d5c7
---

# 应用内更新阶段式进度弹窗

## Report

**What was built** — PC 应用内更新改为异步下载 Job：`POST /api/update/download` 立即返回 `jobId`，前端每 250ms 轮询 `GET /api/update/progress`。确认更新后打开阶段式模态进度弹窗（下载百分比/字节/速度、校验完整性、启动安装），下载中可取消、失败可重试；启动静默更新、设置页「软件更新」卡片、侧边栏「检查更新」共用同一弹窗。取消会请求后端 Job 并在 chunk 循环内清理未完成临时文件。`python/` 与 `build/` 双副本已同步。

**Verification** — `python -m pytest python/tests -q`：63 passed；`npm test`：270 passed（含 auto-updater 10、进度弹窗 DOM/逻辑）；`npm run build`：vite 生产构建成功。独立审查首裁 fail（重试后 cancel 闭包旧 job），修复后复审 pass-with-minor。

**Journey log** — 1) 沙箱禁止 `git worktree add`，改在主仓从 `feature/tetris-game` HEAD 开 `feature/update-progress`（`main` 停在 v2.5.0，不能作基）。2) 设置页「软件更新」独立卡片为工作区既有未提交增量，并入本特性一并提交。3) 复用 modal 实例时业务状态必须挂调用方 session，不能靠闭包捕获旧 jobId。4) Windows 下取消删临时文件须等 `with` 句柄关闭后再 `os.remove`。5) 取消若发生在 `startDownloadUpdate` 返回前，需在拿到 jobId 后立刻补发 cancel。

## [S1] Problem

PC 应用内自动更新确认后，`POST /api/update/download` 会阻塞到整包下完，前端只有 Toast「正在下载更新，请稍候…」。安装包通常几十到上百 MB，用户无法判断是否卡死、下载进度、校验是否完成，失败时也缺少明确的重试入口。需要可视化进度条与阶段反馈，让用户能观察更新是否成功推进。

## [S2] Design

### 行为总览

```text
检查更新（启动静默 / 设置页 / 侧边栏）
  → 确认弹窗（沿用 showConfirmModal）
  → 用户确认「下载并安装」
  → 阶段式进度弹窗
       downloading：真实百分比 · 已下/总量 · 速度 · 可取消
       verifying：SHA256 校验（无百分比，阶段态）
       installing：启动安装器
       ready：安装程序已启动，随后应用退出
       failed：错误文案 + 重试 / 关闭
       cancelled：已取消，可关闭或重试
```

入口共用同一套 `runManualUpdateCheck` / `runStartupUpdateCheck` 流程；确认后统一走 `promptAndInstallUpdate` → 进度弹窗，不再只靠 Toast 等待。

### 后端：下载 Job（Python）

在 `python/auto_update.py`（及 `build/auto_update.py` 同步副本）增加线程安全的 Job 存储：

- 单一全局 Job 即可（桌面应用同时只允许一个更新任务；新 Job 启动时若旧 Job 仍在 running 则先取消或拒绝）。
- 阶段：`pending` → `downloading` → `verifying` → `ready` | `failed` | `cancelled`。
- 进度字段：`percent`（0–100，download 阶段）、`downloaded`、`total`（未知时为 0）、`speed`（字节/秒，近 1s 窗口平滑）、`path`（ready 时）、`error`（failed 时）。
- `Content-Length` 缺失时：`total=0`，`percent` 保持 0 或用伪进度上限 99，前端降级为 indeterminate + 已下载字节。
- 取消：Job 内 `cancel` 标志，chunk 循环每轮检查；取消后删除未完成临时文件。
- 校验失败归类为 `failed`，保留已下载路径由实现决定（默认删除不完整文件，与现实现一致）。

导出接口（供 HTTP 层调用）：

```python
start_download_job(url: str, expected_sha256: str) -> dict  # {"jobId": str, "success": True}
get_download_job(job_id: str) -> dict
cancel_download_job(job_id: str) -> dict
```

保留 `download_installer` 同步函数语义（可内部复用 Job），避免破坏既有直接调用。

### HTTP API

| 方法 | 路径 | 请求 | 响应 |
| --- | --- | --- | --- |
| POST | `/api/update/download` | `{url, sha256}` | `{success, jobId}`（立即返回，后台下载） |
| GET | `/api/update/progress?jobId=` | — | `{success, jobId, phase, percent, downloaded, total, speed, path?, error?}` |
| POST | `/api/update/download/cancel` | `{jobId}` | `{success, phase}` |

- 下载阶段 progress 轮询间隔建议 200–300ms。
- `ready` 后前端再调用既有 `POST /api/update/install` `{path}`。
- 双副本必须同步：`python/main.py` ↔ `build/app_main.py`，`python/auto_update.py` ↔ `build/auto_update.py`。

### 前端：auto-updater 状态机

`src/js/auto-updater.js`：

- `startDownloadUpdate(latest)`：POST download，返回 `jobId`。
- `pollUpdateProgress(jobId, { onUpdate, signal, intervalMs })`：轮询直到终态（ready/failed/cancelled）。
- `cancelUpdateDownload(jobId)`：POST cancel。
- `promptAndInstallUpdate(latest)`：确认 → 打开进度弹窗 → start → poll → ready 时 `installDownloadedUpdate` → 失败/取消展示于弹窗。
- 检查更新逻辑与跳过版本行为保持不变。

### 前端：进度弹窗

新建 `src/js/update-progress-modal.js`（或内联于 auto-updater，优先独立文件便于测试）：

- 复用 `pc-utils.showModal` 骨架，不与业务 `showConfirmModal` 争用同一时刻状态。
- 内容：
  - 标题：正在更新
  - 主进度条 + 右侧百分比（仅 downloading 显示数字；verifying/installing 为阶段动画）
  - 副文案：`12.4 / 48.6 MB · 8.2 MB/s`（total 未知时只显示已下载）
  - 阶段列表：下载安装包 / 校验完整性 / 启动安装（done / active / waiting）
  - 按钮：下载中「取消」；失败「重试」「关闭」；取消后「关闭」「重试」；ready 短文案后关闭并走 install
- 视觉：进度条对齐 `.pc-sync-progress-bar` / 目标计划进度（`--pc-accent`、8px 高、全圆角）；支持 `data-appearance` 深浅色。
- 无障碍：`role="progressbar"`、`aria-valuemin/max/now`、阶段区 `aria-live="polite"`。

### 设置页卡片（工作区已有未提交增量，并入本特性）

设置页独立「软件更新」卡片（`pc-settings-update-panel`）保留：

- 当前版本 +「检查更新」按钮 + 状态 hint。
- 手动检查成功且进入下载时，hint 可短暂显示「正在更新…」，完整进度以弹窗为准。

### 明确不做

- 系统托盘 / 任务栏进度、SSE/WebSocket、前端流式下载回传后端。
- 移动端更新流程。
- 多并行下载 Job。
- 修改 `latest.json` 发布协议字段。

### 测试边界

- Python：Job 状态迁移、进度字段更新、取消清理、校验失败；HTTP 路由 happy path / 缺参。
- 前端：`auto-updater` 轮询封装、弹窗阶段渲染（DOM 断言）、取消回调；不强制 E2E 真下载。

## [S3] Out of Scope

- Android / Capacitor 端更新。
- 增量更新、差分包、后台静默自动安装。
- 发布脚本与 `latest.json` 结构变更。
- 重做侧边栏检查更新徽章逻辑。
- 清理或重写与本特性无关的历史样式。

## Tasks

- [x] T1: `auto_update.py` 下载 Job（进度/取消/阶段）并同步 `build/auto_update.py` — acceptance: pytest 覆盖 job 创建、进度更新、取消删除临时文件、校验失败 (covers: S2)
- [x] T2: `main.py` / `app_main.py` 增加 progress 与 cancel 路由，download 改为异步返回 jobId — acceptance: 路由可返回 jobId 并查询 progress；缺参/未知 job 报错 (covers: S2; depends: T1)
- [x] T3: `auto-updater.js` 异步下载 + 轮询 + 取消封装 — acceptance: 单测覆盖 start/poll 终态/取消；promptAndInstallUpdate 不再阻塞在单次 download POST (covers: S2; depends: T2)
- [x] T4: 阶段式进度弹窗组件与样式 — acceptance: 弹窗展示进度条/百分比/字节/三阶段；下载中可取消，失败可重试 (covers: S2; depends: T3)
- [x] T5: 接入启动静默更新、设置页、侧边栏入口 — acceptance: 三入口确认后均走进度弹窗；设置页卡片与 hint 正常 (covers: S2; depends: T4)
- [x] T6: 文档同步 `docs/apps-code-map.md` 与 `docs/模块说明/应用内自动更新模块.md` — acceptance: 接口表与源码位置含 progress/cancel 与弹窗模块 (covers: S2; depends: T5)
