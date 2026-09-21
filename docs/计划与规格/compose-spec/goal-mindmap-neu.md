---
feature: goal-mindmap-neu
status: delivered
updated: 2026-09-20
branch: main
commits: pending
---

# 目标计划思维导图 · 新拟态 UI

## Report

**What was built** — 在不改交互与数据语义的前提下，将目标计划思维导图 UI 全面对齐主题新拟态 Token（`--pc-neu-*`、`--pc-control-raised/pressed/soft-shadow`）。画布为大面积 inset 凹槽 + 淡点阵；节点为同色抬升胶囊（完成态更淡软）；分支色用 `inset 3px` 左侧色带替代硬边框；左侧状态点（todo 内凹 / doing 半环 / done 绿勾）；进度与缩放为内凹胶囊；工具条默认抬升、激活/primary 内凹 + accent 字；图例为抬升软条；关联/执行中颜色收口为 CSS 变量以便暗色跟随。

**Verification** — `node scripts/goal-mindmap-neu-visual.mjs`：VISUAL_PASS（stageInset/todoInset/progressInset/zoomInset/legendRaised=true，nodeBorder=0px，hardWhiteBorder=false，maximize 正常）。`vitest goal-mindmap-core + goal-utils-cover + pc-goal-project-card-parallax`：32 passed。独立 review：三轴 PASS，无 critical；已修复 major（图例抬升）并清理残留 view-switch CSS、Token 化 relation/executing 色。

**Journey log** — 1) 环境仍禁止 worktree，主工作区实施。2) CSS 分层叠加导致样式膨胀，采用「截断 mindmap 段 + 统一新拟态段」重写，避免选择器互相打架。3) 视觉断言必须查 computed `box-shadow` 是否 inset/raised，不能只看 class 存在。4) 图例若只做顶边细线会被误判为已抬升，需 `--pc-control-raised-shadow` 双阴影。5) `edit` 工具对 CRLF CSS 易失配，PowerShell 全文替换更稳。

## [S1] Problem

思维导图交互与信息语义已就绪，但节点/工具条/图例仍是白卡片 + 硬边框风格，与目标计划模块既有新拟态体系（`--pc-neu-*`、卡片双阴影）不一致，整体触感割裂。

## [S2] Design

### 决策（已确认）

在**不改交互与数据结构**的前提下，将导图 UI 全面对齐主题新拟态 Token。

### Token 契约

复用 `01-foundation-shell.css`：

| Token | 用途 |
|-------|------|
| `--pc-neu-bg` / `--pc-surface` | 所有导图表面底色（同色分层） |
| `--pc-neu-light` / `--pc-neu-dark` | 双阴影高光/暗部 |
| `--pc-control-raised-shadow` | 节点/按钮/图例默认抬升 |
| `--pc-control-pressed-shadow` | 激活按钮、进度/缩放内凹 |
| `--pc-control-soft-shadow` | 完成态弱化阴影 |
| `--pc-neu-radius` / `--pc-radius-lg` | 圆角 |
| `--pc-accent` | 选中/激活强调 |
| `--color-state-success-fg` 等 | 状态色 |
| `--pc-goal-mindmap-relation` / `--pc-goal-mindmap-executing` | 导图局部语义色（可被主题覆盖） |

原则：同色底 + 光影分层；几乎无硬 `border`。

### 组件映射

| 组件 | 样式 |
|------|------|
| 画布 stage | **inset** 凹槽 + 极淡点阵 |
| 节点 | **外抬升** 胶囊；完成态 soft 阴影 + 划线 |
| 分支色 | `inset 3px` 左色带，非 `border-left` |
| 状态点 | todo 内凹 / doing 半环 / done success 实心 |
| 优先级 | 右上抬起色点 + 底色细环 |
| 进度 / 缩放 | **内凹** pill |
| 工具按钮 | 默认 raised；激活/primary **inset** + accent |
| 图例 | **raised** 软浮动条 |
| 连线 | 圆角正交 + 分支色；完成边更淡 |

### 状态语义（保持不变）

左态 / 右优 / 父进度 / 只看未完成 — 仅换皮。

### 测试边界

- 单测：回归 `goal-mindmap-core` 等（纯 JS，不依赖 CSS）
- 视觉：`scripts/goal-mindmap-neu-visual.mjs` 断言 computed 阴影与无硬边框

## [S3] Out of Scope

- 交互逻辑、布局算法、连线几何变更
- 暗色主题单独调色（Token 驱动；局部色已变量化）
- 移动端导图适配
- 第三方 UI 库

## Tasks

- [x] T1: 撰写本 spec 并记录 workspace override — acceptance: 文档存在且设计映射完整 (covers: S2)
- [x] T2: 重写 `08-goal-plan.css` 导图为新拟态 Token 体系 — acceptance: 画布 inset、节点抬升、按钮态、图例软条齐全，无硬白卡片边 (covers: S2)
- [x] T3: 视觉验证脚本 + 截图 — acceptance: computed style/截图确认 inset/抬升，VISUAL_PASS (covers: S2; depends: T2)
- [x] T4: 回归单测 + 独立 review + finalize — acceptance: core 测试通过；review 无 critical；status=delivered (covers: S2; depends: T3)

## Implementation override

环境禁止 `git worktree add`。主工作区实施；提交时仅 stage 本特性相关文件。

### 本特性文件

- `docs/计划与规格/compose-spec/goal-mindmap-neu.md`
- `src/css/pc/08-goal-plan.css`
- `scripts/goal-mindmap-neu-visual.mjs`
