# 生图提示词管理器 - PC端安装包构建方案

> 适用版本：v2.3.2+  
> 构建方案：PyInstaller + NSIS  
> 最后更新：2026-05-09

---

## 一、架构概览

```
┌─────────────────────────────────────────────────────┐
│                   PC 安装包架构                       │
│                                                     │
│  ┌───────────┐    ┌──────────────────────────────┐  │
│  │  pywebview │    │     Python HTTP Server       │  │
│  │  桌面窗口   │◄──►│     (端口 8888)              │  │
│  │  (WebView) │    │     API + 静态文件服务         │  │
│  └───────────┘    └──────────────────────────────┘  │
│         ▲                       ▲                   │
│         │                       │                   │
│    用户交互                 前端 API 请求             │
│         │                       │                   │
│         ▼                       ▼                   │
│  ┌─────────────────────────────────────────────┐   │
│  │           前端 SPA (Vite 构建)                │   │
│  │     index.html + JS/CSS/Assets               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  打包方式：PyInstaller → 单目录 → NSIS 安装包        │
└─────────────────────────────────────────────────────┘
```

**核心思路**：`build/app_main.py` 集成了 Python HTTP 服务器 + pywebview 桌面窗口 + 全部 API 逻辑，PyInstaller 将其与前端文件一起打包为可执行文件，NSIS 再封装为安装包。

---

## 二、环境准备

### 2.1 必装工具

| 工具 | 最低版本 | 用途 | 安装方式 | 验证命令 |
|------|---------|------|---------|---------|
| **Node.js** | 18+ | 前端构建 | https://nodejs.org/ | `node --version` |
| **Python** | 3.9+ | 后端运行 | https://python.org/ | `python --version` |
| **PyInstaller** | 6.x | Python→exe | `pip install pyinstaller` | `pip show pyinstaller` |
| **pywebview** | 6.x | 桌面窗口 | `pip install pywebview` | `pip show pywebview` |
| **pythonnet** | - | .NET互操作 | `pip install pythonnet` | `pip show pythonnet` |
| **NSIS** | 3.x | 安装包制作 | 见下方 2.2 节 | `where makensis` |

### 2.2 NSIS 安装

NSIS 用于生成带安装向导的 `.exe` 安装包。不安装 NSIS 也可以正常构建，只是输出为可执行文件夹而非安装包。

**方式一：官方安装程序（推荐）**

1. 访问 https://nsis.sourceforge.io/Download
2. 下载 `nsis-3.xx-setup.exe`
3. 运行安装程序，默认安装到 `C:\Program Files (x86)\NSIS`
4. 将 `C:\Program Files (x86)\NSIS` 添加到系统 PATH 环境变量
5. 新开终端验证：`where makensis`

**方式二：便携版（免安装）**

1. 从 https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip 下载
2. 解压到任意目录，如 `C:\NSIS`
3. 将 `C:\NSIS\Bin` 添加到系统 PATH
4. 新开终端验证：`where makensis`

---

## 三、构建流程

### 3.1 一键构建

```bash
build.bat
# 选择 1 → 构建 PC 安装包（PyInstaller + NSIS）
```

### 3.2 手动构建（4 步）

#### 第1步：安装依赖

```bash
pip install pyinstaller pywebview pythonnet
npm install
```

验证：
```bash
pip show pyinstaller
pip show pywebview
```

#### 第2步：构建前端

```bash
npx vite build
```

验证：
```bash
dir dist\index.html
```

将 `src/` 下的前端代码编译到 `dist/` 目录。**如果 dist/ 不存在或为空，后续打包会失败。**

#### 第3步：PyInstaller 打包

```bash
python -m PyInstaller build\app.spec --workpath build\build --distpath build\dist --clean -y
```

> **注意**：必须加 `-y` 参数，否则当输出目录已存在时会报错中断。

验证：
```bash
dir build\dist\PromptImageManager\PromptImageManager.exe
dir build\dist\PromptImageManager\_internal\frontend\index.html
```

两个文件都存在才算成功。如果 `frontend\index.html` 缺失，说明第2步的前端构建未生效。

