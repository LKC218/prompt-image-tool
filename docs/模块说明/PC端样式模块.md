# PC端样式模块

## 职责

主导航按钮高 48px，间距 14px，列表上下留白 20px；窗口高度不超过 740px 时统一使用 12px 间距，收展状态不改变纵向排列。默认外凸阴影为 3px 偏移、6px 模糊，悬停为 4px 偏移、8px 模糊，均使用原有主题阴影色的 70% 强度；选中态保留内凹语义。主导航文字收起时在 100ms 内向左 4px 并淡出，侧栏继续完成 240ms 宽度过渡。仅真实收起启用图标独立 `scale` 落定：延迟 140ms 后用 100ms 从 1 缩至 0.98 再回到 1，不移动锚点、不使正文回弹；再次展开立即取消。低动效禁用落定并固定 `scale: 1`。验收入口：`scripts/verify-sidebar-collapse.mjs`。

侧栏按钮微交互限定主导航、设置和更多入口，按钮本体与命中区域不移动。悬停图标上移 1px、放大至 1.06，展开态文字右移 3px，过渡 150ms；按下图标缩至 0.94，过渡 80ms。主导航点击回弹 300ms，峰值上移 3px、放大至 1.12，不包含旋转，结束回到当前悬停或静止状态。扫光降至 180ms、峰值透明度 0.2，主导航停用通用点击波纹，避免叠加。设置保留齿轮动效，更多入口使用缩放回弹，主题开关不变。减少动态效果时图标（包括更多图标）取消动画、过渡和变换。验收入口：`scripts/verify-sidebar-micro-motion.mjs`。

PC 侧栏采用悬停推开布局：`.pc-sidebar-stage` 保留弹性布局占位，通过 `--pc-sidebar-width` 在 84px／280px 间以 240ms 过渡，`.pc-main` 同步让位，不使用覆盖定位。侧栏主体宽度跟随舞台，顶栏左区共享过渡节奏；移除按钮与旧分层滑入样式。品牌图标和主导航图标保持横向锚点，文字淡入淡出，导航列表保留滚动与边缘羽化。减少动态效果时取消宽度与文字过渡。视觉回归入口为 `scripts/verify-sidebar-hover.mjs`，交互规则见 [路由与启动模块](路由与启动模块.md)。

窗口顶部使用连续的 36px 主题底色横条，只有低对比底边线；左侧拖动区域透明，不再单独绘制竖分隔。顶栏保持原有覆盖层结构、拖动标记与窗口按钮事件，遮住其下方侧栏分隔线的顶部，不改变侧栏 Logo 坐标。欢迎横幅从顶栏下沿开始，原总高度 212px 扣除顶栏高度，顶部留白改为 24px；首页、库、编辑器和分类页的覆盖规则同步遵守该约定，保持正文与横幅底边的屏幕坐标。验收脚本 `scripts/verify-window-header.mjs`。

侧栏更多菜单由 `07-theme-toggle.css` 提供固定定位浮层样式；菜单挂在 `.pc-app` 下，不在 `.pc-sidebar` 裁剪容器内。坐标由应用壳按按钮位置计算，保留折叠图标式菜单、主题令牌、视口边缘留白和低动效支持。不得通过放开整个侧栏的 `overflow` 修复菜单遮挡，以免破坏收展裁剪。

为桌面端应用提供完整样式，并以固定的 CSS 级联顺序组织应用壳、通用组件、业务页面、动态弹层和末尾覆盖规则。

## 源码位置

- `src/css/pc.css`
- `src/css/pc/01-foundation-shell.css`
- `src/css/pc/02-settings-compat.css`
- `src/css/pc/03-shared-components.css`
- `src/css/pc/04-settings-page.css`
- `src/css/pc/05a-legacy-page-primitives.css`
- `src/css/pc/05b-category-base.css`
- `src/css/pc/05c-global-overlays.css`
- `src/css/pc/05d-welcome-library-base.css`
- `src/css/pc/05e-page-late-overrides.css`
- `src/css/pc/06-responsive-overrides.css`

## 加载方式

`src/js/main.js` 先加载 `theme-tokens.css`，桌面端再动态加载 `src/js/pc/pc-app.js`。`pc-app.js` 导入 `pc.css`，入口按下表顺序导入子文件。

`pc.css` 是对外稳定入口。HTML 演示页、JavaScript 模块和其他调用方不得直接改为导入子文件。`01-foundation-shell.css` 通过本地 `src/assets/fonts/乐米沐和圆体.ttf` 注册全局主字体，并由 `--pc-font-family` 保留系统字体回退链。

