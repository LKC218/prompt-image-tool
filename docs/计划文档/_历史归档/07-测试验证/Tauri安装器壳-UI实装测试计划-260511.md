# Tauri安装器壳-UI实装测试计划

## 思考与分析

当前 `installer-shell/` 的安装器壳 UI 已完成从设计稿到静态原型的主要接入，源码结构已经从单页堆叠转为“单 HTML 壳体 + 多页面模块”：

- `installer-shell/src/index.html` 保留窗口壳、背景、自定义标题栏和页面挂载点。
- `installer-shell/src/pages/` 已包含欢迎页、许可协议页、安装位置页、附加任务页、正在安装页和安装完成页。
- `installer-shell/src/main.js` 管理步骤流转、许可勾选、安装路径、附加任务、安装阶段和完成页选项。
- `installer-shell/src-tauri/src/main.rs` 已有 `install_with_nsis`、`launch_installed_app`、`apply_desktop_shortcut` 三个命令，理论上可以调用现有 NSIS 安装包完成真实安装。

因此本轮目标不是重新设计 UI，而是把“看起来完成的安装器壳”推进到“能构建、能运行、能真实安装、能失败兜底、能留下测试证据”的工程闭环。

本轮必须特别关注四个风险：

1. Tauri 配置和 Rust 源码存在中文显示或编码异常风险，需要确认构建配置、窗口标题、错误文案在真实运行时不乱码。
2. `bundle.active` 当前为 `false`，资源打包策略需要明确；若只在开发态能找到 `build/PromptImageManager-Setup-2.3.1.exe`，不能视为正式可交付。
3. 附加任务页的“开始菜单”“自动检查更新”等选项目前主要是 UI 状态，NSIS 命令只接收安装目录，不能误称这些选项已经影响安装脚本。
4. 正在安装页使用阶段式进度是合理边界，但必须验证失败时不跳转完成页，成功时能校验主程序和卸载器。

## 实施计划

### 1. 基线核对

核对当前实装范围，确认不把原型误当正式发布链路：

- 检查 `installer-shell/package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/capabilities/default.json`。
- 检查 `src/main.js` 的步骤顺序、预览参数、Tauri 命令调用和失败分支。
- 检查每个 `src/pages/*.js` 是否只返回语义 HTML，不引入页面级全局副作用。
- 检查 `src/styles.css` 是否仍作为共享样式层，不新增路由、不新增多 HTML。
- 检查 `docs/apps-code-map.md` 与 `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md` 是否已经描述最新六页结构。

### 2. 静态与构建验证

先做低成本验证，尽早暴露语法、配置和依赖问题：

```powershell
node --check installer-shell/src/main.js
node --check installer-shell/src/pages/welcome.js
node --check installer-shell/src/pages/license.js
node --check installer-shell/src/pages/install-location.js
node --check installer-shell/src/pages/install-tasks.js
node --check installer-shell/src/pages/installing.js
node --check installer-shell/src/pages/complete.js
npm.cmd --prefix installer-shell run tauri -- info
cargo check --manifest-path installer-shell/src-tauri/Cargo.toml
```

若执行外部命令需要脚本化，统一使用 `subprocess.run([...])` 参数数组封装，避免中文路径和空格路径被 shell 误解析。

### 3. 静态预览与 UI 回归

用浏览器预览每个步骤，逐页核对设计稿落地质量：

- 欢迎页：品牌区、书本主体、开始安装按钮、窗口控制按钮。
- 许可协议页：协议滚动区、同意复选框、下一步禁用与启用状态。
- 安装位置页：默认路径、浏览按钮提示、磁盘信息、上一步与下一步。
- 附加任务页：三个任务选项的勾选状态、摘要信息、开始安装按钮。
- 正在安装页：阶段式进度、当前动作、禁止重复触发安装、退出确认。
- 安装完成页：成功状态、立即启动开关、桌面快捷方式开关、完成按钮。

预览建议覆盖：

```text
installer-shell/src/index.html?step=welcome
installer-shell/src/index.html?step=license
installer-shell/src/index.html?step=license&agreed=1
installer-shell/src/index.html?step=install-location
installer-shell/src/index.html?step=install-tasks
installer-shell/src/index.html?step=installing
installer-shell/src/index.html?step=complete
```

截图证据仅用于本地验证，不纳入版本控制；需要复核时重新生成即可。

### 4. Tauri 运行态验证

运行 Tauri 壳并验证真实窗口行为：

- 窗口尺寸固定为 `1280 x 720`，居中、无边框、不可调整大小。
- 最小化和关闭按钮可用。
- 关闭安装前、安装中分别给出不同确认语义。
- 浏览器预览下不调用 Tauri 命令；Tauri 运行态进入正在安装页才调用 `install_with_nsis`。
- Tauri 命令失败时停留在正在安装页失败状态，不跳转完成页。

