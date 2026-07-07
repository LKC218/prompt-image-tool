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
  `--pc-accent-strong` / `--td-brand-color` / `--td-ripple-color` / `--td-focus-outline` /
  `--storage-ring-color`，驱动主按钮、激活态、聚焦环、水波纹、进度环、欢迎装饰等品牌主色控件。
- `mobile.css`：移动端全部样式。对称派生 `--m-accent-strong` / `--m-focus-ring` / `--m-shadow-accent`，
  主按钮渐变尾色由写死粉 `#FF8FB1` 改为 `var(--m-accent-strong)`。

### 逻辑层 `src/js/`（节选关键模块）
- `pc-app.js`：应用入口；`setAccent(accent)` 写入根节点 `data-accent` 与 `localStorage`（键 `pc-accent`）。
- `pc-settings.js`：PC 设置页外观取色器，`ACCENT_COLORS` 预设与点击切换逻辑。
- `mobile-app.js` / `mobile-settings.js`：移动端入口与取色器（`THEME_COLORS`，`localStorage` 键 `accent`）。
- `pc-detail.js` / `pc-library.js` / `pc-home.js` / `pc-category.js` / `pc-editor.js`：PC 各业务模块。
- `mobile-home.js` / `mobile-library.js` / `mobile-detail.js` / `mobile-category.js` / `mobile-editor.js`：移动端各业务模块。
- `*.test.js`：与源码同名的 vitest 回归用例（运行 `npm run test`）。

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
- `docs/项目开发经验/`：跨会话沉淀的架构与排障经验。
- `README.md`：项目总入口与使用说明。
