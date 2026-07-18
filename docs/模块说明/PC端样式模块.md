# PC端样式模块

## 职责

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

`src/js/main.js` 先加载 `theme-tokens.css`，桌面端再动态加载 `src/js/pc-app.js`。`pc-app.js` 导入 `pc.css`，入口依次导入六个子文件。

`pc.css` 是对外稳定入口。HTML 演示页、JavaScript 模块和其他调用方不得直接改为导入子文件。`01-foundation-shell.css` 通过本地 `src/assets/fonts/乐米沐和圆体.ttf` 注册全局主字体，并由 `--pc-font-family` 保留系统字体回退链。

## 顺序契约

| 顺序 | 文件 | 职责 |
|---:|---|---|
| 01 | `01-foundation-shell.css` | 字体、应用 Token、光标、应用壳、侧边栏和导航；侧栏主导航独立滚动，底部工具区固定 |
| 02 | `02-settings-compat.css` | 设置页历史兼容规则 |
| 03 | `03-shared-components.css` | 侧边栏收起状态、通用布局和基础组件；收起态隐藏导航滚动条并纵向排列底部工具入口 |
| 04 | `04-settings-page.css` | 完整设置页和主题/存储相关布局 |
| 05a | `05a-legacy-page-primitives.css` | 旧通用页面片段、编辑器基础、颜色选择器和分类弹窗基础 |
| 05b | `05b-category-base.css` | 分类与标签初始实现及紧邻媒体查询、低动效规则 |
| 05c | `05c-global-overlays.css` | Toast、Modal、更新记录、右键菜单和图片预览 |
| 05d | `05d-welcome-library-base.css` | 共享欢迎横幅背景展示策略、暗色文字对比保障、编辑器/提示词库基础实现及局部断点 |
| 05e | `05e-page-late-overrides.css` | 文件夹弹窗、首页/详情/分类后续实现及后置补丁 |
| 06 | `06-responsive-overrides.css` | 末尾全局交互、低动效、主题与布局补丁 |

数字前缀是级联顺序契约。不得按名称、路由或组件归属重排文件；首轮拆分保持了原始规则文本和顺序不变。

## 测试约束

`src/js/pc-css-test-utils.js` 按入口顺序读取六个子文件，供 CSS 文本断言测试使用。新增样式子文件或调整顺序时，必须同步更新该读取清单和相关测试。

## 关联文件

- `src/js/main.js`：应用入口和端类型加载。
- `src/js/pc-app.js`：桌面端应用与样式入口导入方。
- `src/js/pc-utils.js`：动态挂载 Toast、Modal、右键菜单和图片预览等组件。
- `src/css/theme-tokens.css`：跨端主题语义 Token。
- `docs/设计文档/跨端配色与主题令牌规范.md`：主题 Token 权威规范。
- `docs/计划文档/09-项目治理/PC端样式文件拆分治理计划-260716.md`：拆分边界、风险与验收计划。
- `docs/计划文档/09-项目治理/PC端页面与弹层样式渐进治理计划-260716.md`：`05-pages-overlays.css` 的冻结阶段规则、回归范围与第二轮拆分触发条件。
- `docs/计划文档/07-测试验证/全局CSS验收测试计划-260716.md`：PC 样式入口、顺序、主题、响应式和动态弹层的验收矩阵。

## 维护说明

- 新增规则优先归入现有职责最匹配的文件，并保持覆盖关系可解释。
- 下载记录视觉规则以 `04-settings-page.css` 为唯一正式来源：列表使用单一边框容器与分隔行，空态使用同一容器内的低对比提示面；`02-settings-compat.css` 不得再为该模块追加拟态阴影，避免形成嵌套窗口效果。
- 设置页其他历史规则与正式规则的覆盖关系未收敛前，不得合并 `02-settings-compat.css` 与 `04-settings-page.css`。
- 动态弹层依赖全局可用样式，不得随路由延迟加载。
- 深色、容器查询、低动效和末尾补丁优先保留在 `06-responsive-overrides.css`，确保覆盖顺序稳定。
- PC 提示词库列表标签在暗色主题下由 `06-responsive-overrides.css` 覆盖默认、悬浮和按下态阴影；三种状态均使用深色主题阴影令牌，避免继承基础样式中的亮色内高光。
- `05a` 至 `05e` 是按原始连续区段拆分的级联序列；新增规则必须插入最接近的既有功能区段，不得无序追加到 `05e` 文件末尾。
- 新增后置覆盖必须记录覆盖目标、触发场景和不可移动原因；不得在未核对级联关系前合并或删除既有规则。
- 第二轮已完成连续物理拆分；后续选择器去重、补丁收敛与视觉优化必须另立计划实施。
- 欢迎横幅统一在 `05d-welcome-library-base.css` 使用等宽自适应尺寸与底部对齐定位；亮色使用 `home-bg.png`，暗色使用 `home-bg2.jpg`，且暗色不叠加渐变遮罩。暗色标题与副标题使用 `--color-text-primary`，并以低扩散深色阴影保障其经过浅色云层时仍清晰可读；页面级规则不得覆盖背景尺寸或定位。
- PC 样式入口或子文件顺序变更时，必须执行全局 CSS 验收计划中的 CSS-01、CSS-02、CSS-06、CSS-07 与 PC 页面、动态弹层人工验收。