## 顺序契约

| 顺序 | 文件 | 职责 |
|---:|---|---|
| 01 | `01-foundation-shell.css` | 字体、应用 Token、Canvas 光标容器与 CSS 回退、应用壳、侧边栏和导航；主导航独立滚动、底部工具区固定，承载悬停推开布局与按钮微交互 |
| 02 | `02-settings-compat.css` | 设置页历史兼容规则 |
| 03 | `03-shared-components.css` | 侧边栏收起状态、通用布局和基础组件；收起态隐藏导航滚动条并纵向排列底部工具入口 |
| 04 | `04-settings-page.css` | 完整设置页和主题/存储相关布局 |
| 05a | `05a-legacy-page-primitives.css` | 旧通用页面片段、编辑器基础、颜色选择器和分类弹窗基础 |
| 05b | `05b-category-base.css` | 分类与标签初始实现及紧邻媒体查询、低动效规则 |
| 05c | `05c-global-overlays.css` | Toast、Modal、更新记录、右键菜单和图片预览 |
| 05d | `05d-welcome-library-base.css` | 共享欢迎横幅背景展示策略、暗色文字对比保障、编辑器/提示词库基础实现及局部断点 |
| 05e | `05e-page-late-overrides.css` | 文件夹弹窗、首页/详情/分类后续实现及后置补丁 |
| 06 | `06-responsive-overrides.css` | 末尾全局交互、低动效、主题与布局补丁 |
| 07 | `07-theme-toggle.css` | 主题切换与侧栏更多菜单 |
| 08 | `08-goal-plan.css` | 目标计划页面 |
| 09 | `09-tetris.css` | 俄罗斯方块页面 |
| 10 | `10-plane.css` | 飞机大战页面 |
| 11 | `11-plant.css` | 挂机植物展示 |
| 12 | `12-compress.css` | 图片无损压缩，所有规则限定 `.pc-compress`，不覆盖其他页面 |

数字前缀是级联顺序契约。不得按名称、路由或组件归属重排文件；首轮拆分保持了原始规则文本和顺序不变。

## 测试约束

`src/js/pc/pc-css-test-utils.js` 按入口顺序读取全部子文件，供 CSS 文本断言测试使用。新增样式子文件或调整顺序时，必须同步更新该读取清单和相关测试。

压缩页复用语义令牌和按钮，以单层浅外凸工作区、内凹模式切换实现精简方案一；列表独立滚动，底栏常驻，帮助按需展开。项目内可信 SVG 内联并继承 `currentColor`。页面 CSS 位于最后但严格作用域隔离，不取代全局覆盖层。视觉脚本为 `scripts/verify-png-compression.mjs`。

压缩页横幅直接使用公共 `renderPcWelcomeBanner` 与 `pc-welcome-banner-category`，不覆盖背景和吉祥物定位。页内设置面板由 `12-compress.css` 控制：宽屏 285px 并排，容器不超过 950px 时覆盖式显示且内部滚动；主列表和设置面板独立滚动，保留底栏空间。优化滑块、预设与预算按钮使用现有主题令牌，参数锁定由 `fieldset` 承载。

## 关联文件

- `src/js/main.js`：应用入口和端类型加载。
- `src/js/pc/pc-app.js`：桌面端应用与样式入口导入方。
- `src/js/pc/pc-utils.js`：动态挂载 Toast、Modal、右键菜单和图片预览等组件。
- `src/css/theme-tokens.css`：跨端主题语义 Token。
- `docs/设计系统/跨端配色与主题令牌规范.md`：主题 Token 权威规范。
- `docs/计划与规格/09-项目治理/PC端样式文件拆分治理计划-260716.md`：拆分边界、风险与验收计划。
- `docs/计划与规格/09-项目治理/PC端页面与弹层样式渐进治理计划-260716.md`：`05-pages-overlays.css` 的冻结阶段规则、回归范围与第二轮拆分触发条件。
- `docs/计划与规格/07-测试验证/全局CSS验收测试计划-260716.md`：PC 样式入口、顺序、主题、响应式和动态弹层的验收矩阵。

## 维护说明

