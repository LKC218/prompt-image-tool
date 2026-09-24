# 提示词管家 — 更新记录

> 本文档是版本变更的**唯一权威源**。用户可见章节仅使用「新增 / 优化 / 修复 / 发布」；工程细节写在「版本与打包 / 验证」。
> 维护规范见 [版本发布与更新记录维护指南](../版本发布与更新记录维护指南.md)。

---

## v2.5.29 (2026-09-24)

> 记录依据：`v2.5.28` 发布提交 `5d837fd` 之后的自动更新安装链路修复（安装脱离 Sidecar 生命周期）。

### 修复

- **在线更新安装失败**：下载完成后应用退出但安装程序未执行；改为在独立 bootstrap 中完成卸载、静默安装与自动重启，不再被主程序退出连带取消。

### 发布

- 版本号统一升级至 `2.5.29`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.29`。
- Android `versionCode` 从 `40` 递增至 `41`，`versionName` 升级为 `2.5.29`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建（Tauri 主路径）：
  - `PromptImageManager-Setup-2.5.29.exe`：28,901,528 字节（27.56 MB），SHA256 `FD3BA9FF7ACB3FCB5D1B22AC0435AB13D5DCC2C2AAE3DA126744F2B9E6EDD22B`

### 验证

- `npm test`：396 passed / 46 files。
- `python -m pytest python/tests/test_auto_update.py -q`：36 passed。
- `node scripts/verify-ui-encoding.mjs`：PASS。
- `python scripts/build_pc_package.py`：Tauri 主路径构建成功。

---

## v2.5.28 (2026-09-24)

> 记录依据：`v2.5.27` 发布提交 `2a0bf0c` 之后的工作区优化（更新进度弹窗、任务菜单分组、导图拖拽落点反馈）。

### 优化

- **更新进度弹窗**：改为紧凑步进器，大号百分比与细进度条更易读，阶段轨垂直排布；去掉拟态阴影，视觉更干净。
- **任务菜单分组**：目标计划任务右键/更多菜单按状态、结构编辑、资源与定位、危险操作分组，并用细线分隔，查找更快。
- **导图拖拽落点反馈**：插上/下、成子级、放到顶层的提示更明确，拖拽跟手，结束后自动清理落点提示。

### 发布

- 版本号统一升级至 `2.5.28`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.28`。
- Android `versionCode` 从 `39` 递增至 `40`，`versionName` 升级为 `2.5.28`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建（Tauri 主路径）：
  - `PromptImageManager-Setup-2.5.28.exe`：28,968,254 字节（27.63 MB），SHA256 `633DDBB9D0142923CE347BDCE65E0096FB7C22E83559966BB1CD5DAFB811B5EE`

### 验证

- `npm test`：396 passed / 46 files。
- `python -m pytest python/tests/test_auto_update.py -q`：33 passed。
- `node scripts/verify-ui-encoding.mjs`：PASS。
- `python scripts/build_pc_package.py`：Tauri 主路径构建成功。

---

## v2.5.27 (2026-09-24)

> 记录依据：`v2.5.26` 在线更新实测失败后修复 Tauri 主程序名与覆盖安装链路。

### 修复

- **在线更新覆盖安装**：识别 Tauri 实际主程序 `app.exe`（并统一 `mainBinaryName=PromptImageManager`）；安装根解析不再落空。
- **更新前先静默卸载**：`run_installer` 调用 `uninstall.exe /S` 后再 `/S` 安装，降低文件锁导致的替换失败。
- **进程清理**：NSIS hook 补杀 `app.exe`，避免残留锁住安装目录。

### 发布

- 版本号统一升级至 `2.5.27`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.27`。
- Android `versionCode` 从 `38` 递增至 `39`，`versionName` 升级为 `2.5.27`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建（Tauri 主路径）：
  - `PromptImageManager-Setup-2.5.27.exe`：28,965,116 字节（27.62 MB），SHA256 `2430DCA3D25C395BC63226026F24696877DA31DE06391DF1511428BB8721F186`

### 验证

- `python -m pytest python/tests/test_auto_update.py -q`：33 passed。
- `python scripts/build_pc_package.py`：Tauri 主路径构建后回填。

---

## v2.5.26 (2026-09-24)

> 记录依据：`v2.5.25` 发布后修复安装包内开屏像素动画因 Logo 资源路径被跳过。

### 修复

- **开屏像素聚合动画**：安装包中 Logo 采样地址改为 Vite 真实产物路径，并保证 `assets/icons/图标.svg` 可访问，像素飞入聚合不再被静默跳过。

### 发布

- 版本号统一升级至 `2.5.26`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.26`。
- Android `versionCode` 从 `37` 递增至 `38`，`versionName` 升级为 `2.5.26`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建（Tauri 主路径）：
  - `PromptImageManager-Setup-2.5.26.exe`：28,964,334 字节（27.62 MB），SHA256 `8EE026499DCB31171D2B376D159D39847409471E53EBEDFA4F8E48DBC2FF74AA`

### 验证

- `npm test`：393 passed / 45 files（含开屏动画 4 例）。
- `python scripts/build_pc_package.py`：Tauri 主路径构建后回填。

---

## v2.5.25 (2026-09-24)

> 记录依据：`v2.5.24` 发布后收敛打包规范为 Tauri 主路径（`cb10f68`）。

### 优化

- **安装包产线统一**：Windows Setup 改为 Tauri + Sidecar 打包，与无边框窗口、应用内自动更新契约一致。

### 发布

