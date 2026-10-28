# 工具脚本说明

本目录存放不属于运行时源码的构建、发包、专项维护与自动化验收脚本。

## 产品官网验收

在根目录安装现有依赖并执行 `npm --prefix website run build` 后，运行 `npm --prefix website test` 和 `node scripts/verify-website.mjs`。若官网预览服务已运行于 `5180`，追加 `--http`；可用 `WEBSITE_TEST_URL` 指定其他回环地址。

验证范围为锚点、功能与平台边界、官方发布链接、隐私边界、生产资源白名单和文档。报告输出到已忽略的 `output/website/静态验收.json`；本脚本不会启动浏览器，不把 HTTP 或静态成功等同于视觉、交互验收。官网用法及浏览器验收范围见 [官网说明](../website/README.md)。

## 侧栏密度与收起验收

运行 `node scripts/verify-sidebar-collapse.mjs`，默认访问 `http://127.0.0.1:5173/?ui=pc`，可用 `SIDEBAR_TEST_URL` 覆盖。独立无头 Edge 核对 14px／短窗口 12px 间距、48px 按钮、20px 留白，逐帧记录文字退场、图标缩放、固定锚点和正文边界，并检查初始状态、反向取消、低动效、浅深色及短窗口末项命中。截图及原始采样报告输出至 `output/sidebar-collapse/`，已由 `.gitignore` 排除，不写业务数据。浏览器验收不代替原生 Tauri 壳验收。

## 侧栏按钮微交互验收

运行 `node scripts/verify-sidebar-micro-motion.mjs`，默认访问 `http://127.0.0.1:5173/?ui=pc`，可用 `SIDEBAR_TEST_URL` 覆盖。独立无头 Edge 验证悬停 1.06 倍与文字右移、按下 0.94 倍、释放回弹逐帧采样、固定点击区域、连续点击、键盘、菜单即时打开、齿轮反馈与低动效。截图和原始采样报告位于现有 `.gitignore` 已排除的 `output/sidebar-micro-motion/`，不写业务数据；截图用于检查视觉状态，动画过程以逐帧报告为证。原生 Tauri 壳仍需独立验收。

## 悬停推开侧栏验收

运行 `node scripts/verify-sidebar-hover.mjs`，默认使用 `http://127.0.0.1:5173/?ui=pc`，可由 `SIDEBAR_TEST_URL` 指定。独立无头 Edge 上下文验证 84px／280px 推开布局、逐帧连续让位、反向切换、残留鼠标焦点、键盘焦点、外置菜单、导航滚动、浅深色和 1280／800 宽度、减少动态效果及无悬停设备。截图和含坐标采样的 `验收报告.json` 输出至 `output/sidebar-hover/`，已有 `.gitignore` 精准排除整个输出目录，不提交业务资料。单元测试：`npx vitest run src/js/pc/pc-sidebar.test.js src/js/pc/pc-app-nav-motion.test.js src/js/pc/pc-window-chrome.test.js`。浏览器验收不替代原生 Tauri 壳验收。

## 顶部衔接验收

`node scripts/verify-window-header.mjs --baseline` 记录调整前的截图和坐标；修改样式后运行 `node scripts/verify-window-header.mjs` 验证。默认使用 `http://127.0.0.1:5173/?ui=pc`，可由 `HEADER_TEST_URL` 指定。覆盖浅深色、1280／800 宽度、收展侧栏和五个其他页面，确认窗口控件命中以及首页正文不下移。浏览器使用独立上下文；原生窗口拖动、最大化须在桌面壳另行验收。输出 `output/window-header/` 已被 `.gitignore` 排除，不提交截图或用户资料。单元测试入口为 `src/js/pc/pc-window-chrome.test.js`。

## 侧栏菜单验收

