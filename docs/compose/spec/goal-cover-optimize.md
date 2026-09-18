---
feature: goal-cover-optimize
status: in-progress
updated: 2026-09-17
branch: feature/plant-idle-game
commits:
---

# 目标计划项目封面导入压缩

## Report

## [S1] Problem

目标计划项目封面导入链路（`setProjectCover` → `importGoalProjectCover`）目前把本地原图直接 `FileReader.readAsDataURL` 后落盘/上传：

- 无压缩、无转码，大 PNG/JPG 原样进入 `goal_images/<projectId>/`（或 Capacitor Data 目录），拉高 `imageBytes` 与存储压力。
- 无类型校验（`accept = image/*`）、无体积上限，与提示词编辑器（WebP + 校验）策略不一致。
- 任务图路径已走 `compressToWebp`（质量 0.85 / 长边 1920），封面是唯一未处理的导入入口。

封面展示位仅为项目列表卡 16:9 区域（`object-fit: cover`），没有全屏查看器，更不需要原图精度。

## [S2] Design

### 架构落点

压缩收口在 `goal-utils.js` 的 `importGoalProjectCover` **内部**，而不是只改 UI：

```text
pc-goal-projects.js  setProjectCover
  ├─ 校验类型/体积、accept、处理中提示
  ├─ FileReader → dataURL
  └─ importGoalProjectCover(storage, projectId, dataUrl, name)
        ├─ optimizeGoalCoverDataUrl(dataUrl)   // 新增，内部调 optimizeImageDataUrl
        ├─ 按实际 MIME/extension 生成落盘文件名
        ├─ Capacitor: Filesystem.writeFile
        └─ Web/API: storage.uploadGoalImage(projectId, imageId, finalDataUrl)
```

复用 `src/js/image-utils.js` 的 `optimizeImageDataUrl`（已有 canvas 缩放、WebP 转码、像素上限拒绝、压后变大回退原图）。不新写 canvas 逻辑，也不把任务图 `compressToWebp` 直接接到封面（其缺 `maxInputPixels` 与 size fallback）。

`goal-utils.js` → `image-utils.js` 单向依赖，不反向。

### 封面优化契约

```js
// goal-utils.js
export const GOAL_COVER_OPTIMIZE_OPTIONS = {
    quality: 0.85,
    maxSide: 1600,
    maxInputPixels: 24_000_000,
    outputType: 'image/webp',
    background: '#FFFFFF'
};

export async function optimizeGoalCoverDataUrl(dataUrl, options = GOAL_COVER_OPTIMIZE_OPTIONS)
// 返回与 optimizeImageDataUrl 对齐的结构，但永不 throw：
// { dataUrl, mimeType, extension, size, originalSize, width, height,
//   originalWidth, originalHeight, usedOriginal, resized }
// 解码失败 / optimize 抛错 → usedOriginal: true，dataUrl 为入参原值
```

`importGoalProjectCover` 行为：

1. `const optimized = await optimizeGoalCoverDataUrl(dataUrl)`
2. `finalDataUrl = optimized.dataUrl`
3. 落盘扩展名以**实际内容 MIME**为准：
   - `usedOriginal === true` → `getImageExtension(dataUrl)`（png/jpg/webp/gif）
   - 否则 → `optimized.extension`（通常 `webp`）
4. 有原始文件名时：保留可读 basename，**强制改写后缀**为上述 ext  
   例：`photo.png` → `<id>-photo.webp`  
   避免 Capacitor `readGoalImageDataUrl` 按错误扩展名拼 MIME 导致预览失败
5. 无文件名：`<imageId>.<ext>`
6. 之后原逻辑：Capacitor 写文件 / `uploadGoalImage`，返回 `coverImage` 相对路径

### 入口校验（PC）

`pc-goal-projects.js` · `setProjectCover`：

| 项 | 契约 |
|----|------|
| 允许类型 | `image/jpeg`, `image/png`, `image/webp` |
| 源文件体积上限 | 15MB（`15 * 1024 * 1024`） |
| `input.accept` | 与允许类型列表 join 一致，不再使用 `image/*` |
| 反馈 | 处理中 toast；类型/体积不符 toast 后 return，不读文件、不落盘 |
| 失败 | 校验拦截 / 保存失败分别 toast |

