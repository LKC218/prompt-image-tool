---
name: release-publish
description: 一键发布提示词管家：校验 releases 安装包、更新 README 当前最新版本信息、提交推送并创建 GitHub Release。用户说「发布最新安装包」「更新首页版本并发布」「/release-publish」「发布 vX.Y.Z」时使用。
---

# 一键发布（release-publish）

把「发安装包 + 更新仓库首页 README 版本信息」收成固定流水线，避免每次口述完整步骤。

## 适用

- 发布最新 PC/Android 安装包到 GitHub Releases
- 同步 README「当前最新」与下载文件名
- 将 `main` 与当前工作分支推到远端

## 前置检查（必须）

1. 读取 `package.json` 的 `version`，作为默认目标版本（可被用户指定覆盖）。
2. 检查 `releases/` 是否存在匹配安装包，至少要有：
   - `PromptImageManager-Setup-<version>.exe`
   - 可选：`PromptImageManager-Shell-Setup-<version>.exe`
   - 可选：`PromptImageManager-v<version>-Android.apk`
3. 若核心安装包不存在，**不要猜测**，先问用户：是否先构建，还是改用已有版本。
4. 若 `docs/版本记录/changelog.md` 中该版本 SHA256/大小与磁盘不一致，先按实际文件校正 changelog 再发布。

## 执行

在项目根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_release.ps1
```

常用参数：

| 参数 | 作用 |
| --- | --- |
| `-Version 2.5.1` | 指定版本（默认读 package.json） |
| `-DryRun` | 只预览，不改文件、不提交、不推送、不发 Release |
| `-SkipReadme` | 不改 README |
| `-SkipCommit` / `-SkipPush` / `-SkipRelease` | 跳过对应阶段 |
| `-Assets path1,path2` | 手动指定附件路径 |

Agent 行为约定：

1. **先 `-DryRun`**，把将要上传的文件、大小、SHA256 报给用户。
2. 用户确认（或本次对话已明确要求全自动）后再去掉 `-DryRun` 真正执行。
3. 执行成功后，必须回报：
   - Release URL
   - 附件列表 + SHA256
   - 是否已更新 README
   - 是否缺 Android / Shell 包
4. 失败时原样贴出脚本错误，不要静默重试破坏性步骤（force push 禁止）。

## 脚本已覆盖

- 从 `releases/` 自动发现附件
- 计算 SHA256
- 生成 `releases/latest.json`（应用内自动更新元数据）并随 Release 上传
- 更新 `README.md` 下载区（当前最新版本、Setup 文件名、Android 提示）
- 版本一致性校验：`package.json` / `meta[name=version]` / `RELEASE_NOTES` 首项不一致时中止
- GitHub Release 正文自动生成：Downloads 表 + 与弹窗同源的完整分节（新增/优化/修复/发布，无条目整节省略）
- `git add/commit/push` 当前分支，并快进推送 `main`
- 用 `gh` 创建 `vX.Y.Z` Release（已存在则补传附件）

## 脚本不覆盖（需要 Agent 额外做）

- 构建安装包（`build_pc_package.py` / `build_android_package.py` / 安装器壳）
- 修改 `changelog.md` 正文（仅当哈希与产物不一致时校正）；**更新说明格式以 [更新记录规范](../../docs/版本记录/更新记录规范.md) 为准**
- 手工改写 GitHub Release 更新说明分节（禁止；以弹窗数据为源；历史回填可用 `scripts/backfill_release_notes.py`）
- 重拍 README 预览图（需要时用 `scripts/capture_readme_previews.py`）

## 触发示例

- `/release-publish`
- 「发布最新安装包并更新首页版本」
- 「把 2.5.2 发到 GitHub」
