# 应用代码地图

> 本文档仅作为「文件导航」与「文档更新落点」，不记录修改历史或执行结果。
> 源文件为中文 UTF-8 编码；若编辑器显示乱码，请确认以 UTF-8 打开。
> 最后整理：2026-08-21

---

## 一、项目概述

提示词管家（prompt-image-tool / PromptImageManager）是一套原生 HTML + CSS 变量 + 原生 JS（无框架）的跨端应用。

- 主入口：`src/index.html` + `src/js/main.js`
- PC 端：Tauri v2 壳 + Python HTTP 后端（JSON 文件存储）
- 移动端：Capacitor + SQLite
- 主题：根节点 `data-appearance`、`data-workbench-theme` 驱动 CSS 语义 Token
- 工作台主题：晴空巡逻 / 蔷薇漫游 / 焦糖午后 / 松林远足 / 星夜侦察 / 海盐薄荷

---

## 二、根目录职责

| 路径 | 职责 |
| --- | --- |
| `src/` | 前端源码（js / css / assets / react 试点 / index.html） |
| `python/` | Python 后端、数据目录占位、pytest |
| `src-tauri/` | Tauri PC 壳 |
| `android/` | Capacitor Android 工程 |
| `installer-shell/` | Tauri 自定义安装器壳 |
| `scripts/` | 构建、开发、维护脚本；`publish_release.ps1` 一键发布（版本一致性校验 + Release 完整分节更新说明）；`normalize_changelog.py` 规范化 changelog 章节词表；`gen_release_body.py` / `backfill_release_notes.py` 生成或回填 Release 正文；`capture_readme_previews.py` 重拍 README 预览图；`verify-*.mjs` 为本地功能核验脚本 |
| `.mimocode/skills/release-publish/` | 项目技能：一键发布安装包并更新首页 README 版本信息 |
| `build/` | PyInstaller / NSIS 打包配置与中间产物（安装包不入 Git） |
| `releases/` | 本地发布产物落点（不入 Git） |
| `docs/` | 技术 / 设计 / 计划 / 模块 / 版本文档 |
| `UI设计稿/` | 历史 UI 复刻稿与图标插画源资产（旁支，不参与运行时） |
| `gpt本地档案馆工具/` | ChatGPT Vault 用户脚本旁支（与主应用弱耦合） |

---

## 三、前端源码导航

### 3.1 启动与双端壳

| 文件 | 职责 |
| --- | --- |
| `src/js/main.js` | `detectUI()`、主题初始化、存储初始化、挂载 PC/移动壳 |
| `src/js/pc-app.js` | PC 侧边栏壳、导航、路由注册、主题切换、更新记录入口 |
| `src/js/mobile-app.js` | 移动端底部 Tab、悬浮新建、返回键、路由注册 |
| `src/js/pc-router.js` | PC 路由（`history.pushState`） |
| `src/js/mobile-router.js` | 移动路由 |

**PC 路由**：`/`、`/library`、`/detail/:id`、`/editor/:id`、`/category`、`/goals`、`/goals/:id`、`/games`、`/tetris`、`/plane`、`/settings`

**移动路由**：`/`、`/library`、`/detail/:id`、`/editor/:id`、`/category`、`/settings`（暂无目标计划）

### 3.2 存储与数据

| 文件 | 职责 |
| --- | --- |
| `src/js/storage.js` | 存储抽象入口 |
| `src/js/api-storage.js` | PC：HTTP API |
| `src/js/sqlite-storage.js` | 移动：Capacitor SQLite |
| `src/js/backup-utils.js` | JSON/ZIP 备份导入导出 |
| `src/js/lan-sync.js` | 局域网同步客户端 |
| `src/js/prompt-tool-json-import.js` | 对话归档 / 旧格式 JSON 导入适配 |
| `src/js/download-history.js` | 导出下载历史 |

### 3.3 PC 页面模块