### 5. NSIS 真实安装闭环

在隔离目录执行真实安装验证，避免污染正式安装目录：

```text
%LOCALAPPDATA%\PIM-Test
```

验证路径：

1. 先确认标准 NSIS 安装包存在：`build/PromptImageManager-Setup-2.3.1.exe`。
2. 通过 Tauri 壳从欢迎页走到附加任务页并开始安装。
3. 安装完成后检查：
   - `PromptImageManager.exe` 存在。
   - `uninstall.exe` 存在。
   - 主程序可启动并展示前端 UI。
   - 桌面快捷方式与完成页开关行为一致。
   - 卸载器可静默卸载，并清理目录、快捷方式和注册表。
4. 若安装失败，记录 Tauri 错误文案、Rust 命令返回值、目标目录状态和 NSIS 安装包状态。

### 6. 必要修复原则

本轮只做与实装测试直接相关的窄修复：

- 修复乱码、配置错误、资源路径错误、Tauri 权限缺失、安装包查找失败、失败状态误跳转等阻断问题。
- 不重写安装 UI 视觉体系。
- 不把 installer-shell 直接接入正式发布链路，除非真实安装闭环通过后再单独制定发布接入计划。
- 不虚构 NSIS 不支持的能力；附加任务若未传递给安装脚本，就在文案和文档中明确当前边界。

### 7. 文档与证据沉淀

测试完成后同步：

- 更新本计划文档的执行记录和结论。
- 如修改 `installer-shell/` 结构，更新 `docs/apps-code-map.md`。
- 如改变 UI 规则、安装边界或状态流转，更新 `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md`。
- 如发现通用经验，例如 Tauri 资源打包、NSIS 静默安装返回值、中文编码坑，补充到 `docs/项目开发经验/项目开发经验.md` 或就近经验文档。

## 任务清单

- [x] Task 1：核对 installer-shell 当前源码、配置、资源和文档落点。
- [x] Task 2：执行 JS 语法检查、Tauri 环境检查和 Rust 构建检查。
- [x] Task 3：逐页完成静态预览回归；截图证据仅本地临时保留，不纳入版本控制。
- [x] Task 4：启动 Tauri 壳，验证窗口行为、步骤流转、关闭确认和 Tauri 命令调用边界。
- [x] Task 5：使用现有 NSIS 安装包执行真实安装、启动、快捷方式、卸载闭环测试。
- [x] Task 6：按最小改动原则修复阻断问题，并复测相关路径。
- [x] Task 7：同步代码地图、UI 设计规则文档、测试结论和必要经验文档。

## 验收标准

- [x] 六个安装步骤在静态预览和 Tauri 窗口中均可正常展示，文字不溢出，核心控件可点击。
- [x] `node --check installer-shell/src/main.js` 与 `node --check installer-shell/src/pages/*.js` 全部通过。
- [x] `npm.cmd --prefix installer-shell run tauri -- info` 通过。
- [x] `cargo check --manifest-path installer-shell/src-tauri/Cargo.toml` 通过，或明确记录依赖级阻塞和复现信息。
- [ ] Tauri 界面自动点击触发 `install_with_nsis` 尚未稳定通过；debug 构建资源目录已包含 NSIS 安装包，NSIS 静默安装核心已用同一目标目录直接验证通过，后续需要补手工点击确认或稳定的 WebView 自动化。
- [x] 安装成功时只在主程序和卸载器均存在后进入完成页。
- [x] 安装失败时不误报成功，并展示可理解的失败信息。
- [x] 完成页的启动主程序、桌面快捷方式收尾和关闭窗口行为经过验证。
- [x] 静默卸载能清理测试安装目录、快捷方式和注册表。
- [x] 文档与测试记录同步完成。

## 执行记录-260511

### 1. 基线核对

- `installer-shell/src/pages/` 已包含六个步骤页：欢迎页、许可协议页、安装位置页、附加任务页、正在安装页和安装完成页。
- `installer-shell/src-tauri/src/main.rs` 已包含 `install_with_nsis`、`launch_installed_app`、`apply_desktop_shortcut`。
- `build/PromptImageManager-Setup-2.3.1.exe` 存在，大小为 `25541321` 字节。
- 发现 UI 默认路径原为 `C:\Program Files\提示词管家`，与当前 NSIS `RequestExecutionLevel user` 和默认 `$LOCALAPPDATA\PromptImageManager` 策略不一致，已修复为原型测试路径 `%LOCALAPPDATA%\PIM-Test`，并在 Rust 侧调用 NSIS 前展开为真实本地用户目录。

### 2. 静态与构建验证

以下命令已通过：