运行 `node scripts/verify-sidebar-more-menu.mjs`，默认使用现有 `http://127.0.0.1:5173/?ui=pc`，可通过 `SIDEBAR_TEST_URL` 指定开发实例。独立浏览器上下文验证浅深色、悬停展开、视口缩放、菜单命中、外部关闭、Esc 焦点归还及更新记录入口。截图位于已由 `.gitignore` 排除的 `output/sidebar-more-menu/`，不修改业务数据。单元回归：`npx vitest run src/js/pc/pc-app-nav-motion.test.js`。

## 图片处理准备与验收

- `verify-image-settings-density.mjs`：验证设置按任务显隐、比例锁键盘操作、风险确认不被详情展开替代、高级参数折叠保值及真实混合批次，保存浅深色 800／1440 截图。先准备 `resize_validation_fixtures.py` 合成数据，运行 `node scripts/verify-image-settings-density.mjs`。产物 `output/image-settings-density/`；无基线时仅验证功能和布局。`--baseline` 仅用于修改前采集当前高度，再在修改后执行普通验证；不要在已完成版本覆盖历史基线。

- `resize_validation_fixtures.py`：生成横图透明 PNG、竖图透明 WebP、EXIF 方向 JPEG 合成样本；传入尺寸 ZIP 路径后独立回读尺寸、方向、透明度和报告，输出 `.回读.json`。仅使用 `output/image-resize/`。
- `verify-image-resize.mjs`：真实 5174／8898 页面验证尺寸开关、三种模式、比例锁、输入校验、逐图计算、调参不编码、旧结果标记、重新处理、5 轮混合批次 ZIP、浅深色宽窄布局、固定标题、键盘与减少动态效果。先运行 `venv/Scripts/python.exe -X utf8 scripts/resize_validation_fixtures.py`，再运行 `node scripts/verify-image-resize.mjs`；下载回读用 `venv/Scripts/python.exe -X utf8 scripts/resize_validation_fixtures.py output/image-resize/原格式缩放.zip`。
- 数学回归：`src/js/shared/image-resize.test.js` 和 `python/tests/test_image_resize.py` 共用 `tests/fixtures/image-resize-cases.json`；真实引擎测试使用隔离任务目录，不写业务数据。完整回归为 `npm test -- --reporter=dot` 和 `venv/Scripts/python.exe -m pytest python/tests -q`。

- `verify-image-panel-motion.mjs`：使用 5174 验收页面，采样收展中间帧，验证固定面板宽度、连续让位、窄屏覆盖、标题固定、滚动保留、反向切换和减少动态效果。产物 `output/image-panel-motion/`。

- `verify-image-interactions.mjs`：沿用 5174／8898 验收服务，先生成 `image_validation_fixtures.py` 样本；验证控件外观、列表节点／焦点复用、确认与取消、快速切换、颜色校验、减少动态效果及浅深色窄屏。运行 `node scripts/verify-image-interactions.mjs`，输出 `output/image-interactions/`。

- `prepare_image_engines.py`：统一准备 PNG 与 JPEG 引擎，摘要校验并保留许可；JPEG 对外分发须另审对应源码义务。
- `image_validation_fixtures.py`：生成三格式隔离样本，传 ZIP 路径回读格式和尺寸。
- `verify-image-processing.mjs`：真实混合批量优化、PNG／JPEG／WebP 转换、ZIP、缓存、浅深色和响应式验收；产物 `output/image-validation/` 已被忽略。

- `prepare_png_engine.py`：固定 Oxipng 10.2.1 官方 Windows x64 包，校验 SHA256，准备引擎、清单与许可；不执行任意安装器。
- `serve_png_validation.py`：回环地址 8898，隔离目录 `output/png-validation/profile`，静态资源来自 `dist`；不操作既有 8888 服务。
- `png_validation_fixtures.py`：生成合成保真样例并复制两张公开项目素材；传 ZIP 路径时进行独立像素、元数据与体积回读。
- `verify-png-compression.mjs`：使用本机 Edge 的无头 Playwright 验收真实页面，输出截图、下载 ZIP 与验收 JSON。

```powershell
# 后端使用项目虚拟环境；首次需安装 requirements.txt 与 pytest
venv/Scripts/python.exe scripts/prepare_image_engines.py
npm run build
venv/Scripts/python.exe scripts/png_validation_fixtures.py
venv/Scripts/python.exe scripts/serve_png_validation.py
```

