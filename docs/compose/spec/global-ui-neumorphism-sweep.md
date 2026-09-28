---
feature: global-ui-neumorphism-sweep
status: delivered
updated: 2026-09-27
branch: main
commits: f8b14e3..working-tree
---

# 全局 UI 新拟态扫尾

## Report

**What was built** — 将 PC 全局 UI 从「拟态控件 + 扁平卡片」混搭统一为 `--pc-control-*` / `--pc-neu-*` 双向/内凹轻拟态。覆盖共享原语（`.pc-card`、`.pc-btn*`、`.pc-input/.pc-textarea/.pc-select`）、浮层（`.pc-toast`、`.pc-modal` 壳、详情最小化列表/按钮）、遗留页面原语（快捷创建、最近项、星标/更多、比例按钮、分段控件、分类卡、图片卡）、设置页（面板、存储/备份卡、开关、动作卡、主题点、导出模式）与库搜索壳。语义色（primary/danger/Toast 状态色）保持实色，只改表面深度与阴影；深色模式经令牌映射夜航冷灰蓝。`--pc-settings-neu-*` 别名改为引用 `--pc-control-*`，不再写死暖白/暖棕。

**Verification** —
- `npm test` → PASS（399 tests / 47 files）
- `node scripts/verify-global-neu-sweep.mjs` → `VISUAL_PASS`（32/32，浅色+深色，截图落盘 `output/playwright/global-neu-sweep/`）
- `node scripts/verify-neu-select-sweep.mjs` / `verify-neu-dropdown-audit.mjs` → `VISUAL_PASS`（无回归）
- `node scripts/verify-ui-encoding.mjs` / `verify-dist-assets.mjs` → PASS
- 独立 Review 两轮：首轮 2 critical（语义色淡染、`color-mix` 110% 越界）已修复；复审全部 PASS，无新引入问题

**Journey log** —
1. `--pc-neu-*` / `--pc-control-*` 挂在 `.pc-app` 而非 `:root`，注入到 `body` 的 Toast/弹窗吃不到令牌——视觉脚本必须注入 `.pc-app` 内。
2. 视觉脚本选择器必须对齐真实 DOM（`.pc-stat-card` 而非 `.pc-card`；库搜索阴影在 `__outer` 壳而非 input）。
3. 首版把 primary/danger/Toast 改成淡染色被 Review 判为违反「状态语义保持原色」——已恢复实色填充 + 拟态阴影。
4. `color-mix` 百分比 >100 会让整条声明失效（`110%` 悬停阴影丢失）。
5. 工作区进入本任务时已有 `pc-neu-select` 并行未提交改动，已写入 S3 作为基线，不计入本规格交付面。

## [S1] Problem

PC 端已有 `--pc-neu-*` / `--pc-control-*` 轻拟态令牌与按钮、下拉、侧栏、统计卡等局部落地，但全局仍残留大量非拟态表面：

1. **共享原语仍是旧扁平风**：`.pc-card`、`.pc-btn` 系列、`.pc-input` / `.pc-textarea` / `.pc-select` 使用单向 `--pc-shadow-*` 或硬描边，与侧栏/按钮语言不一致。
2. **浮层未双向柔和**：`.pc-toast`、部分弹窗壳仍用 `--pc-shadow-lg` 单向投影。
3. **遗留页面原语未接入**：`05a-legacy-page-primitives.css` 的快捷创建、最近项、星标/更多、面包屑、编辑器比例按钮仍是 border + 旧阴影。
4. **设置页残留**：存储/备份卡片、开关、动作卡仍混用 `--pc-shadow-md` 与单侧阴影。
5. **深色模式契约**：不得复用暖白高光；必须走 `--pc-control-*` / `--color-shadow-control-*`，由令牌层映射夜航冷灰蓝。

用户可见问题：同屏出现「拟态控件 + 扁平卡片」混搭，视觉语言断裂。

## [S2] Design

### 转换契约（全项目统一）

| 层级 | 默认凸起 | 按下/激活 | 浅浮层 | 输入内凹 |
|---|---|---|---|---|
| 令牌 | `--pc-control-raised-shadow` | `--pc-control-pressed-shadow` | `--pc-control-soft-shadow` | `--pc-control-pressed-shadow` |
| 背景 | `--pc-neu-bg`（浅）/ `--color-surface-raised`（深，经令牌） | 同左 | `--pc-neu-bg` / `--color-surface-floating` | `--pc-neu-bg` / `--color-surface-input` |
| 描边 | 去掉硬描边；深色可保留 `1px solid var(--color-border-subtle)` | 同左 | 去掉 | 去掉硬描边，靠内凹区分 |

规则：