- 新增规则优先归入现有职责最匹配的文件，并保持覆盖关系可解释。
- 光标 Token、圆环结构、层级和 CSS 回退只放在 `01-foundation-shell.css`；目标解析、状态机、跟随动画和生命周期由 `pc-cursor.js` 管理，具体约束见 `PC端自定义光标模块.md`。
- 侧栏由 `pc-sidebar-stage` 在布局流中占位，不再使用视觉衬板或错峰幕布；最终状态由 `pc-sidebar-collapsed` 维护。
- `pc-sidebar-collapse-feedback` 只标记真实的展开到收起变化，初次挂载不添加；保留至再次展开或卸载，单次 CSS 动画完成后不循环，也不锁定状态切换。
- 图标落定使用独立 `scale`，不要把缩放加到按钮、舞台或正文上；`prefers-reduced-motion: reduce` 必须禁用所有收展与按钮位移动效。
- 下载记录视觉规则以 `04-settings-page.css` 为唯一正式来源：列表使用单一边框容器与分隔行，空态使用同一容器内的低对比提示面；`02-settings-compat.css` 不得再为该模块追加拟态阴影，避免形成嵌套窗口效果。
- 设置页其他历史规则与正式规则的覆盖关系未收敛前，不得合并 `02-settings-compat.css` 与 `04-settings-page.css`。
- 外观设置的正式排版规则位于 `04-settings-page.css`：设置行保留稳定的垂直留白，主题色按钮允许换行且保持固定尺寸，外观模式下拉框不参与压缩；`05e-page-late-overrides.css` 在 `pc-main` 容器宽度不超过 `760px` 时将两条设置行改为上下布局。
- 外观模式选择器为自定义 listbox 下拉（触发器 `.pc-theme-appearance-trigger` + 菜单 `.pc-theme-appearance-menu`），拟态外壳、箭头、悬停、按下、选中与焦点状态位于 `02-settings-compat.css`；展开菜单同样使用轻拟态外凸浮层，不再依赖系统 `<select>` 弹层。事件绑定与主题服务状态链保持不变。
- 公共轻拟态下拉组件位于 `src/js/pc/pc-neu-select.js` + `03-shared-components.css`（`.pc-neu-select-*`），已接入提示词库「每页数量」、分类合并弹窗源/目标分类。侧栏更多菜单（`07-theme-toggle.css`）与分类选择列表（`.pc-picker-list`）同步改为 `--pc-neu-*` 浮层/内凹层级。原生 `<select>` 系统弹层无法 CSS 拟态，须走该组件。
- 全局共享原语（`.pc-card` / `.pc-btn*` / `.pc-input` / `.pc-textarea` / `.pc-select` / `.pc-toast` / `.pc-modal` 壳、快捷创建、最近项、星标/更多、比例按钮、设置面板/开关/动作卡/存储磁贴、库搜索壳）主态一律使用 `--pc-control-raised|pressed|soft-shadow` 与 `--pc-neu-bg`，禁止再引入 `--pc-shadow-sm|md|lg` 单向投影或硬描边主态。视觉闭环脚本：`scripts/verify-global-neu-sweep.mjs`（浅/深色截图 + computed shadow 断言）。
- **浮层壳**（`.pc-modal` 含 `:has(.pc-category-create-dialog/#pcRenameFolderInput/#pcRenameTagInput/#pcChangeColorPicker/.pc-folder-dialog/.pc-confirm-dialog/.pc-release-notes)` 覆写、`.pc-folder-dialog`、`.pc-confirm-dialog`、`.pc-toast`、`.pc-neu-select-menu`、`.pc-theme-appearance-menu`、`.pc-sidebar-more-menu`、`.pc-quick-tip-bubble`、详情最小化列表与按钮、游戏结算卡 `.pc-tetris-overlay-card`/`.pc-plane-overlay-card`）必须用 `--pc-control-float-shadow`（单向抬升 `0 8px 24px var(--color-shadow-dark)` + `inset 0 1px 0` 顶部细高光）。**禁止**对浮层使用 `--pc-control-raised-shadow` 或任何带负偏移外白光的阴影——浮层不在同一背景平面，外白光会读成外发光。同平面控件（页面内卡片、按钮、弹窗内按钮/色点）仍用双向拟态。新增弹窗壳时不得用 `:has` 覆写回双向阴影。
- 动态弹层依赖全局可用样式，不得随路由延迟加载。
- 更新记录左侧版本阶段轨（`.pc-release-phase-rail`）不绘制竖线；刻度在轨道内水平、垂直居中一列排列。普通刻度为 `10×2px` 短横，选中（`is-active` / `is-current`）为 `24×3px` 高对比短横（`background: var(--pc-text)`）。悬停只做轻微加长，不使用多级尺寸跳变。
- 提示词详情弹窗的窗口壳由 `05c-global-overlays.css` 承载，窗口壳只负责裁切、拟态投影和尺寸；展开窗口存在时，宿主背景层以 `backdrop-filter` 提供 10px 高斯模糊与可降级半透明遮罩，且不拦截底层列表点击。`.pc-prompt-detail-modal-content` 是唯一的纵向滚动视口，并隐藏系统滑条视觉但保留鼠标、触控板与键盘滚动。双窗口对比状态下，窗口壳将详情内容改为单列阅读流，信息概览和版本记录下沉至正文底部的双列区域，提示卡独占末行，窄宽度时自动堆叠；多图缩略图带保留独立横向滚动能力且同样隐藏系统滑条。详情的关闭、收藏、更多、封面翻页、复制、缩略图与底栏按钮复用 `--pc-neu-*`、`--pc-control-*` 令牌，不得另行写死亮暗阴影。
- 深色、容器查询、低动效和末尾补丁优先保留在 `06-responsive-overrides.css`，确保覆盖顺序稳定。
- PC 提示词库列表标签在暗色主题下由 `06-responsive-overrides.css` 覆盖默认、悬浮和按下态阴影；三种状态均使用深色主题阴影令牌，避免继承基础样式中的亮色内高光。
- `05a` 至 `05e` 是按原始连续区段拆分的级联序列；新增规则必须插入最接近的既有功能区段，不得无序追加到 `05e` 文件末尾。
- 新增后置覆盖必须记录覆盖目标、触发场景和不可移动原因；不得在未核对级联关系前合并或删除既有规则。
- 第二轮已完成连续物理拆分；后续选择器去重、补丁收敛与视觉优化必须另立计划实施。
- 欢迎横幅统一在 `05d-welcome-library-base.css` 使用等宽自适应尺寸与底部对齐定位；亮色使用 `home-bg.png`，暗色使用 `home-bg2.jpg`，且暗色不叠加渐变遮罩。暗色标题与副标题使用 `--color-text-primary`，并以低扩散深色阴影保障其经过浅色云层时仍清晰可读；页面级规则不得覆盖背景尺寸或定位。
- PC 样式入口或子文件顺序变更时，必须执行全局 CSS 验收计划中的 CSS-01、CSS-02、CSS-06、CSS-07 与 PC 页面、动态弹层人工验收。

