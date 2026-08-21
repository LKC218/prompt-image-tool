# 应用代码地图



















> 本文档仅作为「文件导航」与「文档更新落点」，不记录修改历史或执行结果。









> 源文件为中文 UTF-8 编码；若编辑器显示乱码，请确认以 UTF-8 打开。



















## 一、项目概述



















提示词配图工具（prompt-image-tool）是一套原生 HTML + CSS 变量 + 原生 JS（无框架）的跨端应用，









包含 PC Web、移动端 Web，并通过 Capacitor / Tauri 打包为桌面与移动安装包。









主题与品牌视觉通过根节点 `data-appearance`、`data-workbench-theme` 与 CSS 语义 Token 集中驱动；工作台主题包括晴空、蔷薇、焦糖、松林、星夜与薄荷；`--pc-accent` / `--m-accent` 仅作为端侧组件兼容别名。



















## 二、前端源码导航

- `src/js/mobile-home.js`、`src/js/mobile-category.js`、`src/js/mobile-regression.test.js`：移动端首页分类操作、分类与标签一级页面及跨页面回归覆盖。首页按结构化路由参数进入提示词库筛选；分类与标签作为底部一级标签页不渲染无返回栈的返回入口。逐页面测试记录位于 `docs/测试记录/逐页面验证与缺陷闭环测试记录-260801.md`。
- `src/js/pc-category.js`、`src/css/pc/05b-category-base.css`、`src/css/pc/05e-page-late-overrides.css`：PC 分类与标签管理页。标签行和首页标签统计图标使用 `tag.svg` 的 CSS 静态资源蒙版继承语义色令牌，避免运行时蒙版地址失效、PNG 位图及滤镜在亮暗主题下退化为色块、纯白或纯黑；标签表格固定次数与操作列，批量清除操作置于二级菜单；快捷操作仅保留图标与单行名称，并以最小列宽自适应网格避免窄容器挤压。
- `src/js/pc-utils.js`、`src/js/pc-utils.test.js`、`src/js/mobile-app.js`、`src/js/mobile-app-action-sheet.test.js`、`src/js/pc-utils-modal.test.js`、`src/js/release-notes.js`：全局弹层、上下文菜单与更新记录。PC 上下文菜单支持最多两层级联、碰撞翻转、键盘层级导航和焦点归还；移动端将同一 `children` 菜单数据降级为带返回入口的分层动作表。通用弹层统一处理遮罩点击及 Escape 关闭，更新记录使用其打开和关闭接口。
- `src/js/pc-cursor.js`、`src/js/pc-cursor.test.js`、`src/css/theme-tokens.css`、`src/css/pc/01-foundation-shell.css`：PC 精细指针光标系统。模块提供空闲、操作、媒体、收藏、菜单、复制、拖拽、缩放、加载、禁用和原生光标豁免状态；四角基于目标元素矩形锁定，并在滚动、窗口变化与目标尺寸变化时同步位置；光标直接使用根级品牌令牌，随工作台主题即时同步。具体协议见 `docs/模块说明/PC端自定义光标模块.md`。
- `src/js/pc-app.js`、`src/js/pc-app-nav-motion.test.js`、`src/css/pc/01-foundation-shell.css`、`src/css/pc/03-shared-components.css`：PC 侧栏壳、收起状态与导航动效。`pc-sidebar-stage` 在主侧栏后叠放两张不接收指针事件的主题衬板，以状态类驱动远层、近层、主面板和内容的错峰展开与反向关闭；收起态仍保留窄图标导航。样式层级与维护规则见 `docs/模块说明/PC端样式模块.md`。
- `src/react/icons/audio-lines.jsx`、`src/react/icons/audio-lines-demo.jsx`、`src/react/icons/audio-lines-demo.html`：React 动态图标试点。`AudioLines` 使用 Motion 驱动六条独立波形线，支持播放状态、悬停、点击和减少动效控制；演示页独立于主应用，通过 Vite 多页面入口验证组件表现。职责和接入边界见 `docs/模块说明/动态图标组件模块.md`。

