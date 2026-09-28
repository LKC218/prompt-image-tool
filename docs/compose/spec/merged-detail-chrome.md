---
feature: merged-detail-chrome
status: delivered
updated: 2026-09-28
branch: feat/merged-detail-chrome
commits: 797f89a..797f89a
---

# 详情窗打开时主窗三键常驻 · 单排融合顶栏

## Report

**What was built** — 打开提示词详情时，主窗 chrome 进入详情态单排融合顶栏：左侧面包屑「提示词详情 / 标题」与产品芯片「收起」「关闭详情」，最右始终是软件 `− □ ×`。详情面板不再渲染任何窗口按钮 `− ×`，全局只保留一套窗口语义。chrome 在 `html.pc-prompt-detail-open` 下 z-index 提升到 9000，详情 host 顶部预留顶栏高度，保证软件三键可见可点。收起进入右下角托盘，关闭详情结束会话；Esc 仍只关闭详情。焦点环包含面板与 chrome 产品芯片，键盘可 Tab 到收起/关闭详情。

**Verification** — `npx vitest run`：409 tests / 47 files PASS（含新增键盘可达与 M1 断言）。聚焦 `pc-detail-modal` + `pc-window-chrome`：20 PASS。Playwright + vite :5173 视觉验证：打开详情后 closeup 可见面包屑、收起/关闭详情芯片（58/78px）与软件三键（46px），`panelButtons=false`，`htmlOpen=true`；收起入托盘、关闭后 chrome 还原，无 page error。

**Journey log** — 1) 早期 S1「详情自带 −× 与软件三键错层」被否决为双顶栏重复，改为产品芯片。2) `git worktree add` 被沙箱拦截，改在当前工作树切 `feat/merged-detail-chrome`。3) 芯片点击最初依赖 `mountWindowChrome`，单测未挂载导致不触发，改为 `setChromeDetailContext` 内 `bindDetailButtons`。4) Review 指出焦点陷阱不含 chrome 芯片导致「收起」无键盘路径，已并入 Tab 环。5) 面板窗口钮死样式已清理，避免 QA 对照表误匹配。

## [S1] Problem

打开提示词详情浮层后，详情层（`z-index: 8800`）盖住主窗顶栏（`z-index: 2600`），软件的最小化/最大化/关闭不可见也不可点。

若简单给详情再加一排 `− ×`，会与软件三键形成「双顶栏」重复感，用户分不清关的是详情还是应用。

## [S2] Design

**原则：全局只保留一套「窗口语义」控件（软件 `− □ ×`）。详情是应用内面板，用产品语言操作。**

### 控件语义

| 控件 | 语义 |
|------|------|
| 软件 `− □ ×` | 最小化 / 最大化 / 关闭**应用窗口**（唯一窗口语义，永远可点） |
| `收起` 产品芯片 | 将当前详情缩到右下角托盘（原详情最小化） |
| `关闭详情` 产品芯片 | 关闭当前详情（原详情 `×`） |
| Esc | 关闭当前活动详情；不触发软件关闭 |
| 收藏 / 更多 | 留在详情内容头部（业务状态就地维护，避免与 chrome 双写） |

### 布局契约

详情展开时 chrome 进入 `pc-window-chrome-detail-mode`：

```
[详情面包屑：提示词详情 / <标题>] ……… [收起] [关闭详情] │ [−] [□] [×]
```

- chrome `z-index` 提到 9000（高于详情 host 8800），控制组半透明底保证在模糊遮罩上可读。
- `.pc-prompt-detail-modal-host` 顶部预留 `--pc-window-chrome-height`，详情从 chrome 下方开始。
- 详情面板**不再渲染** `− ×` 窗口按钮；仅保留内容与托盘能力。
- 双开对比时 chrome 面包屑跟随活动详情标题；`收起`/`关闭详情` 作用于活动实例。
- Tab 焦点环包含详情面板与 chrome 产品芯片（软件三键属应用窗口，不进详情焦点环）。

### 模块接口

- `pc-window-chrome.js` 导出：
  - `setChromeDetailContext(context | null)`：`{ title, onCollapse, onClose }`；传入显示详情态，`null` 还原普通态。
  - `syncChromeDetailTitle(title)`：双开切换时更新面包屑。
- `pc-detail-modal.js` 在 `syncDeck()` 同步 chrome 详情态。
- 根节点类：`document.documentElement.pc-prompt-detail-open`（有展开详情时），供 CSS 提升 chrome 层级。

### 交互细节

- `关闭详情` hover 仅文字/描边变 `--pc-danger`，不做窗口 `×` 红底。
- 低动效偏好下跳过补间（沿用现有逻辑）。
- 焦点：打开后焦点落在详情面板，不抢到 chrome；Tab 可达 chrome 产品芯片。

## [S3] Out of Scope

- 不为详情窗增加「最大化」（窗口最大化只作用于软件）。
- 不改移动端详情。
- 不把收藏/更多迁入 chrome（业务状态在 `pc-detail.js`，避免双写）。
- 不改双开对比的正文布局规则。

## Tasks

- [x] T1: chrome 支持详情态布局与 setChromeDetailContext — acceptance: 详情态下面包屑/收起/关闭详情出现，软件三键仍在最右且可点 (covers: S2)
- [x] T2: 详情面板移除 − ×，改为对接 chrome 收起/关闭详情 — acceptance: 面板内无窗口按钮；chrome 芯片可收起到托盘并关闭 (covers: S2; depends: T1)
- [x] T3: CSS 层级提升与 host 顶栏避让 — acceptance: 详情打开时软件三键可见可点，详情不顶到 chrome (covers: S2; depends: T1)
- [x] T4: 回归测试更新（detail-modal / window-chrome） — acceptance: `npm run test` 通过，含 chrome 详情态与无 − × 断言 (covers: S2; depends: T2, T3)
- [x] T5: 浏览器视觉验证 — acceptance: 打开详情截图可见软件三键 + 产品芯片，无双 − × (covers: S2; depends: T3)