| 文件 | 路由 | 职责 |
| --- | --- | --- |
| `pc-home.js` | `/` | 统计卡、最近使用、收藏分类、欢迎区、挂机植物启停 |
| `pc-library.js` | `/library` | 搜索过滤、表格 + 预览、分页 |
| `pc-detail.js` | `/detail/:id` | 版本、图片画廊、复制提示词 |
| `pc-detail-modal.js` | — | 库内详情弹窗 |
| `pc-editor.js` | `/editor/:id` | 新建/编辑、多版本、图片、草稿 |
| `pc-category.js` | `/category` | 文件夹与标签管理 |
| `pc-goal-projects.js` | `/goals` | 目标计划项目列表 |
| `pc-goal-detail.js` | `/goals/:id` | 任务树、进度、任务图片 |
| `pc-games-hub.js` | `/games` | 摸鱼时间游戏中心卡片 |
| `pc-tetris.js` | `/tetris` | 俄罗斯方块小游戏页（Canvas、键盘与按钮） |
| `pc-plane.js` | `/plane` | 飞机大战小游戏页 |
| `pc-settings.js` | `/settings` | 外观、备份、同步、下载历史、检查更新 |

### 3.4 移动页面模块

| 文件 | 路由 | 职责 |
| --- | --- | --- |
| `mobile-home.js` | `/` | 首页仪表盘 |
| `mobile-library.js` | `/library` | 提示词库 |
| `mobile-detail.js` | `/detail/:id` | 详情 |
| `mobile-editor.js` | `/editor/:id` | 新建/编辑 |
| `mobile-category.js` | `/category` | 分类 |
| `mobile-settings.js` | `/settings` | 设置与局域网同步 |

### 3.5 主题、样式与交互

| 文件 | 职责 |
| --- | --- |
| `src/css/theme-tokens.css` | 语义 Token 唯一定义处 |
| `src/css/pc.css` | PC 样式入口（聚合 `src/css/pc/*`） |
| `src/css/pc/01-foundation-shell.css` | 壳与基础 |
| `src/css/pc/02-settings-compat.css` | 设置兼容 |
| `src/css/pc/03-shared-components.css` | 共享组件 |
| `src/css/pc/04-settings-page.css` | 设置页 |
| `src/css/pc/05a-legacy-page-primitives.css` | 遗留页面原语 |
| `src/css/pc/05b-category-base.css` | 分类页 |
| `src/css/pc/05c-global-overlays.css` | 全局弹层 |
| `src/css/pc/05d-welcome-library-base.css` | 欢迎区与库页 |
| `src/css/pc/05e-page-late-overrides.css` | 页面后置覆盖（待收敛） |
| `src/css/pc/06-responsive-overrides.css` | 响应式 |
| `src/css/pc/07-theme-toggle.css` | 主题切换 |
| `src/css/pc/08-goal-plan.css` | 目标计划 |
| `src/css/pc/09-tetris.css` | 俄罗斯方块小游戏页 |
| `src/css/pc/10-plane.css` | 摸鱼中心与飞机大战 |
| `src/css/pc/11-plant.css` | 首页挂机种植物（横幅槽/养护气泡/debug） |
| `src/js/tetris-core.js` | 俄罗斯方块纯逻辑（棋盘/旋转/消行/计分） |
| `src/js/plane-war-core.js` | 飞机大战纯逻辑（生成/碰撞/计分/tick） |
| `src/js/plant-core.js` | 挂机种植物纯逻辑（30 天轮回/养护/铲除/debug） |
| `src/js/plant-persist.js` | 植物档 API/localStorage 双写与迁移 |
| `src/js/plant-tracker.js` | 植物计时生命周期（visibility/心跳/存档） |
| `src/js/plant-view.js` | 植物素材/SVG 渲染与养护 UI |
| `src/assets/pc/plant/` | 镜面草四阶段图 + 单叶精灵 |
| `src/css/mobile.css` | 移动端样式入口 |
| `src/js/version-info.js` | 版本号读取与展示 |
| `src/js/auto-updater.js` | PC 应用内更新：检查 / 启动下载 / 轮询进度 / 取消 / 安装 |
| `src/js/update-progress-modal.js` | 阶段式更新进度弹窗（百分比、阶段列表、取消/重试） |
| `src/js/pc-utils.js` / `mobile-utils.js` | 端侧 Toast/Modal/ActionSheet |
| `src/js/pc-cursor.js` | PC 自定义圆环光标 |
| `src/js/ripple.js` | 涟漪 |
| `src/js/goal-utils.js` / `goal-image-preview.js` | 目标计划共享工具 |

