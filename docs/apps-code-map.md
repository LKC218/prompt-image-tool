# 应用代码地图



















> 本文档仅作为「文件导航」与「文档更新落点」，不记录修改历史或执行结果。









> 源文件为中文 UTF-8 编码；若编辑器显示乱码，请确认以 UTF-8 打开。



















## 一、项目概述



















提示词配图工具（prompt-image-tool）是一套原生 HTML + CSS 变量 + 原生 JS（无框架）的跨端应用，









包含 PC Web、移动端 Web，并通过 Capacitor / Tauri 打包为桌面与移动安装包。









主题与品牌视觉通过根节点 `data-accent` 属性 + CSS 自定义属性（`--pc-accent` / `--m-accent`）集中驱动。



















## 二、前端源码导航



















### 样式层 `src/css/`









- `pc.css`：PC 端全部样式。通过本地 `src/assets/fonts/乐米小熊日记体.ttf` 的 `@font-face` 声明加载全局字体，并由 `--pc-font-family`、`--pc-font-*` 与暖可可文字色令牌集中提供字体栈、字号层级和系统回退；提示词库的表格行、预览区与紧凑比例按钮会同步补偿空间。首页底部的 `.pc-home-bottom-grid`、收藏分类与快速创建使用 `.pc-main` 容器查询进行重排，避免侧栏状态改变时按视口宽度错误压缩；收藏分类卡提供上浮、分类色条延展、图标微缩放、按下与键盘聚焦反馈。主题色令牌集中在 `.pc-app` 基础块，通过 `color-mix()` 派生









  `--pc-accent-strong` / `--td-brand-color` / `--td-ripple-color` / `--td-focus-outline`，









  驱动主按钮、激活态、聚焦环、水波纹、欢迎装饰等品牌主色控件；首页搜索栏沿用新拟态外投影与内凹阴影，不使用额外内外聚焦描边。









  新增 `--pc-neu-*` 新拟态按钮 Token 与 `.pc-neu-btn` 系列类，详见 `docs/设计文档/新拟态按钮设计规范.md`。设置页在 `pc-settings-*` 命名空间复用该令牌：一级模块为暖白外凸面，选择器、记录列表和数据块为内凹槽，操作控件在外凸与按下内凹之间切换，详见 `docs/UI计划/PC端/06-设置与本地存储.md`。提示词库页面在 `pc-library-*` 命名空间内使用 `--pc-library-neu-*` 局部层级，将工作台、表格滚动槽、预览面板、缩略图、操作控件和分页统一为暖白外凸与内凹反馈；工作台通过 `.pc-main` 容器查询在 1240px 可用宽度处切换双栏与单列，避免视口断点忽略侧栏状态。预览内容按封面、摘要、正向提示词、元数据、版本和底部操作分层，正向提示词正文优先于版本备注展示；右侧封面保持原图完整可见，并采用轻微视觉垂直校正以抵消常见插画画布上方留白。表格将标签并入缩略图信息区，以紧凑缩略图和 92px 行高降低横向与纵向拥挤；名称列使用 `.pc-library-name-scroll` 保持单行，并根据实际溢出距离自动缓慢往返滚动，悬停或键盘聚焦时暂停，减少动态效果时关闭，详见 `docs/UI计划/PC端/02-提示词库.md`。共享提示词操作菜单由 `.pc-context-menu` 及其操作项样式承载，逻辑入口位于 `src/js/pc-utils.js`：三点入口播放点跳动后展开独立悬浮操作按钮，右键入口直接展开；菜单根据锚点或指针所在半区调整文字标签方向，并支持视口边界、键盘导航、Escape、滚动关闭与焦点归还，详见 `docs/计划文档/02-视觉与交互优化/PC端浮动操作菜单与点跳动效实施计划-260715.md`。









  PC 左侧导航栏采用暖色轻拟态：业务导航项默认凸起，悬停时切换为内凹按压反馈；设置位于时钟上方的独立无文字圆角方形工具入口，排除全局实心水波纹和圆环动效，仅保留短暂齿轮转动与键盘焦点表达状态。折叠按钮保留即时按压反馈，时钟统一为低对比暖色表盘，详见 `docs/设计文档/PC左侧导航栏轻拟态设计.md`。









