# 项目文件导航

本文只作为文件导航和文档更新落点，不记录修改历史、阶段结果或完成说明。

## 项目入口

- `README.md`：项目级快速开始、目录说明和仓库规范入口。
- `package.json`：前端、测试、Tauri、Capacitor 脚本入口。
- `vite.config.js`：Vite 配置，当前前端根目录为 `src`。
- `capacitor.config.ts`：Capacitor 配置，当前 Web 输出目录为 `dist`。
- `requirements.txt`：Python 依赖入口。
- `build.bat`：综合构建入口，PC 安装包构建完成后同步发布副本到 `releases/`。
- `dev.bat`：本地开发启动入口。
- `scripts/`：专项维护脚本目录。
- `docs/计划文档/根目录历史计划-260503.md`：原根目录历史计划归档。

## 源码目录

- `src/`：前端源码、样式、交互脚本和前端资源。
- `src/js/pc-app.js`：PC 端应用壳层、左侧侧边栏收拉状态、路由挂载和全局快捷键入口，侧边栏收拉按钮位于原安全徽章区域，展开态显示按钮文案，侧边栏本地数据卡片使用设计稿保存插画作为状态图标，并基于本地数据大小驱动圆形统计环与悬浮动效。
- `src/js/pc-welcome-banner.js`：PC 端顶部欢迎横幅共享渲染模块，首页、提示词库、新建/编辑、分类与标签、设置页面共用，并支持编辑页返回与保存动作区布局。
- `src/js/pc-home.js`：PC 端首页仪表盘渲染和交互入口，承载欢迎横幅、悬浮搜索、统计卡、最近使用、收藏分类和快速创建。
- `src/js/pc-library.js`：PC 端提示词库页面渲染和交互入口，承载搜索筛选、表格列表、选中预览、分页、收藏、复制和提示词更多操作。
- `src/js/pc-detail.js`：PC 端提示词详情页渲染和交互入口，承载顶部面包屑、封面主视觉、标题元信息、正负向提示词、右侧信息概览、版本记录和本地安全提示。
- `src/js/pc-editor.js`：PC 端新建/编辑提示词页面渲染和交互入口，承载标题、提示词、标签、分类、比例、图片预览与保存流程；已保存图片预览通过存储层 `getImageUrl()` 回填可访问地址。
- `src/js/pc-category.js`：PC 端分类与标签页面渲染和交互入口，承载分类表格、标签表格、拖拽排序、快捷操作和本地图标引用。
- `src/js/pc-utils.js`：PC 端通用交互工具，承载提示、弹窗、右键菜单、复制、格式化和公共图片查看器；图片查看器支持全屏遮罩、滚轮缩放、拖拽平移、双击缩放/复位、复位按钮和 ESC/遮罩关闭。
- `src/js/mobile-editor.js`：移动端新建/编辑提示词页面渲染和交互入口，承载标题、提示词、标签底部选择弹层、分类、比例、参考图片预览与保存流程；已保存图片预览通过存储层 `getImageUrl()` 回填可访问地址。
- `src/js/mobile-category.js`：移动端分类与标签页面渲染和交互入口，承载分类列表、标签管理、新建/重命名/改色/删除分类弹窗、快速操作（排序高亮、批量编辑改色、合并分类、清理空分类）和兔子提示横幅。
- `src/js/mobile-settings.js`：移动端设置页渲染与交互入口，承载外观、本地存储、数据备份恢复和局域网 PC 搜索、连接测试、拉取、回传与双向同步操作。
- `src/js/lan-sync.js`：局域网 PC 搜索与同步共享逻辑，提供 `LanScanner` 最近设备优先探测、网段扫描、进度回调和 `LanSync` 拉取、回传、双向同步流程。
- `src/js/pc-settings.js`：PC 端设置页渲染与交互入口，承载共享欢迎横幅、外观设置、本地存储、数据备份恢复和局域网互通状态展示。
- `src/css/pc.css`：PC 端全局样式与页面专用样式，共享欢迎横幅统一使用首页插画尺寸与位置；侧边栏支持展开态与 84px 收起态，原安全徽章区域改为满宽胶囊收拉按钮区，收起态隐藏文字和复杂底部信息并保留图标导航；首页样式集中在 `pc-home-*` 类名，提示词库样式集中在 `pc-library-*` 类名并包含表格列宽、列表工作台视觉分区、浅蓝左侧强调选中态、柔和横向滚动条、分页区重排、默认 16:9 窗口下的预览面板下沉和横向滚动兜底，提示词详情样式集中在 `pc-detail-*` 类名并覆盖天空氛围、白色详情画布、16:9 封面、左主右辅双栏和响应式退化，公共图片查看器样式覆盖全屏遮罩、缩放工具栏、拖拽光标和低动效适配，设置页布局样式集中在 `pc-settings-*` 类名，分类与标签页样式集中在 `pc-category-*`、`pc-tag-*` 和 `pc-quick-*` 类名；PC 页面容器使用主内容区容器查询和安全内边距变量处理卡片、表格、按钮的抗挤压排版。
- `src/assets/icons/`：通用本地图标资源，包含分类与标签页使用的 Lucide 本地化 SVG、设计稿分类文件夹与标签 PNG 和 `lucide-license.txt` 授权文本。
- `src/assets/icons/settings/`：设置页专用本地图标资源，覆盖备份、导入、导出 JSON、JSON 导入和同步服务。
- `src/js/image-utils.js`：图片导入共享工具，负责 Data URL 读取、Canvas 压缩、最大边长缩放、MIME 与扩展名识别。
- `src/js/backup-utils.js`：数据备份文件名、统计、Web 下载、Android 文件写入和桌面端后端兜底保存工具。
- `python/`：Python 后端、Python 测试和本地运行时数据目录。
- `python/data/.gitkeep`：运行时数据目录占位文件；真实提示词数据、备份和图片由 `.gitignore` 排除，不进入 Git。
- `src-tauri/`：Tauri 桌面端工程。
- `src-tauri/tauri.conf.json`：Tauri 桌面端应用配置，包含 PC 默认窗口尺寸、最小窗口尺寸、窗口居中、构建命令和打包配置；PC UI 默认窗口采用 `1366 x 768`，最小窗口采用 `1024 x 576`。
- `android/`：Capacitor Android 原生工程。
- `scripts/`：不属于运行时源码的专项工具脚本。