- 版本号统一升级至 `2.5.25`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.25`。
- Android `versionCode` 从 `36` 递增至 `37`，`versionName` 升级为 `2.5.25`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建（Tauri 主路径）：
  - `PromptImageManager-Setup-2.5.25.exe`：28,964,409 字节（27.62 MB），SHA256 `51B3A0CB1C6CE7BFA9223E9264997A0B608A1A10C464F00DEF9CCD21B4A0D66F`

### 验证

- `npm test`：393 passed / 45 files。
- `python -m pytest python/tests -q`：88 passed。
- `python scripts/build_pc_package.py`：Tauri 主路径通过，产出约 27.6MB Setup。

---

## v2.5.24 (2026-09-24)

> 记录依据：`v2.5.23` 发布提交 `352d20c` 之后的自动更新安装/替换/重启契约修复。

### 修复

- **自动更新覆盖安装**：正确识别 Tauri 安装根与主程序，静默安装会覆盖替换旧版本，不再装到错误目录或留下双份文件。
- **更新后自动重启**：安装结束后自动进入新版本；修正安装前误杀自身导致更新中断、装完不重启的问题。

### 发布

- 版本号统一升级至 `2.5.24`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.24`。
- Android `versionCode` 从 `35` 递增至 `36`，`versionName` 升级为 `2.5.24`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.24.exe`：39,461,558 字节（37.63 MB），SHA256 `E8260FBC904616754E55F2CAC96122506F7A021C8A7CB3D0BA511D1CDF9077D5`

### 验证

- `npm test`：393 passed / 45 files。
- `python -m pytest python/tests -q`：88 passed。
- `python -m PyInstaller build/app.spec` + `makensis /INPUTCHARSET UTF8 installer.nsi`：通过，产出 NSIS 安装包。

---

## v2.5.23 (2026-09-24)

> 记录依据：`v2.5.22` 发布后修复导图短标题被 chrome 挤压成竖排单字。

### 优化

- **导图标题横排可读**：节点预留状态点、进度胶囊与导入图按钮的真实宽度，短标题至少保留约 6 个汉字宽度，不再被压成一字一行。

### 发布

- 版本号统一升级至 `2.5.23`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.23`。
- Android `versionCode` 从 `34` 递增至 `35`，`versionName` 升级为 `2.5.23`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.23.exe`：39,456,443 字节（37.63 MB），SHA256 `82C2738EEE7E3F4B09B6FFA2FE4C649E60FB1552D4A59930559191C8AE35935B`

### 验证

- `npm test`：391 passed / 45 files。
- `python -m pytest python/tests -q`：83 passed。
- `npx vite build` + `python -m PyInstaller build/app.spec` + `makensis installer.nsi`：通过，产出 NSIS 安装包。

---

## v2.5.22 (2026-09-24)

> 记录依据：`v2.5.21` 发布后修复卸载/退出残留 Sidecar 导致覆盖安装写文件失败（分支 `fix/auto-update-bugs`）。

### 修复

- **安装被残留进程锁死**：安装与卸载前自动结束 `PromptImageManager.exe`、`PromptImageManager-Server.exe` 及本项目 Python 后端，覆盖安装不再报「无法打开要写入的文件」。
- **退出回收**：应用退出时按进程树结束 Sidecar，并按镜像名兜底，降低任务管理器残留。

### 发布

- 版本号统一升级至 `2.5.22`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.22`。
- Android `versionCode` 从 `33` 递增至 `34`，`versionName` 升级为 `2.5.22`（本版不附带 APK）。
- Tauri NSIS 增加 `nsis/installer-hooks.nsh`（`installerHooks`）：`NSIS_HOOK_PREINSTALL` / `NSIS_HOOK_PREUNINSTALL` 清进程；应急 `build/installer.nsi` 同步。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.22.exe`：28,957,699 字节（27.6 MB），SHA256 `63D73ED5A14BEC8499B8E571C5F1AE8564AB7EB0B4E67E7F066845E581533787`

### 验证

- `npm test`：390 passed / 45 files。
- `python -m pytest python/tests -q`：83 passed。
- Sidecar 运行中静默覆盖安装：安装器退出码 0，安装后 `PromptImageManager-Server.exe` 已结束。
- `npx vite build` + `python -m PyInstaller build/server.spec` + `npx tauri build`：通过，产出 NSIS 安装包。

---

## v2.5.21 (2026-09-24)

> 记录依据：`v2.5.20` 发布后定位并修复 Tauri 壳下应用内自动更新无法发现新版本（分支 `fix/auto-update-bugs`）。

### 修复

- **检查更新连不上后端**：Tauri 安装包页面源与 Python Sidecar 不同源，更新接口裸相对路径打回 WebView 源，导致 2.5.19/2.5.20 检查更新失败或像没有新版本。现经 `resolveApiBase()` 拼绝对地址，检查/下载/安装链路恢复。
- **检查结果提示**：设置页「软件更新」不再只显示「已检查 · 时间」，改为「已是最新 v… / 可更新到 v… / 检查失败」。

### 发布

- 版本号统一升级至 `2.5.21`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.21`。
- Android `versionCode` 从 `32` 递增至 `33`，`versionName` 升级为 `2.5.21`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.21.exe`：28,951,868 字节（27.6 MB），SHA256 `C4C20ABFF7E928A885F5E37A09FB6D35D8B769B41C2813A164E17F50092D4215`

### 验证

- `npm test`：390 passed / 45 files（含 Tauri API base 与更新提示文案用例）。
- `python -m pytest python/tests -q`：82 passed。
- `npx vite build` + `python -m PyInstaller build/server.spec` + `npx tauri build`：通过，产出 NSIS 安装包。

---

## v2.5.20 (2026-09-24)

> 记录依据：`v2.5.19` 发布后工作区交付的目标计划拖拽调级、导图完整显示、更新记录阶段轨顺畅化与开屏像素聚合动画（分支 `fix/auto-update-bugs`）。

### 新增

- **目标计划拖拽调级**：任务列表与思维导图均支持拖拽调整层级。列表落点区分「成子级 / 插到上方 / 插到下方 / 成顶层」，折叠目标悬停可自动展开；导图节点中部成子级、上下 30% 插兄弟、空白或根成顶层；均禁止拖入自身子树。

### 优化

- **导图长标题完整显示**：节点宽度上限 360、高度随折行增长，标题换行不再截断省略。
- **更新记录阶段轨跟手**：滚动按阅读锚点稳定切换高亮，点击刻度精确停在版本卡顶部，程序滚动期间不再抖动或过冲。
- **开屏像素聚合动画**：Logo 像素自四周聚合成图标后回弹展示标题；启动等待动画结束后再进入应用；`prefers-reduced-motion` 下退回静态 Logo。

### 发布

- 版本号统一升级至 `2.5.20`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.20`。
- Android `versionCode` 从 `31` 递增至 `32`，`versionName` 升级为 `2.5.20`（本版不附带 APK）。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.20.exe`：28,951,629 字节（27.6 MB），SHA256 `56CFE74E2CBF3F6FD175BE106AC4CFD91707CDBF1C6390C9B487A39D3C03DE48`

### 验证

- `npm test`：386 passed / 45 files（含拖拽调级、导图布局、阶段轨、开屏动画）。
- `python -m pytest python/tests -q`：82 passed。
- `npx vite build` + `python -m PyInstaller build/server.spec` + `npx tauri build`：通过，产出 NSIS 安装包。

---

## v2.5.19 (2026-09-23)

> 记录依据：`v2.5.18` 发布后应用内自动更新链路缺陷修复（分支 `fix/auto-update-bugs`）。

### 优化

- **更新确认文案**：确认框改为「暂不更新 / 下载安装」；点「暂不更新」跳过该版本提示，手动检查仍可再次发现。
- **更新会话互斥**：确认、下载、安装、重试同一时间只允许一路，避免重复弹窗与双重下载。

### 修复

- **检查更新卡死**：更新确认框被 Esc / 点击遮罩关闭时 Promise 正常结算，侧栏与设置页「检查更新」不再永久禁用。
- **取消按钮失效**：下载进度弹窗操作按钮按阶段缓存，连续进度刷新不再重建按钮导致「取消更新」点空。
- **空格安装路径**：Windows 静默安装 `/D=` 参数改为末尾无引号拼接，安装目录含空格时不再被忽略。
- **Esc 误导航**：更新进度显示期间拦截业务 Esc，不再误触发编辑器返回；若叠着确认框则正常关闭确认框。

### 发布

- 版本号统一升级至 `2.5.19`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.19`。
- Android `versionCode` 从 `30` 递增至 `31`，`versionName` 升级为 `2.5.19`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.19.exe`：28,946,691 字节（27.6 MB），SHA256 `341428F252E4E7C9389087D0F3DA05AA40C6686A8493C19312E187DE628706D7`

### 验证

- `npm test`：369 passed / 43 files（含 auto-updater 21）。
- `python -m pytest python/tests -q`：82 passed。
- `npx vite build` + `python -m PyInstaller build/server.spec` + `npx tauri build`：通过，产出 NSIS 安装包。

---

## v2.5.18 (2026-09-23)

> 记录依据：侧栏列表边缘羽化落地与安装向导全面中文化（含 Tauri NSIS 与应急 NSIS 路径）。

### 优化

- **侧栏列表边缘羽化**：左侧导航列表四边使用 mask 软溶入底色，滚动溢出与拟态阴影不再硬裁切；收起态羽化宽度自动收窄。
- **安装向导中文化**：Windows 安装/卸载向导标题、欢迎页、完成页、按钮与系统字符串统一简体中文；完成页提供「立即启动」，静默安装（含应用内自动更新）不会二次拉起应用。

### 发布

- 版本号统一升级至 `2.5.18`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳统一升级至 `2.5.18`。
- Android `versionCode` 从 `29` 递增至 `30`，`versionName` 升级为 `2.5.18`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.18.exe`：28,945,430 字节（27.6 MB），SHA256 `495A442C1C0D0B8389C1B54BB9DFFCB2A91FAE9F5E225B28E0FDB790F0D26B07`
- `src-tauri/tauri.conf.json`：NSIS `languages: ["SimpChinese"]` + `customLanguageFiles` 指向 `nsis/SimpChinese.nsh`。
- `build/installer.nsi`：中文 MUI 文案、LangString 按钮与 `LaunchInstalledApp` 静默防护；UTF-8 with BOM。
- `scripts/build_pc_package.py`：`validate_pc_installer_config()` 增加汉化与启动项预检。

### 验证

- `npm test`：43 文件 / 358 用例通过。
- `scripts/verify-ui-encoding.mjs`：安装器编码与中文约定通过。
- `npx tauri build`：通过，产出 NSIS 安装包（构建后回填哈希）。

---

## v2.5.17 (2026-09-24)

> 记录依据：无边框窗口壳 Tauri 收敛（顶栏黑边、最小化缩窗、双壳分叉）实施与实机安装验证通过。

### 修复

- **顶部黑边**：Windows 正式壳切换为 Tauri 无边框窗口，去掉 Win11 WebView2 残余非客户区深色条。
- **最小化后窗口变小**：最小化再还原不再丢失尺寸；启动默认 1600×900（16:9），屏幕不足时等比缩到工作区。

### 优化

- **桌面壳收敛**：Windows 正式安装包以 Tauri 2 为唯一主壳；自绘顶栏、拖动、最小化/最大化/关闭统一走 Tauri 窗口 API。
- **后端 Sidecar**：Python HTTP 后端以无头 `PromptImageManager-Server.exe` 随包分发，不再依赖用户自装 Python；端口占用时自动递增并通过 `/api/health` 发现。
- **构建主路径**：`build.bat` 选项 1 改为「Tauri + Python Sidecar」；原 PyInstaller + pywebview 全量包降为应急选项 2。

### 发布

- 版本号统一升级至 `2.5.17`；发布 Windows Setup 安装包。
- 旧 pywebview 壳代码冻结为应急路径，不再投入窗口修复。

### 版本与打包

- 新增 `build/server.spec`（无头后端 onefile）、`src-tauri/server/`（Sidecar 资源位）、`src/js/pc/pc-window-size.js`（启动尺寸与还原纠偏）。
- `src-tauri/tauri.conf.json`：`decorations:false` + `shadow`；capabilities 补齐尺寸/监视器权限。
- `src-tauri/src/lib.rs`：优先启动 Sidecar，退出回收子进程；失败回退系统 Python。
- Android `versionCode` 从 `28` 递增至 `29`，`versionName` 升级为 `2.5.17`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.17.exe`：28,946,644 字节（27.6 MB），SHA256 `C2386DE7632F381A74B635A88971AEDCF6DB6EC23F7998FE8C628D0F08DA5039`

### 验证

- `npm test`：43 文件 / 358 用例通过。
- `cargo test --manifest-path src-tauri/Cargo.toml --lib`：2 passed。
- `npm run build` / `npx tauri build`：通过，产出 NSIS 安装包。
- 人工安装实机确认：顶部黑边消失，最小化还原不再缩窗。

---

## v2.5.16 (2026-09-23)

> 记录依据：`v2.5.15` 发布之后的思维导图图片导入能力与任务图片入口统一。

### 新增

- **思维导图导入图片**：导图工具栏「导入图片」、节点 `+` 按钮与节点菜单均可为任务导入图片，导入后缩略图即时刷新。

### 优化

- **图片入口统一**：列表与导图菜单均提供「导入图片」；导图节点菜单补齐「图片管理 / 查看图片」，无需切回列表即可管理任务图片。

### 发布

- 版本号统一升级至 `2.5.16`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本统一升级至 `2.5.16`。
- Android `versionCode` 从 `27` 递增至 `28`，`versionName` 升级为 `2.5.16`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.16.exe`：39,440,190 字节（37.6 MB），SHA256 `3CE0C3395EB38B3750120BAC371F579769583C24C20E1E4D29BE2BCBAE424BFD`