- `scripts/build_installer_shell_package.py`、`scripts/build_pc_package.py`、`build/installer.nsi`、`installer-shell/src-tauri/`：Windows 安装器构建与安全卸载链。PC 构建会以 PyInstaller 产物生成 `build/_uninstall_files.nsh`，NSIS 只删除清单内程序文件，保留未知文件和用户数据；旧安装目录数据迁移至用户级归档失败时保留原目录。安装器壳在升级快照失败时中止安装。构建脚本以根目录 `package.json` 的版本为唯一来源，同步安装器壳元数据与 NSIS 核心安装包资源路径；Rust 构建脚本将该版本注入运行时，用于嵌入、查找和释放同版本安装核心；安装器壳图标固定使用 `installer-shell/src-tauri/icons/icon.ico`。详见 `docs/构建方案/PC端安装包构建方案.md`。



















### 样式层 `src/css/`









- `pc.css`：PC 端稳定样式聚合入口，严格按数字前缀导入 `src/css/pc/` 下的十个连续区段。通过本地 `src/assets/fonts/乐米沐和圆体.ttf` 的 `@font-face` 声明加载全局字体，并由 `--pc-font-family`、`--pc-font-*` 与暖可可文字色令牌集中提供字体栈、字号层级和系统回退；提示词库的表格行、预览区与紧凑比例按钮会同步补偿空间。首页底部的 `.pc-home-bottom-grid`、收藏分类与快速创建使用 `.pc-main` 容器查询进行重排，避免侧栏状态改变时按视口宽度错误压缩；收藏分类卡提供上浮、分类色条延展、图标微缩放、按下与键盘聚焦反馈。主题色令牌集中在 `.pc-app` 基础块，通过 `color-mix()` 派生









  `--pc-accent-strong` / `--td-brand-color` / `--td-ripple-color` / `--td-focus-outline`，









  驱动主按钮、激活态、聚焦环、水波纹、欢迎装饰等品牌主色控件；首页搜索栏沿用新拟态外投影与内凹阴影，不使用额外内外聚焦描边。首页统计卡的暗色覆盖位于 `pc/05e-page-late-overrides.css`，使用跨端语义表面、边框、阴影和状态色令牌，为四色图标槽提供低饱和承托，避免浅色半透明底在深色工作台中产生突兀亮斑。









  新增 `--pc-neu-*` 新拟态按钮 Token 与 `.pc-neu-btn` 系列类，详见 `docs/设计文档/新拟态按钮设计规范.md`。设置页在 `pc-settings-*` 命名空间复用该令牌：顶部欢迎横幅保持独立且不随正文布局调整；正文使用 16px 分区节奏，首行以具备 360px / 520px 最小可读宽度的 `5 / 7` 非对称外观/存储双列顶部对齐，主内容区低于 920px 时主动改单列；备份入口固定由 `.pc-settings-action-grid-three` 承载等宽等高三列，卡片文案允许换行，导出位置与辅助说明可独立换行，避免在窄内容区相互挤压。内部数据块、选择器和记录列表降低重复投影，数据管理操作以统一表面配合语义图标区分优先级。本地存储容量环以本地数据大小相对浏览器站点配额的占用率绘制，本地数据大小不可用时回退浏览器使用量；非零且低于 `1%` 时显示 `<1%` 并保留最小可见弧段，详见 `docs/UI计划/PC端/06-设置与本地存储.md`。提示词库页面在 `pc-library-*` 命名空间内使用 `--pc-library-neu-*` 局部层级，将工作台、表格滚动槽、预览面板、缩略图、操作控件和分页统一为暖白外凸与内凹反馈；工作台通过 `.pc-main` 容器查询在 1240px 可用宽度处切换双栏与单列，避免视口断点忽略侧栏状态。预览内容按封面、摘要、正向提示词、元数据、版本和底部操作分层，正向提示词正文优先于版本备注展示；右侧封面保持原图完整可见，并采用轻微视觉垂直校正以抵消常见插画画布上方留白。表格将标签并入缩略图信息区，以紧凑缩略图和 92px 行高降低横向与纵向拥挤；名称列使用 `.pc-library-name-scroll` 保持单行，并根据实际溢出距离自动缓慢往返滚动，悬停或键盘聚焦时暂停，减少动态效果时关闭，详见 `docs/UI计划/PC端/02-提示词库.md`。共享提示词操作菜单由 `.pc-context-menu` 及其操作项样式承载，逻辑入口位于 `src/js/pc-utils.js`：三点入口播放点跳动后展开独立悬浮操作按钮，右键入口直接展开；菜单根据锚点或指针所在半区调整文字标签方向，并支持视口边界、键盘导航、Escape、滚动关闭与焦点归还。菜单表面、阴影和动作状态由 `theme-tokens.css` 的 `context-*` 语义令牌统一驱动；暗色模式中的外层操作行保持透明，动作色仅作用于圆角实体，且通过 `data-ripple="false"` 禁用全局波纹，详见 `docs/设计文档/跨端配色与主题令牌规范.md`。









  PC 左侧导航栏采用暖色轻拟态：业务导航项默认凸起，悬停时切换为内凹按压反馈；主导航独立承接溢出滚动，底部工具区固定在侧栏底部。展开态中，更新记录、主题开关和设置入口按 `48px / 96px / 48px` 规格单行排列，间距为 `8px`，主题胶囊与工具按钮同高；收起态隐藏导航滚动条，并将三个入口纵向排列，主题开关降级为 48×48px 单图标状态。主题开关复用主题服务切换浅深外观，并在支持时由滑块中心执行带稳定帧的圆形主题过渡，避免快照结束时的视觉顿挫；设置位于时钟上方的独立无文字圆角方形工具入口，排除全局实心水波纹和圆环动效，仅保留短暂齿轮转动与键盘焦点表达状态。折叠按钮保留即时按压反馈，时钟统一为低对比暖色表盘，详见 `docs/设计文档/PC左侧导航栏轻拟态设计.md`。

