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

[lib.rs](../src-tauri/src/lib.rs) `find_python()` 函数依次尝试：

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
| 资源包含 | `../python/*` | Python 后端脚本 |
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
- **监听地址**：`0.0.0.0:8888`（支持局域网访问）
- **数据存储**：JSON 文件 + 图片文件
- **并发处理**：多线程，`allow_reuse_address = True`

### 5.2 数据目录

```
应用目录（或 ~/.prompt-image-tool/）
├── data/
│   ├── prompt_sets.json     # 所有集合数据（JSON）
│   ├── folders.json         # 文件夹数据（JSON）
│   └── images/              # 图片文件
│       ├── abc123.png
│       └── def456.jpg
└── python/
    └── main.py              # Python 后端脚本
```

### 5.3 数据目录回退机制

[main.py](../python/main.py) `get_data_dir()` 函数：

1. 优先在应用目录（`get_app_dir()`）下创建 `data/` 目录
2. 尝试写入测试文件验证写权限
3. 若 `PermissionError` 或 `OSError`，回退到用户目录 `~/.prompt-image-tool`
4. 支持 PyInstaller 打包后的路径解析

### 5.4 数据加载容错

`load_data()` / `load_folders()` 函数：

1. 读取文件内容后 `strip()` 去除空白
2. 空文件返回 `[]`
3. 捕获 `json.JSONDecodeError` 和 `IOError` 异常，返回空列表

### 5.5 图片处理

`save_image(image_id, data_url)` 函数：

- 解析 Data URL 中的 MIME 类型（`image/png`、`image/jpeg`、`image/webp`、`image/gif`）
- 生成文件名：`{image_id}.{ext}`
- 写入 `data/images/` 目录
- 使用 `shutil.copy2()` 复制图片文件（版本复制时）

### 5.6 网络信息

`get_local_ip()` 函数：通过 UDP Socket 获取本机局域网 IP 地址，供局域网同步使用。

---

## 六、PC 端功能清单

### 6.1 核心功能

| 功能 | 描述 | 实现位置 |
|------|------|---------|
| 提示词集合 CRUD | 创建/删除/重命名/搜索集合 | `app.js` → `ApiStorage` → Python API |
| 文件夹管理 | 创建/删除/重命名/颜色标签/移动集合 | `app.js` → `ApiStorage` → Python API |
| 多版本管理 | 添加/删除/重命名/复制版本 | `app.js` → `ApiStorage` → Python API |
| 提示词编辑 | 正向/反向提示词，500ms 防抖自动保存 | `app.js` → `promptHandler()` |
| 提示词预览 | 二级窗口完整预览 + 一键复制 | `app.js` → `openPromptPreview()` |
| 图片上传 | 点击/拖拽上传，支持 PNG/JPG/WEBP/GIF | `app.js` → `ApiStorage` → Python API |
| 图片查看 | 全屏查看，ESC/点击关闭 | `app.js` → `viewImage()` |
| 版本对比 | 并排对比两个版本的提示词和图片 | `app.js` → `toggleCompare()` |
| 数据导入导出 | JSON 格式，相同 ID 覆盖更新 | `app.js` → `ApiStorage` → Python API |
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
| 局域网同步服务 | 作为同步服务端，Android 端可拉取数据 | `main.py` → `/api/sync` |
| 本机 IP 显示 | 显示本机局域网 IP，方便同步 | `app.js` → `loadPCNetworkInfo()` |

---

## 七、前端存储层（ApiStorage）

[api-storage.js](../src/js/api-storage.js) 实现了 `ApiStorage` 类，通过 HTTP Fetch 与 Python 后端通信。

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
| `exportData()` | GET | `/api/export` | 导出全部数据 |
| `importData(data)` | POST | `/api/import` | 导入数据 |
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
| PC-001 | Python 后端 `load_data()`/`save_data()` 非原子操作，高并发下可能数据丢失 | 中 | 加文件锁（`fcntl` / `msvcrt`）或改用 SQLite |
| PC-002 | Python 后端日志被静默（`log_message` 为空函数），生产环境无法排查问题 | 中 | 接入日志文件输出 |
| PC-003 | 自动保存每次完整读取再写入，效率较低 | 低 | 实现增量更新机制 |
| PC-004 | API 无认证机制，局域网内任何人可访问 | 低 | 按需添加 Token 认证 |
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
