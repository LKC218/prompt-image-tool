# 生图提示词管理器 — PC 端技术文档

> 版本：2.2.1 | 最后更新：2026-05-04

---

## 一、概述

PC 桌面端基于 **Tauri 2.x (Rust)** 封装，内嵌 Python HTTP 后端，通过 WebView2 渲染前端页面。前端通过 `ApiStorage` 类与 Python 后端通信，所有数据存储在 JSON 文件和图片文件中。

### 核心架构

```
┌────────────────────────────────────────────────────┐
│                 Tauri 窗口 (WebView2)               │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │          前端 (index.html + app.js)           │  │
│  │              ↓ ApiStorage (HTTP Fetch)        │  │
│  └──────────────────────┬───────────────────────┘  │
│                         │ HTTP REST API             │
│  ┌──────────────────────▼───────────────────────┐  │
│  │       Python 后端 (main.py)                   │  │
│  │   http.server + ThreadingTCPServer            │  │
│  │   端口: 8888 | 数据: JSON + 图片文件           │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │       Rust 层 (lib.rs)                        │  │
│  │   启动时自动查找并启动 Python 子进程            │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

---

## 二、技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 桌面框架 | Tauri | 2.11.0 | Rust 核心 + WebView2 渲染 |
| 后端语言 | Rust | 1.77.2+ | Tauri 内置，管理 Python 进程 |
| 脚本后端 | Python | 3.9+ | HTTP API 服务，数据存储 |
| 前端渲染 | WebView2 | 系统内置 | Windows Edge 渲染引擎 |
| 打包格式 | NSIS | - | Windows 安装程序 |
| 前端构建 | Vite | 8.x | 开发服务器 + 生产构建 |

---

## 三、Rust 层（Tauri 入口）

### 3.1 应用启动流程

```
Tauri 启动
  → 初始化 Shell/Log 插件
  → 检测非 Android 平台（#[cfg(not(target_os = "android"))]）
  → find_python() 查找 Python 可执行文件
  → start_python_backend() 启动 Python 子进程
  → WebView 加载前端页面
  → 前端 ApiStorage.init() 轮询 /api/health 等待后端就绪