- `pc/`：PC 样式连续区段目录。`01-foundation-shell.css` 承载字体、应用壳、侧边栏和导航；`02-settings-compat.css` 保留设置页历史兼容规则；`03-shared-components.css` 承载侧边栏收起状态与通用组件；`04-settings-page.css` 承载完整设置页，其中下载记录采用单一列表容器、分隔行与低对比空态，避免拟态阴影叠加；`05a` 至 `05e` 按原始连续顺序承载旧页面基础、分类基础、全局弹层、按亮暗主题切换图片且无暗色遮罩的欢迎横幅与提示词库基础、以及后置页面补丁。欢迎横幅暗色文案在 `05d-welcome-library-base.css` 统一使用主文字令牌与低扩散深色阴影，保障浅色云层背景上的可读性；`06-responsive-overrides.css` 承载末尾全局交互、低动效及主题/布局补丁；`07-theme-toggle.css` 承载侧栏图标主题开关及 View Transition 圆形揭示规则。数字前缀即 CSS 级联顺序，不得重排。详见 `docs/模块说明/PC端样式模块.md`。

- `src/js/pc-detail-modal.js`：PC 端提示词详情的多实例弹窗编排层。它复用 `pc-detail.js` 的实例级详情数据与业务交互，支持最多两个展开窗口、重复项激活、带缩放淡出与恢复过渡的最小化悬浮入口、响应式并排或垂直排列、来源元素焦点恢复和按激活窗口处理的键盘关闭；从弹窗进入编辑页前会最小化全部展开详情会话，详情页面路由仍由 `pc-detail.js` 维护。弹窗开关和最小化动画均遵循低动效偏好；展开窗口期间锁定实际页面滚动容器 `#pcMain`，并由遮罩承接窗口外部滚轮命中。`pc-detail.js` 还为弹窗内的正负提示词正文提供 DOM Range 选区定位与仅复制菜单，复用共享浮层和剪贴板反馈。

- `src/js/pc-detail-modal.test.js`：PC 端详情弹窗的背景滚动与遮罩命中回归测试，覆盖展开、关闭和全部最小化后对 `#pcMain` 原始滚动样式的恢复，以及最小化状态下透明遮罩不拦截底层页面指针事件。

- `docs/模块说明/PC端提示词详情弹窗模块.md`：PC 端详情弹窗的职责、实例生命周期、编辑跳转收尾与关联源码导航。

- `src/css/pc/05c-global-overlays.css` 与 `src/css/pc/05e-page-late-overrides.css`：详情弹窗的轻拟态样式分别承载窗口壳、背景高斯模糊层、粘性工具栏与顶栏收藏、更多、关闭按钮，以及窗口内部的封面、缩略图、标题、元信息、正负提示词、侧栏和底部操作。双窗口对比状态会切换为单列正文，将信息概览和版本记录移至底部双列区域，并压缩封面高度以优先保障提示词阅读宽度；样式严格收敛在 `.pc-prompt-detail-modal-content` 作用域，独立详情页保持既有低描边表面语言；卡片外凸、内容槽内凹、顶栏控件和底部操作的按压反馈均复用 `--pc-neu-*` 令牌，底部图标与文字同步响应状态，复制成功状态提供短暂的局部确认动画并支持低动效降级；详情正文提供正负语义选区高亮，并为只读文本复制启用紧凑浮动菜单变体。