- `mobile.css`：移动端全部样式。通过本地 `src/assets/fonts/乐米小熊日记体.ttf` 的 `@font-face` 声明加载全局字体，并由 `--m-font-family`、`--m-font-*` 与暖可可文字色令牌集中提供字体栈、字号层级和系统回退；提示词复制、下载记录和小屏布局会同步扩容，避免大字号压缩触控区域。对称派生 `--m-accent-strong` / `--m-focus-ring` / `--m-shadow-accent`，









  主按钮渐变尾色由写死粉 `#FF8FB1` 改为 `var(--m-accent-strong)`。









  新增 `--m-neu-*` 新拟态按钮 Token 与 `.m-neu-btn` 系列类，详见 `docs/设计文档/新拟态按钮设计规范.md`。设置页通过 `.m-mascot-banner` 页面标识应用局部拟态层级：欢迎区、卡片与备份操作外凸，状态、输入和进度区域内凹，详见 `docs/UI计划/移动端UI设计/06-设置与本地存储.md`。



















### 逻辑层 `src/js/`（节选关键模块）









- `pc-app.js`：应用入口；`setAccent(accent)` 写入根节点 `data-accent` 与 `localStorage`（键 `pc-accent`），并将 `meta[name="version"]` 写入根节点 `data-app-version`，用于核验实际运行包是否为当前构建。
- `pc-cursor.js`：PC 端精细指针专用自定义光标模块。中心点即时跟随、外环通过 `requestAnimationFrame` 插值延迟跟随；交互控件悬停时放大外环并继承 `--pc-accent`。非语义点击容器使用 `data-cursor="action"` 显式接管，图片预览、拖拽、缩放、禁用和加载等原生语义使用 `data-cursor="native"` 保留系统指针；触控设备及减少动态效果偏好下不启用。









  `setupSidebarToggle()` 管理侧栏的折叠按钮动效与持久化：悬停显示旋转主题色描边和文字波动，点击后图标起飞并在动画结束时切换侧栏状态；`updateNavHighlight()` 同步包括无文字设置入口在内的导航视觉激活态与 `aria-current="page"`。底部时钟仍由 `setupSidebarClock()` 基于系统时间驱动指针，秒针跳秒。









- `version-info.js`：共享版本号模块，统一读取 `index.html` 的 `<meta name="version">` 并为 PC / 移动端设置页提供渲染与挂载能力。PC 端与移动端设置页均不再各自内联读取版本号。
- `release-notes.js` / `release-notes-data.js`：PC 更新记录模块与结构化版本内容。应用启动时对比当前版本和 `pc-release-notes-last-seen-version`；未读时自动弹出轻拟态版本记录，左侧栏设置入口旁保留可继承状态色的内联云朵箭头手动查看入口与未读提示点。
- `pc-settings.js`：PC 设置页外观取色器，`ACCENT_COLORS` 预设与点击切换逻辑。版本号展示委托 `version-info.js`；完整备份默认调用 ZIP v2 原图导出，兼容 JSON 保留为次级入口。 
- `mobile-app.js` / `mobile-settings.js`：移动端入口与取色器（`THEME_COLORS`，`localStorage` 键 `accent`）。移动端设置页新增版本号展示，委托 `version-info.js`。









- `pc-utils.js`：PC 端共享交互工具；`showContextMenu()` 为首页、提示词库、详情页和分类页提供右键与三点更多操作菜单，兼容原有坐标参数，并支持传入三点触发元素以完成点跳动、独立悬浮操作组、视口翻转、键盘导航与焦点归还。菜单动作数据由 `pc-menu-actions.js` 提供。
- `pc-menu-actions.js`：提示词集合更多操作的共享动作工厂，维护重命名、移动到分类、复制、删除及其既有业务处理函数。
- `pc-detail.js` / `pc-library.js` / `pc-home.js` / `pc-category.js` / `pc-editor.js`：PC 各业务模块。
  - `pc-detail.js` 渲染 PC 提示词详情页，封面区读取当前版本图片列表；多图时显示横向缩略图条，并同步缩略图、轮播箭头、圆点、计数器和公共图片查看器的当前图片。
