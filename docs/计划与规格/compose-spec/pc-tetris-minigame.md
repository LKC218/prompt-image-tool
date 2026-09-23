---
feature: pc-tetris-minigame
status: delivered
updated: 2026-09-16
branch: feature/tetris-game
commits: 7b864cb..6c8a70a
---

# PC 俄罗斯方块小游戏

## Report

**What was built** — PC 左侧主导航在「分类与标签」后新增「俄罗斯方块」入口，路由 `/tetris`。游戏页提供 10×20 Canvas 棋盘、七种方块与 7-bag、左右/旋转/软降/硬降、消行计分与等级加速、下一预览、暂停（P/Esc）、重开、结束遮罩重开，以及 `localStorage` 最高分。纯逻辑拆在 `games/tetris-core.js` 并有 12 条单测；样式走语义 Token 新拟态，仅 PC，移动端未做。

**Verification** — `npm test`：33 files / 250 tests 全过（含 `tetris-core.test.js` 12）；`npm run build`：vite 生产构建成功。独立审查结论 `pass-with-minor`，已回修修饰键短路、Esc 暂停、结束遮罩重开按钮、预览形状复用 core、死代码清理。

**Journey log** — 1) 沙箱禁止 `git worktree add`，改为本仓 `feature/tetris-game` 分支，并隔离既有 settings/auto-update 未提交 diff。2) 规格中 Esc 暂停与结束遮罩重开首次实现有偏差，审查指出后已对齐。3) `pc-app.js` 同文件混有检查更新 WIP 与 tetris 增量，提交时需注意勿误伤。

## [S1] Problem

应用缺少休闲小游戏入口。用户希望在 PC 左侧主导航「分类与标签」下方增加一个入口，进入可玩的俄罗斯方块页面，用于短时娱乐，不侵入现有提示词/目标计划业务。

## [S2] Design

### 范围与平台

- 仅 PC 端；移动端本次不加入口、不加路由。
- 路由：`/tetris`，注册在 `pc-app.js`，与现有页面一致走 `render` / `mount` / `unmount`。
- 侧栏主导航 `NAV_ITEMS` 在「分类与标签」之后追加一项：label「小游戏」或「俄罗斯方块」，data-nav=`/tetris`；加入 `TAB_ROUTES`，`updateNavHighlight` 可直接高亮。
- 图标：`src/assets/pc/nav-icons/tetris.png`，与现有 nav 图标一致，作为 CSS mask 使用（深色透明底图形）。

### 页面模块

| 文件 | 职责 |
| --- | --- |
| `src/js/pc/pc-tetris.js` | 游戏页：DOM/Canvas 渲染、输入、循环、状态、生命周期 |
| `src/css/pc/09-tetris.css` | 页面布局与新拟态控件样式，经 `pc.css` 引入 |

模块导出约定与 `pc-category.js` 等一致：`export function render` / `export function mount` / `export function unmount`。`unmount` 必须清理 `requestAnimationFrame`、`keydown` 监听与计时器，避免路由切换后游戏继续跑。

### 游戏规则（经典可玩完整版）

- 场地：10×20 可见格（内部可含缓冲行），Canvas 绘制优先，便于刷新与主题色。
- 方块：I / O / T / S / Z / J / L 七种，标准 4×4 或边界盒旋转状态；使用 7-bag 随机。
- 操作：←→ 移动，↑ 旋转，↓ 软降，Space 硬降，P 或 Esc 暂停/继续，R 重开；页面内提供触控/鼠标按钮兜底。
- 计分：单行 100、双行 300、三行 500、四行 800，再乘当前等级；软降/硬降加移动分（可简化为固定加分）。
- 等级：每消 10 行升 1 级，下落间隔随等级缩短（有下限）。
- UI 信息：当前分、等级、消行数、最高分、下一个方块预览、暂停遮罩、游戏结束遮罩（显示分数 + 重开）。
- 最高分：`localStorage` key `pc-tetris-highscore`，仅本地，不入业务存储。
- 视觉：使用现有 `--pc-*` / `--color-*` 语义 Token，新拟态轻阴影，与侧栏/主内容区风格一致；支持浅色/深色 `data-appearance`。
- 页面可复用 `renderPcWelcomeBanner` 作为标题区（与分类页类似），标题「俄罗斯方块」，副标题轻松文案。

### 交互与焦点

- 进入页面后 `keydown` 仅在本页 `mount` 时绑定，且仅在目标非输入框时拦截游戏键，避免与全局 Ctrl+S 冲突；Space 需 `preventDefault` 防页面滚动。
- 路由离开时 `unmount` 解绑；若模态打开可不强制处理（本页无业务模态）。

### 测试边界

- 单元测试聚焦纯逻辑：旋转、碰撞、消行、计分、7-bag（可抽 `src/js/games/tetris-core.js`，页面只做 UI 接线）。
- 侧栏入口与路由注册可在 `pc-app` 相关测试或手动验收覆盖；不强制 E2E。

## [S3] Out of Scope

- 移动端入口/页面/触控布局专项适配。
- Hold 槽、幽灵块高级策略、T-Spin/连击特效、音效与震动。
- 联网排行榜、多用户、后端存储最高分。
- 修改现有设置/自动更新未提交改动的功能语义（本功能仅增量编辑 `pc-app.js` 导航与路由，不覆盖他人未提交 diff）。

## Tasks

- [x] T1: 新增 tetris 侧栏图标与导航项 — acceptance: 侧栏出现入口，点击进入 `/tetris`，高亮正确；不破坏现有五项导航 (covers: S2)
- [x] T2: 抽出 `games/tetris-core.js` 纯逻辑并补单测 — acceptance: 碰撞/旋转/消行/计分/bag 测试通过 `npm test` (covers: S2)
- [x] T3: 实现 `pc-tetris.js` 页面与 `09-tetris.css` — acceptance: 本地 dev 可完整玩一局：移动/旋转/硬降/升级/结束/重开/最高分持久化；离开路由无残留监听 (covers: S2)
- [x] T4: 文档同步 `docs/导航/apps-code-map.md` 与就近模块说明 — acceptance: 导航表含 `/tetris` 与新文件职责 (covers: S2; depends: T1, T3)