#### 第4步：NSIS 安装包

```bash
cd build
makensis installer.nsi
cd ..
```

验证：
```bash
dir build\PromptImageManager-Setup-2.3.2.exe
```

> 如果系统未安装 NSIS，可跳过此步。直接使用第3步产出的 `build\dist\PromptImageManager\` 文件夹即可。

---

## 四、构建产物

### 4.1 NSIS 安装包（推荐分发）

```
build/PromptImageManager-Setup-2.3.2.exe    # 核心 NSIS 安装包
releases/PromptImageManager-Setup-2.3.2.exe # 发布目录副本
releases/PromptImageManager-Shell-Setup-2.3.2.exe # 带 Tauri 安装器壳的正式 PC 交付包
```

安装后包含：桌面快捷方式、开始菜单、卸载程序、注册表条目。

安装位置：`%LOCALAPPDATA%\PromptImageManager\`

用户数据位置：安装版默认使用 `%APPDATA%\PromptImageManager\data\`，不随普通卸载删除。旧版本曾写入安装目录的 `data\` 会在新版本启动时复制迁移；安装器壳开始安装前还会把旧安装目录数据和用户级数据复制到 `%APPDATA%\PromptImageManager\update-backups\`。

### 4.2 便携文件夹

```
build/dist/PromptImageManager/
├── PromptImageManager.exe      # 主程序（双击运行）
├── icon.ico                    # 应用图标
├── app.log                     # 运行日志（启动后自动生成）
├── _internal/
│   ├── frontend/               # 前端文件
│   │   ├── index.html
│   │   └── assets/
│   └── ...                     # Python 运行时依赖
```

整个文件夹可复制到任意位置运行，无需安装。

安装版的提示词、分类、图片和备份不再以安装目录为主存储位置；真实目录以 `app.log` 中的 `DATA_DIR=` 和设置页“本地存储”区域展示为准。

---

## 五、关键配置文件

| 文件 | 作用 |
|------|------|
| `build/app_main.py` | PC 独立版主程序：Python HTTP 服务器 + pywebview 桌面窗口 + 全部 API 逻辑 + 安装版用户级数据目录和旧数据迁移 |
| `build/app.spec` | PyInstaller 打包配置：入口文件、前端资源打包规则、隐藏导入、图标、是否显示控制台 |
| `build/installer.nsi` | NSIS 安装包脚本：安装向导页面、快捷方式、注册表、卸载逻辑和旧安装目录数据保护（必须为无 BOM 的 UTF-8 编码） |
| `build/icon.ico` | 应用图标（同时用于 exe 和安装包） |

> **⚠️ 编码注意**：`installer.nsi` 必须使用无 BOM 的 UTF-8 编码保存。如果文件包含 UTF-8 BOM（`EF BB BF`），NSIS 会报语法错误。可用以下 PowerShell 命令转换：
> ```powershell
> $content = [System.IO.File]::ReadAllText("build\installer.nsi")
> $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
> [System.IO.File]::WriteAllText("build\installer.nsi", $content, $utf8NoBom)
> ```

---

## 六、API 路由清单

`build/app_main.py` 提供的完整 API 列表，必须与 `python/main.py` 保持同步。

### 6.1 GET 路由

| 路由 | 处理函数 | 说明 |
|------|----------|------|
| `/api/health` | 内联 | 健康检查，返回 `status`、`dataDir`、`device_name` |
| `/api/prompt-sets` | `handle_get_prompt_sets` | 提示词集合列表（含 `folderId`、`tags`、`isFavorite`、`firstImage`） |
| `/api/prompt-set/{id}` | `handle_get_prompt_set` | 单个提示词集合详情（含 `isFavorite` 默认值） |
| `/api/folders` | `handle_get_folders` | 文件夹/分类列表 |
| `/api/sync` | `handle_sync` | 同步数据（含 `folder_id`） |
| `/api/sync/images/{name}` | `handle_sync_image` | 同步图片 |
| `/api/network-info` | `handle_network_info` | 网络信息 |
| `/api/images/{name}` | `serve_image` | 通过 `/api/images/` 前缀访问图片 |
| `/images/{name}` | `serve_image` | 通过 `/images/` 前缀访问图片 |

### 6.2 POST 路由

| 路由 | 处理函数 | 说明 |
|------|----------|------|
| `/api/prompt-sets` | `handle_create_prompt_set` | 创建提示词集合（含 `folderId`、`tags`、`isFavorite` + 版本生图参数） |
| `/api/prompt-set/{id}` | `handle_update_prompt_set` | 更新提示词集合（支持 `folderId`、`tags`、`isFavorite`） |
| `/api/prompt-set/{id}/version` | `handle_add_version` | 新增版本（含生图参数字段） |
| `/api/prompt-set/{id}/delete-version` | `handle_delete_version` | 删除版本 |
| `/api/prompt-set/{id}/rename-version` | `handle_rename_version` | 重命名版本 |
| `/api/prompt-set/{id}/duplicate-version` | `handle_duplicate_version` | 复制版本 |
| `/api/prompt-set/{id}/move` | `handle_move_prompt_to_folder` | 移动提示词到文件夹 |
| `/api/prompt-set/{id}/toggle-favorite` | `handle_toggle_favorite` | 切换收藏状态 |
| `/api/folders` | `handle_create_folder` | 创建文件夹 |
| `/api/folders/reorder` | `handle_reorder_folders` | 文件夹排序 |
| `/api/folder/{id}` | `handle_update_folder` | 更新文件夹 |
| `/api/prompt-set/{id}/image` | `handle_upload_image` | 上传图片 |

### 6.3 DELETE 路由

| 路由 | 处理函数 | 说明 |
|------|----------|------|
| `/api/prompt-set/{id}` | `handle_delete_prompt_set` | 删除提示词集合 |
| `/api/folder/{id}` | `handle_delete_folder` | 删除文件夹 |

### 6.4 数据字段对照

创建提示词集合时的完整字段：

```
顶层：id, name, folderId, tags, isFavorite, createdAt, updatedAt
版本：version, prompt, negativePrompt, images, note,
      aspectRatio, stylePreset, sampler, steps, cfgScale, hrFix, model, createdAt