1. **禁止**新写 `0 2px 8px` / `--pc-shadow-sm|md|lg` 一类单向投影作为交互表面主态；媒体浮层、纯装饰、focus ring、`prefers-reduced-motion` 除外。
2. **禁止**在组件内写死 `rgba(255,255,255,*)` 暖白高光或 `rgba(120,90,50,*)` 暖棕投影；一律引用 `--pc-neu-light/dark` 或 `--pc-control-*`。
3. **状态语义保持原色**（danger/primary/success/warning Toast），新拟态只改表面深度与阴影，不改语义色填充。
4. **focus-visible** 仍用主题色焦点环（`--pc-accent` / `--color-brand-focus`），不依赖阴影。
5. **原生 `<select>`** 不可 CSS 拟态弹层；已改造处走 `pc-neu-select`，本轮遗留原生 select 仅美化触发器本体，不扩组件面。
6. **深色模式**走 `:root[data-appearance="dark"]` 令牌覆写，组件选择器不写死夜航色。
7. **`color-mix` 百分比必须 ≤ 100**，否则整条声明失效。

### 分批范围

| 批次 | 范围 | 主要文件 |
|---|---|---|
| B1 共享原语 | `.pc-card`、`.pc-btn*`、`.pc-input/.pc-textarea/.pc-select` | `03-shared-components.css` |
| B2 浮层 | `.pc-toast`、`.pc-modal` 壳阴影 | `05c-global-overlays.css` |
| B3 遗留页面 | 快捷创建、最近项、星标/更多、面包屑、比例按钮 | `05a-legacy-page-primitives.css` |
| B4 设置页 | 存储/备份卡、开关、动作卡、主题点 | `04-settings-page.css`、`02-settings-compat.css` |
| B5 视觉闭环 | Playwright 全局扫尾脚本 + 截图 | `scripts/verify-global-neu-sweep.mjs` |

游戏页（`08-goal-plan` / `09-tetris` / `10-plane` / `11-plant`）与 `mobile.css` **本轮不改**（见 Out of Scope）。

### 测试与视觉验证边界

1. 既有 vitest（`pc-settings.test.js`、`pc-neu-select.test.js` 等）保持通过。
2. 新增 `scripts/verify-global-neu-sweep.mjs`：
   - 打开 `/?ui=pc`，依次截取：首页卡片、共享按钮区、输入框、Toast、设置页开关/动作卡、快捷创建。
   - 用 `getComputedStyle` 断言：目标选择器 `box-shadow` 含 `inset` 或 ≥2 段阴影（双向/内凹），且不含未映射的裸 `rgb(0, 0, 0` 单段主投影。
   - 浅色 + 深色（`data-appearance="dark"`）各跑一遍。
   - 输出 `VISUAL_PASS` / `VISUAL_FAIL` 与截图到 `output/playwright/global-neu-sweep/`。
3. 既有 `verify-neu-select-sweep.mjs` / `verify-neu-dropdown-audit.mjs` 不回归失败。

## [S3] Out of Scope

- 移动端 `mobile.css` / `m-neu-btn` 扫尾（独立批次）。
- 小游戏页（俄罗斯方块/飞机/植物）与目标计划画布内装饰阴影。
- 本规格不交付新组件 API。工作区已有的 `pc-neu-select.js` 及其接入（外观下拉、合并弹窗、每页数量）属于**进入本任务前的并行未提交工作**，作为基线保留，不计入本规格 T1–T6 交付面；验收只覆盖其回归不失败。
- 原生 `<select>` 系统弹层外观。
- 发布/打包/安装器壳 `installer-shell`。

## Tasks

- [x] T1: B1 共享原语拟态化 — acceptance: `.pc-card/.pc-btn*/.pc-input/.pc-textarea/.pc-select` 主态为双向或内凹令牌阴影，无硬描边主态；浅深色均成立 (covers: S2)
- [x] T2: B2 浮层拟态化 — acceptance: `.pc-toast`/`.pc-modal` 壳使用 control/neu 令牌，无 `--pc-shadow-lg` 主投影 (covers: S2; depends: T1)
- [x] T3: B3 遗留页面原语拟态化 — acceptance: 快捷创建/最近项/星标更多/面包屑/比例按钮主态为凸起或内凹拟态 (covers: S2; depends: T1)
- [x] T4: B4 设置页残留拟态化 — acceptance: 存储/备份卡、开关、动作卡、主题点主态无 `--pc-shadow-md` 单向投影 (covers: S2; depends: T1)
- [x] T5: 视觉验证脚本与截图闭环 — acceptance: `node scripts/verify-global-neu-sweep.mjs` 输出 `VISUAL_PASS`，浅深色截图落盘 (covers: S2; depends: T2; T3; T4)
- [x] T6: 单测与文档同步 — acceptance: `npm test` 相关用例通过；`docs/apps-code-map.md` 与就近模块说明已更新 (covers: S2)
