# 项目文件导航

本文只作为文件导航和文档更新落点，不记录修改历史、阶段结果或完成说明。

## 项目入口

- `README.md`：GitHub 仓库首页介绍、界面预览、下载入口、快速开始、文档入口和仓库规范入口。
- `package.json`：前端、测试、Tauri、Capacitor 脚本入口。
- `vite.config.js`：Vite 配置，当前前端根目录为 `src`。
- `capacitor.config.ts`：Capacitor 配置，当前 Web 输出目录为 `dist`。
- `requirements.txt`：Python 依赖入口。
- `build.bat`：综合构建入口，PC 安装包构建完成后同步发布副本到 `releases/`。
- `dev.bat`：本地开发启动入口，调用 `scripts/start_dev_server.py` 启动或复用前后端服务。
- `scripts/`：专项维护脚本目录，脚本清单见 `scripts/README.md`。
- `docs/计划文档/根目录历史计划-260503.md`：原根目录历史计划归档。

## 源码目录

- `src/`：前端源码、样式、交互脚本和前端资源。
- `src/js/pc-app.js`：PC 端应用壳层、左侧侧边栏收拉状态、路由挂载和全局快捷键入口，侧边栏收拉按钮位于原安全徽章区域，展开态显示按钮文案，侧边栏本地数据卡片使用设计稿保存插画作为状态图标，并基于本地数据大小驱动圆形统计环与悬浮动效。
- `src/js/pc-welcome-banner.js`：PC 端顶部欢迎横幅共享渲染模块，首页、提示词库、新建/编辑、分类与标签、设置页面共用，并支持编辑页返回与保存动作区布局。
- `src/js/pc-home.js`：PC 端首页仪表盘渲染和交互入口，承载欢迎横幅、悬浮搜索、统计卡、最近使用、收藏分类和快速创建；首页搜索框不保留右侧独立聚焦按钮，标签统计图标使用本地 PNG。
- `src/js/pc-library.js`：PC 端提示词库页面渲染和交互入口，承载搜索筛选、分类夹筛选标签、表格列表、选中预览、分页、收藏、复制和提示词更多操作；分页箭头使用本地 SVG 图标，不使用字符箭头。
- `src/js/pc-detail.js`：PC 端提示词详情页渲染和交互入口，承载顶部面包屑、封面主视觉、标题元信息、正负向提示词展示、右侧信息概览、版本记录和本地安全提示；提示词正文展示会清理前导空白，复制仍保留原始内容，收藏、更多、封面切换、元信息和底部操作图标统一来自本地 SVG。
- `src/js/pc-editor.js`：PC 端新建/编辑提示词页面渲染和交互入口，承载标题、提示词、标签、分类、比例、图片预览与保存流程；正向提示词前端输入上限为 6666 个字符，负向提示词保持 2000 个字符；已保存图片预览通过存储层 `getImageUrl()` 回填可访问地址，并支持剪贴板图片粘贴追加、本地临时草稿恢复和新建模式一键清空当前输入与图片预览，返回、保存、添加、删除、分类和选中状态图标统一来自本地 SVG。
- `src/js/pc-category.js`：PC 端分类与标签页面渲染和交互入口，承载分类表格、标签表格、拖拽排序、快捷操作和本地图标引用；分类行文件夹图标使用 `UI设计稿/图标/插画设计/文件夹.png` 并在样式层保留 PNG 原色，标签行和重命名/删除操作优先使用 `src/assets/pc/` 下的设计稿 PNG。
- `src/js/pc-utils.js`：PC 端通用交互工具，承载提示、弹窗、右键菜单、复制、格式化和公共图片查看器；右键菜单支持按动作类型给图标配置柔和色底，图片查看器支持全屏遮罩、滚轮缩放、拖拽平移、双击缩放/复位、下载当前图片、复位按钮和 ESC/遮罩关闭，图片查看器工具按钮使用本地 SVG。
- `src/js/pc-icon-assets.js`：PC 端本地图标统一出口，导入 `src/assets/icons/pc/` 和通用图标 SVG，并提供 `pcIcon()` 渲染辅助函数，避免页面继续使用 Emoji 或字符图标。
- `src/js/mobile-detail.js`：移动端提示词详情页渲染和交互入口，承载顶部导航、封面图、标题标签、正负向提示词卡片、信息卡片、版本记录、底部操作栏、图片查看器和完整提示词底部弹层；图片查看器支持下载当前图片，正负向提示词卡片头部将标题、字数统计和复制按钮拆分为独立结构，避免窄屏挤压。
- `src/js/mobile-editor.js`：移动端新建/编辑提示词页面渲染和交互入口，承载标题、提示词、标签底部选择弹层、分类、比例、参考图片预览与保存流程；正向提示词前端输入上限为 6666 个字符，负向提示词保持 2000 个字符；已保存图片预览通过存储层 `getImageUrl()` 回填可访问地址。
- `src/js/mobile-category.js`：移动端分类与标签页面渲染和交互入口，承载分类列表、标签管理、新建/重命名/改色/删除分类弹窗、快速操作（排序高亮、批量编辑改色、合并分类、清理空分类）和兔子提示横幅。
- `src/js/mobile-settings.js`：移动端设置页渲染与交互入口，承载外观、本地存储、图片下载记录、数据备份恢复和局域网 PC 搜索、`IP:端口` 连接测试、拉取、回传与双向同步操作。
- `src/js/mobile-icon-assets.js`：移动端本地图标统一出口，导入通用 SVG、移动端补充 SVG 和移动端已有 PNG，并提供 `mobileIcon()` 渲染辅助函数，避免页面继续使用 Emoji 或字符图标。
- `src/js/mobile-regression.test.js`：移动端页面级回归测试，覆盖首页、提示词库、详情、编辑、分类与标签、设置页、导入导出入口、局域网连接入口和图片预览下载入口。
- `src/js/lan-sync.js`：局域网 PC 搜索与同步共享逻辑，提供同步目标解析、`LanScanner` 最近设备优先探测、端口范围网段扫描、进度回调和 `LanSync` 拉取、回传、双向同步流程。
- `src/js/pc-settings.js`：PC 端设置页渲染与交互入口，承载共享欢迎横幅、外观设置、本地存储、图片下载记录、数据备份恢复和局域网互通状态展示；数据备份与恢复区常驻入口收敛为“导入 JSON”和“导出 JSON”两个按钮，并通过导出位置模式在下载目录与自定义位置之间切换。
- `src/css/pc.css`：PC 端全局样式与页面专用样式，共享欢迎横幅统一使用首页插画尺寸与位置，并将横幅背景层按主内容可视宽度铺满、内部内容按安全宽度居中；侧边栏支持展开态与 84px 收起态，原安全徽章区域改为满宽胶囊收拉按钮区，收起态隐藏文字和复杂底部信息并保留图标导航；首页样式集中在 `pc-home-*` 类名，提示词库样式集中在 `pc-library-*` 类名并包含表格列宽、列表工作台视觉分区、浅蓝左侧强调选中态、柔和横向滚动条、分页区重排、默认 16:9 窗口下的预览面板下沉和横向滚动兜底，提示词详情样式集中在 `pc-detail-*` 类名并覆盖天空氛围、白色详情画布、16:9 封面、左主右辅双栏和响应式退化，公共图片查看器样式覆盖全屏遮罩、缩放工具栏、拖拽光标、SVG 工具按钮、下载按钮禁用态和低动效适配，设置页布局样式集中在 `pc-settings-*` 类名并包含备份恢复两按钮布局、导出位置分段选择、焦点态和响应式退化，分类与标签页样式集中在 `pc-category-*`、`pc-tag-*` 和 `pc-quick-*` 类名；PC 页面容器使用主内容区容器查询和安全内边距变量处理卡片、表格、按钮的抗挤压排版。
- `src/css/mobile.css`：移动端全局样式与页面专用样式，覆盖移动端页面壳、顶部导航、底部导航、列表、详情、编辑、分类、设置、弹层、图片查看器和本地图标显示；图片查看器关闭与下载按钮保持稳定触控尺寸，提示词详情页正负向卡片头部使用可压缩标题容器、独立字数统计、稳定触控尺寸复制按钮和极窄屏媒体查询处理标题与按钮抗挤压排版。
- `src/assets/icons/`：通用本地图标资源，包含分类与标签页使用的 Lucide 本地化 SVG、设计稿分类文件夹与标签 PNG 和 `lucide-license.txt` 授权文本。
- `src/assets/icons/mobile/`：移动端补充 SVG 图标资源，覆盖返回、展开收起、关闭、下载、收藏、加载、全屏预览、文件、刷新和剪贴板等字符图标替换场景。
- `src/assets/icons/pc/`：PC 端补充 SVG 图标资源，覆盖保存、下载、收藏、关闭、箭头、复位、正负向提示、信息、对比、盾牌等字符图标替换场景，并保留 `iconfont-license.md` 来源说明。
- `src/assets/icons/settings/`：设置页专用本地图标资源，覆盖备份、导入、导出 JSON、JSON 导入和同步服务。
- `src/js/image-utils.js`：图片导入共享工具，负责 Data URL 读取、Canvas 压缩、最大边长缩放、MIME 与扩展名识别。
- `src/js/prompt-tool-json-import.js`：prompt-image-tool 专用 JSON 导入共享工具，负责 schema 识别、临时暂存、消费、Data URL 图片对象标准化和设置页/编辑页联动。
- `src/js/download-history.js`：图片下载历史本地存储工具，负责历史记录写入、读取、清空、时间格式化和落点标签整理。
- `src/js/image-download-utils.js`：图片下载共享工具，负责图片 Blob 拉取、文件名清理、扩展名推断、文件保存选择器、Android 相册写入、浏览器下载兜底、PC 后端图片保存回退和下载历史记录写入。
- `src/js/mobile-gallery.js`：Android 图片写入系统相册的 Capacitor 插件 JS 封装。
- `src/js/pc-prompt-ui-utils.js`：PC 提示词页面纯函数工具，承载详情页提示词展示前导空白清理、提示词库分类字段兼容和分类夹计数逻辑。
- `src/js/backup-utils.js`：数据备份文件名、统计、Web 下载、Android 文件写入和桌面端后端保存工具；PC 默认导出保存到下载目录，自定义位置模式优先使用文件保存选择器，必要时回退到后端原生保存窗口。
- `python/`：Python 后端、Python 测试和本地运行时数据目录。
- `python/tests/test_build_app_main.py`：PC 安装包后端回归测试，覆盖 PyInstaller 入口的局域网互通能力声明、配对令牌校验、回传写入、前端静态路由和端口占用回退。
- `python/data/.gitkeep`：运行时数据目录占位文件；真实提示词数据、备份和图片由 `.gitignore` 排除，不进入 Git。
- `src-tauri/`：Tauri 桌面端工程。
- `src-tauri/tauri.conf.json`：Tauri 桌面端应用配置，包含 PC 默认窗口尺寸、最小窗口尺寸、窗口居中、构建命令和打包配置；PC UI 默认窗口采用 `1366 x 768`，最小窗口采用 `1024 x 576`。
- `installer-shell/`：Tauri 安装器壳工程，隔离验证参考图风格安装向导 UI、无边框窗口配置和调用 NSIS 静默安装的 Rust 命令；`installer-shell/src-tauri/tauri.conf.json` 需启用 `app.withGlobalTauri`，让静态页面通过 `window.__TAURI__.core.invoke` 调用安装、路径校验、快捷方式和启动命令，并通过 `window.__TAURI__.dialog.open` 打开安装目录选择窗口；`installer-shell/src-tauri/capabilities/default.json` 显式开放窗口关闭、最小化、拖动和目录打开能力；`installer-shell/src/pages/` 承载安装步骤页面模块，当前已拆分欢迎页、许可协议页、安装位置页、附加任务页、准备安装页、正在安装页和安装完成页；欢迎页使用 `installer-shell/src/assets/installer-welcome/` 的压缩本地图片复刻书本安装器首屏，品牌区固定在窗口左上天空留白区，右页标题、卖点和按钮固定在书页安全区；许可协议页使用 `installer-shell/src/assets/installer-license/` 的压缩本地图片承载双页书本与左页插画；安装位置页使用 `installer-shell/src/assets/installer-location/` 的压缩本地图片承载书本主体、左页场景和右页纸张底纹，默认路径指向当前用户下载目录下的 `PIM-Test`，前端通过 `tauri-plugin-dialog` 的异步目录选择窗口返回真实路径，Tauri 调度层负责将 `%USERPROFILE%` 与 `%LOCALAPPDATA%` 前缀展开为真实本地用户目录后校验目录可写性；附加任务页使用 `installer-shell/src/assets/installer-tasks/` 的压缩本地图片承载安装前任务选择书本主体，并用真实 DOM 实现复选框、应用摘要和下一步按钮；准备安装页使用同一书本资产承载最终确认摘要，点击开始安装后才触发安装；正在安装页使用 `installer-shell/src/assets/installer-installing/` 的压缩本地图片承载安装中书本主体，并用真实 DOM 实现阶段式进度、当前动作、阶段列表、失败重试和修改设置；安装完成页使用 `installer-shell/src/assets/installer-complete/` 的压缩本地图片承载完成页书本主体，并用真实 DOM 实现成功状态、完成后选项、桌面和开始菜单快捷方式收尾、完成按钮退出安装窗口；Rust 安装结果和快捷方式命令会返回桌面、开始菜单启动项和开始菜单卸载项的实际存在状态，快捷方式失败时只展示收尾警告，不阻断主安装完成；`embedded-installer` feature 用于正式打包时把 `build/PromptImageManager-Setup-2.3.4.exe` 嵌入壳体，输出双击后先显示自定义 UI 的安装器壳 EXE。
- `android/`：Capacitor Android 原生工程。
- `android/app/src/main/java/com/promptimagemanager/app/plugins/ImageGallerySaverPlugin.java`：Android 原生图片保存到系统相册的 Capacitor 插件。
- `scripts/`：不属于运行时源码的专项工具脚本。
- `scripts/start_dev_server.py`：本地开发服务器启动脚本，负责复用或启动 `8888` Python 后端、`5173` Vite 前端，并验证 PC / 移动端预览地址。