### 3.6 React 微试点

| 路径 | 职责 |
| --- | --- |
| `src/react/icons/` | 动画图标试点（AudioLines），独立演示页，不挂入主壳 |

---

## 四、后端与壳

| 路径 | 职责 |
| --- | --- |
| `python/main.py` | 开发用 HTTP API + 静态资源 |
| `python/auto_update.py` | 更新检查/异步下载 Job/静默安装模块（`build/auto_update.py` 同步副本） |
| `build/app_main.py` | PyInstaller 独立包入口 |
| `build/installer.nsi` | NSIS 安装脚本 |
| `src-tauri/` | PC 窗口、拉起 Python |
| `installer-shell/` | 自定义安装向导壳 |
| `capacitor.config.ts` / `android/` | Android 工程 |

核心 API 与同步协议详见 [`docs/技术文档/api-reference.md`](技术文档/api-reference.md)、[`docs/技术文档/lan-sync-design-doc.md`](技术文档/lan-sync-design-doc.md)。

---

## 五、文档导航

| 目录 | 用途 |
| --- | --- |
| `docs/README.md` | 文档中心入口 |
| `docs/技术文档/` | PC / 移动 / Web / API / 同步 |
| `docs/设计文档/` | UI/UX、主题令牌、组件规范 |
| `docs/模块说明/` | 就近模块说明（光标、样式、目标计划、路由等） |
| `docs/计划文档/` | 活跃计划 + `_历史归档/` |
| `docs/构建方案/` | 打包与发布流程 |
| `docs/版本记录/` | 更新记录规范（固定格式）、changelog 权威源、版本索引 |
| `docs/版本记录/更新记录规范.md` | **更新说明格式唯一规范**：词表/模板/检查清单 |
| `docs/版本发布与更新记录维护指南.md` | 发版流程、版本号与配置同步；格式细节指向更新记录规范 |
| `docs/测试记录/` | 测试与回归记录 |
| `docs/项目开发经验/` | 可复用规范与踩坑 |
| `docs/UI计划/` | 页面级 UI 计划与复刻稿 |
| `docs/工程文档/` | 交接与目录说明 |

**就近模块说明**（改动后优先同步）：

- [目标计划模块](模块说明/目标计划模块.md)
- [PC端样式模块](模块说明/PC端样式模块.md)
- [全局样式与主题模块](模块说明/全局样式与主题模块.md)
- [路由与启动模块](模块说明/路由与启动模块.md)
- [PC端自定义光标模块](模块说明/PC端自定义光标模块.md)
- [PC端提示词详情弹窗模块](模块说明/PC端提示词详情弹窗模块.md)
- [动态图标组件模块](模块说明/动态图标组件模块.md)
- [版本号模块](模块说明/版本号模块.md)
- [应用内自动更新模块](模块说明/应用内自动更新模块.md)
- [俄罗斯方块小游戏模块](模块说明/俄罗斯方块小游戏模块.md)
- [摸鱼时间游戏中心模块](模块说明/摸鱼时间游戏中心模块.md)
- [首页挂机种植物模块](模块说明/首页挂机种植物模块.md)

---

## 六、旁支边界（不参与主应用构建）

| 路径 | 边界说明 |
| --- | --- |
| `UI设计稿/` | 设计复刻文档与插画/图标源文件；运行时资源已迁至 `src/assets/`，此处仅作设计归档与素材源 |
| `gpt本地档案馆工具/` | Tampermonkey 用户脚本，导出 ChatGPT 对话供本工具导入；不依赖、不打包进主应用 |
| `docs/计划文档/_历史归档/` | 已完成计划，不参与日常导航 |

---

## 七、文档更新约定

1. 新增/修改功能模块后：同步本文件的对应表格行，并更新最近的 `docs/模块说明/` 文档。
2. 本文件只做导航，不写修改历史、阶段记录或任务完成说明。
3. 空目录、占位目录、未接入主线的目录不单独建档。
4. 中文文档命名：有意义、无空格、连字符分隔、日期后置 `YYMMDD`。
