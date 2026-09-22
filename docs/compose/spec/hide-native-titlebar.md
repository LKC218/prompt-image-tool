---
feature: hide-native-titlebar
status: delivered
updated: 2026-09-22
branch: feat/hide-native-titlebar
commits: main..feat/hide-native-titlebar
---

# Hide Native Titlebar

## Report

**What was built** — 在 `build/app_main.py` 增加 `strip_native_caption(window, log)`：窗口 `shown` 后用 Win32 去掉 `WS_CAPTION | WS_SYSMENU`，保留 `WS_THICKFRAME` 以便边缘缩放，并 `SetWindowPos(SWP_FRAMECHANGED)` 刷新边框。取不到 HWND、非 Windows、`SetWindowLongW` 失败均只记日志、不阻断启动。`scripts/frameless_probe.py` 会在拆边框前后读取 `WS_CAPTION` 位。环境禁止 worktree，改动在主工作区分支 `feat/hide-native-titlebar` 上完成。

**Verification** — `python scripts/frameless_probe.py`：`has_ws_caption: false`（拆后）。`npm run test`：42 文件 / 352 用例通过。`python -m py_compile build/app_main.py`：通过。

**Journey log** — 1) pywebview `frameless=True` 在 Win11 WebView2 上不可靠，需 Win32 兜底。2) WinForms `Handle` 是 `IntPtr`，要用 `ToInt64()`，`int()` 会炸。3) `SetWindowLongW` 返回 0 不能当失败，要用 `GetLastError`。4) `GetForegroundWindow` 回退可能拆错窗，已去掉。5) 环境禁止 `git worktree`，compose 默认 worktree 流程改为当前仓分支。

## [S1] Problem

安装包（PyInstaller + pywebview）启动后仍显示系统黑色标题栏，页面内自绘顶栏叠在下方，形成双顶栏。`webview.create_window(..., frameless=True)` 在 Win11 WebView2 上未去掉 `WS_CAPTION`。Tauri 的 `decorations: false` 不作用于 NSIS/pywebview 正式包。

## [S2] Design

主流观感（MiMO/VS Code）= 无系统标题栏 + 应用自绘顶栏。本机正式壳是 pywebview，因此用 **Win32 强制去掉标题栏** 落到当前安装包；Tauri 路径保持 `decorations: false` 不变。

**Contracts**

1. 窗口 `shown` 后对 HWND 执行：去掉 `WS_CAPTION | WS_SYSMENU`，保留 `WS_THICKFRAME`（边缘缩放），`SetWindowPos(..., SWP_FRAMECHANGED)`。
2. 失败不得阻断启动：写日志并继续有边框运行。
3. 拖动仅靠已有 `.pywebview-drag-region` / `data-tauri-drag-region`。
4. 自绘顶栏（左收起/后退/前进，右最小化/最大化/关闭）为唯一标题栏；不得再渲染系统钮。
5. API：`DesktopWindowApi.minimize/toggle_maximize/close/is_maximized` 行为不变。

**Error behavior**

- 非 Windows 或取不到 HWND → 跳过拆边框，日志一行。
- `SetWindowLongW` 失败（结合 `GetLastError`）→ 日志，不抛。

## [S3] Out of Scope

- 正式包构建链从 PyInstaller 迁到 `tauri build`
- Win11 Snap Layouts / 圆角合成自绘
- macOS / Linux 外壳

## Tasks

- [x] T1: `build/app_main.py` 增加 `strip_native_caption(window, log)` 并在 `shown` 钩子调用 — acceptance: 去掉 caption/sysmenu、保留 thickframe、SWP_FRAMECHANGED、异常被吞 (covers: S2)
- [x] T2: 扩展 `scripts/frameless_probe.py` 校验 caption 风格位 — acceptance: 探针打印 style 是否含 WS_CAPTION (covers: S2; depends: T1)
- [x] T3: `npm run test` + `python -m py_compile build/app_main.py` — acceptance: 全部通过 (covers: S2; depends: T1)
- [x] T4: 记录 changelog 验证小节 — acceptance: 含 Win32 拆边框条目 (covers: S2; depends: T3)
