---
feature: fix-auto-update-bugs
status: delivered
updated: 2026-09-23
branch: fix/auto-update-bugs
commits: 0320ed1..15f1256 # reviewed implementation range
---

# 自动更新缺陷修复

## Report

**What was built** — 修复 PC 应用内自动更新 5 类缺陷：①确认框 Esc/遮罩关闭时 Promise 永久挂起导致「检查更新」按钮卡死（`showConfirmModal` 返回 Promise，取消/Esc/遮罩/被覆盖均 settle false）；②进度弹窗每 250ms 重建操作钮导致取消点击丢失（`setActions` 按 mode 缓存，installing/ready 不渲染操作钮）；③确认文案改为「暂不更新 / 下载安装」；④更新会话全局互斥（含重试路径），并发返回 `busy`；⑤Windows NSIS `/D=` 改为无引号末尾拼接，路径含空格不再失效。另将 version meta 读取与 helper 对齐为 8000 字符，`build/auto_update.py` 双副本同步。

审查循环中另修 3 个衍生问题：进度窗 capture `stopPropagation` 吞掉确认框 Esc（topmost：进度窗主动 `closeModal` 结算 Promise，同时继续拦截编辑器 `goBack` 等 bubble 业务 Esc）；确定按钮 `settled` 门控防重复 `onConfirm`；进度窗重复打开时 capture 监听泄漏（模块级单例 `destroy` 对称清理）。

**Verification** — `python -m pytest python/tests -q`：82 passed。`npm test`：369 passed / 43 files。`npm test -- src/js/release/auto-updater.test.js`：21 passed。`filecmp` `python/auto_update.py` vs `build/auto_update.py`：一致。独立审查 3 轮：初审 1 major（Esc 吞 Promise）→ 复审暴露去掉 stopPropagation 的编辑器误导航 major → 终审 A/B 消除后指出监听泄漏 major，补单例 destroy 后本地回归通过。

**Journey log** — 1) 环境禁止 `git worktree add`，改为本仓分支 `fix/auto-update-bugs`。2) capture `stopPropagation` 不拦同节点兄弟 listener，但拦后续节点/bubble；修「吞 Esc」不能只删 stopPropagation，需 topmost 门闩。3) `document.dispatchEvent` 测 Esc 会同节点假阳性，必须从子元素派发。4) DOM `remove()` 不摘 `document` 监听，模态必须 `destroy()` 对称清理。5) NSIS `/D=` 必须末尾且无引号，`list2cmdline` 会对含空格路径加引号导致失效。

## [S1] Problem

PC 应用内自动更新链路存在多处交互与安装参数缺陷：

1. 更新确认框被 Esc / 点击遮罩关闭时，`confirmUpdate` 的 Promise 永不 resolve，侧栏「检查更新」永久 `disabled`。
2. 下载进度弹窗每次轮询（约 250ms）都清空并重建操作按钮，取消点击可能丢失。
3. 确认框「取消」实际会写入跳过版本，文案与行为不符。
4. 启动检查与手动检查可并发，共用 modal 时后开覆盖先开，先开的 Promise 挂起，并可能双重下载。
5. NSIS `/D=` 路径含空格时被 `subprocess` 加引号，静默安装可能忽略自定义安装目录。
6. 安装/就绪阶段仍显示「关闭」按钮；version meta 前后端读取截断长度不一致。

## [S2] Design

### 契约

1. **确认框 Promise 闭环**  
   `showConfirmModal(message, onConfirm, options?)` 返回 `Promise<boolean>`。  
   - 确定 → `resolve(true)` 并调用 `onConfirm`  
   - 取消按钮 / Esc / 遮罩 / 被新 modal 覆盖 → `resolve(false)`  
   - 仅 settle 一次；既有 `onConfirm` 回调风格保持兼容。  
   `confirmUpdate` 改为直接 await 该 Promise。  
   **Esc topmost**：更新进度窗在 capture `stopPropagation` 挡住编辑器/详情等 bubble 业务 Esc；若确认框仍 active，进度窗主动 `closeModal()` 结算 Promise。确认框单独存在时仍走全局 bubble Esc。进度窗单例 `destroy` 对称摘除 capture 监听。