## 资源与产物

- `src/assets/`：应用运行时使用的前端资源。
- `src/assets/pc/home-folder.png`：PC 首页收藏分类卡片使用的本地文件夹插画图标。
- `src/assets/pc/tag-2.png`、`src/assets/pc/action-copy.png`、`src/assets/pc/action-delete.png`、`src/assets/pc/action-folder.png`、`src/assets/pc/action-rename.png`：PC 首页标签统计、分类与标签页、提示词更多菜单使用的设计稿 PNG 图标资源；PC 分类页分类行文件夹图标当前直接引用 `UI设计稿/图标/插画设计/文件夹.png`。
- `src/assets/pc/detail-image-placeholder.png`：PC 提示词详情页无封面状态使用的图片占位插画。
- `docs/assets/readme/`：README 首页展示素材目录，保存仓库首页图标和 PC/移动端预览截图。
- `UI设计稿/`：原始设计稿和视觉参考。
- `releases/`：发布产物落点，仅保留占位文件；安装包通过本地构建或 GitHub Releases 分发，不进入 Git。
- `dist/`：Vite 构建输出。
- `build/`：当前 PC 打包配置、PyInstaller 入口和打包中间产物混合目录，后续建议拆分。
- `build/app_main.py`：PC 独立安装包使用的 PyInstaller 后端入口，负责内置前端静态资源、独占端口启动 WebView 和暴露与 `python/main.py` 对齐的局域网同步接口。

