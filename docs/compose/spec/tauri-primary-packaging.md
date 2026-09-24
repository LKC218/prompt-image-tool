---
feature: tauri-primary-packaging
status: delivered
updated: 2026-09-24
branch: chore/tauri-primary-packaging
commits: e62610f..working-tree # reviewed implementation range（实现待随本分支收尾提交）
---

# Tauri 主路径打包规范收敛

## Report

**What was built** — Windows 正式发包收敛为唯一 Tauri + Sidecar 链路：`vite` → `server.spec` → `npx tauri build` → `releases/PromptImageManager-Setup-<ver>.exe`。`scripts/build_pc_package.py` 重写为 Tauri 发包封装（禁止 `app.spec` 回退）；`build.bat` 去掉应急旧壳菜单并以 Python 读版本规范命名；`app.spec`/`app_main.py`/`installer.nsi` 打 DEPRECATED；安装器壳脚本核心包改为 `releases/`→`build/` 双落点查找。新增《PC发包规范-Tauri主路径》SOP，构建/交接/技术/导航/发布/README 全面改单轨。

**Verification** — `python -m pytest python/tests -q`：88 passed。`npm test`：393 passed / 45 files。`build_pc_package.py --help` / `ast.parse` 双脚本：PASS。正式路径禁用词与旧链步骤检索：CLEAN（PyInstaller 仅保留 Sidecar `server.spec` 依赖说明）。独立审查 2 轮：初审 4 critical（交接文档/壳脚本落点/bat 版本解析/scripts README）→ 修复后复审关闭，并外溢文档（技术百科/转移指南/code map）一并收口。

**Journey log** — 1) 必须区分 `server.spec`（保留）与 `app.spec` 全量旧壳（废止）。2) 发布名固定 `PromptImageManager-Setup-<ver>.exe`，Tauri 原始中文名仅作中间产物。3) batch 内解析 package.json 不可靠，应用 Python 读 version。4) 正式链检索 CLEAN 不等于全仓文档收敛，交接/百科/技术文档需逐份扫。5) 安装器壳资源路径仍指向 `build/`，需从 `releases/` 拷贝副本。

## [S1] Problem

## [S1] Problem

Windows 发包存在双轨：Tauri + Sidecar（~28MB）与 PyInstaller + pywebview 全量应急壳（~38MB）都产出 `PromptImageManager-Setup-*.exe`。2.5.23/2.5.24 误走应急壳，与无边框窗口、Tauri 自动更新契约不一致；文档仍保留「方式 A/B」双方案，发包入口不唯一。

## [S2] Design

### 契约

1. **唯一正式发包链**  
   `vite build` → `PyInstaller build/server.spec`（仅 Sidecar）→ 拷贝 `PromptImageManager-Server.exe` 到 `src-tauri/server/` → `npx tauri build` → 将 Tauri NSIS 产物复制/重命名为 `releases/PromptImageManager-Setup-<version>.exe`。

2. **发布文件名**  
   继续使用 `PromptImageManager-Setup-<version>.exe`（兼容 `latest.json` / 自动更新 / `publish_release.ps1`），不改协议字段。

3. **PyInstaller 范围**  
   - **保留**：`build/server.spec`（无头 Sidecar，Tauri 资源）。  
   - **废止为正式路径**：`build/app.spec`、`build/app_main.py`、`build/installer.nsi`、`scripts/build_pc_package.py` 的全量 pywebview 语义。文件保留并打 DEPRECATED 头；`build_pc_package.py` 改为 **Tauri 发包封装**（同名入口，避免全仓引用断裂）。

4. **构建入口**  
   `build.bat` 仅保留：① Tauri + Sidecar（默认/推荐）、Android、仅前端、开发模式。删除「应急旧壳」菜单与 `:build_pc` 分支。Tauri 成功后将产物规范名为 `PromptImageManager-Setup-<ver>.exe` 再拷入 `releases/`。

5. **规范文档**  
   新增 `docs/构建方案/PC发包规范-Tauri主路径.md` 为发包唯一 SOP；`PC端构建流程.md` / `PC端安装包构建方案.md` / 快速打包 / 交接 / 目录说明 / 发布指南 / 自动更新模块 / README / code map 改为引用 SOP 或删除全量 PyInstaller 正式步骤。

6. **旧壳兼容（代码）**  
   自动更新多候选主 exe、NSIS 清进程双名单 **保留**（服务从旧 PyInstaller 安装升级的用户）。

### 错误行为

- Tauri 产物缺失时 `build_pc_package.py` / `build.bat` 报错退出，不得回退打应急壳。  
- DEPRECATED 文件不得被正式发包链调用。

### 测试边界

- 全仓检索：正式发包文档与 `build.bat` 不含「应急旧壳」菜单与 `app.spec` 全量步骤。  
- `npm test` + `python -m pytest python/tests -q` 全绿。  
- `build_pc_package.py --help` 可用且描述为 Tauri 主路径（语法检查通过）。  
- 不强制本机完整 `tauri build`（耗时长）；以脚本逻辑与文档一致性 + 既有测试为准。

## [S3] Out of Scope

- 发布 v2.5.25 或改 GitHub Release 历史资产  
- 删除历史 changelog 中的 PyInstaller 记录  
- 迁走/删除 `app_main.py` 源文件本体（仅标注 DEPRECATED）  
- Android / 安装器壳业务改造

## Tasks

- [x] T1: 新增《PC发包规范-Tauri主路径》SOP — acceptance: 文档含唯一四步+改名+publish 衔接 (covers: S2-1, S2-2, S2-5)
- [x] T2: `build_pc_package.py` 改为 Tauri 发包封装 — acceptance: 执行 server.spec + tauri build + 产出 PromptImageManager-Setup-<ver>.exe 路径逻辑；不再调用 app.spec/installer.nsi (covers: S2-1, S2-2, S2-3)
- [x] T3: `build.bat` 去掉应急选项并规范名拷贝 releases — acceptance: 菜单无应急旧壳；Tauri 成功后 releases 含 PromptImageManager-Setup-<ver>.exe (covers: S2-4)
- [x] T4: 旧壳源文件 DEPRECATED 头 — acceptance: app_main.py / app.spec / installer.nsi 含 DEPRECATED 说明 (covers: S2-3)
- [x] T5: 收敛构建/交接/发布/模块/README/code map 文档 — acceptance: 正式发包步骤仅引用 Tauri SOP (covers: S2-5)
- [x] T6: 全自动验证 — acceptance: pytest+npm test 绿；发包禁用词检索清零 (covers: S2; depends: T1-T5)