2. **进度弹窗按钮稳定**  
   `setActions(mode)` 仅在 `mode` 变化时重建 DOM；`downloading/pending/verifying` → `cancel`，`failed/cancelled` → `retry`，`installing/ready` → 不放可点操作（不渲染关闭钮，由调用方自动关或失败重试路径关闭）。

3. **确认文案**  
   更新确认框：确认=「下载安装」，取消=「暂不更新」。点取消仍 `skipUpdateVersion`（启动静默检查不再打扰；手动检查会清除跳过）。

4. **更新流程互斥**  
   `promptAndInstallUpdate` / `runUpdateWithProgressModal` / 进度弹窗「重试」全局同一时刻只允许一个会话；并发进入时后者直接返回 `{ updated: false, busy: true }`。确认阶段持锁，确认后直连内部会话，避免二次加锁死锁。

5. **NSIS `/D=` 无引号**  
   Windows 下安装器命令行手工拼接：`"<setup>" /S /D=<install_dir>`，`/D=` 为最后一段且不加引号；非 Windows 保持 list 传参。

6. **次要一致性**  
   `read_local_app_version` 截断长度与 helper 对齐为 8000；`setActions('none')` 不再渲染按钮。

### 错误行为

- `showConfirmModal` Promise 不因重复 settle 抛错。
- 安装器启动失败仍走现有 `handle_update_install` 400 JSON，不 `os._exit`。
- helper 启动失败不阻断安装（保持现状）。

### 测试边界

- 前端：确认框 Esc/遮罩/取消/确定 settle 语义；进度窗 mode 未变不重建按钮；busy 拒绝并发；文案；进度窗残留 + 确认框 Esc；bubble 业务不被误触；重复 open 不泄漏 Esc 拦截。
- 后端：Windows 命令行 `/D=` 无引号且在末尾（通过 mock `Popen` 断言 cmdline）；版本读取截断。
- 不强制 E2E 真下载 / 真静默安装。

## [S3] Out of Scope

- prerelease 语义化版本比较（`2.6.0-rc1`）
- Tauri 安装布局迁移
- 发布脚本 / `latest.json` 字段变更
- 重写更新状态机或引入新依赖

## Tasks

- [x] T1: `pc-utils.js` 确认框 Promise 闭环（确定/取消/Esc/遮罩/覆盖）— acceptance: 各关闭路径恰好 settle 一次且不重复回调 (covers: S2-1)
- [x] T2: `auto-updater.js` `confirmUpdate` 接新 Promise，并为更新确认定制按钮文案 — acceptance: 取消文案「暂不更新」，确定「下载安装」 (covers: S2-1, S2-3)
- [x] T3: `update-progress-modal.js` `setActions` 按 mode 缓存；installing/ready 不渲染操作钮 — acceptance: 同 mode 连续 setProgress 不重建按钮 (covers: S2-2, S2-6)
- [x] T4: `auto-updater.js` 更新会话互斥 — acceptance: 第二次并发调用返回 busy 且不弹进度窗 (covers: S2-4)
- [x] T5: `auto_update.py` Windows `/S /D=` 无引号命令行 + meta 读取 8000 — acceptance: mock Popen 断言 `/D=` 末尾无引号 (covers: S2-5, S2-6)
- [x] T6: 同步 `build/auto_update.py` — acceptance: 与 `python/auto_update.py` 字节一致 (covers: S2-5, S2-6; depends: T5)
- [x] T7: 补前端/后端回归测试并全部通过 — acceptance: pytest + vitest 相关套件绿 (covers: S2; depends: T1-T6)