### 验证

- `npm test`（`goal-mindmap-core` 等）：38 passed。
- `node scripts/goal-mindmap-import-visual.mjs`：IMPORT_VISUAL_PASS（工具栏/节点导入按钮、无选中提示、导入出图、菜单含导入与图片管理）。

---

## v2.5.15 (2026-09-23)

> 记录依据：`feat/hide-native-titlebar`（`12fe649`）Win32 强制隐藏原生标题栏；随后顶栏黑边与接缝修复。

### 优化

- **顶栏接缝对齐**：窗口顶栏左段与侧栏同宽（`box-sizing: border-box`），侧栏与顶栏竖线连成一条，不再错位断开。

### 修复

- **原生标题栏未隐藏**：Win11 WebView2 下 `frameless=True` 仍可能保留系统标题栏；`build/app_main.py` 在窗口 `shown` 后用 Win32 去掉 `WS_CAPTION | WS_SYSMENU`（保留 `WS_THICKFRAME` 边缘缩放），失败不阻断启动。
- **顶栏黑边**：DWM 玻璃铺满窗口（margins `-1`）、浅色沉浸模式与隐藏窗口边框，去掉顶部约 6px 残边；`shown` 后多次重试，防止 Win11 重绘边框。

### 发布

- 版本号统一升级至 `2.5.15`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本统一升级至 `2.5.15`。
- Android `versionCode` 从 `26` 递增至 `27`，`versionName` 升级为 `2.5.15`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.15.exe`：39,438,102 字节（37.6 MB），SHA256 `24A202748FC225464684C2E269E6297A1BACB6763BF430AC576E154E6F8D6D84`

### 验证

- `python scripts/frameless_probe.py`：拆边框后 `has_ws_caption: false`。
- `npm run test`：通过（42 个测试文件，352 个测试用例）。
- `python -m py_compile build/app_main.py`：通过。

---

## v2.5.14 (2026-09-22)

> 记录依据：`v2.5.13` 发布之后的窗口外壳结构重做（真实顶栏布局行、MiMO 同构导航/窗口控件）。

### 优化

- **窗口顶栏真实布局行**：左侧「收起侧栏 / 后退 / 前进」，中间隐形拖动区，右侧「最小化 / 最大化 / 关闭」；左段背景随侧栏宽度折叠，右段随内容底色。
- **布局一体化**：侧栏 Logo 恢复自然顶距，欢迎横幅/详情页去掉顶栏预留空带；脑图最大化从顶栏下方铺满内容区，窗口按钮始终可操作。
- **双端拖动热区**：`.pywebview-drag-region` 与 `data-tauri-drag-region` 并存，Tauri 与 Python/pywebview 安装包均可拖动窗口。

### 发布

- 版本号统一升级至 `2.5.14`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本统一升级至 `2.5.14`。
- Android `versionCode` 从 `25` 递增至 `26`，`versionName` 升级为 `2.5.14`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.14.exe`：39,435,027 字节（37.6 MB），SHA256 `57AA9675FF642E6B87F9B8A82CC46EE1DE0BD4D370C1B428AA9A2ABF82B1A7F1`

### 验证

- `npm run test`：通过（42 个测试文件，352 个测试用例）。
- `npm run build`：通过。
- `scripts/frameless_probe.py`：pywebview `frameless` / `js_api` 创建成功。

---

## v2.5.13 (2026-09-22)

> 记录依据：`v2.5.12` 发布之后的桌面端窗口外壳一体化改造（无边框窗口、自定义标题栏控件、顶通布局适配）。

### 新增

- **一体化窗口外壳**：去掉系统黑色标题栏，窗口顶栏融入应用界面；右上角提供最小化/最大化/关闭，双击顶栏空白区可切换最大化/还原。
- **双端窗口壳同步**：Tauri 与 Python/pywebview 安装包均启用无边框窗口与自定义标题栏控件，拖动热区分别对接 `data-tauri-drag-region` 与 `.pywebview-drag-region`。

### 优化

- **窗口观感对齐现代客户端**：侧栏与内容区从窗口顶端开始，品牌区保留在左侧；顶栏为隐形拖动区，视觉上不再出现独立系统黑条。
- **顶栏空间适配**：欢迎横幅、详情页与导图最大化工具条预留顶栏高度，深浅色主题下窗口控件对比清晰，导图最大化时仍可操作窗口按钮。

### 发布

- 版本号统一升级至 `2.5.13`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本统一升级至 `2.5.13`。
- Android `versionCode` 从 `24` 递增至 `25`，`versionName` 升级为 `2.5.13`。
- PC Tauri 窗口配置启用 `decorations: false`，capability 补齐窗口拖动/最小化/最大化/关闭权限。
- `build/app_main.py` 同步启用 `frameless` 窗口与 `DesktopWindowApi`（最小化/最大化/关闭），拖动区使用 `.pywebview-drag-region`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.13.exe`：39,434,429 字节（37.6 MB），SHA256 `0DA53142ECF507B7E3E5848A7781A04078FB04642A53112A1267F8626FFDE6F1`

### 验证

- `npm run test`：通过（42 个测试文件，352 个测试用例；含新增 `pc-window-chrome`）。
- `npm run build`：通过。
- `python scripts/build_pc_package.py`：通过（PyInstaller + NSIS，产物已拷贝至 `releases/`）。

---

## v2.5.12 (2026-09-22)

> 记录依据：`v2.5.11` 发布提交 `6a51e62` / 首页对齐 `6fcdc48` 之后的工作区优化（导图图片预览、视图路由、首页液面、导图高度与定位）。

### 新增

- **导图节点图片预览**：导图任务节点显示图片缩略与多图角标，点击可打开图片查看器浏览该任务全部图片。
- **在导图中定位**：任务菜单新增「在导图中定位」，可从列表直达导图节点并自动取景聚焦。
- **首页统计卡液面**：四张统计卡增加静置液面与双层波浪微动装饰，深浅色主题适配，并尊重「减少动态效果」偏好。

### 优化

- **视图切换直达**：项目卡片「查看思维导图」通过路由参数直达导图视图；列表/导图切换按钮图标化，并同步 URL 视图状态，刷新后保持。
- **导图嵌入高度**：导图嵌入态按视口高度自适应取景，容器高度链贯通；最大化与嵌入态互不干扰，矮窗口自动收紧下限。
- **选中与取景手感**：列表选中态高亮；定位/适应画布/最大化使用相机过渡，聚焦节点带闪光提示；再点「思维导图」可重新取景。

### 修复

- **视图切换失效**：作者样式覆盖 UA `[hidden]` 导致列表/导图切换后仍双显或不切换，已显式兜底 `display: none`。
- **图片预览绑定串扰**：导图图片入口与列表图片图标选择器隔离，避免误绑定与重复打开查看器。
- **安装器中文编码**：`build/installer.nsi` 恢复 UTF-8 with BOM，避免 NSIS 按 ANSI 解析导致安装界面中文乱码。

### 发布

- 版本号统一升级至 `2.5.12`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本统一升级至 `2.5.12`。
- Android `versionCode` 从 `23` 递增至 `24`，`versionName` 升级为 `2.5.12`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.12.exe`：39,425,782 字节（37.6 MB），SHA256 `5AB2F6B284675D85C7131ACCD39BAAD4372FE08E38146C52596A227B3FF9C598`

### 验证

- `npm run test`：通过（41 个测试文件，349 个测试用例；含 `goal-mindmap-core`、`pc-stat-liquid`、`release-notes`）。
- `npm run verify:ui-encoding`：通过（`installer.nsi` utf8-bom）。
- `npm run verify:dist-assets`：通过。

---

## v2.5.11 (2026-09-20)

> 记录依据：`v2.5.10` 发布提交之后的目标计划思维导图全链路交付（结构导图、完成态语义、新拟态 UI、交互与相机动画）。

### 新增

- **目标计划思维导图**：详情页「列表 / 思维导图」切换；项目卡片「查看思维导图」直达；任务树自动生成层级连线；支持跨分支手动关联与「只看未完成」筛选。
- **节点二级菜单**：单击任务节点弹出菜单，支持完成/取消完成、添加子任务、重命名、复制、优先级、执行中标记、在列表中定位与删除。
- **应用内最大化画布**：导图可最大化占满视口，支持适应画布、重置视图、缩放指示与 Esc 退出。

### 优化

- **连线与完成态语义**：圆角正交连线 + 一级分支配色；左侧状态（未完成/部分完成/已完成）、右上优先级角标、父/根节点 `done/total` 进度。
- **新拟态视觉**：节点/工具条/图例对齐 `--pc-neu-*` Token；画布点阵纹理与四边羽化；图例防重叠。
- **交互手感**：拖拽平移惯性阻尼；滚轮指针锚点缩放；适应画布/最大化/聚焦节点使用相机过渡动画。

### 修复

- **菜单节点标题污染**：取消节点菜单后标题完整恢复，不再被三点动画样式破坏。
- **定位后再最大化**：在列表中定位后返回导图可再次进入最大化。
- **底栏图例重叠**：图例布局与层级修复，避免文字互相遮挡或被羽化层吃掉。

### 发布

- 版本号统一升级至 `2.5.11`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本统一升级至 `2.5.11`。
- Android `versionCode` 从 `22` 递增至 `23`，`versionName` 升级为 `2.5.11`。
- 已完成 PC 端核心安装包构建（基于当前主分支工作区）：
  - `PromptImageManager-Setup-2.5.11.exe`：39,421,840 字节（37.6 MB），SHA256 `3C0A7B27857DCBB371BABD6DADADDD9B7173AE64B77365902B021BFE4BF7B842`