-  - `pc-home.js` 渲染 PC 首页仪表盘：搜索栏采用凸起外框、内凹输入槽及整体焦点环；统计卡固定 `96px` 高度且保留语义色描边，悬停上移 `3px`、强化阴影并放大图标；最近使用、收藏分类与导入入口使用首页局部新拟态，其中最近使用项悬停上移 `3px`、缩略图微缩放、标题强调主题色、操作按钮提高可见度，按下切换内凹阴影。最近使用的收藏按钮以 `aria-pressed` 同步持久状态、请求锁定和一次性反馈；收藏成功播放星形回弹、光环扩散与六向粒子，取消收藏仅播放收缩回弹；收藏分类为原生 `button`，通过 `data-folder-id` 与事件委托跳转提示词库；分类语义色仅经 `--pc-home-category-color` 传给图标、名称和色线。首页「查看全部」按钮已叠加 .pc-neu-btn.pc-neu-btn--small 改造为新拟态小胶囊按钮，保留原类名以维持涟漪与事件绑定；箭头图标使用 currentColor 继承按钮色，悬停变亮蓝、按下变深蓝并伴随右移动效。首页主创建入口复用 `.pc-create-btn`，样式集中在 `src/css/pc.css`，规范见 `docs/设计文档/新拟态按钮设计规范.md`，模块说明见 `docs/UI计划/PC端/01-首页仪表盘.md`。
- `pc-library.js` 提示词库页搜索栏已同步为同款新拟态双层结构（`.pc-library-search > __outer`/`__inner`）；分类/标签筛选按钮（`.pc-library-filter-btn`）已按 CodePen `arcadejhs/jOEBMyB` 的多层阴影拟态风格重构，默认态凸起、悬停 `scale(.98)`、激活态内凹下移，样式见 `src/css/pc.css`。
- `pc-category.js` / `mobile-category.js`：分类与标签管理页。PC 端以 `.pc-category-page` 局部令牌统一欢迎横幅、页签、列表管理面板、搜索、快捷操作与相关弹窗的凸起/内凹层级；移动端以 `.m-category-page` 作为页面样式作用域，统一顶部导航、分段控制器、分类列表、标签、快捷操作及分类创建/确认弹窗。两端均保留分类与标签语义色作为图标、文字和标签的识别锚点，详细规范见 `docs/UI计划/PC端/05-分类与标签.md` 和 `docs/UI计划/移动端UI设计/05-分类与标签.md`。
- `tag-utils.js`：标签语义令牌与聚合模块，仅为场景、日系、科幻、插画、国风保留全局预设语义色；`getLibraryTagStyleClass()` 仅在 PC 提示词库列表中为高频业务标签提供固定配色，其余列表标签由名称稳定分配有限调色板。详情、首页、预览、图片区域、编辑器和移动端仍使用默认标签样式。
- `pc.css` / `mobile.css`：内容标签胶囊采用轻量软陶视觉：同色系底色、描边、内高光、柔和投影及按压内凹反馈。PC 提示词库列表通过 `.pc-library-tag-pill` 叠加局部颜色与类 Clay 的双向阴影：默认浮起、悬浮强化、按压内凹；标签裁切容器预留阴影安全空间，避免圆角阴影呈矩形截边；非列表标签不继承该局部颜色或阴影，并统一遵守减少动态效果设置。









  主操作按钮 `.pc-library-primary-btn`（新建提示词）已按 Uiverse `Pankaj-Meharchandani/popular-cat-31` 复刻玻璃拟态 + hover 旋转光晕 + 文字拆分波动 + 点击加号区域内缩小淡出/对勾入场状态切换，并优化为主题色渐变面 + 白色文字 + 主题色外发光以增强 CTA 显眼度；加号图标另增加入场动画与 hover 居中旋转，效果已抽象为 `.pc-create-btn` 通用类，详见 `docs/设计文档/新建提示词按钮复刻-Uiverse-popular-cat-31.md`。









- `pc-editor.js` 编辑器页顶部保存按钮（`.pc-editor-save-btn`）复用 `.pc-create-btn` 通用类，默认态为保存图标 +「保存」，保存中切换为对勾 +「保存中」，`setEditorSavingState()` 同步切换 `.is-acting` / `disabled` / `pc-editor-save-busy`，详见 `docs/设计文档/新建提示词按钮复刻-Uiverse-popular-cat-31.md`。编辑器主体由 `pc-editor.js` 渲染、`pc.css` 中 `.pc-editor-*` 样式承载：主卡和次级操作使用暖白外凸，标题/提示词与图片区使用内凹，分类选择器为原生 `button` 并通过 `aria-haspopup="dialog"` 表达弹窗入口，比例选项包含 `21:9` 并以 `aria-pressed` 同步选中状态；缩略图点击或键盘激活复用 `showImageViewer()`，标题和正负提示词在选区稳定约 180ms 后自动复用 `showContextMenu({ focusMenu: false, referenceRect })` 提供复制、粘贴、删除操作，菜单以真实选区为锚点优先显示在上方，与选区间隔 20px、与视口保留 24px 安全距离；复制、粘贴和删除的悬浮态分别采用青绿、蓝紫、珊瑚红语义色。菜单按钮按下不夺取输入焦点，因此选区持续可见，不再监听右键触发。保存和图片删除保留高对比操作层。规范见 `docs/UI计划/PC端/04-新建编辑提示词.md`。



