```

> **同步检查**：每次修改 `python/main.py` 的 API 后，必须同步更新 `build/app_main.py`，否则打包版会缺失功能。

---

## 七、运行日志与调试

### 7.1 运行日志

程序启动后会在 exe 同级目录自动生成 `app.log`，记录关键启动信息：

```
[2026-05-09T20:33:43] App starting, debug=False, frozen=True
[2026-05-09T20:33:43] FRONTEND_DIR=D:\...\_internal\frontend
[2026-05-09T20:33:43] DATA_DIR=D:\...\data
[2026-05-09T20:33:43] HAS_WEBVIEW=True
[2026-05-09T20:33:43] Server started on http://127.0.0.1:8888
[2026-05-09T20:33:43] Health check passed
[2026-05-09T20:33:43] Creating webview window with URL: http://127.0.0.1:8888
[2026-05-09T20:33:43] Calling webview.start()
```

### 7.2 调试模式

设置环境变量 `PROMPT_DEBUG=1` 启用调试模式，日志中会标记 `debug=True`。

**创建调试启动脚本**：在安装目录下创建 `start-debug.bat`：

```bat
@echo off
chcp 65001 >nul
title 生图提示词管理器 - 调试模式
set PROMPT_DEBUG=1
PromptImageManager.exe
pause
```

### 7.3 错误日志

如果 pywebview 启动失败，会在 exe 同级目录生成 `webview_error.log`，包含完整的异常堆栈。

---

## 八、版本号管理

发布新版本时，需同步修改以下文件中的版本号：

| 文件 | 字段/位置 | 示例值 |
|------|----------|--------|
| `package.json` | `"version"` | `"2.3.2"` |
| `build/installer.nsi` | `!define APPVERSION` | `"2.3.2"` |
| `build.bat` | 标题文本 | `v2.3.2` |
| `src-tauri/tauri.conf.json` | `"version"` | `"2.3.2"` |
| `src-tauri/Cargo.toml` | `version` | `"2.3.2"` |
| `android/app/build.gradle` | `versionCode` / `versionName` | `7` / `"2.3.2"` |

---

## 九、常见问题

### Q1：打包后运行闪退

检查 `build/dist/PromptImageManager/_internal/frontend/` 目录是否存在且包含 `index.html`。如果不存在，重新执行 `npx vite build` 后再打包。

也可查看 `app.log` 确认启动流程卡在哪一步。

### Q2：PyInstaller 报错 "output directory is not empty"

在命令末尾加 `-y` 参数。

### Q3：pywebview 窗口打开失败，变成浏览器打开

**最常见原因**：pywebview 6.x API 变更，`icon` 参数从 `create_window()` 移到了 `start()`。

```python
# ❌ 错误写法（pywebview 5.x）
window = webview.create_window(..., icon=icon_path)
webview.start()