### 验证

- `vitest` 目标计划相关：`goal-mindmap-core` 等通过（含构图/布局/相机/惯性/筛选）。
- `scripts/goal-mindmap-neu-visual.mjs`：VISUAL_PASS（菜单/筛选/最大化/新拟态/四边羽化/图例/相机过渡）。
- 发布前将执行：`npm test`、`npm run build`、`python scripts/build_pc_package.py`、`publish_release.ps1 -DryRun` 后正式发布。

---

## v2.5.10 (2026-09-20)

> 记录依据：`v2.5.9` 发布提交 `31337d4` 之后的工作区缺陷扫描与修复（UI 乱码、移动端筛选标签、测试 mock、编码与资源回归门禁）。

### 修复

- **确认弹窗与右键菜单中文乱码**：通用确认/输入弹窗标题与「取消/确定」按钮、二级菜单箭头文案恢复为正确中文与符号。
- **移动端筛选标签布局**：横向滚动筛选条中的标签增加不可收缩约束，长标签不再被压缩换行。
- **安装器中文编码**：`build/installer.nsi` 恢复 UTF-8 with BOM，避免 NSIS 按 ANSI 解析导致安装界面中文乱码。
- **库页测试 mock 缺口**：补全详情链路所需 mock 导出，消除测试运行时 mock 缺失报错。

### 优化

- **构建产物资源校验**：新增 `verify:dist-assets` / `verify:ui-encoding` / `verify:defects`，可在发布前检查 dist CSS 资源解析与源码乱码特征。

### 发布

- 版本号统一升级至 `2.5.10`；发布 Windows Setup 安装包。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本统一升级至 `2.5.10`。
- Android `versionCode` 从 `21` 递增至 `22`，`versionName` 升级为 `2.5.10`。
- 已完成 PC 端核心安装包构建（基于当前主分支工作区）：
  - `PromptImageManager-Setup-2.5.10.exe`：39,392,665 字节（37.6 MB），SHA256 `4F0FA110481640403F51B8943ACF03AE1628BD3F5FD738C26382D05DD1C729DD`


### 验证

- `npm run test`：通过，39 个测试文件、308 个测试用例。
- `venv python -m pytest python/tests -q`：通过，77 个用例。
- `npm run test:rust`：通过，3 个用例。
- `npm run build`：成功。
- `npm run verify:defects`：通过（ui-encoding + dist-assets）。
- `python scripts/build_pc_package.py`：成功（Vite + PyInstaller + NSIS）。
- 产物检查：`dist/index.html` 与内置前端 meta 均为 `2.5.10`。

---

## v2.5.9 (2026-09-18)

> 记录依据：`v2.5.8` 发布提交 `f5f85ea` 之后的主分支变更（`4e259b7`）：应用内更新安装完成后自动重启。

### 新增

- **更新后自动重启**：PC 应用内自动更新静默安装完成后，自动拉起新版本应用，无需再手动打开软件。

### 优化

- **安装覆盖目录**：静默安装会带上当前安装目录参数，降低自定义路径被装回默认目录的概率。
- **安装结果校验**：安装请求携带目标版本号，helper 在启动新版本前核对版本信息，减少误启动。

### 发布

- 版本号统一升级至 `2.5.9`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器、安装器壳版本已统一升级至 `2.5.9`。
- Android `versionCode` 从 `20` 递增至 `21`，`versionName` 升级为 `2.5.9`。
- 已完成 PC 端核心安装包构建（基于当前主分支 HEAD）：
  - `PromptImageManager-Setup-2.5.9.exe`：39,392,086 字节（37.6 MB），SHA256 `3C308CA97C4573E59D3BCF4DBF98196F681D47FD204C9552F8CD531DE6D941A4`

### 验证

- `python -m pytest python/tests/test_auto_update.py -q`：通过，23 个用例（含自动重启 helper / 安装目录解析）。
- `python -m pytest python/tests -q`：通过，77 个用例。
- `npm test`：通过，39 个测试文件、307 个测试用例。
- `npm run build`：成功。
- `python scripts/build_pc_package.py`：成功（Vite + PyInstaller + NSIS）。
- 产物检查：`dist/index.html` 与内置前端 meta 均为 `2.5.9`。

---

## v2.5.8 (2026-09-18)

> 记录依据：`v2.5.7` 安装包构建提交之后的主分支变更（`f5f8395` / `ae53d3a` / `ec50e30` 等）：侧栏重组、卡片视差、封面压缩、图片查看器 FLIP。

### 新增

- **侧栏「更多菜单」**：PC 侧栏工具区收进更多入口，主题切换更清晰。
- **目标计划 / 摸鱼时间卡片 3D 视差**：卡片随指针轻微倾斜，层次感更强。

### 优化

- **图片查看器 FLIP 转场**：缩略图可平滑展开到全屏，关闭时反向收回（详情 / 编辑器 / 目标 / 资源库）。
- **目标项目封面导入压缩**：自动压为 WebP（长边 1600、质量 0.85）；上传限制 jpeg/png/webp 且不超过 15MB。

### 发布

- 版本号统一升级至 `2.5.8`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器版本已统一升级至 `2.5.8`。
- 已完成 PC 端核心安装包构建（基于当前主分支 HEAD）：
  - `PromptImageManager-Setup-2.5.8.exe`：39,389,093 字节（37.6 MB），SHA256 `1143DF202F8486DB01B67006F921C7D1422D1D7068D830C9CB264A1EB6783C1C`

### 验证

- `npm test`：通过，39 个测试文件、307 个测试用例（含 plant / parallax / image-viewer / cover / release-notes）。
- `npm run build`：成功。
- `python scripts/build_pc_package.py`：成功（Vite + PyInstaller + NSIS）。
- 产物检查：`dist/index.html` 与内置前端 meta 均为 `2.5.8`。

---

## v2.5.7 (2026-09-17)

> 记录依据：首页挂机种植物正式实装（30 天轮回 + 本地持久化）。

### 新增

- **首页挂机种植物**：欢迎区横幅内 30 天真实日历轮回（生长→开花→凋落→铲除重开）。
- **养护交互**：浇水 / 施肥 / 除害（含反馈动画）；不加速生长。
- **本地持久化**：`plant.json` 与提示词同数据目录，更新/重装可恢复；备份 JSON 含 plant。
- **体验**：天数徽章、满级铲除提示、设置页「重置挂机植物」、离线暂存轻提示。

### 发布

- 版本号统一升级至 `2.5.7`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器版本已统一升级至 `2.5.7`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.7.exe`：39,385,197 字节（37.6 MB），SHA256 `7C134B46C026D9047A2B240BCA54D5E3903E84D51F383E25B6AC7E9A2FA53AB9`

### 验证

- `npm test`（plant-core / plant-persist / pc-cursor）：通过。
- `npm run build`：成功。
- `python/main.py` 增加 `GET/POST /api/plant`；`build/probe_install.py` 覆盖 plant 落盘检查。

---

## v2.5.6 (2026-09-16)

> 记录依据：`v2.5.5` 发布后用户反馈「检查更新失败 [SSL: UNEXPECTED_EOF_WHILE_READING]」。

### 修复

- **检查更新网络加固**：每个候选 URL 最多重试 3 次；直连 GitHub 失败后回退 `ghproxy.net` 与 jsDelivr（`@main/releases/latest.json`）。
- **安装包下载镜像回退**：GitHub Release 直连失败时自动尝试 `ghproxy.net` 前缀镜像。
- **错误文案**：SSL/EOF/超时/DNS 失败转为可读中文说明。

### 发布

- 版本号统一升级至 `2.5.6`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器和安装器壳版本已统一升级至 `2.5.6`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.6.exe`：35,636,349 字节（34.0 MB），SHA256 `D704D7B0B55549E9517E02E09C1479DF2AA7BAC5AFC3E16F0D8CA2ACA4A6C52C`

### 验证

- `python -m pytest python/tests`：通过，68 个用例（含镜像回退与友好错误）。
- 真实网络：直连 GitHub 失败时 `fetch_latest_meta()` 成功回退并读到 v2.5.5 元数据。

---

## v2.5.5 (2026-09-16)

> 记录依据：`v2.5.4` 发布提交 `028aed6` 之后的应用内更新进度可视化改动。

### 新增

- **阶段式更新进度弹窗（PC）**：确认更新后展示模态进度，包含下载百分比、已下/总量与速度，以及「下载安装包 / 校验完整性 / 启动安装」三阶段状态。
- **可取消与重试**：下载中可取消；失败后可在弹窗内重试，无需重新走完整检查流程。

### 优化

- **异步下载 Job**：`POST /api/update/download` 立即返回 `jobId`，前端轮询 `GET /api/update/progress`；新增 `POST /api/update/download/cancel`。
- **设置页软件更新卡片**：独立面板展示当前版本、检查更新按钮与上次检查提示。
- **三入口统一**：启动静默更新、设置页、侧边栏「检查更新」共用同一进度弹窗。

### 发布

