# 工程目录整理扫描记录

## 技能与上下文

- 本轮安装了 `planning-with-files`，用于把整理过程沉淀为持久 Markdown 文件。
- 当前会话尚未重启 Codex，因此本轮按该技能的文件化规划思路手动执行。
- 仓库根目录未发现额外 `SKILL.md`。

## 根目录观察

根目录当前同时承载以下职责：

- 项目配置：`.gitignore`、`package.json`、`package-lock.json`、`vite.config.js`、`capacitor.config.ts`、`requirements.txt`。
- 启动和构建入口：`build.bat`、`dev.bat`、`start-dev.bat`、`start.bat`。
- 临时或专项工具：`compress_icon.py`、`patch-java-version.ps1`。
- 历史计划与产物：`plan.md`、`PromptImageManager-v2.2.1.apk`。
- 主源码和平台目录：`src`、`python`、`src-tauri`、`android`。
- 生成或本地环境目录：`.venv`、`node_modules`、`dist`、`build`、`android-sdk`、`releases`。
- 设计资产区：`UI设计稿`。

## 文档目录观察

`docs` 当前包含：

- 顶层技术文档：`api-reference.md`、`web-technical-doc.md`、`pc-technical-doc.md`、`mobile-technical-doc.md` 等。
- UI 计划：`docs/UI计划`，其中 PC、PC 设计、移动端设计并存。
- 构建方案：`docs/构建方案`。
- 计划文档：`docs/计划文档`。
- 对话历史：`docs/对话历史`。
- 已修复问题：`docs/已修复问题`。

## 构建依赖线索

- `vite.config.js` 使用 `root: 'src'`，前端源码路径不应在第一阶段移动。
- `capacitor.config.ts` 使用 `webDir: 'dist'`，移动 `dist` 或修改输出目录会影响安卓构建。
- `package.json` 脚本直接引用 `python/main.py`、`src-tauri/Cargo.toml`、`cap sync android` 等路径。
- `build.bat` 直接引用 `build\app.spec`、`build\installer.nsi`、`build\dist`、`dist` 等路径。
- `dev.bat`、`start-dev.bat`、`start.bat` 直接引用根目录、`python\main.py` 和 Vite 启动命令。
- `compress_icon.py` 直接写入 `src/assets/icons/图标.svg`，属于有副作用的专项工具。
- `patch-java-version.ps1` 会修改 `android` 和 `node_modules` 下的 Gradle 文件，属于环境修复脚本。

## 工作区风险

当前 `git status --short` 显示已有大量修改、新增和删除，包括：

- `src/js`、`src/css`、`src/index.html` 等前端结构正在变化。
- `python/data` 与 `python/main.py` 有改动。
- `releases` 下历史产物存在删除记录。
- `build` 下打包配置和产物有改动。
- `docs` 下已有 UI 计划和构建方案新增或修改。

因此第一批整理应只动低风险文档和明确产物，不应直接重排源码目录。