## 文档目录

- `docs/README.md`：文档中心入口。
- `docs/apps-code-map.md`：项目文件导航和文档更新落点。
- `docs/技术文档/`：API、PC、移动端、Web 和局域网同步技术说明。
- `docs/技术文档/聊天归档脚本图片导出技术说明-260524.md`：ChatGPT 本地档案馆用户脚本导出当前对话附带已生成图片、按对话名称生成图片文件名、图片清单、ZIP 结构和验证边界的技术说明。
- `docs/技术文档/聊天归档脚本图片导出技术说明-260524.md`：ChatGPT 本地档案馆用户脚本导出当前对话附带已生成图片、按对话名称生成图片文件名、图片清单、ZIP 结构和 prompt-image-tool 专用 JSON 导出技术说明。
- `docs/设计文档/`：UI/UX 设计系统、组件规范和响应式设计。
- `docs/工程文档/`：工程交接、迁移和目录职责说明。
- `docs/工程目录整理/`：目录治理计划、扫描记录和整理方案。
- `docs/项目开发经验/`：可复用工程规范、问题经验和跨页面实施约定；其中 `项目开发经验.md` 记录局域网双端同步内容比较、Windows 安装包端口独占、安装器壳全局 Tauri API 等通用经验，`安装包中文编码与快捷方式图标规范.md` 记录 Windows 安装包中文编码与快捷方式图标预检规则。
- `docs/UI计划/`：PC 与移动端 UI 计划和设计文档。
- `docs/构建方案/`：构建、安装包和平台打包方案。
- `docs/计划文档/`：版本计划和功能实施计划。
- `docs/测试记录/`：功能测试验证记录、问题定位证据和复测结论。
- `docs/测试记录/PC端全功能回归测试记录-260515.md`：PC 端前后端测试、构建、运行时页面探针、导出落盘和基础 CRUD 冒烟记录。
- `docs/测试记录/移动端全功能回归测试记录-260515.md`：移动端页面级回归、构建、Capacitor 同步、Android Debug 构建和返回键监听修复记录。
- `docs/测试记录/局域网同步冲突优化测试记录-260521.md`：局域网同步冲突预览、幂等冲突副本、双向统一接口和后端入口对齐的自动化测试记录。
- `docs/版本记录/`：版本迭代历史与变更记录。
- `docs/已修复问题/`：问题复盘与修复记录。
- `docs/对话历史/`：重要对话记录。

