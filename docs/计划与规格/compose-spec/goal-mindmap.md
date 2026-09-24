---
feature: goal-mindmap
status: delivered
updated: 2026-09-20
branch: main
commits: pending
---

# 目标计划思维导图

## Report

**What was built** — 目标计划详情页新增「列表 / 思维导图」视图切换；导图从现有任务树自动生成节点与实线层级连线，并支持「关联模式」手动补充跨分支虚线关联（localStorage 按项目持久化）。项目卡片「···」菜单增加「查看思维导图」一键直达。

交互增强：滚轮**以指针为锚点**缩放（范围 45%–220%）、拖拽平移、点击空白取消选中、「适应画布 / 重置视图」、右上缩放比例指示；工具条「最大化」进入应用内全屏（隐侧栏/顶栏/进度，`Esc` 退出），偏好按项目持久化，进入/退出时自动适应画布。

连线样式（XMind 风）：**圆角正交**——父节点右缘短横 → 共享竖脊 → 子节点左缘短横；同父兄弟共用同一竖脊。一级分支自动配色，节点左侧色条对齐分支色。

完成态语义：**左侧状态**（空心圆=未完成 / 半环=部分完成 / 绿勾=已完成，完成文案划线降透明）；**右上角**优先级色点；**父/根节点**显示叶子进度 `done/total`（如 `2/3`）；工具条「只看未完成」过滤已完成叶子及其无未完成后代的分支；图例区分状态/优先级/进度。

**Verification** — `vitest goal-mindmap-core`：23 passed（含进度汇总/未完成筛选）。`node scripts/goal-mindmap-visual.mjs`：VISUAL_PASS（todo/done/doing 可区分，progressBadges≥4，筛选后节点 8→5 且 done=0，最大化/Esc 正常）。

**Journey log** — 1) `git worktree` 被拦，主工作区实施。2) 路由靠 `history.state`，视觉脚本须 UI 点击进入。3) 视图/关联/最大化偏好用 `window.localStorage`，不能走 ApiStorage。4) 菜单 `source=more` 有 220ms 延迟。5) 选中态原地更新 class，避免打断 dblclick；最大化 class 必须打在 `.pc-goal-detail-page`（mount 的 pageEl 是外层 `.pc-page`）。

## [S1] Problem

目标计划详情页只有任务清单视图。项目任务已具备父子层级、完成态、优先级与执行中标记，但缺少一眼看清结构总览的视图；跨分支依赖（如关闭按钮相关任务）在树状列表中无法表达。项目卡片菜单也没有直达结构视图的入口。

## [S2] Design

### 产品决策（已确认）

1. **结构靠自动**：思维导图默认从现有任务树自动生成父子连线，不重复录入。
2. **关系靠手动**：跨分支关联用虚线补充，不与任务树混为一层。
3. **入口挂在项目内**：
   - 主入口：详情页顶栏「列表 / 思维导图」视图切换。
   - 快捷入口：项目卡片「···」→「查看思维导图」。

### 架构

```text
goal-mindmap-core.js          纯函数：构图 / 布局 / 关联链接 / 落点解析
        ▲
        │
pc-goal-detail.js             视图切换 + 导图渲染交互 + 拖拽改层级
pc-goal-projects.js           卡片菜单「查看思维导图」
08-goal-plan.css              导图样式
localStorage                  跨分支链接 + 视图偏好（PC 本地）
```

不引入第三方导图库；用 SVG + DOM 在现有 vanilla 模块内实现。

### 数据契约

#### 构图

```js
buildMindmapGraph(project, tasks)
// → {
//   rootId: '__root__',
//   nodes: [{
//     id, title, depth, parentId, order,
//     completed, priority, status,
//     checkState // 'checked'|'indeterminate'|'unchecked'
//   }],
//   hierarchyEdges: [{ from, to }] // 父→子，实线
// }
```

- 根节点 `id = '__root__'`，标题为 `project.name`；`checkState` 跟随根任务 `getParentCheckState`。
- 根任务 parentId 为 root；子任务沿用 `task.children`。
- 优先级 class 仅允许 `high|medium|low`（`mindmapPriorityClass` 白名单）。

#### 布局

```js
layoutMindmap(nodes, hierarchyEdges, options?)
// options: { nodeMinWidth, nodeHeight, hGap, vGap, padding }
// → { positions: Map<id,{x,y,w,h}>, width, height }
```

- 水平树：按深度分列（列宽取该层最大节点宽），子树纵向堆叠。
- 节点尺寸按标题估算：宽上限 360，高随折行增长（`estimateNodeSize` / `estimateMindmapTitleLines`），标题 CSS 换行完整显示不截断。空图返回最小画布。