- `theme-tokens.css`、`theme-config.js`、`theme-service.js`：定义跨端语义色与暗色映射，并管理工作台主题和外观偏好的恢复；首次启动、清空存储或外观偏好无效时默认使用浅色，已保存的用户偏好优先恢复。浮动菜单的 `context-*` 令牌位于通用 `data-appearance="dark"` 层，保证所有暗色工作台主题均使用统一的深蓝灰操作实体、低强度冷色边缘高光与低亮度语义动作色；具体规则见 `docs/设计文档/跨端配色与主题令牌规范.md`。









- `mobile.css`：移动端全部样式。通过本地 `src/assets/fonts/乐米沐和圆体.ttf` 的 `@font-face` 声明加载全局字体，并由 `--m-font-family`、`--m-font-*` 与暖可可文字色令牌集中提供字体栈、字号层级和系统回退；提示词复制、下载记录和小屏布局会同步扩容，避免大字号压缩触控区域。下载记录以语义列表呈现业务标题、实际文件名、来源/保存位置与时间、平台、保存方式标签；对长内容执行单行省略并保留完整悬浮文本。对称派生 `--m-accent-strong` / `--m-focus-ring` / `--m-shadow-accent`，









  主按钮渐变尾色由写死粉 `#FF8FB1` 改为 `var(--m-accent-strong)`。









  新增 `--m-neu-*` 新拟态按钮 Token 与 `.m-neu-btn` 系列类，详见 `docs/设计文档/新拟态按钮设计规范.md`。设置页通过 `.m-mascot-banner` 页面标识应用局部拟态层级：欢迎区、卡片与备份操作外凸，状态、输入和进度区域内凹，详见 `docs/UI计划/移动端UI设计/06-设置与本地存储.md`。



















### 逻辑层 `src/js/`（节选关键模块）









- `pc-app.js` / `pc-router.js`：PC 应用入口与内存路由。路由 History 状态保存同端视图、路径、参数和业务返回栈快照；初始化与 `popstate` 优先恢复合法快照，启动挂载按恢复路由同步页面和侧栏当前态。`setAccent(accent)` 写入根节点 `data-accent` 与 `localStorage`（键 `pc-accent`），并将 `meta[name="version"]` 写入根节点 `data-app-version`，用于核验实际运行包是否为当前构建。









  `setupSidebarToggle()` 管理侧栏的折叠按钮动效与持久化：悬停显示旋转主题色描边和文字波动，点击后图标起飞并在动画结束时切换侧栏状态；`toggleAppearance()` 以主题开关滑块中心计算圆形揭示范围，并委托主题服务更新浅深外观；`updateNavHighlight()` 同步包括无文字设置入口在内的导航视觉激活态与 `aria-current="page"`。底部时钟仍由 `setupSidebarClock()` 基于系统时间驱动指针，秒针跳秒。