- 版本号统一升级至 `2.5.5`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器和安装器壳版本已统一升级至 `2.5.5`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.5.exe`：35,632,272 字节（34.0 MB），SHA256 `397661259F52C79872EF7338186748F2A783778B138C0A117FEFAE1EDE4E522D`

### 验证

- `npm test`：通过，34 个测试文件、270 个测试用例（含 auto-updater / 进度弹窗）。
- `python -m pytest python/tests`：通过，63 个用例（含下载 Job 进度与取消）。
- `npm run build`：成功。
- 产物检查：内置前端版本 meta 为 `2.5.5`。

---

## v2.5.4 (2026-09-16)

> 记录依据：`v2.5.3` 发布提交 `7b864cb` 之后的功能改动（摸鱼时间小游戏）。

### 新增

- **摸鱼时间游戏中心（PC）**：侧栏入口改为「摸鱼时间」（`/games`），卡片展示游戏简述，确认后进入。
- **俄罗斯方块**：10×20 棋盘、七种方块与 7-bag、消行计分与等级加速、暂停/重开、本地最高分。
- **飞机大战**：竖版 Canvas、三类敌机波次、自动射击、碰撞扣命、贴图素材渲染、本地最高分。

### 优化

- 飞机大战支持鼠标/触控滑动跟随与按住射击；键盘方向键与 Space 仍可用。
- 飞机、子弹与特效替换为对齐应用软拟态风格的透明底贴图（`src/assets/pc/games/plane/`）。

### 修复

- 飞机大战敌机贴图朝向修正：新素材机头已朝下，取消绘制层 180° 翻转。

### 发布

- 版本号统一升级至 `2.5.4`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器和安装器壳版本已统一升级至 `2.5.4`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.4.exe`：35,624,252 字节（34.0 MB），SHA256 `D5C64D9D484FA65CD7093647E0F1B08FD164C60D94A707C68B22B9CE29BE9FEF`

### 验证

- `npm test`：通过，34 个测试文件、262 个测试用例（含 tetris-core / plane-war-core）。
- `npm run build`：成功，贴图资源打入 `dist/assets/`。
- 产物检查：内置前端版本 meta 为 `2.5.4`。

---

## v2.5.3 (2026-09-15)

> 记录依据：`v2.5.2` 发布提交 `0cc1bf2` 之后的工作区功能改动。

### 新增

- **应用内自动更新（PC）**：启动静默检查 GitHub Releases 的 `latest.json`；设置页支持「检查更新」；确认后下载安装包、校验 SHA256，并以 NSIS `/S` 静默覆盖安装后退出应用。
- **更新元数据发布链路**：`publish_release.ps1` 发版时自动生成并上传 `latest.json`（含 version / url / sha256）。

### 发布

- 版本号统一升级至 `2.5.3`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、NSIS 安装器和安装器壳版本已统一升级至 `2.5.3`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.3.exe`：35,367,872 字节（33.7 MB），SHA256 `3E090980FD4C1F09E1692896DD3E1831361A53473B02F55FF6727B3E947B5532`

### 验证

- `pytest python/tests/test_auto_update.py`：通过，3 个用例。
- `vitest run src/js/auto-updater.test.js src/js/pc-settings.test.js`：通过，7 个用例。
- 产物检查：内置前端版本 meta 为 `2.5.3`。

---

## v2.5.2 (2026-09-15)

> 记录依据：`v2.5.1` 发布提交 `615c908` 之后的工作区优化改动。

### 优化

- **PC 自定义光标圆环柔光**：完全替换「四角取景框 + 空闲自转 + 语义 glyph」方案，改为品牌色描边圆环；空闲约 28px，悬停可点目标放大至约 44px 并出现半透明柔光，按下略缩。
- **交互与性能**：GSAP `quickTo` 跟随、状态机收敛为 hover / disabled / loading，移除目标框吸附与每帧 parallax，降低视觉噪音与布局开销。
- **可用性**：输入框/可编辑区保留原生光标；`data-cursor="native"` 继续屏蔽自定义光标。

### 发布

- 版本号统一升级至 `2.5.2`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本已统一升级至 `2.5.2`。
- Android `versionCode` 已从 `19` 递增至 `20`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.2.exe`：35,361,433 字节（33.7 MB），SHA256 `4CBFFB92884FA12749F79342CCFF120886BEFFBFF18589A95488FEB8CC5C1094`

### 验证

- `npm test`：通过，31 个测试文件、235 个测试用例全部通过（含 `pc-cursor.test.js` 7 项）。
- `python build\probe_install.py`：通过，goals API 全链路 9 项检查通过。
- 产物检查：内置前端版本 meta 为 `2.5.2`。

---

## v2.5.1 (2026-09-14)

> 记录依据：`v2.5.0` 发布提交 `1d2aa02` 之后的工作区功能改动与文档整理。

### 新增

- **目标计划项目排序**：PC 端「我的项目」支持多维排序，可选默认顺序、按名称、按创建时间、按更新时间、按进度、按存储大小，选择结果本地记忆。

### 优化

- **封面容错**：目标计划项目封面加载失败时自动回退为首字母渐变，避免裂图。
- **窗口尺寸**：PC 端默认窗口尺寸调整为 1600×900。

### 修复

- **封面清理误删**：目标计划图片清理时跳过 `cover` 子目录，并将项目封面路径并入保留列表，避免任务更新/删除时误删封面。

### 发布

- 版本号统一升级至 `2.5.1`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本已统一升级至 `2.5.1`，`build/app_main.py` 已同步封面字段与清理保护逻辑。
- Android `versionCode` 已从 `18` 递增至 `19`。
- 已完成 PC 端核心安装包构建：
  - `PromptImageManager-Setup-2.5.1.exe`：35,361,482 字节（33.7 MB），SHA256 `57F5613C4CBE4B0B249AD24568A65C86160533EF2AC2E2B26CEF3E0FE2A53D50`

### 验证

- `npm test`：通过，31 个测试文件、238 个测试用例全部通过。
- `python -m pytest python/tests/test_build_app_main.py -q`：通过，12 个测试用例全部通过。
- `python build\probe_install.py`：通过，goals API 全链路 9 项检查通过（含端口占用回退至 8889）。
- 产物检查：`build/dist/PromptImageManager/PromptImageManager.exe` 与内置前端 `index.html` 存在，版本 meta 为 `2.5.1`。

---

## v2.5.0 (2026-08-22)

> 记录依据：`v2.4.3` 发布提交 `1661081` 之后、截至 `2d961b3` 的功能提交。

### 新增

- **目标计划清单模块**：PC 与移动端新增目标计划模块，支持工程列表、父子任务层级和任务图片管理，数据由后端统一存储。

### 优化

- **更新记录弹窗**：打开更新记录弹窗即标记当前版本已读，底栏仅保留关闭按钮，关闭后不再重复弹出。

### 发布

- 版本号统一升级至 `2.5.0`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本已统一升级至 `2.5.0`，`build/app_main.py` 已同步目标计划（goal）后端 API。
- Android `versionCode` 已从 `17` 递增至 `18`。
- 已完成 PC 端构建与安装探针验证（goal API 全链路 9 项检查通过）：
  - `PromptImageManager-Setup-2.5.0.exe`：30,575,635 字节（29.2 MB），SHA256 `933563DAAAF8334373122F45A206B01B63274280E1DEA160F796D13B4EA8C2A3`
  - `PromptImageManager-Shell-Setup-2.5.0.exe`：41,104,384 字节（39.2 MB），SHA256 `114A645A498CFAB77C6323936C4F96F17B9E1678A6B6E6EFA0DE229743950778`

---

## v2.4.3 (2026-08-18)

### 发布

