---
feature: pc-image-viewer-flip
status: delivered
updated: 2026-09-17
branch: feature/plant-idle-game
commits: 
---

# PC 图片查看器重构 + GSAP Flip 转场

## Report

**What was built** — PC 图片查看器从 `pc-utils.js` 抽到独立模块 `src/js/pc-image-viewer.js`，`pc-utils` 仅 re-export 旧 API。`openImageViewer` 新增 `sourceEl`：源图已 complete 且非 reduced-motion 时，用 GSAP 从缩略图 rect FLIP 展开到全屏（开 0.32s `power3.out`，关 0.28s `power2.in`，壳层 0.14s）；无 source / 未加载完 / reduced-motion 则只 fade。详情、编辑器、目标（浮层预览+图片管理器）、资源库四处补传 `sourceEl`。动画用 `flipSession` 代际号防中断串态；关闭时若源节点已卸载则降级 fade。

**Verification** — `npm test -- pc-image-viewer pc-detail pc-editor pc-utils auto-updater`：39 passed。`npm run build`：vite 生产构建成功。审查后修复 Major：waitForImage 挂起、FLIP 中断尾部污染状态、goal 浮层先 remove 导致测不到源。`pc-home`/`pc-settings` 各 1 例失败为 PRE-EXISTING（stash 本特性文件后仍失败）。

**Journey log** — 1) 沙箱禁止 `git worktree add` / `git switch`，在 `feature/plant-idle-game` 上实现，仅 stage 本特性文件。2) PowerShell `Get-Content|Set-Content` 会打坏 UTF-8 中文，编码敏感写入用 Python。3) 规格「未加载完 → fade」不要实现成 await load（会挂死且与规格不符）。4) goal 浮层必须 `onOpenViewer` 后再 `hidePreview`，否则 source detached 无法 FLIP。5) vitest 里 `gsap.to` mock 若不触发 `onComplete`，Promise 门控动画尾部会被静默跳过。

## [S1] Problem

PC 图片查看器实现埋在 `pc-utils.js`（缩放/拖拽/下载/多图约 300 行），与其它工具函数耦合。打开时只有 opacity 淡入，没有从缩略图位置连续展开到全屏的转场；入口也拿不到源图 DOM，无法做 shared-element 动画。业务页（详情/编辑器/目标/资源库）各自调用同一 API，但缺少 `sourceEl` 契约。

## [S2] Design

### 架构

将查看器从 `pc-utils.js` 抽到 `src/js/pc-image-viewer.js`。`pc-utils.js` 仅 re-export `showImageViewer` / `closeImageViewer`，旧调用路径不断。

```text
src/js/pc-image-viewer.js
  ensureViewer / bindViewer
  openImageViewer / closeImageViewer
  zoom/pan/keyboard/download
  playOpenFlip / playCloseFlip  (GSAP)
```

项目已依赖 `gsap@^3.15`（`pc-cursor.js`、`pc-detail-modal.js` 在用）。转场用 GSAP tween 手写 FLIP 测量（不强制 `Flip` 插件），风格对齐 `pc-detail-modal.js` 的 timeline + `prefersReducedMotion()`。

### 公开 API

```js
openImageViewer({
  urls,            // string[] 可选；与 src 二选一
  src,             // 单图 url
  index = 0,
  filename,
  sourceFile,
  image,           // 原 image 对象（下载元数据）
  sourceEl,        // Element | null：触发展开的缩略图/img
})
closeImageViewer({ immediate = false } = {})
```

兼容旧入参：
- `openImageViewer(string)` → 单 URL
- `{ urls, index }` → 多图
- `{ src|url, filename, image }` → 单图

### 转场行为

| 场景 | 表现 |
| --- | --- |
| 有 `sourceEl` 且图已 complete | FLIP zoom：从源 rect 放大到 viewer 目标位 |
| 无 `sourceEl` 或未加载完 | 仅壳层 fade（不 await load） |
| 关闭且曾 FLIP 打开且源仍在 DOM | 反向播回源 rect |
| 关闭时源已卸载 | 降级 fade |
| `prefers-reduced-motion` | 跳过 FLIP，只 fade / none |
| 多图左右切换 | 不做 FLIP，仅换 src + reset |

参数：开 `0.32s` / `power3.out`；关 `0.28s` / `power2.in`；壳层 `0.14s` autoAlpha。

实现要点：
1. First：`sourceEl`（或内部 `img`）`getBoundingClientRect()`
2. Last：打开 viewer 布局后测 `#pcImageViewerImg` rect
3. Invert：`gsap.set` 用 `x/y/scaleX/scaleY` 压回源位，`transformOrigin: '0 0'`
4. Play：`gsap.to` 归零；期间 `pc-image-viewer-flipping` 关闭 CSS transform transition
5. 源图在动画期 `visibility: hidden`，结束后恢复；取消/中断则立即恢复
6. `flipSession` 代际号：open/close 递增，await 后若 session 过期则丢弃尾部
7. 动画中再关闭：kill tween，session 作废后 teardown

缩放拖拽仍走既有 `imageViewerState` + CSS transform；Flip 完成后 `clearProps`。

### 调用点

| 文件 | 改造 |
| --- | --- |
| `pc-detail.js` | 传当前封面 `img` 为 `sourceEl` |
| `pc-editor.js` | 传 thumb 内 `img` |
| `pc-goal-detail.js` / `goal-image-preview.js` | 浮层先 open 再 hide；管理器传对应 `img` |
| `pc-library.js` | 传 `.pc-library-preview-cover img` |
| `pc-app.js` | Escape 时 `closeImageViewer({ immediate: true })` |

### 测试

- 单测：normalize 入参、有/无 sourceEl、未 complete 不 FLIP、close 清理、reduced-motion
- detail mock 断言包含 `sourceEl`
- 既有 editor/library/app-nav 相关用例通过

## [S3] Out of Scope

- Mobile `mobile-detail.js` 查看器
- 引入 PhotoSwipe / 新动画库
- View Transitions API 用于图片展开
- 多图切换 shared-element
- 后端 / 存储 / 下载协议变更
- 拆除 `pc-utils` ↔ `pc-image-viewer` 循环导入（当前 call-time import 安全）

## Tasks

- [x] T1: 抽出 `pc-image-viewer.js` 并从 `pc-utils` re-export — acceptance: 旧 `showImageViewer`/`closeImageViewer` 路径可用，行为不回归 (covers: S2)
- [x] T2: 实现 GSAP Flip 开/关转场与 reduced-motion 降级 — acceptance: 有 sourceEl 时从源位置展开，关闭反向；无 sourceEl 仅 fade (covers: S2; depends: T1)
- [x] T3: 四处业务调用点补传 `sourceEl` — acceptance: detail/editor/goal/library 点击缩略图打开查看器时传入对应 img (covers: S2; depends: T1)
- [x] T4: CSS flipping 态与单测/回归 — acceptance: `npm test` 相关用例通过，动画期不与 CSS transition 冲突 (covers: S2; depends: T2, T3)