- `version-info.js`：共享版本号模块，统一读取 `index.html` 的 `<meta name="version">` 并为 PC / 移动端设置页提供渲染与挂载能力。PC 端与移动端设置页均不再各自内联读取版本号。
- `release-notes.js` / `release-notes-data.js`：PC 更新记录模块与结构化版本内容。应用启动时对比当前版本和 `pc-release-notes-last-seen-version`；未读时自动弹出轻拟态版本记录，左侧栏设置入口旁保留可继承状态色的内联云朵箭头手动查看入口与未读提示点。
- `theme-config.js` / `theme-service.js`：跨端主题配置与运行时服务。前者定义工作台主题、外观合法值和旧键映射；后者迁移 `pc-accent` / `accent`、应用根节点属性、监听系统外观并按绝对时间安排定时切换。
- `pc-settings.js`：PC 设置页的工作台主题与外观模式选择器；版本号展示委托 `version-info.js`；完整备份默认调用 ZIP v2 原图导出，兼容 JSON 保留为次级入口。外观设置排版由 `src/css/pc/04-settings-page.css` 负责稳定间距、主题色按钮换行和控件宽度保护，`02-settings-compat.css` 负责原生选择器的拟态外壳，`05e-page-late-overrides.css` 负责 760px 容器断点下的上下布局。
- `mobile-app.js` / `mobile-router.js` / `mobile-settings.js`：移动端入口、内存路由与设置页。路由 History 状态保存同端视图、路径、参数和业务返回栈快照；初始化与 `popstate` 优先恢复合法快照，挂载时按恢复路由同步页面和底部导航状态。设置页复用工作台主题和外观模式配置，版本号展示委托 `version-info.js`。
- `router-history.test.js`：PC 与移动端 History 快照恢复、浏览器返回协调与无效状态安全回退；路由与启动职责见 `docs/模块说明/路由与启动模块.md`。
- `theme-tokens.css`：跨端基础语义 Token，负责浅深表面、文字、边框、状态和工作台品牌色映射；PC 设置页通过 `--pc-settings-*` 局部别名、移动设置页通过语义状态与表面 Token 消除深色硬编码和暖棕投影；权威规范见 `docs/设计文档/跨端配色与主题令牌规范.md`。
- `folder-color.js`：跨端分类颜色兼容解析器。优先读取 `colorKey`，兼容历史 `color` 十六进制值并以分类标识稳定回退；PC 与移动首页均由此模块渲染分类色，避免排序或截取造成变色。









- `pc-utils.js`：PC 端共享交互工具；`showContextMenu()` 为首页、提示词库、详情页和分类页提供右键与三点更多操作菜单，兼容原有坐标参数，并支持传入三点触发元素以完成点跳动、独立悬浮操作组、视口翻转、键盘导航与焦点归还。菜单动作数据由 `pc-menu-actions.js` 提供。
- `pc-menu-actions.js`：提示词集合更多操作的共享动作工厂，维护重命名、移动到分类、复制、删除及其既有业务处理函数。
- `pc-detail.js` / `pc-library.js` / `pc-home.js` / `pc-category.js` / `pc-editor.js`：PC 各业务模块。
  - `pc-detail.js` 渲染 PC 提示词详情页，封面区读取当前版本图片列表；多图时显示横向缩略图条，并同步缩略图、轮播箭头、圆点、计数器和公共图片查看器的当前图片。详情元信息条仅保留创建时间与创建者，标签由标题区和信息概览承担；`pc-detail-modal.js` 负责弹窗会话、焦点与回收动效，关闭时优先回到可见的来源卡片或表格行；详情弹窗与卡片采用低对比描边、统一留白和无外发光交互规范，详见 `docs/UI计划/PC端/03-提示词详情.md`。