- 版本号统一升级至 `2.4.3`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本统一升级至 `2.4.3`。
- Android `versionCode` 从 `16` 递增至 `17`，`versionName` 升级为 `2.4.3`。
- 安装器壳内嵌核心安装包路径同步为 `PromptImageManager-Setup-2.4.3.exe`。
- 重新构建 PC NSIS 安装包并复制到 `releases/`。

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Setup-2.4.3.exe` | `30537071` 字节 | `F8B31841891E75AE447BA6B8610691273370293AC373F3BD869E8F7E578FE720` |

### 验证

- 版本配置静态检查：发布相关源码与配置已统一为 `2.4.3`，Android `versionCode` 为 `17`。
- `npm.cmd run test -- src/js/release-notes.test.js`：通过，4 个测试用例全部通过。
- `npm.cmd run build`：通过，Vite 生产构建成功。
- `python -m PyInstaller build/app.spec --workpath build/build --distpath build/dist --clean -y`：通过，生成 PC 可执行文件。
- `makensis /INPUTCHARSET UTF8 build/installer.nsi`：通过，生成 NSIS 安装包。

---

## v2.4.2 (2026-07-19)

### 新增

- **PC 提示词详情弹窗**：从首页最近使用卡片或提示词库表格行打开提示词时，改为在当前页面内打开详情弹窗，保留搜索、筛选、滚动和浏览上下文。
- **双详情对比阅读**：详情弹窗最多可同时展开两个提示词，支持并排或上下排列，方便对照提示词、版本和图片内容。
- **详情窗口最小化与选区复制**：详情窗口支持最小化到右下角并随时恢复；选中正向或负向提示词文字后可直接复制。

### 优化

- **详情阅读与操作体验**：优化详情标题、封面、缩略图、元信息、提示词正文和底部操作区层级；弹窗支持独立滚动，进入编辑前自动最小化已打开的详情窗口。
- **键盘与动态效果适配**：支持 Esc 关闭当前活动窗口、关闭后回到原始卡片或表格行，并适配“减少动态效果”系统偏好。
- **编辑器图片区空态**：PC 新建和编辑提示词页面在未上传图片时收紧图片区高度，减少无效留白并使上传入口布局更紧凑。

### 发布

- 版本号统一升级至 `2.4.2`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本统一升级至 `2.4.2`。
- Android `versionCode` 从 `15` 递增至 `16`，`versionName` 升级为 `2.4.2`。
- 安装器壳内嵌核心安装包路径同步为 `PromptImageManager-Setup-2.4.2.exe`。

### 验证

- `npm.cmd run test -- src/js/release-notes.test.js src/js/pc-detail.test.js src/js/pc-detail-modal.test.js`：通过，3 个测试文件、10 个测试用例全部通过。
- `npm.cmd run build`：通过；保留既有静态资源运行时解析提示。
- 版本配置静态检查与 `git diff --check`：通过，发布配置已统一为 `2.4.2`，Android `versionCode` 为 `16`。

---

## v2.4.1 (2026-07-18)

> 推送范围：`f159475..82511b4`，以 `v2.4.0` 发布提交之后、`v2.4.1` 发布提交之前的功能提交为记录依据。

### 新增

- **跨端主题与编辑器**：新增跨端主题切换能力，并优化提示词编辑器交互与跨端一致性。
- **图片下载体验**：完善图片下载流程、下载记录与移动端图片保存体验。
- **工作台主题视觉**：补充工作台主题表现与暗色欢迎横幅。

### 优化

- **提示词管理界面**：优化 PC 与移动端提示词管理界面和操作交互。
- **PC 设置页**：调整设置页布局与视觉层级，提升信息浏览效率。
- **字体一致性**：统一应用与安装器默认字体，改善多端文字显示表现。

### 修复

- **侧栏收起导航**：修复 PC 侧栏收起状态下导航布局不稳定的问题。

### 发布

- 版本号统一升级至 `2.4.1`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本统一升级至 `2.4.1`。
- Android `versionCode` 从 `14` 递增至 `15`，`versionName` 升级为 `2.4.1`。
- 同步主应用与安装器壳 Cargo 锁文件，并将安装器壳内嵌核心安装包路径更新为 `PromptImageManager-Setup-2.4.1.exe`。

### 验证

- **PC 样式模块化**：拆分 PC 端样式模块，同时保持既有样式加载顺序。
- **质量与文档维护**：补充全局 CSS 验收计划，并同步跨端界面、主题、编辑器与发布使用说明。

---

## v2.4.0 (2026-07-15)

### 新增

- **ZIP 备份图片恢复**：完整备份恢复流程支持还原 ZIP 备份中的原始图片资源，并返回图片恢复数量、冲突项和备份路径。
- **应用内更新记录**：PC 更新记录弹窗补充 `v2.4.0` 的结构化版本说明，未阅读当前版本时可自动提示并支持手动查看。

### 优化

- **PC 详情图片体验**：优化提示词详情页的封面浏览、多图切换和图片预览交互。
- **设置与导航体验**：优化 PC 侧栏工具入口，并统一 PC 与移动端设置页的版本信息展示。
- **运行链路反馈**：完善备份、存储、局域网同步和开发服务启动过程中的状态处理与错误反馈。

### 修复

- **移动端预览遮罩清理**：修复提示词详情图片预览在关闭或页面卸载后可能残留全局遮罩的问题。

### 发布

- 版本号统一升级至 `2.4.0`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本统一升级至 `2.4.0`。
- Android `versionCode` 从 `13` 递增至 `14`，`versionName` 升级为 `2.4.0`。
- 修正主应用与安装器壳 Cargo 锁文件的应用包版本，并将安装器壳内嵌核心安装包路径同步至 `PromptImageManager-Setup-2.4.0.exe`。

---

## v2.3.7 (2026-07-14)

### 发布

- 版本号统一升级至 `2.3.7`；详见下方「版本与打包」。

### 版本与打包

- 主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器、README 徽标和 `index.html` 版本元信息统一收口为 `2.3.7`。
- 新增 `src/js/core/version-info.js` 共享版本号模块，统一为 PC 与移动端设置页提供版本号读取与渲染能力。

---

## v2.3.6 (2026-05-25)

### 优化

- **提示词库返回位置保留**：PC 端提示词库从详情页返回后保留上次查看的页码、选中提示词和表格滚动位置，减少重新定位成本。

### 发布

- 版本号统一升级至 `2.3.6`；详见下方「版本与打包」。

### 版本与打包

- **版本号升级**：主应用、PC 发布配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳发布版本统一升级到 `2.3.6`。
- **Android 版本递增**：Android `versionCode` 从 `11` 递增到 `12`，`versionName` 升级为 `2.3.6`。
- **PC 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.6.exe`。
- **Tauri semver 收口**：Tauri 配置、Cargo 包版本和 Windows 文件版本统一使用合法 semver `2.3.6`。

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.6.exe` | `35448832` 字节 | `389CB81FAE1920D5166DD0A9B8AF781C7A51188ADA1EA51E1FA00D2924540871` |
| `releases/PromptImageManager-Setup-2.3.6.exe` | `25671325` 字节 | `1D1C6366A88E6947463A76AC1DDCC5E312D7AA4FE1434D4A48C27D04E14E1460` |
| `releases/PromptImageManager-v2.3.6-Android.apk` | `46868242` 字节 | `611B96CE2B56F6E46E93AA1E6A64003B2BCE2F54B30FE7B43CB076D9CF102688` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.6`，第三方依赖自身版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='12'`、`versionName='2.3.6'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.6`，文件描述为 `提示词管家安装向导`。
- GitHub Release：已创建 `v2.3.6`，上传 `PromptImageManager-Shell-Setup-2.3.6.exe` 与 `PromptImageManager-v2.3.6-Android.apk`；Release 正文 UTF-8 回读无 ASCII 问号和连续问号替换标记，两份公开下载链接范围请求均返回 `206 Partial Content`。
- Android 真机状态：`adb devices -l` 未检测到已连接设备，因此本轮未执行 APK 真机安装；APK 构建、签名和元信息校验已完成。

---

## v2.3.5 (2026-05-25)

### 发布

- 版本号统一升级至 `2.3.5`；详见下方「版本与打包」。

### 版本与打包

- **版本号升级**：主应用、PC 发布配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳发布版本统一升级到 `2.3.5`。
- **Android 版本递增**：Android `versionCode` 从 `10` 递增到 `11`，`versionName` 升级为 `2.3.5`。
- **PC 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.5.exe`。
- **Tauri semver 收口**：Tauri 配置、Cargo 包版本和 Windows 文件版本统一使用合法 semver `2.3.5`，不再使用四段式发布版本。

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.5.exe` | `35324416` 字节 | `9357E6C3EE6FD1E083DF7E3FD68639E4334B150F77D10030A78EC3A5904C0E9D` |
| `releases/PromptImageManager-Setup-2.3.5.exe` | `25558163` 字节 | `A968F9DFA1E285383B781095A43687103FA150BB6993E7BB3B43A0CF1BDB7514` |
| `releases/PromptImageManager-v2.3.5-Android.apk` | `46758299` 字节 | `0DE9D05C086B5F37F3061EE50F4F3213C20AF6FD44A88FE31559DA94E8E5FF26` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.5`，第三方依赖自身的 `fsevents 2.3.3` 版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='11'`、`versionName='2.3.5'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.5`，文件描述为 `提示词管家安装向导`。

---

## v2.3.4.1 (2026-05-24)

### 发布

- 版本号统一升级至 `2.3.4.1`；详见下方「版本与打包」。

### 版本与打包

- **版本号升级**：主应用、PC 发布配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳发布版本统一升级到 `2.3.4.1`。
- **Android 版本递增**：Android `versionCode` 从 `9` 递增到 `10`，`versionName` 升级为 `2.3.4.1`。
- **PC 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.4.1.exe`。
- **Tauri semver 兼容**：Tauri 配置版本采用合法 semver `2.3.4+1`，对外发布文件名和 Android `versionName` 继续使用 `2.3.4.1`。

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.4.1.exe` | `35321344` 字节 | `C89FAD75D0F0F8E19F5238146496E9ABD66FF156E62540BF470C2EE8EEB8A364` |
| `releases/PromptImageManager-Setup-2.3.4.1.exe` | `25555622` 字节 | `829CE5C733D55E2B58D59E12A74CEEF11FB51FF2CDE9DB165E54FA12957CF264` |
| `releases/PromptImageManager-v2.3.4.1-Android.apk` | `46755417` 字节 | `BBC50C24837EEA655660CDD4B35B7F3635A711C7BE22C098DF9E0084C0B9EF3F` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.4.1`，第三方依赖自身的 `fsevents 2.3.3` 版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='10'`、`versionName='2.3.4.1'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.4+1`，文件描述为 `提示词管家安装向导`。

---

## v2.3.4 (2026-05-24)

### 发布

- 版本号统一升级至 `2.3.4`；详见下方「版本与打包」。

### 版本与打包

- **版本号升级**：主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳统一升级到 `2.3.4`。
- **Android 版本递增**：Android `versionCode` 从 `8` 递增到 `9`，`versionName` 升级为 `2.3.4`。
- **PC Tauri 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.4.exe`，避免后续打包时继续嵌入旧版本核心安装包。

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.4.exe` | `35320832` 字节 | `46781A78725DE3064DC7340FB3EB9198F437C94C2B8522CA1B8E4AB3FDA4C679` |
| `releases/PromptImageManager-Setup-2.3.4.exe` | `25555099` 字节 | `6B8BB87DA0408949253D229011CBD298738F8F4279147C6462C90601D45724DA` |
| `releases/PromptImageManager-v2.3.4-Android.apk` | `46754849` 字节 | `3D3B5D41F908ABF8C69ED42DDFC72BD6C758A7F88FE32B777A9201753DE8F0E9` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.4`，第三方依赖自身的 `fsevents 2.3.3` 版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='9'`、`versionName='2.3.4'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.4`，文件描述为 `提示词管家安装向导`。
- 自动化回归：`npm.cmd run test` 通过，14 个测试文件、127 个测试用例全部通过；`python -m pytest python/tests -q` 通过，45 个测试用例全部通过；`python -m pytest python/tests/test_build_app_main.py -q` 通过，9 个测试用例全部通过。
- PC 打包版运行探针：开发后端占用 `8888` 时，打包后的 `PromptImageManager.exe` 自动回退到 `8890`，`/api/health`、`/`、`/index.html` 均返回 200。
- PC 核心安装器静默安装验收：临时目录安装返回退出码 `0`，主程序、卸载器、桌面快捷方式、开始菜单启动项和开始菜单卸载项均真实落地；验收后已卸载临时安装并恢复安装前已有快捷方式。
- Android 真机状态：`adb devices` 未检测到已连接设备，因此本轮未执行 APK 真机安装；APK 构建、签名和元信息校验已完成。

---

## v2.3.3 (2026-05-22)

### 发布

- 版本号统一升级至 `2.3.3`；详见下方「版本与打包」。

### 版本与打包

- **版本号升级**：主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳统一升级到 `2.3.3`。
- **Android 版本递增**：Android `versionCode` 从 `7` 递增到 `8`，`versionName` 升级为 `2.3.3`。
- **PC Tauri 安装器壳交付**：PC 端正式产物为带 Tauri 安装器壳 UI 的 `PromptImageManager-Shell-Setup-2.3.3.exe`，内部嵌入 `PromptImageManager-Setup-2.3.3.exe` 核心安装包。

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.3.exe` | `35314176` 字节 | `71685CEDDEF0E90E21A07A9EB8E7422BE044BE6BE5F1DEBCCFAF132490089476` |
| `releases/PromptImageManager-Setup-2.3.3.exe` | `25547667` 字节 | `6813CC0CFA1013A8D73196A8BD19A9C41CBEF1BA824CCD6F4B6EC9E10950786D` |
| `releases/PromptImageManager-v2.3.3-Android.apk` | `46748583` 字节 | `9FB48F2E4D0E8A09C974C8E55707296D9F625094374C113D51D71EA60E79CD72` |