## 资源与产物

- `src/assets/`：应用运行时使用的前端资源。
- `src/assets/pc/home-folder.png`：PC 首页收藏分类卡片使用的本地文件夹插画图标。
- `src/assets/pc/detail-image-placeholder.png`：PC 提示词详情页无封面状态使用的图片占位插画。
- `UI设计稿/`：原始设计稿和视觉参考。
- `releases/`：发布产物落点，仅保留占位文件；安装包通过本地构建或 GitHub Releases 分发，不进入 Git。
- `dist/`：Vite 构建输出。
- `build/`：当前 PC 打包配置、PyInstaller 入口和打包中间产物混合目录，后续建议拆分。

## 文档目录

- `docs/README.md`：文档中心入口。
- `docs/apps-code-map.md`：项目文件导航和文档更新落点。
- `docs/技术文档/`：API、PC、移动端、Web 和局域网同步技术说明。
- `docs/设计文档/`：UI/UX 设计系统、组件规范和响应式设计。
- `docs/工程文档/`：工程交接、迁移和目录职责说明。
- `docs/工程目录整理/`：目录治理计划、扫描记录和整理方案。
- `docs/项目开发经验/`：可复用工程规范、问题经验和跨页面实施约定；其中 `项目开发经验.md` 记录局域网双端同步内容比较等通用经验，`安装包中文编码与快捷方式图标规范.md` 记录 Windows 安装包中文编码与快捷方式图标预检规则。
- `docs/UI计划/`：PC 与移动端 UI 计划和设计文档。
- `docs/构建方案/`：构建、安装包和平台打包方案。
- `docs/计划文档/`：版本计划和功能实施计划。
- `docs/测试记录/`：功能测试验证记录、问题定位证据和复测结论。
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
- `scripts/build_android_package.py`：Android 安装包非交互式构建脚本，执行 `Vite -> Capacitor sync -> Java 版本修补 -> Gradle assembleRelease -> releases`。
- `scripts/build_release_packages.py`：PC 与 Android 发布包总构建入口，支持单端或全量构建。
- `docs/构建方案/PC独立安装包快速打包流程.md`：PC 快速打包流程说明与常见问题。
- `docs/构建方案/Android安装包构建方案.md`：Android 安装包构建、签名与发布产物说明。