-  - `pc-home.js` 渲染 PC 首页仪表盘：搜索栏采用凸起外框、内凹输入槽及整体焦点环；统计卡固定 `96px` 高度且保留语义色描边，悬停上移 `3px`、强化阴影并放大图标；最近使用、收藏分类与导入入口使用首页局部新拟态，其中最近使用项采用放大缩略图、主题名称和精简元信息，元信息依次显示日期、分类和首个业务标签，日期和分类保持可读、业务标签优先截断；收藏和更多操作不再占据布局列，分别绝对定位于右上和右下，信息区保留右侧安全空间，更多按钮缩小以降低视觉权重。项目悬停上移 `3px`、缩略图微缩放、标题强调主题色，精细指针设备上的未收藏星标低强调、更多按钮仅在悬停或键盘焦点时显示，触屏和粗指针设备保留操作常显，按下切换内凹阴影。最近使用的收藏按钮以 `aria-pressed` 同步持久状态、请求锁定和一次性反馈；收藏成功播放星形回弹、光环扩散与六向粒子，取消收藏仅播放收缩回弹；最近使用卡片、缩略图、收藏和更多按钮分别通过 `data-cursor` 声明 `action`、`media`、`favorite`、`menu` 光标语义；收藏分类为原生 `button`，通过 `data-folder-id` 与事件委托跳转提示词库；分类语义色仅经 `--pc-home-category-color` 传给图标、名称和色线。首页「查看全部」按钮已叠加 .pc-neu-btn.pc-neu-btn--small 改造为新拟态小胶囊按钮，保留原类名以维持涟漪与事件绑定；箭头图标使用 currentColor 继承按钮色，悬停变亮蓝、按下变深蓝并伴随右移动效。首页主创建入口复用 `.pc-create-btn`，样式集中在 `src/css/pc.css`，规范见 `docs/设计文档/新拟态按钮设计规范.md`，模块说明见 `docs/UI计划/PC端/01-首页仪表盘.md`。
- `pc-library.js` 提示词库页搜索栏已同步为同款新拟态双层结构（`.pc-library-search > __outer`/`__inner`）；分类/标签筛选按钮（`.pc-library-filter-btn`）已按 CodePen `arcadejhs/jOEBMyB` 的多层阴影拟态风格重构，默认态凸起、悬停 `scale(.98)`、激活态内凹下移，样式见 `src/css/pc.css`。
- `pc-category.js` / `mobile-category.js`：分类与标签管理页。PC 端以 `.pc-category-page` 局部令牌统一欢迎横幅、页签、列表管理面板、搜索、快捷操作与相关弹窗的凸起/内凹层级；移动端以 `.m-category-page` 作为页面样式作用域，统一顶部导航、分段控制器、分类列表、标签、快捷操作及分类创建/确认弹窗。两端均保留分类与标签语义色作为图标、文字和标签的识别锚点，详细规范见 `docs/UI计划/PC端/05-分类与标签.md` 和 `docs/UI计划/移动端UI设计/05-分类与标签.md`。
- `pc-goal-projects.js` / `pc-goal-detail.js` / `mobile-goal-projects.js` / `mobile-goal-detail.js`：目标计划清单模块。PC 端左侧导航新增「目标计划」入口（图标为 `src/assets/pc/nav-icons/目标计划.png`），进入后展示工程项目列表，点击项目进入父子任务清单；移动端提供对应入口与页面。项目卡片采用「16:9 封面图 + 信息区」竖向网格布局，无封面时根据项目名称生成首字母渐变封面，hover 时卡片上浮、封面微缩放。任务支持父任务折叠/展开、子任务缩进、勾选状态联动、图片悬浮预览、点击查看大图、优先级色点标记、执行中左侧状态条，以及图片管理弹窗的粘贴导入与 WebP 压缩。优先级字段 `task.priority` 取值为 `high` / `medium` / `low` / `''`，在 PC 任务行首（拖拽把手左侧）以小圆点展示，并通过「更多 → 设置优先级」菜单切换；数据层在 SQLite/JSON 中按 `projects → tasks → task_images` 组织，图片只存相对路径，项目封面存储在 `goal_images/<projectId>/cover/`。通用状态计算、优先级常量、封面生成与图片预览由 `goal-utils.js` 和 `goal-image-preview.js` 承载。PC 端样式统一按新拟态按钮设计规范重构：项目卡片、任务项、图片管理项为凸起双向阴影，进度条与复选框为内凹槽，返回/更多/操作/图片图标按钮为圆形新拟态按钮，任务操作按钮常态可见，并补齐暗色模式与 `prefers-reduced-motion` 回退；样式集中在 `src/css/pc/08-goal-plan.css`。模块说明见 `docs/模块说明/目标计划模块.md`，实施计划与数据结构见 `docs/计划文档/04-新功能实装与增强/目标计划清单功能实施计划-260821.md`。
- `tag-utils.js`：标签语义令牌与聚合模块，仅为场景、日系、科幻、插画、国风保留全局预设语义色；`getLibraryTagStyleClass()` 仅在 PC 提示词库列表中为高频业务标签提供固定配色，其余列表标签由名称稳定分配有限调色板。详情、首页、预览、图片区域、编辑器和移动端仍使用默认标签样式。
- `pc.css` / `mobile.css`：内容标签胶囊采用轻量软陶视觉：同色系底色、描边、内高光、柔和投影及按压内凹反馈。PC 提示词库列表通过 `.pc-library-tag-pill` 叠加局部颜色与类 Clay 的双向阴影：默认浮起、悬浮强化、按压内凹；暗色主题在 `06-responsive-overrides.css` 对三种状态统一使用深色阴影令牌，不继承亮色内高光；标签裁切容器预留阴影安全空间，避免圆角阴影呈矩形截边；非列表标签不继承该局部颜色或阴影，并统一遵守减少动态效果设置。









  主操作按钮 `.pc-library-primary-btn`（新建提示词）已按 Uiverse `Pankaj-Meharchandani/popular-cat-31` 复刻玻璃拟态 + hover 旋转光晕 + 文字拆分波动 + 点击加号区域内缩小淡出/对勾入场状态切换，并优化为主题色渐变面 + 白色文字 + 主题色外发光以增强 CTA 显眼度；加号图标另增加入场动画与 hover 居中旋转，效果已抽象为 `.pc-create-btn` 通用类，详见 `docs/设计文档/新建提示词按钮复刻-Uiverse-popular-cat-31.md`。









