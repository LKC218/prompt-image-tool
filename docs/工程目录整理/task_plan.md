# 工程目录整理任务计划

## 当前状态

- 状态：第一批低风险整理已完成
- 日期：2026-05-09
- 范围：先生成目录整理方案，不移动源码、资源或构建文件。

## 任务

- [x] 安装 `planning-with-files` 技能。
- [x] 扫描根目录、文档目录和关键构建配置。
- [x] 识别高风险路径和可整理路径。
- [x] 执行第一批低风险迁移。
- [x] 执行迁移后更新 `.gitignore` 和相关文档。
- [x] 执行第二批脚本整理。
- [ ] 复核 `releases` 历史产物删除记录，决定恢复、归档或保持删除。

## 风险控制

- 当前工作区存在大量未提交改动，目录迁移必须继续拆成小批次。
- `src`、`python`、`src-tauri`、`android` 与构建链强相关，第一阶段不做结构性移动。
- 发布产物、历史计划、设计稿和临时工具脚本优先进入候选整理范围。

## 第一批执行结果

- `plan.md` 已归档到 `docs/计划文档/根目录历史计划-260503.md`。
- `PromptImageManager-v2.2.1.apk` 已归档到 `releases/PromptImageManager-v2.2.1-Android.apk`。
- `.gitignore` 已补充安装包产物忽略规则。

## 第二批执行结果

- `compress_icon.py` 已迁移到 `scripts/compress_icon.py`，并修正图标路径。
- `patch-java-version.ps1` 已迁移到 `scripts/patch-java-version.ps1`。
- `build.bat` 已同步改为调用 `scripts\patch-java-version.ps1`。
- `start-dev.bat` 已删除：该脚本硬编码本机 Python 路径，和 `dev.bat` 功能重复。
- `start.bat` 已删除：该脚本与 `dev.bat`、`build.bat` 菜单入口重复，且未被项目文件引用。