## 文档更新落点

- 修改前端页面、样式或交互：同步检查 `docs/UI计划/` 和相关技术文档。
- 修改设置页、数据导入导出或局域网同步：同步检查 `docs/技术文档/pc-technical-doc.md`、`docs/技术文档/mobile-technical-doc.md`、`docs/技术文档/lan-sync-design-doc.md` 和 `docs/技术文档/api-reference.md`。
- 修改 Python 后端接口或数据结构：同步检查 `docs/技术文档/api-reference.md` 和相关技术文档。
- 修改构建、安装包或平台配置：同步检查 `docs/构建方案/`。
- 调整目录结构：同步检查 `docs/apps-code-map.md` 和 `docs/工程文档/工程目录说明.md`。
- 调整仓库忽略规则、运行时数据或发布产物策略：同步检查根目录 `README.md`、`.gitignore` 和 `docs/工程文档/工程目录说明.md`。
- 调整工具脚本：同步检查 `scripts/README.md`。
## PC 快速构建入口

- `scripts/build_pc_package.py`：PC 独立安装包非交互式构建脚本，执行 `Vite -> PyInstaller -> NSIS -> releases`。
- `scripts/build_installer_shell_package.py`：Tauri 安装器壳发布产物构建脚本，执行 `检查现有 NSIS 安装核心 -> JS/Rust 检查 -> Tauri release build embedded-installer -> releases`。
- `scripts/build_android_package.py`：Android 安装包非交互式构建脚本，执行 `Vite -> Capacitor sync -> Java 版本修补 -> Gradle assembleRelease -> releases`。
- `scripts/build_release_packages.py`：PC 与 Android 发布包总构建入口，支持单端或全量构建。
- `docs/构建方案/PC独立安装包快速打包流程.md`：PC 快速打包流程说明与常见问题。
- `docs/构建方案/Android安装包构建方案.md`：Android 安装包构建、签名与发布产物说明。
- `docs/计划文档/双端安装包版本升级与打包计划-260513.md`：v2.3.2 PC 核心安装包、Tauri 安装器壳和 Android APK 的版本升级、构建验证与文档收口计划。
- `docs/计划文档/PC端安装后快捷方式缺失修复计划-260515.md`：PC 安装器壳安装后桌面快捷方式和开始菜单快捷方式缺失的分层定位、修复任务和验证清单。
- `docs/计划文档/双端局域网同步冲突优化计划-260521.md`：PC 与移动端局域网同步冲突预览、字段级差异、冲突策略、安全写入和验证闭环的实施计划。