- `pc-editor.js` 编辑器页顶部保存按钮（`.pc-editor-save-btn`）复用 `.pc-create-btn` 通用类，默认态为保存图标 +「保存」，保存中切换为对勾 +「保存中」，`setEditorSavingState()` 同步切换 `.is-acting` / `disabled` / `pc-editor-save-busy`，详见 `docs/设计文档/新建提示词按钮复刻-Uiverse-popular-cat-31.md`。编辑器主体由 `pc-editor.js` 渲染、`pc.css` 中 `.pc-editor-*` 样式承载：主卡和次级操作使用暖白外凸，标题/提示词与图片区使用内凹；图片区空态取消固定最小高度，采用 12px 内边距与 112px 上传入口以消除无效底部留白，已有图片时由缩略图网格自然撑开。顶部不提供返回按钮，分类选择器为原生 `button` 并通过 `aria-haspopup="dialog"` 表达弹窗入口。分类选择器、分类弹窗和添加标签按钮的单色图标仅以 CSS 蒙版渲染，不生成重叠 SVG 图片节点；图标采用语义表面、文字和品牌状态 Token，避免暗色模式出现纯黑或双图标。关闭或选中分类后焦点回到选择器。比例选项包含 `21:9` 并以 `aria-pressed` 同步选中状态；缩略图点击或键盘激活复用 `showImageViewer()`，标题和正负提示词在选区稳定约 180ms 后自动复用 `showContextMenu({ focusMenu: false, referenceRect })` 提供复制、粘贴、删除操作，菜单以真实选区为锚点优先显示在上方，与选区间隔 20px、与视口保留 24px 安全距离；复制、粘贴和删除的悬浮态分别采用青绿、蓝紫、珊瑚红语义色。菜单按钮按下不夺取输入焦点，因此选区持续可见，不再监听右键触发。保存和图片删除保留高对比操作层。正向提示词标签旁已试点接入 React 动态图标 `AudioLines`（语音输入入口），通过 `mountAnimatedIcons()` 在页面挂载时渲染、页面卸载时清理 React root，图标颜色继承编辑器语义 Token，点击提示功能开发中。规范见 `docs/UI计划/PC端/04-新建编辑提示词.md`，图标接入细节见 `docs/模块说明/动态图标组件模块.md`。



















- `mobile-home.js` / `mobile-library.js` / `mobile-detail.js` / `mobile-category.js` / `mobile-editor.js`：移动端各业务模块；`favorite-feedback.js` 统一处理首页、提示词库与详情页的收藏请求锁定、乐观状态、失败回滚、ARIA 状态与反馈动效。









  - `mobile-home.js` 首页统计卡片（`.m-stat-card`）已改为新拟态凸起，移除纯色背景，以语义色文字表达分类，按下态内凹微缩放，卡片顶部使用居中渐变描边 + 同色微光作为分类识别锚点，样式见 `src/css/mobile.css`。首页「查看全部」按钮已叠加 .m-neu-btn.m-neu-btn--small 改造为新拟态小胶囊按钮，保留原类名以维持事件绑定。









  - `mobile-library.js` 提示词库页标签栏（`.m-filter-tag`）已按 CodePen `arcadejhs/jOEBMyB` 的多层阴影拟态风格重构，胶囊形默认凸起、激活态内凹下移，样式见 `src/css/mobile.css`。









- `*.test.js`：与源码同名的 vitest 回归用例（运行 `npm run test`）；`router-history.test.js` 覆盖 PC/移动端 History 快照恢复、浏览器返回协调和无效状态安全回退。









