---
feature: project-defect-scan
status: delivered
updated: 2026-09-20
branch: main
commits: uncommitted-on-main
---

# 全项目缺陷静态与测试扫描

## Report

**What was built** — 在 main 工作区完成全项目静态 + 测试扫描，关闭可落盘缺陷：补全 `pc-library.test.js` 对 detail 链路的 mock（`formatPromptForDisplay` / `hideContextMenu` / `showConfirmModal`）；移动端 `.m-filter-tag` 增加 `flex: 0 0 auto` 防止横滑标签被压缩；UI 乱码文案（确认/取消/确定/二级菜单箭头）与 `installer.nsi` UTF-8 BOM 一并闭环；新增 `scripts/verify-dist-assets.mjs`、`scripts/verify-ui-encoding.mjs` 及 `npm run verify:defects`，用于构建产物资源解析与源码编码卫生回归。评审后加固：乱码字符集补入 `U+7EAE` 纠，资源脚本跳过远程 URL 并剥离 query/hash，NSI 缺失记 FAIL，mock 边界对齐真实 `String(x || '')`。

**Verification** — `npm run test` 39 files / 308 tests PASS；`npm run build` PASS；`npm run verify:defects` PASS（ui-encoding nsi=utf8-bom；dist-assets css=3 resolved_urls=5）；venv `pytest` 77 PASS；`npm run test:rust` 3 tests PASS。

**Journey log** — 历史 BUG-007 的 `../assets` 路径问题在当前源码已为 `../../assets`，当前 dist 非 data URL 均可解析，故改为补回归脚本而非再改路径。Rust 本机已可用，不再记环境阻塞。库测试会静态加载 detail 模块图，mock 必须覆盖 detail 导入而非仅 library 用到的函数。工作区另有 release-notes/文档重组 WIP，未纳入本缺陷扫描范围。

## [S1] Problem

项目在 v2.5.9 与近期重构后仍存在未闭环缺陷记录（BUG-003/007、DEF-260801-05），且工作区遗留 UI 文案乱码与安装器编码风险。需要以「静态 + 测试扫描」方式核实当前真实状态，关闭可修复项，并为构建产物资源路径补上可重复的回归校验。

## [S2] Design

本轮在用户指定的 **main 工作区**上执行（用户明确选择不在 worktree 隔离）。

扫描与修复边界：

1. **基线测量**：`npm run test`、venv 下 `python -m pytest`、`src/css/**/url()` 与 `dist` CSS 资源解析。
2. **确认待修缺陷**（有证据、可落盘）：
   - DEF-260801-05：`pc-library.test.js` 对 `pc-prompt-ui-utils.js` / `pc-utils.js` 的 mock 缺口（detail 链路导入）。
   - BUG-003：`.m-filter-tag` 在 flex 横滑容器中可被压缩；需 `flex: 0 0 auto`。
   - BUG-007：源码路径已正确，当前 dist 资源可解析；以**构建产物资源回归脚本**防回归。
3. **工作区已修复项纳入闭环**：
   - UI 乱码：`src/js/pc-utils.js` 确认/取消/确定/子菜单箭头文案。
   - `build/installer.nsi` 恢复 UTF-8 with BOM。
4. **Rust**：本机 `cargo` 可用，`npm run test:rust` 通过（3 tests）。

回归校验契约：

- `scripts/verify-dist-assets.mjs`：解析 `dist/**/*.css` 的 `url(...)`（跳过 `#`/远程/`data:`），剥离 `?`/`#` 后解析到 `dist` 内文件；任一缺失 exit 1。
- `scripts/verify-ui-encoding.mjs`：扫描 UI 源文件 GBK 乱码特征（含 U+7EAE 纠）与 PUA；`installer.nsi` 缺失或中文无 BOM 均 FAIL。
- `package.json`：`verify:dist-assets` / `verify:ui-encoding` / `verify:defects`。

## [S3] Out of Scope

- 不处理 release-notes 时间线 UI 等未提交功能改造（非本轮缺陷）。
- 不引入浏览器 E2E 框架。
- 不改 docs 大规模目录重组（工作区已有进行中的文档迁移）。
- 不覆盖 Tauri/Android 真机与安装包安装矩阵。

## Tasks

- [x] T1: 补全 `pc-library.test.js` mock — acceptance: `formatPromptForDisplay` 与 detail 所需 `pc-utils` 导出在 mock 中；`npm test -- src/js/pc-library.test.js` 通过且无 mock 缺口 stderr (covers: S2)
- [x] T2: 修复移动端筛选标签收缩 — acceptance: `src/css/mobile.css` 中 `.mobile-app .m-filter-tag` 含 `flex: 0 0 auto` 且保留 `white-space: nowrap` (covers: S2)
- [x] T3: 构建产物资源与编码回归脚本 — acceptance: 两个 mjs 脚本可运行；对当前 `dist`/源码扫描通过；已接入 package.json (covers: S2)
- [x] T4: 闭环 UI 乱码与 NSIS BOM — acceptance: 源码扫描无 mojibake 特征；`installer.nsi` 以 UTF-8 BOM 保存 (covers: S2)
- [x] T5: 全量验证 — acceptance: `npm run test` 通过；venv `pytest` 通过；重建 `dist` 后资源脚本通过；`test:rust` 通过 (covers: S2; depends: T1,T2,T3,T4)
