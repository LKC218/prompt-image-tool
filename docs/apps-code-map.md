# 应用代码地图

> 本文档仅作为「文件导航」与「文档更新落点」，不记录修改历史或执行结果。
> 源文件为中文 UTF-8 编码；若编辑器显示乱码，请确认以 UTF-8 打开。

## 一、项目概述

提示词配图工具（prompt-image-tool）是一套原生 HTML + CSS 变量 + 原生 JS（无框架）的跨端应用，
包含 PC Web、移动端 Web，并通过 Capacitor / Tauri 打包为桌面与移动安装包。
主题与品牌视觉通过根节点 `data-accent` 属性 + CSS 自定义属性（`--pc-accent` / `--m-accent`）集中驱动。

## 二、前端源码导航

### 样式层 `src/css/`
- `pc.css`：PC 端全部样式。主题色令牌集中在 `.pc-app` 基础块，通过 `color-mix()` 派生
  `--pc-accent-strong` / `--td-brand-color` / `--td-ripple-color` / `--td-focus-outline`，
  驱动主按钮、激活态、聚焦环、水波纹、欢迎装饰等品牌主色控件。
  新增 `--pc-neu-*` 新拟态按钮 Token 与 `.pc-neu-btn` 系列类，详见 `docs/设计文档/新拟态按钮设计规范.md`。
  PC 左侧导航栏采用暖色轻拟态：业务导航项默认凸起，悬停时切换为内凹按压反馈；设置位于时钟上方的独立功能区，当前页保留主题色位置标记与键盘焦点。折叠按钮保留即时按压反馈，时钟统一为低对比暖色表盘，详见 `docs/设计文档/PC左侧导航栏轻拟态设计.md`。
- `mobile.css`：移动端全部样式。对称派生 `--m-accent-strong` / `--m-focus-ring` / `--m-shadow-accent`，
  主按钮渐变尾色由写死粉 `#FF8FB1` 改为 `var(--m-accent-strong)`。
  新增 `--m-neu-*` 新拟态按钮 Token 与 `.m-neu-btn` 系列类，详见 `docs/设计文档/新拟态按钮设计规范.md`。

### 逻辑层 `src/js/`（节选关键模块）
- `pc-app.js`：应用入口；`setAccent(accent)` 写入根节点 `data-accent` 与 `localStorage`（键 `pc-accent`）。
  `setupSidebarToggle()` 管理侧栏的折叠按钮动效与持久化：悬停显示旋转主题色描边和文字波动，点击后图标起飞并在动画结束时切换侧栏状态；`updateNavHighlight()` 同步视觉激活态与 `aria-current="page"`。底部时钟仍由 `setupSidebarClock()` 基于系统时间驱动指针，秒针跳秒。
- `pc-settings.js`：PC 设置页外观取色器，`ACCENT_COLORS` 预设与点击切换逻辑。
- `mobile-app.js` / `mobile-settings.js`：移动端入口与取色器（`THEME_COLORS`，`localStorage` 键 `accent`）。
- `pc-detail.js` / `pc-library.js` / `pc-home.js` / `pc-category.js` / `pc-editor.js`：PC 各业务模块。
  - `pc-home.js` 渲染 PC 首页仪表盘：搜索栏采用凸起外框、内凹输入槽及整体焦点环；统计卡固定 `96px` 高度且保留语义色描边；最近使用、收藏分类与导入入口使用首页局部新拟态。最近使用的收藏按钮以 `aria-pressed` 同步持久状态、请求锁定和一次性弹性反馈；收藏分类为原生 `button`，通过 `data-folder-id` 与事件委托跳转提示词库；分类语义色仅经 `--pc-home-category-color` 传给图标、名称和色线。首页主创建入口复用 `.pc-create-btn`，样式集中在 `src/css/pc.css`，规范见 `docs/设计文档/新拟态按钮设计规范.md`，模块说明见 `docs/UI计划/PC端/01-首页仪表盘.md`。
- `pc-library.js` 提示词库页搜索栏已同步为同款新拟态双层结构（`.pc-library-search > __outer`/`__inner`）；分类/标签筛选按钮（`.pc-library-filter-btn`）已按 CodePen `arcadejhs/jOEBMyB` 的多层阴影拟态风格重构，默认态凸起、悬停 `scale(.98)`、激活态内凹下移，样式见 `src/css/pc.css`。
  主操作按钮 `.pc-library-primary-btn`（新建提示词）已按 Uiverse `Pankaj-Meharchandani/popular-cat-31` 复刻玻璃拟态 + hover 旋转光晕 + 文字拆分波动 + 点击加号区域内缩小淡出/对勾入场状态切换，并优化为主题色渐变面 + 白色文字 + 主题色外发光以增强 CTA 显眼度；加号图标另增加入场动画与 hover 居中旋转，效果已抽象为 `.pc-create-btn` 通用类，详见 `docs/设计文档/新建提示词按钮复刻-Uiverse-popular-cat-31.md`。
- `pc-editor.js` 编辑器页顶部保存按钮（`.pc-editor-save-btn`）复用 `.pc-create-btn` 通用类，默认态为保存图标 +「保存」，保存中切换为对勾 +「保存中」，`setEditorSavingState()` 同步切换 `.is-acting` / `disabled` / `pc-editor-save-busy`，详见 `docs/设计文档/新建提示词按钮复刻-Uiverse-popular-cat-31.md`。

- `mobile-home.js` / `mobile-library.js` / `mobile-detail.js` / `mobile-category.js` / `mobile-editor.js`：移动端各业务模块。
  - `mobile-home.js` 首页统计卡片（`.m-stat-card`）已改为新拟态凸起，移除纯色背景，以语义色文字表达分类，按下态内凹微缩放，卡片顶部使用居中渐变描边 + 同色微光作为分类识别锚点，样式见 `src/css/mobile.css`。
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
- `docs/项目开发经验/`：跨会话沉淀的架构与排障经验。
- `README.md`：项目总入口与使用说明。