# ✅ 正确写法（pywebview 6.x）
window = webview.create_window(...)
webview.start(icon=icon_path)
```

如果 `create_window()` 传入了不支持的参数，会抛出 `TypeError`。当前代码已单独捕获 `TypeError`，移除不兼容参数后自动重试。

**排查步骤**：

1. 查看安装目录下 `app.log`，确认 `HAS_WEBVIEW` 值和 `webview.start()` 是否报错
2. 如果存在 `webview_error.log`，查看具体异常信息
3. 如果 `app.log` 显示 `Fallback: opened browser`，说明 pywebview 启动失败已降级到浏览器

**其他可能原因**：
- 未安装 pythonnet：`pip install pythonnet`（pywebview 在 Windows 上依赖 pythonnet 调用 .NET WinForms）
- 未安装 WebView2 Runtime：Windows 10/11 通常已预装，旧系统需手动安装

### Q4：PyInstaller 打包报错找不到模块

在 `build/app.spec` 的 `hiddenimports` 列表中添加缺失的模块名。

### Q5：NSIS 构建报错找不到 makensis

NSIS 未安装或未加入 PATH。参考第 2.2 节安装 NSIS。也可跳过 NSIS 步骤，直接使用便携文件夹。

如果 NSIS 已安装但不在 PATH 中，可使用完整路径调用：
```powershell
& "C:\Program Files (x86)\NSIS\Bin\makensis.exe" /INPUTCHARSET UTF8 build\installer.nsi
```

### Q6：端口 8888 被占用

程序固定绑定 `127.0.0.1`，避免 `localhost` 在 IPv4/IPv6 或已有开发服务之间解析不一致。若 `127.0.0.1:8888` 被占用，程序会自动尝试其他端口（最多重试 10 次），并在 `app.log` 中记录实际使用的端口。pywebview 窗口会加载正确的端口地址。

### Q7：安装后无法新建提示词或分类

**根因**：`build/app_main.py` 与 `python/main.py` 的 API 不同步，缺失路由或数据字段。

**排查**：对比两个文件的 API 路由和数据字段，参考第六节「API 路由清单」逐一核对。

**高频缺失项**：
- 文件夹相关路由（`/api/folders`、`/api/folder/{id}`）
- 收藏功能（`/api/prompt-set/{id}/toggle-favorite`）
- 提示词字段（`folderId`、`tags`、`isFavorite`）
- 版本生图参数（`aspectRatio`、`sampler`、`steps`、`cfgScale`、`hrFix`、`model`、`stylePreset`）

---

## 十、构建流程速查图

```
    ┌──────────────────────────┐
    │     npm install          │
    │   pip install pywebview  │
    │   pip install pyinstaller│
    │   pip install pythonnet  │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │   npx vite build         │
    │   (src/ → dist/)         │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  python -m PyInstaller   │
    │  build/app.spec          │
    │  --workpath build/build  │
    │  --distpath build/dist   │
    │  --clean -y              │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  build/dist/             │
    │  PromptImageManager.exe  │
    │  + _internal/frontend/   │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  cd build                │
    │  makensis installer.nsi  │  ← 可选，需安装 NSIS
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  PromptImageManager      │
    │  -Setup-2.3.2.exe        │
    │  → 复制到 releases/      │
    └──────────────────────────┘
```