## PC 提示词模块计划入口

- `docs/计划文档/PC端提示词编辑详情与筛选优化计划-260512.md`：PC 端新建/编辑提示词图片粘贴、临时草稿恢复、详情页提示词首行空白和提示词库分类夹筛选标签的实施计划。
- `docs/计划文档/PC端保存导致内容丢失排查计划-260524.md`：PC 端保存失败、成功提示与失败提示并存、以及内容丢失待验证风险的服务启动、数据保护、复现定位、修复策略与回归验证计划。
- `docs/计划文档/PC端新建提示词一键清空输入计划-260524.md`：PC 端新建提示词页增加一键清空当前未保存输入、图片预览和新建草稿的实施计划。
- `docs/计划文档/双端图片预览下载按钮计划-260522.md`：PC 端和移动端图片预览层增加下载按钮、PC 自定义保存位置、移动端一键下载和后端安全保存接口的实施计划。
- `docs/计划文档/正向提示词字数上限调整计划-260513.md`：PC 端和移动端新建/编辑页正向提示词 6666 字符上限调整计划。
- `docs/计划文档/移动端文字图标替换计划-260513.md`：移动端页面、公共菜单和样式中字符图标、Emoji 图标、本地 SVG/PNG 图标替换的定位清单与实施计划。

## Tauri 安装器壳 UI 规则入口