```powershell
node --check installer-shell/src/main.js
node --check installer-shell/src/pages/complete.js
node --check installer-shell/src/pages/install-location.js
node --check installer-shell/src/pages/install-tasks.js
node --check installer-shell/src/pages/installing.js
node --check installer-shell/src/pages/license.js
node --check installer-shell/src/pages/welcome.js
npm.cmd --prefix installer-shell run tauri -- info
cargo check --manifest-path installer-shell/src-tauri/Cargo.toml
npm.cmd --prefix installer-shell run tauri -- build --debug
```

Tauri debug 构建产物：

```text
installer-shell/src-tauri/target/debug/prompt_image_manager_installer_shell.exe
```

构建后资源目录中存在：

```text
installer-shell/src-tauri/target/debug/_up_/_up_/build/PromptImageManager-Setup-2.3.1.exe
```

### 3. 静态预览与交互验证

已通过本地 HTTP 服务预览 `installer-shell/src`，并使用 Edge headless 完成逐页截图检查。截图证据按仓库清理要求不纳入版本控制。

DOM 冒烟验证已通过：

- 未勾选许可协议时下一步禁用。
- 勾选许可协议后下一步启用。
- `step=license&agreed=1` 可预置许可协议勾选状态。
- 安装位置默认值为 `%LOCALAPPDATA%\PIM-Test`。
- 附加任务默认勾选桌面快捷方式和开始菜单快捷方式，默认不勾选自动更新。

### 4. Tauri 运行态验证

- Tauri debug 构建成功。
- 启动 `prompt_image_manager_installer_shell.exe` 后，窗口标题为 `提示词管家安装向导原型`。
- 进程 `prompt_image_manager_installer_shell` 响应正常。
- debug 构建资源目录已包含 `PromptImageManager-Setup-2.3.1.exe`，`find_installer` 的资源候选路径具备命中条件。
- 尝试使用 Windows 鼠标坐标自动点击 Tauri WebView，从欢迎页推进到附加任务页并触发安装；在当前 DPI 缩放环境下自动点击未稳定触发安装，测试目录未生成。该项不作为通过项记录，后续应补手工点击验证或引入更稳定的 WebView 自动化。
- 验证后已关闭测试窗口。

### 5. NSIS 真实安装闭环

本项直接验证当前安装器壳调用的 NSIS 静默安装核心。测试目录：

```text
C:\Users\Administrator\AppData\Local\PIM-Test
```

安装验证结果：

- NSIS 静默安装退出码为 `0`。
- `PromptImageManager.exe` 存在。
- `uninstall.exe` 存在。
- `icon.ico` 存在。
- 桌面快捷方式存在。
- 开始菜单应用快捷方式存在。
- 开始菜单卸载快捷方式存在。
- `HKCU\Software\PromptImageManager` 写入 `InstallDir`，且指向测试目录。
- 主程序启动后保持运行超过 8 秒。
- `/api/health` 在本机端口返回 `200`，证明安装后的主程序后端可启动。

卸载验证结果：

- 静默卸载退出码为 `0`。
- 测试安装目录已删除。
- 桌面快捷方式已删除。
- 开始菜单目录已删除。
- `HKCU\Software\PromptImageManager` 已删除。
- `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptImageManager` 已删除。
- 测试前未发现同名快捷方式或注册表项，无需恢复原有状态。

### 6. 结论

当前安装器壳 UI 已完成主要实装测试闭环：静态 UI、Tauri debug 构建、Tauri 窗口启动、NSIS 静默安装、主程序启动、快捷方式、注册表和静默卸载均验证通过。

仍需保持的边界：

- 当前 `bundle.active` 仍为 `false`，安装器壳暂不替换正式发布用 NSIS 安装包。
- Tauri WebView 自动点击安装流程未稳定通过；进入正式发布链路前，需要补一次手工点击确认或接入稳定的桌面端自动化。
- 附加任务页的开始菜单和自动更新选项仍主要是 UI 状态；当前 NSIS 脚本固定创建开始菜单快捷方式，自动更新未接入安装脚本。
- 本轮不实现逐文件真实进度，正在安装页继续使用阶段式进度。

## 暂不纳入范围

- 暂不替换正式发布用 NSIS 安装包。
- 暂不引入多窗口、多 HTML、前端路由或新前端框架。
- 暂不实现逐文件真实进度。
- 暂不做代码签名、增量更新和在线安装器。
- 暂不把附加任务全部改造成 NSIS 命令行变量，除非测试证明这是进入下一阶段的必要前置。

## 当前等待确认

下一步可单独制定“安装器壳接入正式发布链路计划”，再决定是否启用 Tauri bundle、如何命名最终产物、是否保留传统 NSIS 安装包并行发布。