校验常量可挂在 `goal-utils.js` 导出（`GOAL_COVER_ALLOWED_TYPES` / `GOAL_COVER_MAX_SOURCE_BYTES`），UI 只引用，避免两处漂移。

### 错误与回退

| 场景 | 行为 |
|------|------|
| 类型/体积不合法 | UI 拦截，不调用 import |
| 优化失败 / 解码失败 | `optimizeGoalCoverDataUrl` 回退原图，import 仍继续 |
| 压后体积 ≥ 原图且未缩放 | `optimizeImageDataUrl` 自带 `usedOriginal` 回退 |
| 像素超 `maxInputPixels` | optimize 抛错 → wrapper 回退原图（不阻断设置封面）；UI 仍可能成功保存 |
| 保存失败 | 与现状一致：toast「设置封面失败」 |

### 不改动的存储契约

- `project.coverImage` 仍为相对路径字符串
- `sqlite-storage` / `api-storage` / CSS / 数据库 schema 不改
- 存储层仍不做二次压缩

### 测试边界

新增 `src/js/goal-utils-cover.test.js`（vitest）：

1. `optimizeGoalCoverDataUrl` 成功路径：canvas `toBlob(..., 'image/webp', 0.85)`，返回 webp mime/extension
2. optimize 抛错：返回原 dataURL，`usedOriginal === true`，不 throw
3. `importGoalProjectCover` 将压缩后 dataURL 传入 `storage.uploadGoalImage`；落盘扩展名跟 MIME（webp），不沿用原 `.png` 名

可复用 `image-utils.test.js` 的 mockCanvasPipeline 模式。不重复断言 production 逻辑细节到 mock 次数层面的无意义断言。

### 文档

`docs/模块说明/目标计划模块.md`「项目封面」条目补充：导入时 Canvas 压缩为 WebP（质量 0.85、最大边 1600px）；类型/体积校验；优化失败回退原图。

### 工作区覆盖记录

沙箱禁止 `git worktree add`，用户确认改为在主 worktree 当前分支 `feature/plant-idle-game` 上实施；提交时仅 stage 本特性相关文件（同 `pc-image-viewer-flip` 先例）。`pc-goal-projects.js` 上已有与本特性无关的未提交 parallax 改动（3 行 import/mount），实现与提交时不剥离它们，但审查与提交说明需区分。

## [S3] Out of Scope

- 历史已入库封面的批量迁移/重压
- 移动端「设置封面」入口（当前不存在）
- 任务图 `compressToWebp` 参数重构或统一两套压缩实现
- 列表缩略图（`getGoalThumbUrl`）策略变更
- 存储层后端压缩、数据库 schema 变更
- 从 `main` 拉独立 worktree / 分支整合（沙箱拦截，已用户确认改道）

## Tasks

- [ ] T1: `goal-utils.js` 增加封面优化常量与 `optimizeGoalCoverDataUrl`，并接入 `importGoalProjectCover`（MIME 对齐扩展名） — acceptance: 封面导入路径调用优化；失败回退原图；落盘扩展名与实际内容一致 (covers: S2)
- [ ] T2: `pc-goal-projects.js` · `setProjectCover` 类型/体积校验与 accept、处理提示 — acceptance: 非法类型/超 15MB 不落盘并 toast；合法路径展示处理中后成功设置 (covers: S2; depends: T1)
- [ ] T3: 新增 `goal-utils-cover.test.js` 覆盖优化成功/回退/import 传参与扩展名 — acceptance: `npx vitest run src/js/goal-utils-cover.test.js src/js/image-utils.test.js` 通过 (covers: S2; depends: T1, T2)
- [ ] T4: 更新 `docs/模块说明/目标计划模块.md` 封面导入说明 — acceptance: 文档记载 WebP 0.85/1600px、校验与回退策略 (covers: S2; depends: T1)