- `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md`：基于参考图片搭建 Tauri 安装器壳界面的视觉、布局、步骤、状态和工程边界规则。
- `docs/计划文档/Tauri安装器壳-全页面功能完善计划-260511.md`：安装器壳全页面功能完善实施计划，覆盖准备安装页、安装位置、附加任务、安装阶段、完成收尾和真实安装闭环验证。
- `docs/计划文档/Tauri安装器壳-安装路径窗口控制完成退出计划-260512.md`：安装器壳安装路径默认下载目录、窗口拖动与控制按钮、完成页退出行为的实施计划。
- `docs/计划文档/Tauri安装器壳-安装路径选择崩溃修复计划-260512.md`：安装器壳安装位置页点击浏览崩溃、路径选择不生效和真实安装闭环验证的修复计划。
- `docs/计划文档/项目缓存清理与未引用文件整理计划-260512.md`：项目缓存、构建产物、安装器壳预览缓存和未跟踪设计/文档文件的分类清理计划。
## 近期计划文档入口

- `docs/计划文档/PC端安装器壳快捷方式回归修复计划-260522.md`：PC 端带安装壳 UI 安装后桌面快捷方式、开始菜单启动快捷方式和开始菜单卸载快捷方式缺失的回归定位、最小修复与真实安装验收计划。
- `docs/计划文档/聊天归档脚本-图片导出与作者栏移除计划-260524.md`：ChatGPT 本地档案馆用户脚本导出当前对话时附带已生成图片、导出清单兜底和移除作者展示区域的实施计划。
- `docs/计划文档/聊天归档脚本-图片按对话名称命名计划-260524.md`：ChatGPT 本地档案馆用户脚本导出当前对话图片时按对话名称生成可读文件名的实施计划。
- `docs/计划文档/聊天归档脚本-prompt-image-tool-json对话命名计划-260524.md`：ChatGPT 本地档案馆导出 prompt-image-tool 专用 JSON 时以对话名称为主文件名并用 schema 与后缀区分普通归档的实施计划。
- `docs/计划文档/聊天归档脚本-prompt-image-tool-json导出导入联动计划-260524.md`：ChatGPT 本地档案馆新增 prompt-image-tool 专用 JSON 导出，以及 prompt-image-tool 导入端识别 schema 后自动进入新建提示词页预填标题、提示词和图片的双阶段实施计划。
- `docs/计划文档/聊天归档脚本-prompt-image-tool-json首段跳过代码块计划-260524.md`：ChatGPT 本地档案馆 prompt-image-tool 专用 JSON 在提取正向提示词时跳过首段代码块、只保留自然语言正文的调整计划。
- `docs/计划文档/聊天归档脚本-prompt-image-tool-json多段正向提示词保留计划-260524.md`：ChatGPT 本地档案馆 prompt-image-tool 专用 JSON 提取正向提示词时跳过首段噪声，并保留空行后的完整多段自然语言正文的调整计划。
- `docs/计划文档/双端设置页图片下载记录与移动端相册保存计划-260524.md`：PC 和移动端设置页新增图片下载记录列表、一键清除历史，以及移动端图片保存到手机相册的原生链路规划。
- `docs/计划文档/移动端下载记录UI布局排版优化计划-260524.md`：移动端设置页图片下载记录卡片、长文件名、时间平台元信息和清空历史工具区的布局排版优化计划。
- `docs/计划文档/双端Bug测试修复与安装包构建计划-260524.md`：PC 端和移动端主流程 Bug 测试、发现问题后的自行修复、自动化验证，以及 Android APK 和 PC 带安装壳 UI 安装包构建验收计划。