### 验证

- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='8'`、`versionName='2.3.3'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.3`，文件描述为 `提示词管家安装向导`。

---

## v2.3.2 (2026-05-13)

### 新增

- **同步预览接口**：新增 `/api/sync/preview`，移动端同步写入前可查看新增、跳过、冲突、PC 独有数量和字段级差异。
- **同步前备份**：PC 源码后端与安装包后端写入前生成同步前备份，并通过 `backupPath` 返回恢复线索。

### 优化

- **双向同步统一接口**：`LanSync.bidirectional()` 改为统一调用 `/api/sync/bidirectional`，后端返回合并报告和最新快照后再写入 Android 本地。

### 修复

- **冲突副本幂等**：回传冲突副本新增稳定 `conflictKey` 与 `syncMeta` 来源信息，重复回传同一冲突内容时不再生成重复副本。

### 发布

- 版本号统一升级至 `2.3.2`；详见下方「版本与打包」。

### 版本与打包

- **版本号升级**：主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳统一升级到 `2.3.2`。
- **Android 版本递增**：Android `versionCode` 从 `6` 递增到 `7`，`versionName` 升级为 `2.3.2`。
- **PC Tauri 安装器壳交付**：PC 端正式产物为带 Tauri 安装器壳的 `PromptImageManager-Shell-Setup-2.3.2.exe`，内部嵌入 `PromptImageManager-Setup-2.3.2.exe` 核心安装包。

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.2.exe` | `35276800` 字节 | `25E7CE8EC939F427BFD1DEFAC9CA24E46798FB1283830E9088452F2F21832DBD` |
| `releases/PromptImageManager-Setup-2.3.2.exe` | `25518130` 字节 | `00A895BF5D9831D586A258CC9109315E6115FE32974BC76862977E5729302FBF` |
| `releases/PromptImageManager-v2.3.2-Android.apk` | `46744828` 字节 | `51F1FD83C8ADCCE95B0A6145B12BEC54EFDB99CB6D38AC166C032685791F6404` |

### 验证

- 补充源码后端、安装包后端和移动端同步测试，覆盖预览接口、字段差异、幂等冲突副本和双向统一接口。
- `npm.cmd run build`：通过，Vite 生产构建成功。
- `npm.cmd run test`：通过，8 个测试文件、86 个测试用例全部通过；另有 2026-05-21 补充验证：`npm.cmd run test`（9 个测试文件、98 个测试用例）、`python -m pytest python/tests -q`（36 个测试用例）。
- `python scripts/build_pc_package.py --skip-env-check`：通过，生成 PC 核心 NSIS 安装包并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build --skip-env-check`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- `python scripts/build_android_package.py --skip-env-check`：通过，生成签名 Release APK 并复制到 `releases/`。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='7'`、`versionName='2.3.2'`、`targetSdkVersion='36'`。
- PC 打包版运行探针：打包后的 `PromptImageManager.exe` 在 `8888` 被占用时回退到 `8889`，`/api/health`、`/index.html`、`/api/sync/capabilities` 均返回 200。
- PC UI 变动后重打包：2026-05-13 重新执行 PC 核心安装包和 Tauri 安装器壳构建，发布产物大小与 SHA256 已刷新。
- PC 二次 UI 变动后重打包：2026-05-13 再次重新执行 PC 核心安装包和 Tauri 安装器壳构建，打包版直接监听 `8888`，`/api/health`、`/index.html`、`/api/sync/capabilities` 均返回 200。

- 当前执行时 `adb devices -l` 未检测到已连接设备，因此未执行 APK 真机安装；APK 本地构建、签名和元信息校验已完成。
- Android 构建过程中仍有来自 Capacitor 依赖的 Kotlin/Gradle 警告，不阻断 Release APK 生成。

---

## v2.3.1 (2026-05-10)

### 新增

- **PC 与 Android 局域网互通**：Android 端在同一局域网内支持从 PC 拉取、回传到 PC 和双向同步；PC 端新增同步能力声明、设备 ID、配对令牌和写入类接口令牌校验，避免未配对设备直接写入数据
- **Android 回传与双向合并**：新增 `/api/sync/import` 和 `/api/sync/bidirectional`，Android 独有提示词可回传到 PC，双向同步会先回传 Android 本机快照，再拉取 PC 最新结果
- **移动端同步方向选择**：移动端设置页新增“从 PC 拉取 / 回传到 PC / 双向同步”模式选择，同步报告区区分展示新增、覆盖、冲突副本、跳过和图片接收结果
- **局域网 PC 搜索增强**：移动端搜索 PC 时优先探测最近设备，支持搜索进度、结果来源、互通能力标签、点击设备自动填入 IP 并测试连接；保留手动输入 IP 作为稳定兜底
- **PC 图片查看器缩放平移**：PC 端全屏图片查看器支持鼠标滚轮缩放、拖拽平移、双击缩放/复位、复位按钮、缩放比例显示和点击遮罩关闭，详情页封面图与提示词库预览图共用同一能力
- **PC 侧边栏收拉**：PC 左侧导航栏新增展开/收起按钮，收起态保留图标导航并隐藏文字和复杂底部信息，收拉状态持久化到 `localStorage`
- **发布包构建脚本**：新增 Android 安装包构建脚本和 PC/Android 总构建入口，支持将正式发布产物复制到 `releases/`

### 优化

- **局域网动态端口连接**：移动端同步目标统一支持 `IP`、`IP:端口` 和 `http://IP:端口`，搜索 PC 时扫描默认端口范围 `8888-8897`，最近设备按 `ip:port` 保存；PC 安装包端口占用时按顺序回退到 `8889-8897`，拉取、回传、双向同步和图片下载均使用实际端口。

- **PC 默认 16:9 窗口**：Tauri 桌面端默认窗口调整为 `1366 x 768`，最小窗口调整为 `1024 x 576`，提升默认桌面体验比例
- **PC 自适应排版优化**：基于主内容区安全内边距和最大宽度优化首页、提示词库、详情页、编辑页、分类与标签页、设置页的抗挤压排版；表格表头保持单行可读，必要时使用横向滚动兜底
- **提示词详情页重构**：PC 详情页升级为顶部面包屑、天空氛围、16:9 封面、左主右辅双栏、信息概览、版本记录和本地安全提示结构
- **提示词库列表优化**：PC 提示词库表格增加稳定列宽、列表工作台视觉分区、浅蓝选中强调、柔和横向滚动条和分页区重排
- **图片导入共享工具**：图片读取、压缩、最大边长缩放、MIME 与扩展名识别逻辑抽取到 `src/js/shared/image-utils.js`，PC 与移动端编辑页复用同一优化链路
- **已保存图片预览回填**：PC 与移动端编辑页可通过存储层 `getImageUrl()` 回填已保存图片，避免编辑已有提示词时图片预览缺失
- **移动端分类与设置增强**：移动端分类页补充分类重命名、改色、删除、批量改色、合并分类和清理空分类等快捷操作；设置页同步区补齐搜索、连接测试、拉取、回传和双向同步流程
- **安装包中文与图标规范**：构建脚本和 NSIS 构建流程统一 UTF-8 处理，安装器、快捷方式和卸载项统一绑定应用图标，降低中文乱码和白板图标风险

### 修复

- **Android WebView Mixed Content 拦截**：启用 `android.allowMixedContent=true` 和 `android:usesCleartextTraffic="true"`，修复 Android 应用内 HTTPS 页面无法请求局域网 HTTP 同步服务的问题
- **同内容回传误判冲突**：后端新增 `normalize_prompt_for_compare()` 与 `is_same_prompt_set()`，冲突判断忽略端侧生成型 ID、时间字段、图片 Data URL、图片体积、MIME 类型和字段命名差异；同内容回传计入跳过，不再生成重复冲突副本
- **局域网写入接口保护**：回传和双向同步接口缺少或携带错误 `X-Sync-Token` 时返回 `401`，避免未配对写入
- **PC 安装包局域网互通不可用**：修复 `build/app_main.py` 落后于源码后端的问题，安装包后端改为监听 `0.0.0.0`，并补齐能力声明、配对、回传和双向同步接口；前端 API 层对 HTML 响应给出明确错误提示

