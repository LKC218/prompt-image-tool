---
feature: github-crt-profile-card
status: delivered
updated: 2026-09-16
branch: main@crt-profile-card + main@LKC218/LKC218
commits: a619c82..45bcb91 (crt-profile-card); 1bc1e8c (LKC218/LKC218)
---

# GitHub 个人自述页 CRT 动态名片

## Report

**What was built** — 双仓交付：`LKC218/crt-profile-card` 托管无脚本 CRT 名片 SVG（960×390，SMIL 打字机 + 扫描线 + 辉光，v1.4.0）；`LKC218/LKC218` Profile README 通过 raw URL 引用该名片。文案为潮汕向：大字 ID `LKC218`、欢迎语「做泥？食杯茶再担」+ 颜表情、名言「苦茶也会回甘，行落去」。

**Verification** — 本地 Playwright 内联 SVG 延迟 9s 截图：文案完整、中文可读、无横向溢出。远程 raw 验收：`crt-profile-card/main/assets/crt-card.svg` 与 `LKC218/LKC218/main/README.md` 均可访问且内容与本地一致。

**Journey log** — 1) 远程 404 时先本地完整交付。2) 截图过早 → Playwright 延迟等待；img 缓存 → 改为内联 SVG 截图。3) 未 fork typed-crt，手写 SMIL。4) 仓库名拆分为项目仓 `crt-profile-card` + Profile 仓 `LKC218/LKC218`。5) 文案迭代：英文欢迎 → 潮汕音译+本字「担」→ 颜表情+回甘名言，去掉「潮汕茶理」标注。

## [S1] Problem

工程师 GitHub 主页缺少可识别的「个人名片」气质。希望在 Profile README 顶部嵌入 **SVG 动态名片**：极简自我介绍 + 绿屏扫描线终端风。

GitHub README 约束：

- 不执行任意 JS / React / Canvas
- 可通过 `<img>` 引用自包含 SVG
- 打字机动画必须内建于 SVG（SMIL / CSS）

## [S2] Design

### 已锁定决策

| 轴 | 选择 |
| --- | --- |
| 托管 | **双仓**：源在 `crt-profile-card`，展示在 `LKC218/LKC218` |
| 内容 | 大字 ID + 潮汕欢迎语/颜表情 + 回甘名言 |
| 主题 | **monochrome-green / green-scanlines** |
| 实现 | 手写无脚本 SMIL SVG，不依赖 typed-crt 源码 |

### 仓库布局

**项目仓 `LKC218/crt-profile-card`**（本地 `G:\项目\LKC218-LKC218`）：

```text
README.md
README-维护说明.md
.gitignore
assets/crt-card.svg
```

**Profile 仓 `LKC218/LKC218`**（本地 `G:\项目\profile-LKC218`）：

```text
README.md
```

Profile `README.md` 顶部：

```markdown
<p align="center">
  <img src="https://raw.githubusercontent.com/LKC218/crt-profile-card/main/assets/crt-card.svg" alt="LKC218 CRT 名片" width="100%">
</p>
```

> 双仓必须用绝对 raw URL。图下不重复文案，避免与屏内文字叠读。

### 名片文案（v1.4 已定稿 2026-09-16）

```text
顶栏：◆ CRT://lkc218.profile          ● ONLINE
主区：
> whoami
LKC218
> hello
Zuo ni? Jia de xian, zai dan. ( ´ ▽ ` )ﾉ
做泥？食杯茶再担。(￣▽￣)/
> motto
"Bitter tea still turns sweet. Keep going."
苦茶也会回甘，行落去。
底栏：ready · green-scanlines · no-js svg
```

- 画布 960×390，README 展示 `width="100%"`（铺满 Profile 内容栏，约半屏）

### 验收标准

- 打开 `https://github.com/LKC218` 后，README 顶部可见 CRT 绿屏名片
- 首次加载有打字机效果（或至少扫描线/辉光）
- 文字可读，中英文无乱码；移动端不横向溢出
- 外链失效时项目仓仍有 SVG 源
- 未在业务仓库引入 typed-crt 依赖

## [S3] Out of Scope

- 在 `prompt-image-tool` 内实现 CRT 功能页
- Canvas/WebGL 播放器嵌入 README
- 多主题切换、头像合成、贡献热力图
- fork/集成 typed-crt 源码
- 完整技能树名片

## Tasks

- [x] T1: 定稿文案与 green-scanlines 视觉 — acceptance: 手写 SVG 动画完整可读 (covers: S2)
- [x] T2: 本地项目仓落地 assets + README — acceptance: 仓库可独立预览名片 (covers: S2; depends: T1)
- [x] T3: 本地 Playwright 延迟截图验收 — acceptance: 文案完整、无溢出 (covers: S2; depends: T2)
- [ ] T4:（可选）补充 static PNG 兜底 — acceptance: assets 有 PNG 且维护说明含 fallback (covers: S2; depends: T2)
- [x] T5: 创建远程 `LKC218/crt-profile-card` 并 push 项目仓 — acceptance: 远程 main 可访问 SVG (covers: S2; depends: T2)
- [x] T6: 创建远程 `LKC218/LKC218` 并 push Profile README — acceptance: Profile 页 raw 图可见 (covers: S2; depends: T5)
- [x] T7: 线上验收 Profile 名片 — acceptance: raw README/SVG 可访问且内容正确 (covers: S2; depends: T6)