- `image-utils.js` / `image-download-utils.js`：图片导入优化、格式识别、WebP 默认压缩、原格式下载与 JPG 导出能力落点；移动端仅在原生相册写入真实成功后记录下载成功，读取、转码或相册写入失败会透传具体原因，不将浏览器锚点触发视为已保存。









  PC 侧说明见 `docs/技术文档/pc-technical-doc.md`，移动端说明见 `docs/技术文档/mobile-technical-doc.md`，实施计划见 `docs/计划文档/04-新功能实装与增强/图片-WebP压缩与JPG导出实施计划-260711.md`。



















### 主题与外观模块









- 状态链路：设置页选择 → `theme-service.js` 持久化 `appearance-preference` / `workbench-theme` → 根节点 `data-appearance` / `data-workbench-theme` → `theme-tokens.css` 语义 Token → `--pc-accent` / `--m-accent` 兼容别名和组件样式。
- 工作台主题：晴空巡逻 sky / 焦糖午后 caramel / 松林远足 forest / 星夜侦察 night / 海盐薄荷 mint。主题仅影响品牌互动和叙事装饰。
- 外观模式：浅色、深色、跟随系统、定时切换。定时切换按设备本地绝对时间计算下一切换点。
- 语义色保护：成功、信息、警告、危险由固定状态 Token 提供；控件材质使用 `surface-control` 与 `shadow-control-*` Token，组件文字、图标和教程 SVG 前景必须复用主题语义 Token；分类 `colorKey` 负责解析深浅模式下的稳定色相与低亮度表面，不能由工作台主题覆盖。
- 详细 Token、迁移和可访问性规则见 `docs/设计文档/跨端配色与主题令牌规范.md`。
- 全局 CSS 的自动化结构守卫、浏览器人工验收矩阵和变更触发规则见 `docs/计划文档/07-测试验证/全局CSS验收测试计划-260716.md`。
- 全项目的页面、按钮、数据链路与容器分阶段验证，以及缺陷分级、修复闭环和自动化演进建议见 `docs/计划文档/07-测试验证/全项目分阶段功能验证与缺陷修复计划-260720.md`。



















## 三、文档导航






















- `docs/项目代码百科.md`：结构化 Code Wiki，覆盖项目架构、模块职责、关键类与函数、依赖关系、运行方式与 API 速查。
- `docs/UI计划/PC端/`：PC 端界面与交互设计说明（含 `06-设置与本地存储.md` 主题色入口）。









- `docs/UI计划/移动端UI设计/`：移动端界面与交互设计说明（含 `06-设置与本地存储.md` 主题色选择器）。









- `docs/设计文档/新拟态按钮设计规范.md`：新拟态（Neumorphism）按钮 Token、调用方式与参考案例钩子（Uiverse）。









- `docs/设计文档/PC侧边栏模拟时钟.md`：PC 侧边栏底部新拟态模拟时钟的样式、结构、真实时间驱动与无障碍说明。









- `docs/计划文档/04-新功能实装与增强/图片-WebP压缩与JPG导出实施计划-260711.md`：新导入图片 WebP 压缩、图片 JPG 导出、历史图片保留与后续手动存储优化计划。
- `docs/计划文档/04-新功能实装与增强/目标计划清单功能实施计划-260821.md`：左侧导航新增「目标计划」入口，按工程项目管理父子任务清单，支持图片悬浮预览与双端数据存储扩展。
- `docs/计划文档/07-测试验证/全项目分阶段功能验证与缺陷修复计划-260720.md`：全端逐页逐按钮功能验证、数据与容器测试、缺陷修复闭环与质量门槛计划。
- `docs/计划文档/07-测试验证/逐页面验证与缺陷闭环实施计划-260731.md`：可重复执行的双端逐页面检查矩阵、容器与安装器验证、缺陷闭环、测试记录模板和发布准入标准。
- `docs/版本发布与更新记录维护指南.md`：发布前汇总最新修改、判定版本号、同步跨端配置、维护完整版本记录与 PC 更新记录弹窗的操作规范。
- `docs/项目开发经验/`：跨会话沉淀的架构与排障经验。









- `python/main.py`、`build/app_main.py`：PC 数据目录解析、旧数据迁移和备份 API；ZIP v2 以 `manifest.json`、业务 JSON 与原始图片流式写入压缩包，并提供本机路径预检。Windows 默认落盘至 `%APPDATA%\PromptImageManager\data`。
- `scripts/start_dev_server.py`：本地开发服务启动与实际数据目录输出。
- `README.md`：项目总入口与使用说明。