图片处理页继续复用公共欢迎横幅。`12-compress.css` 新增目标格式、编码方式、条件质量／背景与元数据确认控件，均限定 `.pc-compress`；设置面板内部滚动，窄窗口覆盖，不新增全局主题规则。交互契约见 [图片处理模块](图片处理模块.md)。

图片处理控件与动效集中在 `12-compress.css` 页内覆盖区，覆盖本文件早先的浏览器原生控件外观，不改公共主题令牌或全局 CSS 加载顺序。分段选中层使用 transform，新增／状态反馈使用 opacity 与短距离位移；进度条是局部宽度过渡。新增伪元素同样受减少动态效果规则控制。确认框及单条通知与页面同属 `.pc-compress`，避免影响其他模块。

设置面板联动覆盖位于 `12-compress.css` 的“收展联动”区：局部 grid 占位过渡替换旧 flex 立即重排，固定内容宽度；窄容器覆盖模式禁用列宽过渡。独立滚动容器与 minmax(0,1fr) 行约束保证标题不滚动、底栏不被内容撑出。不修改全局 CSS 加载顺序。

尺寸设置使用页内 `.image-resize-heading`、`.image-number-field`、`.image-dimension-grid`，数字框浅内凹并内置 px／% 单位；指定尺寸仅宽高双列，其余模式单字段。比例锁为可键盘操作的 aria-pressed 按钮，独立开关使用原生 checkbox 与 switch 语义。字段错误关联说明与 aria-invalid；模式展开沿用短淡入，减少动态效果直接切换。尺寸说明允许行内换行，已有结果单独标注，所有规则仍限定 `.pc-compress`。验收入口 `scripts/verify-image-resize.mjs`。

设置精简使用 `.image-height-label` 将比例锁并入宽高标签行，数字框仍保留原高度与字号；`.image-encoding-state` 呈现固定编码状态，`.image-risk-details` 承载按需阅读的说明，`.image-cache-maintenance` 位于同一个高级折叠区。优化预设与精确滑块不再默认同时占位。没有新增全局样式、主题令牌或面板宽度覆盖；高度与视觉验收入口为 `scripts/verify-image-settings-density.mjs`。