### 发布

- 局域网互通与图片查看器能力随 `2.3.1` 一并交付。

### 验证

- `/api/health` 扩展返回 `device_id`、`device_name`、`platform`、`sync_version`、`pairing_required` 和 `capabilities`
- 新增 `/api/sync/capabilities`、`/api/sync/pairing`、`/api/sync/import`、`/api/sync/bidirectional`
- 新增 `sync-device.json` 运行时设备信息文件，用于保存 PC 设备 ID 和同步令牌
- `LanScanner` 支持最近设备优先探测、候选网段去重、扫描进度回调和搜索中止
- `LanSync` 支持拉取、回传、双向同步和配对令牌读取
- `pc-utils.js` 内部新增图片查看器状态模型，统一维护缩放倍数、平移量、拖拽状态和复位逻辑
- `pc-app.js` 新增侧边栏收起状态读取、切换、持久化和本地数据占用圆环展示
- `python/tests/test_main.py` 补充同步令牌校验、冲突副本、同内容跳过和双向同步相关测试
- 新增 `src/js/image-utils.test.js` 和 `src/js/lan-sync.test.js`，覆盖图片处理与局域网同步核心逻辑

- `npm run test`：7 files passed，76 tests passed
- `npm run build`：通过，Vite 构建成功
- `python -m pytest python/tests/test_main.py -q`：25 passed
- `npm run test -- lan-sync.test.js`：5 passed
- Android 真机与 PC 局域网互通验证通过，覆盖连接测试、从 PC 拉取、Android 回传到 PC、双向同步、图片传输和同内容回传去重

- 真机测试数据中仍保留首次冲突误判前产生的两个 `Android冲突副本`，后续修复不会再因同内容、不同生成型字段或时间字段重复生成此类副本
- Android 自动搜索在 WebRTC 获取本机网段失败时仍依赖最近设备和常见网段，手动输入 IP 仍是稳定兜底路径
- PC 图片查看器与 PC 16:9 排版仍保留部分人工视觉验收项，当前已完成构建验证

---

## v2.2.21 (2026-05-04)

### 新增

- **局域网自动发现 PC 端**：移动端打开同步弹窗时自动扫描局域网内的 PC 端设备，点击设备卡片即可自动填入 IP 地址，无需手动输入；支持刷新扫描和手动输入回退
- **同步进度条增强**：新增进度百分比显示、已用时间和预估剩余时间，方便用户判断同步进度和等待时长

### 优化

- **暗色模式图标修复**：暗色模式下所有 SVG 图标（顶栏按钮、详情页操作按钮、右键菜单、帮助弹窗、同步状态等）通过 CSS `filter` 方案正确显示为浅色，不再因 `currentColor` 无法继承而显示为不可见的黑色
- **暗色模式全局配色一致性**：新增 `--mono-icon-filter` CSS 变量统一控制暗色/亮色模式下的图标滤镜，主题切换时图标颜色平滑过渡
- **图片导入 JPG 压缩**：导入图片时自动转换为 JPG 格式并压缩（quality=0.92），透明通道自动填充白色背景，压缩后体积大于原图时保留原始格式，显著减少存储空间和同步传输量
- **PC 端设备标识**：`/api/health` 接口新增 `device_name` 字段，返回计算机名称，方便移动端识别目标设备

### 验证

- 新增 `LanScanner` 类（`lan-sync.js`）：WebRTC 获取本机 IP + HTTP 并发扫描局域网，并发数 30，超时 1.5s
- 新增 `compressImageToJpeg()` 函数（`app.js`）：Canvas API 压缩，白底填充透明通道，体积对比保底
- 新增 `formatDuration()` 函数（`app.js`）：毫秒转可读时间格式（Xs / Xm Ys / Xh Ym）
- `main.css` 新增 `--mono-icon-filter` 变量、设备发现区域样式、进度条增强样式
- `index.html` 同步弹窗新增设备发现区域和进度条增强元素
- `python/main.py` 新增 `import platform`，`/api/health` 返回 `device_name`

---

## v2.2.1 (2026-05-04)

### 新增

- **新手引导教程**：首次使用时弹出分步引导教程，手绘风格箭头指引，聚光灯高亮，支持跳过和重播
- **帮助按钮**：Header 新增帮助按钮，可重新触发引导教程
- **启动画面**：新增启动画面（Splash Screen），最小展示 1.2 秒后淡出
- **SVG 图标系统**：所有 Emoji 图标替换为语义化 SVG 图标，统一管理于 `src/assets/icons/` 目录

### 优化

- `app.js` 从 1402 行扩展到 1526 行，新增引导教程集成、SVG 图标引用、帮助按钮逻辑
- `sqlite-storage.js` 从 351 行扩展到 367 行
- `main.css` 从 1087 行扩展到 1384 行，新增引导教程样式、启动画面样式、帮助按钮样式
- `responsive.css` 从 272 行扩展到 423 行，新增引导教程和启动画面的响应式适配
- 新增 `tutorial.js`（462 行）引导教程模块

### 修复

- 修复 Android 端构建兼容性问题（Java 版本修补脚本）

---

## v2.1.0 (2026-05-03)

### 新增

- **提示词一键复制**：正向/反向提示词一键复制到剪贴板（含 `execCommand` fallback）
- **提示词预览弹窗**：二级窗口完整预览正向/反向提示词和版本备注，支持弹窗内复制
- **暗色/亮色主题切换**：支持主题切换，localStorage 持久化，系统偏好跟随，动态更新 theme-color meta

### 优化

- CSS 变量体系完善：新增亮色主题变量定义（`[data-theme="light"]`）
- 动画增强：新增 `fadeIn`、`modalIn`、`zoomIn`、`slideIn` 动画
- 主题切换按钮图标：暗色模式显示太阳☀，亮色模式显示月亮🌙

---

## v2.0.0 (2026-05-03)

### 新增

- **文件夹管理**：支持创建/删除/重命名文件夹，颜色标签分类，集合移动到文件夹
- **暗色/亮色主题切换**：支持主题切换，localStorage 持久化，系统偏好跟随
- **提示词预览**：二级窗口完整预览正向/反向提示词和版本备注
- **一键复制**：正向/反向提示词一键复制到剪贴板（含 fallback）
- **右键/长按菜单**：集合项右键弹出操作菜单（删除/重命名/复制/移动到文件夹）
- **视图切换**：列表视图/文件夹视图切换
- **局域网同步**：Android 端从 PC 端拉取全量数据，冲突检测与合并
- **手势返回**：移动端支持系统返回键/手势返回上一级（History API）
- **PC 端 IP 显示**：PC 端显示本机局域网 IP，方便同步
- **同步接口**：新增 `/api/sync`、`/api/sync/images/{filename}`、`/api/network-info`

### 优化

- 新增版本时提示词为空（不继承旧版本内容），「复制为新版本」保持复制行为
- Python 后端监听地址从 `localhost` 改为 `0.0.0.0`，支持局域网访问
- 前端代码重构：`app.js` 从 596 行扩展到 1402 行，支持更多功能
- CSS 变量体系完善：新增 `--text3`、`--radius-sm/md/lg`、`--transition-fast/normal` 等变量
- 亮色主题变量定义（`[data-theme="light"]`）
- 动画增强：新增 `fadeIn`、`modalIn`、`zoomIn` 动画

### 修复

- **BUG-001**：CORS 跨域请求被拒绝 — 新增 `do_OPTIONS()` 方法，所有响应添加 CORS 头
- **BUG-002**：数据文件为空或损坏时后端崩溃 — `load_data()` 增加容错处理
- **BUG-003**：随机端口导致前端无法连接后端 — 固定使用 8888 端口
- **BUG-004**：并发请求导致数据丢失 — 改用 `ThreadingTCPServer` 多线程处理
- **BUG-005**：应用目录无写权限时数据无法保存 — 新增 `get_data_dir()` 回退机制
- **BUG-006**：前端无法检测后端是否就绪 — 新增 `/api/health` 健康检查 + 轮询重试
- **BUG-007**：v1 自动打开浏览器 — 移除自动打开浏览器逻辑
- **图片 Bug 修复**：修复 PC 端图片 URL 路径问题、移动端图片预览/导入问题

### 验证

- 技术栈基线：Tauri 2.11.0、Capacitor 8.3.1、@capacitor-community/sqlite 8.1.0、@capacitor/filesystem 8.1.2、Vite 8.x、Vitest 4.x。

---

## v1.0.0 (初始版本)

### 新增

- 提示词集合 CRUD
- 多版本管理（添加/删除/重命名/复制版本）
- 提示词编辑（正向/反向，500ms 防抖自动保存）
- 图片上传/删除/查看
- 版本对比
- 数据导入导出（JSON 格式）
- PC 桌面端（Tauri 封装）
- Android 移动端（Capacitor 封装）
- Web 端（Vite + Python 后端）

### 修复

> 以下问题在初始版本中已知，已于 `v2.0.0` 修复。

- CORS 跨域请求被拒绝
- 数据文件为空或损坏时后端崩溃
- 随机端口导致前端无法连接后端
- 并发请求导致数据丢失
- 应用目录无写权限时数据无法保存
- 前端无法检测后端是否就绪
- 自动打开浏览器（桌面端不需要）