拖拽改层级（`resolveMindmapDropTarget` + `moveTaskInTree`）：节点中部=成子级，上下 30%=插兄弟，空白/根=成顶层；禁止拖入自身子树。

#### 跨分支链接

```js
`pc-goal-mindmap-links:${projectId}` → [{ fromId, toId }]
parseMindmapLinks / serializeMindmapLinks / normalizeMindmapLinks / toggleMindmapLink
```

- 任务删除后打开导图时自动过滤失效链接并回写 storage。
- 链接**不同步后端**（见 Out of Scope）。

#### 视图偏好

```js
`pc-goal-detail-view:${projectId}` → 'list' | 'mindmap'
`pc-goal-detail-open-view` → { view: 'mindmap', projectId }  // 一次性，按项目匹配后消费
```

存储介质必须是 `window.localStorage`（不是 ApiStorage）。

### UI / 交互

#### 详情页

- 顶栏标题右侧分段控件：`列表` | `思维导图`。
- 思维导图容器：`#pcGoalMindmap`。
- 工具条：关联模式、清空关联（确认）、适应画布、重置视图、最大化/退出最大化、缩放比例。
- 滚轮缩放以指针为锚点；拖拽平移；点击空白取消选中。
- 应用内最大化：导图占满视口，`Esc` 或按钮退出；偏好 key `pc-goal-mindmap-maximize:${projectId}`。
- 图例：任务层级实线 / 手动关联虚线 / 优先级 / 已完成。
- 节点：圆角卡片 + 标题；完成节点降对比；优先级色点；执行中绿色描边。
- 非关联模式点击：**原地**切换选中 class（不整页重绘，保证 dblclick 可用）。
- 非关联模式双击节点：回列表并展开该任务路径；关联模式下 dblclick 忽略。
- 关联模式：依次点选两个任务节点创建/取消虚线；根节点不可关联。
- 画布：拖拽平移 + 滚轮缩放 + 重置。
- 空任务：与列表一致的空态文案。

#### 项目列表

- 卡片菜单首项「查看思维导图」：
  - `requestOpenMindmapView(window.localStorage, projectId)`
  - `navigate(\`/goals/${id}\`)`
- 详情 mount：仅当一次性标记的 projectId 匹配时消费为 mindmap，否则读项目偏好。

### 测试边界

- `goal-mindmap-core.test.js`：构图/布局/链接/序列化/open-view 项目匹配/优先级白名单/根完成态。
- 视觉：`scripts/goal-mindmap-visual.mjs`（Playwright + 已有 dev 后端）。

## [S3] Out of Scope

- 跨分支链接的后端持久化与 PC/Android 同步。
- 导图内直接编辑任务标题。
- 自动推断依赖。
- 移动端导图专项适配。
- 第三方导图库、协作光标、导出 PNG/SVG。

> 后续已补齐：列表/导图拖拽改层级；导图标题完整换行显示。

## Tasks

- [x] T1: 实现 `goal-mindmap-core.js` 构图/布局/链接工具 — acceptance: 模块导出契约完整，无 DOM 依赖 (covers: S2)
- [x] T2: 编写 `goal-mindmap-core.test.js` 并跑通 — acceptance: vitest 相关用例全部通过 (covers: S2; depends: T1)
- [x] T3: 详情页视图切换 + 导图渲染交互 — acceptance: 列表/导图可切换，层级实线与关联虚线可见，偏好可持久化 (covers: S2; depends: T1)
- [x] T4: 项目卡片菜单「查看思维导图」 — acceptance: 点击后进入详情并打开导图视图 (covers: S2)
- [x] T5: 补充 `08-goal-plan.css` 导图样式 — acceptance: 节点/连线/工具条/图例样式完整，不破坏现有列表样式 (covers: S2)
- [x] T6: vitest + 视觉验证 — acceptance: 相关测试通过；Playwright 截图确认导图与入口可用 (covers: S2; depends: T2 T3 T4 T5)
- [x] T7: 独立 review 并 finalize 文档 — acceptance: review 无 critical；spec status=delivered (covers: S2; depends: T6)

## Implementation override

本环境禁止 `git worktree add`（隔离会话保护共享 ref）。按 `goal-cover-optimize` 先例：在主工作区实现；若提交，仅 stage 本特性相关文件，不携带已有无关脏改动。

### 本特性文件

- `docs/计划与规格/compose-spec/goal-mindmap.md`
- `src/js/goal/goal-mindmap-core.js`
- `src/js/goal-mindmap-core.test.js`
- `src/js/pc/pc-goal-detail.js`
- `src/js/pc/pc-goal-projects.js`
- `src/css/pc/08-goal-plan.css`
- `src/js/pc/pc-utils.js`（`escapeHtml` 属性安全转义）
- `scripts/goal-mindmap-visual.mjs`