另一个终端启动前端：

```powershell
$env:PROMPT_IMAGE_TOOL_API_TARGET='http://127.0.0.1:8898'
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

再开一个终端执行验证：

```powershell
venv/Scripts/python.exe scripts/image_validation_fixtures.py
node scripts/verify-image-processing.mjs
venv/Scripts/python.exe scripts/image_validation_fixtures.py output/image-validation/转换JPEG.zip
node scripts/verify-png-compression.mjs
venv/Scripts/python.exe scripts/png_validation_fixtures.py output/png-validation/批量结果.zip
venv/Scripts/python.exe -m pytest python/tests/test_png_compress.py python/tests/test_image_process.py -q
```

验收产物位于已忽略的 `output/png-validation/`；引擎产物由 `vendor/oxipng/.gitignore` 精准排除。引擎测试需要先完成准备，不以跳过引擎测试冒充成功。前端可用 `PNG_TEST_URL` 指向其他 Vite 实例，后端安全检查仍使用专用 8898 端口。

## 脚本分类索引

### 1. 本地开发与引擎准备
- `start_dev_server.py`：本地开发服务器启动入口，优先复用现有 `5173/8888` 服务，缺失时启动 Python 后端与 Vite 前端，并验证 PC / 移动端预览地址和实际数据目录。
- `一键启动-服务器和网页.bat`（根目录）：Windows 双击入口，直接调用 `scripts/start_dev_server.py --pc-only`，一键启动后端和前端并打开 PC 预览页。
- `prepare_image_engines.py`：统一准备 PNG（Oxipng）与 JPEG（Jpegoptim）引擎，执行 SHA256 校验并保留许可证文件。
- `prepare_png_engine.py`：固定准备 Oxipng 10.2.1 官方 Windows x64 引擎、清单与许可证。
- `compress_icon.py`：压缩 `src/assets/icons/图标.svg` 内嵌的 PNG 数据。会直接改写图标文件，运行前应确认当前工作区状态。

### 2. 构建、打包与发布
- `build_pc_package.py`：**Tauri 主路径**非交互式 PC 发包入口（`vite → server.spec Sidecar → npx tauri build → releases/PromptImageManager-Setup-<ver>.exe`）。禁止 `app.spec` 全量旧壳。
- `build_installer_shell_package.py`：Tauri 安装器壳发布产物构建入口，可将现有 NSIS 安装核心嵌入自定义安装器壳，并输出到 `releases/`。
- `build_android_package.py`：非交互式 Android 安装包构建入口，按 `Vite -> Capacitor sync -> Java 版本修补 -> Gradle assembleRelease -> releases` 顺序执行，并校验版本、签名配置和 APK 产物。
- `build_release_packages.py`：发布包总构建入口，可构建 PC、Android 或全部安装包。
- `prepare_release_sources.py`：校验并准备第三方图片引擎源码分发包，同时复制到 Tauri 安装资源目录。
- `publish_release.ps1`：一键发版脚本（版本一致性校验、Release 创建/更新、上传安装包与源码附件）。
- `normalize_changelog.py` / `gen_release_body.py` / `backfill_release_notes.py`：规范化 `changelog.md` 章节、生成或回填 GitHub Release 更新说明。
- `capture_readme_previews.py`：自动截取并更新 `docs/assets/readme/` 下的 README 界面预览图。
- `patch-java-version.ps1`：将 Capacitor 相关 Gradle 配置中的 Java 版本从 21 修补为 17。该脚本会修改 `android` 和 `node_modules` 下的 Gradle 文件，仅在 Android 构建遇到 Java 版本兼容问题时使用。

### 3. 自动化核验与测试样本（`verify-*` / `*-fixtures`）
- **构建与发布校验**：`verify-ui-encoding.mjs`、`verify-dist-assets.mjs`、`verify_release_package.py`、`verify_frozen_release.py`、`frameless_probe.py`。
- **侧栏与窗口壳验收**：`verify-sidebar-collapse.mjs`、`verify-sidebar-hover.mjs`、`verify-sidebar-micro-motion.mjs`、`verify-sidebar-more-menu.mjs`、`verify-window-header.mjs`。
- **图片处理与缩放验收**：`verify-image-processing.mjs`、`verify-image-resize.mjs`、`verify-image-interactions.mjs`、`verify-image-panel-motion.mjs`、`verify-image-settings-density.mjs`、`verify-png-compression.mjs`；配套样本与隔离服务：`image_validation_fixtures.py`、`resize_validation_fixtures.py`、`png_validation_fixtures.py`、`serve_png_validation.py`。
- **全局轻拟态与专项视觉验收**：`verify-global-neu-sweep.mjs`、`verify-neu-select-sweep.mjs`、`verify-neu-dropdown-audit.mjs`、`verify-appearance-neu-select.mjs`、`verify-pc-home-liquid.mjs`、`repro-liquid-wave-decay.mjs`、`verify-cover-persist.mjs`、`verify-goal-mindmap-height.mjs`、`verify-goal-sort.mjs`、`verify-goal-view-switch.mjs`、`goal-mindmap-visual.mjs`、`goal-mindmap-neu-visual.mjs`、`goal-mindmap-import-visual.mjs`、`verify-website.mjs`。

## 使用原则

- 从项目根目录运行脚本。
- 运行前先检查 `git status`。
- 有副作用的脚本不要接入自动流程，除非已确认构建链确实依赖它。

## 本地开发服务器

从项目根目录运行：

```powershell
python scripts\start_dev_server.py
```

Windows 双击入口：

```powershell
一键启动-服务器和网页.bat
```

只检查现有服务是否可用：

```powershell
python scripts\start_dev_server.py --check-only
```

Windows 默认使用 `%APPDATA%\PromptImageManager\data`。需要隔离测试数据时，在启动前设置 `PROMPT_IMAGE_TOOL_DATA_DIR` 为独立目录。

## PC 快速打包

```powershell
python scripts\build_pc_package.py
```

可选参数：`--skip-frontend` / `--skip-sidecar` / `--skip-tauri` / `--skip-env-check`。  
产物固定 `releases\PromptImageManager-Setup-<version>.exe`（Tauri 约 28MB）。

## Tauri 安装器壳打包

默认会先构建标准 PC 安装核心，再生成双击后显示自定义安装器壳 UI 的发布产物：

```powershell
python scripts\build_installer_shell_package.py
```

只复用已有核心安装包时使用（查找 `releases\` 优先，其次 `build\`）：

```powershell
python scripts\build_installer_shell_package.py --skip-pc-build
```

## Android 快速打包

```powershell
python scripts\build_android_package.py
```

仅在临时验证时允许导出未签名 APK：

```powershell
python scripts\build_android_package.py --allow-unsigned
```

## 发布包总入口

默认构建 PC 与 Android 两类安装包：

```powershell
python scripts\build_release_packages.py
```

只构建单端：

```powershell
python scripts\build_release_packages.py --pc
python scripts\build_release_packages.py --android
```

## 发布源码材料

`venv/Scripts/python.exe scripts/verify_release_package.py` 在发布预演生成 `latest.json` 后，检查版本、哈希、实际 NSIS 文件资源及源码附件一致性。不会访问远端或执行安装。

`venv/Scripts/python.exe scripts/verify_frozen_release.py` 启动真实冻结 Sidecar，以独立数据目录完成三格式转换和缩放回读，结束后关闭该测试进程；不会启动 Vite 或更改用户资料库。结果位于 `output/release-<版本>/frozen/`。

`python scripts/prepare_release_sources.py` 校验并准备图片引擎源码附件，同时复制到 Tauri 安装资源。正式 PC 构建已串联调用；来源和边界见 `docs/构建方案/第三方图片引擎分发说明.md`。生成目录不提交 Git，源码附件随安装包发布。
