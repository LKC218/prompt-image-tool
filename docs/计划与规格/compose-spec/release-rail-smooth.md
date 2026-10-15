---
feature: release-rail-smooth
status: delivered
updated: 2026-09-24
branch: fix/auto-update-bugs
commits: 5e78e1f..working-tree
---

# 更新记录阶段轨交互顺畅化

## Report

**What was built** — 重写更新记录阶段轨的滚动跟随与点击跳转。滚动时用视口上 1/3 阅读锚点做 scroll 位置映射（rAF 节流、`lastActiveStepId` 去重、仅 prev/curr 增量写 class），替代多阈值 IntersectionObserver，消除高亮抖动。点击刻度立即高亮目标，再以 `scrollTo(top = phaseTop - 8)` 精确定位；程序滚动期间锁定映射，`scrollend`（含目标位校验，防 stale 事件）或 rAF 稳定检测解锁后再校准。已在目标位时点击早退，避免 no-op `scrollTo` 不触发 `scrollend` 导致锁卡死。监听经 `AbortController` 在重绑/关闭时清理，避免弹窗复用节点导致的 resize 泄漏。

**Verification** — `npm test -- src/js/release/release-notes.test.js --run` PASS（11）；`npm test -- src/js/release/ --run` PASS（32）。独立审查两轮：4 项 MAJOR 中 3 项 RESOLVED、1 项 PARTIAL（定时器清理）在后续修复中关闭；NEW critical（no-op 锁卡死）RESOLVED；最终复审无 NEW critical。

**Journey log** — 1. IO 多阈值 + 全量 class 刷是抖动根因，换 rAF 位置映射后稳定。2. `scrollend` 在 no-op `scrollTo` 时不会触发，程序锁必须有同位早退。3. 快速连点会堆叠 `scrollend` 监听，必须单例 + 目标位校验。4. `showModal` 复用 `#pcModalContent`，`window` 监听要用 AbortController 显式拆除。5. 测试里 `scrollend` 特性探测需显式 stub `onscrollend`，否则 jsdom 走 fallback 路径。

## [S1] Problem

## [S1] Problem

更新记录弹窗左侧版本阶段轨操作卡顿、不跟手：

1. **滚动跟随抖动**：滚动右侧版本列表时，左侧高亮刻度跳变、滞后或频繁闪烁。
2. **点击跳转不跟手**：点击刻度后滚动过冲、目标版本未停稳，或高亮与可视位置不一致。

## [S2] Design

### 根因

| 症状 | 根因 |
|---|---|
| 滚动跟随抖动 | `IntersectionObserver` 多阈值 `[0.25, 0.5, 0.7]` + `rootMargin: -25%` 在边界频繁回调；回调内取 top 最小相交项，滚动跨界时切换不稳；`setActiveVersion` 每次全量 `forEach` 刷 26 个 tick + 全部 phase 的 class/aria |
| 点击跳转不跟手 | `scrollIntoView({ behavior: 'smooth', block: 'start' })` 与 IO 竞争：动画过程中 IO 持续改 active，落点后再切换，产生过冲与不同步感 |

### 目标行为

1. **滚动跟随稳定**
   - 用 scroll 位置映射替代 IO 驱动：以滚动容器视口上 1/3 线为阅读锚点，命中 `offsetTop` 最近且覆盖锚点的 phase。
   - `requestAnimationFrame` 节流 scroll 回调。
   - 缓存 `lastActiveStepId`，仅在变化时写 DOM。
   - class/aria 更新范围：仅上一个与当前 tick/phase，不做全量扫描写。

2. **点击跳转精确跟手**
   - 点击后立即 `setActiveVersion(stepId)`（不等滚动结束）。
   - 使用 `scroll.scrollTo({ top, behavior })` 精确定位到 `phase.offsetTop - 8`（对齐 `scroll-margin-top`），替代 `scrollIntoView`。
   - 程序滚动期间置 `programmaticScrollLock`，scroll 映射不覆盖 active；以 `scrollend`（无则 rAF 稳定检测 / 超时兜底）释放锁，再按最终位置校准一次 active。
   - `prefers-reduced-motion: reduce` 时 `behavior: 'auto'`。

3. **保持不变**
   - 每版本一条刻度、与版本卡一一对应。
   - tooltip、hover 联动、键盘 focus、`aria-current` 语义。
   - 视觉：居中一列、无竖线、选中高对比短横（上一轮已定）。

### 接口

- 重写 `bindPhaseRail(modal)`（`src/js/release/release-notes.js`）内部跟随与跳转逻辑；导出 API 不变。
- 不改 `renderPhaseRail` / `renderReleasePhase` 的 DOM 结构与 `data-*` 契约。

### 错误行为

- 无 `IntersectionObserver` 的旧环境：直接落入 scroll 映射实现（不再单独走 IO 分支）。
- `scrollend` 不可用：用「连续 2 帧 scroll 增量 < 1px」或 400ms 超时释放程序滚动锁。
- `scrollend` 可用：以目标位校验（`|scrollTop - target| <= 2`）接受事件，忽略 stale 事件；2000ms 超时仅作安全网。已在目标位（`|scrollTop - top| <= 1`）的点击不加锁、不调用 `scrollTo`。
- 弹窗关闭/重绑时经 `AbortController` 解除 scroll、resize 监听与 rAF/timer。

### 测试边界

- 单测断言：绑定后存在 scroll 映射路径；点击调用精确 `scrollTo`（top 对齐 phase）；程序滚动锁期间不切换 active；`setActiveVersion` 同 id 不重复写。
- 不断言具体像素手感；回归覆盖既有 7 条用例。

## [S3] Out of Scope

- tooltip 闪烁/定位性能优化（本次未报卡顿）。
- tick-mark `width` 过渡改 `transform` 的视觉微优化。
- 弹窗开合动画、列表滚动物理/惯性库。
- 阶段轨视觉规格调整（居中、无竖线、选中短横已交付）。

## Tasks

- [x] T1: 重写滚动跟随为 rAF + scroll 位置映射，带 lastActive 去重与增量 class 写 — acceptance: 滚动时 active 刻度稳定切换、无闪烁；同 id 不重复写 DOM (covers: S2)
- [x] T2: 重写点击跳转为精确 scrollTo + 程序滚动锁，落点后校准 active — acceptance: 点击后停在目标版本头部，高亮与目标一致且不被滚动中途覆盖 (covers: S2; depends: T1)
- [x] T3: 补充跟随/跳转回归测试并跑通 release 全套 — acceptance: `release-notes.test.js` 新旧用例全过 (covers: S2; depends: T2)
- [x] T4: 同步就近模块说明文档 — acceptance: `PC端样式模块.md` / `01-首页仪表盘.md` 或版本号模块描述与新行为一致 (covers: S2; depends: T3)