```

### 3.2 Python 查找策略

[lib.rs](../../src-tauri/src/lib.rs) `find_python()` 函数依次尝试：

1. 命令行查找：`python` → `python3` → `python.exe`
2. 常见安装路径：
   - `C:\Python312\python.exe`
   - `C:\Python311\python.exe`
   - `C:\Python310\python.exe`
   - `C:\Python39\python.exe`
   - `C:\Users\Default\AppData\Local\Programs\Python\Python3xx\python.exe`
3. 均未找到则记录错误日志并放弃启动后端

### 3.3 Python 脚本路径查找

1. 优先路径：`{resource_dir}/python/main.py`
2. 备用路径：`{resource_dir}/_up_/python/main.py`（NSIS 安装后的实际路径）
3. 均不存在则记录错误日志

### 3.4 进程启动

- Windows 下使用 `CREATE_NO_WINDOW` 标志（`0x08000000`）隐藏 Python 控制台窗口
- 工作目录设置为 Python 脚本所在目录
- Python 进程随 Tauri 主进程退出

### 3.5 Rust 依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `tauri` | 2.11.0 | 桌面框架核心 |
| `tauri-build` | 2.6.0 | Tauri 构建工具 |
| `tauri-plugin-shell` | 2 | Shell 命令执行（启动 Python 进程） |
| `tauri-plugin-log` | 2 | 日志插件（仅 Debug 模式） |
| `serde` / `serde_json` | 1.0 | 序列化/反序列化 |
| `log` | 0.4 | 日志门面 |

### 3.6 Rust 单元测试

| 测试函数 | 测试内容 |
|----------|---------|
| `test_path_conversion` | 路径拼接与字符串转换 |
| `test_path_exists_check` | 路径存在性检查 |
| `test_alternative_path` | 备用路径构建（`_up_` 目录） |

---

## 四、Tauri 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 窗口标题 | 生图提示词管理器 | - |
| 窗口尺寸 | 1200 × 800 | 默认大小 |
| 最小尺寸 | 800 × 600 | - |
| 窗口居中 | 是 | - |
| 可调整大小 | 是 | - |
| 打包格式 | NSIS | Windows 安装程序 |
| 资源包含 | `../../python/*` | Python 后端脚本 |
| WebView 安装 | 下载引导程序 | 首次运行自动下载 |
| 应用 ID | `com.promptimagemanager.app` | - |

### 权限配置（capabilities/default.json）

- `shell:allow-open` — 允许打开外部链接
- `shell:allow-execute` — 允许执行 Shell 命令（启动 Python）
- `shell:allow-spawn` — 允许创建子进程
- `log:default` — 允许日志输出

---

## 五、Python 后端

### 5.1 技术架构

- **HTTP 服务器**：`http.server.HTTPRequestHandler` + `socketserver.ThreadingTCPServer`
- **监听地址**：开发后端默认 `0.0.0.0:8888`；PyInstaller 安装包入口优先使用 `8888`，端口占用时按顺序切换到 `8889-8897`（支持局域网访问）
- **数据存储**：JSON 文件 + 图片文件
- **并发处理**：多线程；安装包入口使用独占端口绑定，避免 Windows 下与已有开发后端共享同一端口后加载到目录列表

### 5.2 数据目录

```
开发模式应用目录，或安装版用户级目录 `%APPDATA%\PromptImageManager`
├── data/
│   ├── prompt_sets.json     # 所有集合数据（JSON）
│   ├── folders.json         # 文件夹数据（JSON）
│   ├── images/              # 图片文件
│       ├── abc123.png
│       └── def456.jpg
│   ├── backups/             # 导入同步前备份与用户备份
│   └── data-migration.json  # 旧安装目录数据迁移记录
```

### 5.3 数据目录回退机制

[main.py](../../python/main.py) `get_data_dir()` 函数：

1. 开发模式默认继续在应用目录下创建 `data/`，便于本地调试。
2. 安装版、显式开启 `PROMPT_IMAGE_TOOL_FORCE_USER_DATA=1`，或设置 `PROMPT_IMAGE_TOOL_DATA_DIR` 时，优先使用用户级稳定目录。
3. Windows 安装版默认用户级目录为 `%APPDATA%\PromptImageManager\data`。
4. 如果旧安装目录 `$INSTDIR\data` 存在且用户级目录为空，启动时会复制迁移旧数据，并写入 `data-migration.json`。
5. 如果用户级目录已有数据，则不会用旧安装目录覆盖，只记录跳过迁移。
6. 若普通开发目录无法写入，仍回退到 `~/.prompt-image-tool`。

### 5.3.1 版本更新数据保护

PC 端版本更新安装需要保证提示词 JSON、分类、参考图片和备份不随程序目录清理而丢失。计划与实现入口见 [PC端版本更新安装保留JSON提示词信息计划-260525.md](../计划文档/PC端版本更新安装保留JSON提示词信息计划-260525.md)。

当前约束：

1. `python/main.py` 与 `build/app_main.py` 使用同一套用户级数据目录、旧目录迁移和迁移标记逻辑。
2. 安装器壳执行 NSIS 安装前会创建升级快照，覆盖旧安装目录 `data/` 与用户级 `data/`。
3. NSIS 普通卸载默认只删除程序文件、快捷方式和卸载注册表项；若旧 `$INSTDIR\data` 仍存在，会先移到 `%APPDATA%\PromptImageManager\legacy-install-data`。
4. PC 设置页本地存储区通过 `/api/health` 展示真实数据目录，便于排障。

### 5.4 数据加载容错

`load_data()` / `load_folders()` 函数：

1. 读取文件内容后 `strip()` 去除空白
2. 文件不存在时返回 `[]`
3. 现有空文件、坏 JSON 或读取失败会直接报错，不再静默返回空列表参与后续写入
4. `save_data()` / `save_folders()` 采用临时文件写入后原子替换，并在覆盖前保留最近一次 `.bak` 备份

### 5.5 图片处理

`save_image(image_id, data_url)` 函数：

- 解析 Data URL 中的 MIME 类型（`image/png`、`image/jpeg`、`image/webp`、`image/gif`）
- 生成文件名：`{image_id}.{ext}`
- 写入 `data/images/` 目录
- 使用 `shutil.copy2()` 复制图片文件（版本复制时）

### 5.6 导入压缩策略

PC 编辑器导入图片时先在前端执行统一优化：

- 支持 JPG、PNG、WebP，单张源文件上限为 15MB，单版本最多 10 张。
- 新建/编辑页支持从外部复制图片后在页面内 `Ctrl+V` 粘贴，剪贴板图片会转换为 `File` 并复用同一套导入、压缩、数量上限和保存流程。
- 使用 `src/js/image-utils.js` 解码 Data URL 后通过 Canvas 输出 JPEG，质量参数为 `0.9`。
- 最大边长限制为 `2560px`，最大输入像素为 `4000 万`，避免超大图拖慢 WebView。
- 当未缩放且 JPEG 结果不小于原图时保留原始 Data URL，避免 PNG/WebP 反向增大。
- 图片元数据中的 `file` 字段以 `uploadImage()` 返回值为准，保证回退原图时扩展名与真实落盘文件一致。
- 新建/编辑页的未保存内容会按 `pc-editor-draft:new` 或 `pc-editor-draft:{promptSetId}` 写入浏览器本地草稿，覆盖标题、提示词、标签、分类、比例和压缩后的新导入图片；正式保存成功后清理对应草稿。
- PC 新建页顶部提供一键清空当前输入入口，二次确认后重置标题、正向提示词、负向提示词、标签、分类、比例和图片预览，并删除 `pc-editor-draft:new`，避免切页后恢复旧输入；该入口不在编辑模式显示，也不调用后端删除已保存图片。

### 5.7 提示词长度限制

PC 新建/编辑页的提示词长度限制由 `src/js/pc-editor.js` 前端常量维护：

- 正向提示词：`MAX_POSITIVE_PROMPT_LEN = 6666`，用于 `maxlength`、字数统计和超限样式。
- 负向提示词：`MAX_NEGATIVE_PROMPT_LEN = 2000`，继续保持原有输入上限。
- 后端数据结构仍使用 `versions.prompt` 和 `versions.negativePrompt` 字段，不新增迁移或存储字段。

### 5.8 网络信息

`get_local_ip()` 函数：通过 UDP Socket 获取本机局域网 IP 地址，供局域网同步使用。

### 5.9 安装包后端入口

PC 独立安装包通过 `build/app.spec` 打包 `build/app_main.py`，该入口需要与 `python/main.py` 的局域网同步协议保持对齐。安装包后端优先监听 `0.0.0.0:8888`，如果端口已被开发后端或旧进程占用，则使用独占绑定检测并按顺序切换到 `8889-8897`；本机 WebView 始终加载实际端口的 `http://127.0.0.1:{port}`。

`build/app_main.py` 需要覆盖以下局域网互通接口：

- `GET /api/health`
- `GET /api/sync/capabilities`
- `GET /api/sync/pairing`
- `POST /api/sync/preview`
- `POST /api/sync/import`
- `POST /api/sync/bidirectional`

源码后端和安装包后端都必须使用同一套冲突策略：写入前可通过 `/api/sync/preview` 返回字段级差异；`keep_pc` 冲突回传生成带 `conflictKey` 的幂等冲突副本；重复回传同一冲突内容时跳过已有副本；实际写入前在 `backups` 目录生成同步前备份，并在报告中返回 `backupPath`。

### 5.10 prompt-image-tool JSON 导入联动

PC 首页导入 JSON 时会先尝试通过 `src/js/prompt-tool-json-import.js` 判断是否能转成新建提示词导入内容。若命中 `prompt-image-tool.import.v1`，或命中单条 ChatGPT Vault 对话归档 JSON（包含 `messages[]`、标题和归档标识），则会标准化、临时暂存并跳转到新建提示词页。

导入暂存优先写入 IndexedDB，失败时回退 Web Storage 和同页内存 Map，避免带参考图片的专用 JSON 因 `sessionStorage` 配额限制被误报为文件格式错误。

PC 设置页的导入入口现在分成两个显式按钮：

- `导入 JSON`：只处理完整备份 JSON，继续走 `storage.importData(data)`。
- `导入 ChatGPT 对话`：处理单条 ChatGPT Vault 对话归档 JSON，成功后跳转到 `navigate('/editor/', { importId })`。
- 新建/编辑页从暂存 payload 回填标题、正向提示词、负向提示词、标签、比例和参考图片。
- 图片对象会先复用 `src/js/image-utils.js` 做统一压缩，再交给现有保存链路上传。
- 单条 ChatGPT 对话归档 JSON 不包含内嵌图片二进制时，仅预填标题与提示词文本；需要图片同步时应优先使用 ChatGPT Vault 的 `导出提示词JSON` 入口。

发布前需运行 `python -m pytest python/tests/test_build_app_main.py -q`，避免安装包后端落后于源码后端，导致前端拿到首页 HTML 并触发 JSON 解析失败；同时确认 `/`、`/index.html` 和任意前端路由不会返回 `SimpleHTTPRequestHandler` 目录列表。

---

## 六、PC 端功能清单

### 6.1 核心功能

| 功能 | 描述 | 实现位置 |
|------|------|---------|
| 提示词集合 CRUD | 创建/删除/重命名/搜索集合 | `app.js` → `ApiStorage` → Python API |
| 文件夹管理 | 创建/删除/重命名/颜色标签/移动集合 | `app.js` → `ApiStorage` → Python API |
| 多版本管理 | 添加/删除/重命名/复制版本 | `app.js` → `ApiStorage` → Python API |
| 提示词库筛选 | 全部、收藏、最近使用、未分类和分类夹标签筛选，搜索与分类可叠加 | `pc-library.js` → `pc-prompt-ui-utils.js` |
| 提示词编辑 | 正向提示词前端上限 6666 字符，反向提示词前端上限 2000 字符 | `pc-editor.js` |
| 提示词预览 | 二级窗口完整预览 + 一键复制 | `app.js` → `openPromptPreview()` |
| 图片上传 | 点击/拖拽上传，支持 PNG/JPG/WEBP/GIF | `app.js` → `ApiStorage` → Python API |
| 图片查看 | 全屏查看，支持滚轮缩放、拖拽平移、双击缩放/复位、下载当前图片、复位按钮、ESC/点击遮罩关闭；下载优先使用文件保存选择器，桌面端可回退后端原生保存窗口，并写入本地下载历史 | `pc-utils.js` → `showImageViewer()` → `image-download-utils.js` / `download-history.js` |
| 版本对比 | 并排对比两个版本的提示词和图片 | `app.js` → `toggleCompare()` |
| 数据导入导出 | 完整备份 JSON，包含文件夹、提示词、版本和图片文件内容；设置页常驻入口收敛为“导入 JSON”“导入 ChatGPT 对话”和“导出 JSON”三个按钮；PC 默认导出到系统下载目录，自定义位置模式优先使用文件保存选择器，桌面 WebView 可由后端打开原生保存窗口；相同 ID 默认覆盖 | `pc-settings.js` / `backup-utils.js` → `ApiStorage` → Python API |
| 图片下载历史 | 设置页展示最近图片下载记录，并支持一键清空历史 | `pc-settings.js` → `download-history.js` |
| 暗色/亮色主题 | 主题切换，localStorage 持久化 | `app.js` → `initTheme()` / `toggleTheme()` |
| 右键菜单 | 集合项右键弹出操作菜单 | `app.js` → `showContextMenu()` |
| 新手引导 | 首次使用分步引导教程 | `app.js` → `tutorial.js` → `TutorialGuide` |
| 帮助按钮 | 重新触发引导教程 | `app.js` → `startTutorial()` |

### 6.2 PC 端特有功能

| 功能 | 描述 | 实现位置 |
|------|------|---------|
| 自动启动后端 | Tauri 启动时自动查找并启动 Python 进程 | `lib.rs` → `start_python_backend()` |
| 隐藏控制台 | Windows 下 Python 子进程无控制台窗口 | `lib.rs` → `CREATE_NO_WINDOW` |
| 数据目录回退 | 应用目录无写权限时回退到用户目录 | `main.py` → `get_data_dir()` |
| 局域网互通服务 | 作为同步服务端，Android 端可拉取、预览冲突、回传和发起双向同步，PC 端不主动连接其他设备 | `main.py` → `/api/sync`、`/api/sync/preview`、`/api/sync/import` |
| 桌面端备份保存 | PC 默认由 Python 后端写入系统下载目录并返回保存路径；自定义位置模式可由后端打开原生保存窗口，取消选择时返回 `canceled: true` | `backup-utils.js` → `ApiStorage.exportFile()` → `/api/export-file` |
| 本机 IP 显示 | 显示本机局域网 IP、端口和复制入口，方便移动端连接 | `pc-settings.js` → `getNetworkInfo()` |
| SVG 图标系统 | PC 页面运行时不使用 Emoji、星号、勾号、叉号或箭头字符充当图标，通用图标和 iconfont 语义补充图标均本地化为 SVG | `pc-icon-assets.js`、`src/assets/icons/*.svg`、`src/assets/icons/pc/*.svg` |

---

## 七、前端存储层（ApiStorage）

[api-storage.js](../../src/js/api-storage.js) 实现了 `ApiStorage` 类，通过 HTTP Fetch 与 Python 后端通信。

### 7.1 初始化与健康检查

```javascript
async init() {
    // 轮询 /api/health，最多重试 10 次，每次间隔 1 秒
    // 等待 Python 后端就绪
}
```

### 7.2 方法列表

| 方法 | HTTP | API 端点 | 功能 |
|------|------|----------|------|
| `init()` | GET | `/api/health` | 健康检查（重试 10 次） |
| `getFolders()` | GET | `/api/folders` | 获取所有文件夹 |
| `createFolder(name, color)` | POST | `/api/folders` | 创建文件夹 |
| `updateFolder(id, data)` | POST | `/api/folder/{id}` | 更新文件夹 |
| `deleteFolder(id)` | DELETE | `/api/folder/{id}` | 删除文件夹 |
| `movePromptToFolder(promptSetId, folderId)` | POST | `/api/prompt-set/{id}/move` | 移动集合到文件夹 |
| `getPromptSets()` | GET | `/api/prompt-sets` | 获取集合列表摘要 |
| `getPromptSet(id)` | GET | `/api/prompt-set/{id}` | 获取集合详情 |
| `createPromptSet(name, folderId)` | POST | `/api/prompt-sets` | 创建集合 |
| `updatePromptSet(id, data)` | POST | `/api/prompt-set/{id}` | 更新集合 |
| `deletePromptSet(id)` | DELETE | `/api/prompt-set/{id}` | 删除集合 |
| `addVersion(id, data)` | POST | `/api/prompt-set/{id}/version` | 添加版本 |
| `deleteVersion(id, versionIndex)` | POST | `/api/prompt-set/{id}/delete-version` | 删除版本 |
| `renameVersion(id, versionIndex, version)` | POST | `/api/prompt-set/{id}/rename-version` | 重命名版本 |
| `duplicateVersion(id, versionIndex)` | POST | `/api/prompt-set/{id}/duplicate-version` | 复制版本 |
| `uploadImage(imageId, dataUrl, name)` | POST | `/api/image/{imageId}` | 上传图片 |
| `deleteImage(filename)` | DELETE | `/api/image/{filename}` | 删除图片 |
| `exportData()` | GET | `/api/export` | 导出完整备份，图片以 Data URL 嵌入 |
| `exportFile(filename, options)` | POST | `/api/export-file` | 后端直接生成备份文件并返回保存路径；`options.saveMode` 支持 `downloads` 和 `custom` |
| `downloadImageFile(sourceFile, options)` | POST | `/api/image-download-file` | 后端保存 `data/images` 内的指定图片并返回保存路径；用于 PC 图片预览自定义位置下载 |
| `importData(data)` | POST | `/api/import` | 导入完整备份，相同 ID 覆盖并恢复图片 |
| `getNetworkInfo()` | GET | `/api/network-info` | 获取 PC 同步服务 IP 和端口 |
| `getSyncCapabilities()` | GET | `/api/sync/capabilities` | 获取 PC 局域网互通能力 |
| `estimateStorageSize()` | GET | `/api/export` | 基于完整备份估算数据大小 |

---

## 局域网同步端口返回

PC 端同步服务默认优先使用 `8888`。独立安装包发现端口被占用时会按顺序回退到 `8889-8897`，本机 WebView 加载 `http://127.0.0.1:{port}`，局域网接口也监听同一个实际端口。`/api/health`、`/api/sync/capabilities` 和 `/api/network-info` 需要返回该实际端口，PC 设置页展示和复制的同步地址必须包含端口。

开发后端仍以 `8888` 作为默认端口，但端口值统一来自 `SERVER_PORT`，避免接口返回值与运行端口漂移。
| `getImageUrl(img)` | - | `${baseUrl}/images/${img.file}` | 获取图片 URL |
| `getPlatform()` | - | - | 返回 `'pc'` |

---

## 八、构建与部署

### 8.1 构建方式对比

| | 方式 A：PyInstaller | 方式 B：Tauri |
|---|---|---|
| 窗口技术 | pywebview（系统 WebView） | Tauri（系统 WebView） |
| 需要 Rust | 不需要 | 需要 |
| 打包体积 | 较大（含 Python 运行时） | 较小 |
| 构建速度 | 较快 | 较慢（需编译 Rust） |
| 输出格式 | exe 文件夹 / NSIS 安装包 | NSIS 安装包 |
| 推荐场景 | 快速打包、无需 Rust 环境 | 追求专业桌面应用体验 |

### 8.2 方式 A：PyInstaller 构建

```bash
# 一键构建
build.bat → 选择 1（PC 安装包 PyInstaller + NSIS）

# 手动构建
pip install pyinstaller pywebview
npm install
npx vite build
python -m PyInstaller build/app.spec --workpath build/build --distpath build/dist --clean

# 制作安装包（可选，需安装 NSIS）
cd build && makensis installer.nsi
```

**构建产物**：

```
build/dist/PromptImageManager/
├── PromptImageManager.exe      # 主程序
└── _internal/
    ├── frontend/               # 前端文件
    └── ...                     # Python 运行时依赖
```

### 8.3 方式 B：Tauri 构建（推荐）

```bash
# 一键构建
build.bat → 选择 2（PC 桌面端 Tauri）

# 手动构建
npm install
npx tauri build
```

**构建产物**：

```
src-tauri/target/release/bundle/
└── nsis/
    └── 生图提示词管理器_2.0.0_x64-setup.exe
```

### 8.4 构建前提

| 工具 | 用途 | 安装方式 |
|------|------|---------|
| Node.js 18+ | 前端构建 | https://nodejs.org/ |
| Python 3.9+ | 后端运行 | https://python.org/ |
| Rust | Tauri 编译（方式 B） | https://rustup.rs/ |
| PyInstaller | Python 打包（方式 A） | `pip install pyinstaller` |
| pywebview | 桌面窗口（方式 A） | `pip install pywebview` |
| NSIS | 安装包制作（可选） | https://nsis.sourceforge.io/ |

### 8.5 开发模式

```bash
# 方式一：浏览器开发（两个终端）
python python/main.py          # 终端1：启动 Python 后端
npx vite                       # 终端2：启动前端开发服务器（端口 5173）

# 方式二：Tauri 开发
npx tauri dev

# 方式三：一键脚本
build.bat → 选择 4（开发模式）
```

---

## 九、已知问题与改进建议

| 编号 | 问题描述 | 严重程度 | 建议 |
|------|---------|---------|------|
| PC-001 | Python 后端曾存在 `load_data()`/`save_data()` 静默空写和非原子覆盖风险 | 中 | 当前已改为坏文件拒绝覆盖 + 原子替换 + `.bak` 备份，后续如需更强并发保障再考虑文件锁或 SQLite |
| PC-002 | Python 后端日志被静默（`log_message` 为空函数），生产环境无法排查问题 | 中 | 接入日志文件输出 |
| PC-003 | 自动保存每次完整读取再写入，效率较低 | 低 | 实现增量更新机制 |
| PC-004 | 普通读取接口仍允许局域网访问 | 低 | 写入类同步接口已增加 `X-Sync-Token`，后续可继续收紧读取权限 |
| PC-005 | Python 进程随 Tauri 退出后不会自动清理 | 中 | 添加进程生命周期管理 |
| PC-006 | Python 查找路径有限，不支持 conda/pyenv 等环境 | 低 | 扩展查找策略或允许用户配置 |

---

## 十、发布检查清单

- [ ] 前端构建无错误（`npx vite build`）
- [ ] Tauri 构建无错误（`cargo tauri build`）
- [ ] Python 后端脚本已包含在资源目录
- [ ] NSIS 安装程序可正常安装/卸载
- [ ] 安装后应用可正常启动，Python 后端自动运行
- [ ] 数据目录写权限回退机制正常工作
- [ ] 导入导出功能正常
- [ ] 图片上传/删除/查看正常
- [ ] 版本对比功能正常
- [ ] 文件夹管理功能正常
- [ ] 暗色/亮色主题切换正常
- [ ] 局域网同步功能正常（Android 端可连接）