- `mobile-home.js` / `mobile-library.js` / `mobile-detail.js` / `mobile-category.js` / `mobile-editor.js`：移动端各业务模块；`favorite-feedback.js` 统一处理首页、提示词库与详情页的收藏请求锁定、乐观状态、失败回滚、ARIA 状态与反馈动效。









  - `mobile-home.js` 首页统计卡片（`.m-stat-card`）已改为新拟态凸起，移除纯色背景，以语义色文字表达分类，按下态内凹微缩放，卡片顶部使用居中渐变描边 + 同色微光作为分类识别锚点，样式见 `src/css/mobile.css`。首页「查看全部」按钮已叠加 .m-neu-btn.m-neu-btn--small 改造为新拟态小胶囊按钮，保留原类名以维持事件绑定。









  - `mobile-library.js` 提示词库页标签栏（`.m-filter-tag`）已按 CodePen `arcadejhs/jOEBMyB` 的多层阴影拟态风格重构，胶囊形默认凸起、激活态内凹下移，样式见 `src/css/mobile.css`。









- `*.test.js`：与源码同名的 vitest 回归用例（运行 `npm run test`）。









- `image-utils.js` / `image-download-utils.js`：图片导入优化、格式识别、WebP 默认压缩、原格式下载与 JPG 导出能力落点；









  PC 侧说明见 `docs/技术文档/pc-technical-doc.md`，移动端说明见 `docs/技术文档/mobile-technical-doc.md`，实施计划见 `docs/计划文档/04-新功能实装与增强/图片-WebP压缩与JPG导出实施计划-260711.md`。



















### 主题色模块（落地说明）









- 状态链路：取色器点击 → `setAccent(accent)` → 根节点 `data-accent` + `localStorage` →









  CSS `[data-accent=...]` 覆盖 `--pc-accent` / `--m-accent` → 品牌控件经派生令牌渲染对应色相。









- 预设：粉 pink / 蓝 blue / 绿 green / 紫 purple / 黄 yellow（5 个，无自定义取色、无新增预设）。









- 派生策略：`color-mix(in srgb, var(--pc-accent) X%, #000|transparent)` 从主色派生深色与透明层，









  避免给 5 个预设块各写一组冗余字段（DRY / KISS）。









- 语义色保护：成功绿 `--pc-green`、警告黄 `--pc-yellow`、危险红 `--pc-danger`、信息蓝装饰卡、









  分类标签 `.pc-tag-*`、功能快捷卡 `.pc-quick-action-blue`、`.pc-settings-action-blue`、toast 状态色









  等均保持固定含义，不随主题色变化。



















## 三、文档导航



















- `docs/UI计划/PC端/`：PC 端界面与交互设计说明（含 `06-设置与本地存储.md` 主题色入口）。









- `docs/UI计划/移动端UI设计/`：移动端界面与交互设计说明（含 `06-设置与本地存储.md` 主题色选择器）。









- `docs/设计文档/新拟态按钮设计规范.md`：新拟态（Neumorphism）按钮 Token、调用方式与参考案例钩子（Uiverse）。









- `docs/设计文档/PC侧边栏模拟时钟.md`：PC 侧边栏底部新拟态模拟时钟的样式、结构、真实时间驱动与无障碍说明。









- `docs/计划文档/04-新功能实装与增强/图片-WebP压缩与JPG导出实施计划-260711.md`：新导入图片 WebP 压缩、图片 JPG 导出、历史图片保留与后续手动存储优化计划。
- `docs/版本发布与更新记录维护指南.md`：发布前汇总最新修改、判定版本号、同步跨端配置、维护完整版本记录与 PC 更新记录弹窗的操作规范。
- `docs/项目开发经验/`：跨会话沉淀的架构与排障经验。









- `python/main.py`、`build/app_main.py`：PC 数据目录解析、旧数据迁移和备份 API；ZIP v2 以 `manifest.json`、业务 JSON 与原始图片流式写入压缩包，并提供本机路径预检。Windows 默认落盘至 `%APPDATA%\PromptImageManager\data`。
- `scripts/start_dev_server.py`：本地开发服务启动与实际数据目录输出。
- `README.md`：项目总入口与使用说明。
