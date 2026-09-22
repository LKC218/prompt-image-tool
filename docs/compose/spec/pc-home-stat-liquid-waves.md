---
feature: pc-home-stat-liquid-waves
status: delivered
updated: 2026-02-16
branch: main
commits: (uncommitted workspace — user chose current tree; no git commit performed)
---

# PC 首页统计卡液体波浪永续

## Report

**What was built** — 首页四张统计卡改为「中位静置液面 + 双层解析正弦波浪」。删除了原先不稳定的弹簧场 + 每帧位移积分（会导致 path y 数秒内指数爆炸、波浪视觉消失）。表面 y 现为常数振幅的多频 `sin` 叠加，任意时刻有界；rAF 仅推进 `phase`，`destroy` 在 `unmount` 时取消循环。液面高度固定中位（0.46/0.48/0.44/0.45，模块夹取 0.42–0.50），无鼠标交互，`prefers-reduced-motion` 下冻结。

**Verification** —
- `npm test -- src/js/pc-stat-liquid.test.js src/js/pc-home.test.js src/js/pc-home-pixel-animation.test.js src/js/global-micro-interactions.test.js` → PASS（17 tests；含 body/waveA/waveB 30s 有界断言）
- `node scripts/verify-pc-home-liquid.mjs`（Playwright 20s）→ PASS：`maxBodyRange≈5.2`，`lateMoving=true`，四卡 mid fill，无 console error
- Review（独立 subagent）→ Spec compliance / Correctness / Codebase consistency **pass**，无 critical
- 截图：`output/playwright/pc-home-stat-liquid-stable.png`
- 诊断脚本：`scripts/repro-liquid-wave-decay.mjs`（修复前发散证据）

**Journey log** —
1. 首版弹簧 + 每帧 `y += sin(...)` 在数值上不稳定，20s 采样 range 达 1e14，表现为「波浪消失」。
2. 用户确认：解析正弦波 + 当前工作区继续（不切 worktree）。
3. 单元测试先锁 30s 有界 + path 持续变化，再改实现。
4. Review 提示 wave 层未纳入有界断言 → 已补测 body/waveA/waveB。
5. 运行时切换系统「减少动态」不会热更新 JS phase（仅 CSS 隐藏波层）；如需热切换可再监听 media change。

## [S1] Problem

首页四张统计卡的液体「双层波浪微动」只持续数秒，随后视觉上消失（液面变平或异常）。

根因（已复现）：`src/js/pc-stat-liquid.js` 使用弹簧场，并对表面高度 `y[i]` **每帧叠加 sin 位移**。离散积分不稳定，能量被持续泵入，约数秒后 SVG path 的 y 坐标指数爆炸（20s 采样中 bodyRange 从 ~70 增至 1e14 量级），液面跑出卡片可视区，用户感知为「波浪消失」。

复现脚本：`scripts/repro-liquid-wave-decay.mjs`（对 path y 做逐秒采样）。

## [S2] Design

**目标行为**

- 液面保持卡片中位高度，不随数量填充、不消失。
- 双层波浪**持续、有界、可见**的 idle 微动。
- 无鼠标交互（`pointer-events: none`）。
- `prefers-reduced-motion: reduce` 时冻结为静态中位液面。

**实现契约**

1. 液面高度：`clampStatFill` 夹在 `[0.42, 0.50]`，默认 `0.45`；四卡初始 `0.46 / 0.48 / 0.44 / 0.45`。
2. 表面几何：**禁止弹簧 / 未钳制积分状态**。每层 y 为解析函数：
   - `y(x,t) = baseY + bias_layer + Σ sin(k·x_norm + ω·t + φ)`
   - `body` / `waveA` / `waveB` 使用不同 `(k, ω, φ, amplitude)` 与竖直偏置。
   - 振幅由常数决定，数学上对任意 `t` 有界。
3. 路径：仍用 `pointsToPath` 生成 SVG `d`（viewBox `0 0 200 100`，闭合至 y=120）。
4. 动画循环：单一 `requestAnimationFrame`，仅推进 `phase += dt`；`dt` 钳在 `[0, 0.05]`。
5. 生命周期：`createStatLiquidController` / `destroy`；`pc-home.js` `mount`/`unmount` 挂接不变。
6. 采样点数：`LIQ_POINTS >= 28`，保证波形平滑。

**测试边界**

- 单元测试：解析表面在 `t ∈ [0, 30]` 步进下，body/waveA/waveB 表面 y 相对 `baseY` 的偏移绝对值 ≤ 12；相邻帧 path `d` 可变化。
- 集成/视觉：Playwright 打开 `/?ui=pc`，20s 内 path y 极差保持有界，且后期（t≥15s）path 仍在变化；截图留存。
- 既有 `pc-home*.test.js` / 微交互测试保持通过。

## [S3] Out of Scope

- 鼠标晃液、点击涟漪、倾角惯性。
- 液面高度与提示词/分类/标签/收藏数量的比例映射。
- 移动端 `m-stat-card`。
- WebGL / Canvas 流体。

## Tasks

- [x] T1: 将 `pc-stat-liquid.js` 重写为解析正弦液面 — acceptance: 单元测试证明 30s 模拟表面偏移有界且 path 持续变化；无弹簧积分 (covers: S2)
- [x] T2: 保持 `pc-home.js` / CSS 中位液面集成 — acceptance: 四卡 fill 为 0.46/0.48/0.44/0.45；相关 vitest 通过 (covers: S2; depends: T1)
- [x] T3: Playwright 20s 闭环验证 — acceptance: path y 有界、后期仍动画、无 pageerror；产出截图 (covers: S1; S2; depends: T2)
