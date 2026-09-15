---
feature: pc-games-hub-plane
status: delivered
updated: 2026-09-16
branch: feature/tetris-game
commits: 1e921b2..73eb66b
---

# 摸鱼时间游戏中心与飞机大战

## Report

**What was built** — 侧栏原「俄罗斯方块」入口改为「摸鱼时间」（`/games`）。中心页以目标计划风格卡片展示游戏简述，点击进入弹出确认框，确认后跳转 `/tetris` 或 `/plane`。新增完整经典飞机大战：Canvas 竖版战场、移动/自动射击、三类敌机与波次加速、碰撞扣命与无敌、计分/最高分、暂停/重开。`/tetris`、`/plane` 均高亮侧栏「摸鱼时间」。

**Verification** — `npm test`：34 files / 261 tests 全过（plane-war-core 11 测，含扣命/计分/结束）；`npm run build` 成功。独立审查 `pass-with-minor`，已补测试并清理死代码/文案/文档。

**Journey log** — 1) 卡片视觉对齐 goal 但独立 `pc-games-*` 类，避免与业务 DOM 耦合。2) 审查指出扣命/计分/结束缺测，补确定性用例后闭环。3) 未实现道具，文案与 `powerups` 字段已对齐实现。

## [S1] Problem

侧栏仅有直达「俄罗斯方块」的入口，无法扩展更多小游戏，也没有「先看简介再进入」的选择体验。需要把入口升级为「摸鱼时间」游戏中心：卡片式选择游戏、展示简述、确认后进入；并新增完整经典版飞机大战。

## [S2] Design

### 导航与路由

- 侧栏 `NAV_ITEMS` 中原「俄罗斯方块」（`/tetris`）改为 label「摸鱼时间」、path `/games`，图标沿用/微调游戏主题 mask 图。
- 路由：
  - `/games`：游戏中心（卡片列表）
  - `/tetris`：俄罗斯方块（沿用现有页）
  - `/plane`：飞机大战（新建）
- `TAB_ROUTES` 含 `/games`；`updateNavHighlight`：`/tetris`、`/plane` 时高亮 `/games`（与 `/detail` 高亮 `/library` 同模式）。
- 移动端不做。

### 游戏中心页 `pc-games-hub.js`

- 欢迎横幅标题「摸鱼时间」，副文案轻松。
- 游戏以卡片网格呈现，视觉对齐目标计划项目卡（渐变封面 + 标题 + 简述 + 元信息/入口按钮），类名前缀 `pc-games-*`，不直接复用 goal DOM 避免耦合。
- 游戏目录（常量）：

| id | 标题 | 路由 | 简述 |
| --- | --- | --- | --- |
| tetris | 俄罗斯方块 | `/tetris` | 经典七种方块，消行升级，键盘畅玩 |
| plane | 飞机大战 | `/plane` | 驾驶小飞机击落敌机，波次加速挑战高分 |

- 点击「进入游戏」→ `showConfirmModal` 显示标题+简述，确认后 `navigate`，取消则停留。
- 卡片封面用确定性渐变/首字或内联 SVG 风格图形，不依赖业务图片资源。

### 飞机大战 `pc-plane.js` + `plane-war-core.js`

- Canvas 竖版战场；玩家机底部，←→（及可选 ↑↓ 限底部区域）移动；Space 或自动射击（经典：空格射击，可自动连射）。
- 敌机自上而下波次生成，命中得分；玩家中弹扣命；生命归零结束。
- 计分、等级/波次加速、暂停（P/Esc）、重开（R）、结束遮罩重开。
- 最高分：`localStorage` key `pc-plane-highscore`。
- 纯逻辑进 `plane-war-core.js`（生成、碰撞、计分、tick），页面只做渲染与输入；补单元测试。
- 样式 `10-plane.css`（或并入 games 相关 css），经 `pc.css` 引入；Token 与 tetris 页一致。
- `unmount` 清理 rAF 与 keydown。

### 测试

- `plane-war-core.test.js`：生成、碰撞、扣命、计分、结束条件。
- 中心页卡片与确认流可不强制 DOM 测；路由高亮如已有 nav 测试模式可补。

## [S3] Out of Scope

- 移动端入口与触控专项。
- 飞机大战豪华内容（Boss 树、多机体、音效包）。
- 游戏成就/排行后端。
- 未提交 settings/auto-update WIP 的功能语义。

## Tasks

- [x] T1: 侧栏改名「摸鱼时间」并接 `/games` 高亮规则 — acceptance: 侧栏文案与路由正确；`/tetris`、`/plane` 高亮摸鱼时间 (covers: S2)
- [x] T2: 实现游戏中心卡片页与确认进入 — acceptance: 两张卡片展示简述，确认后进入对应游戏，取消不跳转 (covers: S2)
- [x] T3: `plane-war-core.js` 逻辑与单测 — acceptance: 核心测试通过 (covers: S2)
- [x] T4: 飞机大战页面与样式 — acceptance: 可完整玩一局（移动/射击/波次/结束/重开/最高分）；离开无残留 (covers: S2)
- [x] T5: 文档同步 apps-code-map 与模块说明 — acceptance: 导航/路由/文件表更新 (covers: S2; depends: T1, T2, T4)
