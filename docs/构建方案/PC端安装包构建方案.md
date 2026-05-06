# 生图提示词管理器 - PC端安装包构建方案

> 适用版本：v2.3.1+  
> 构建方案：PyInstaller + NSIS  
> 最后更新：2026-05-05

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
dir build\PromptImageManager-Setup-2.3.1.exe
```

> 如果系统未安装 NSIS，可跳过此步。直接使用第3步产出的 `build\dist\PromptImageManager\` 文件夹即可。

---

## 四、构建产物

### 4.1 NSIS 安装包（推荐分发）

```
build/PromptImageManager-Setup-2.3.1.exe    # ~15 MB，带安装向导
```

安装后包含：桌面快捷方式、开始菜单、卸载程序、注册表条目。

安装位置：`%LOCALAPPDATA%\PromptImageManager\`

### 4.2 便携文件夹

```
build/dist/PromptImageManager/
├── PromptImageManager.exe      # 主程序（双击运行）
├── _internal/
│   ├── frontend/               # 前端文件
│   │   ├── index.html
│   │   └── assets/
│   └── ...                     # Python 运行时依赖
```

整个文件夹可复制到任意位置运行，无需安装。

---

## 五、关键配置文件

| 文件 | 作用 |
|------|------|
| `build/app_main.py` | PC 独立版主程序：Python HTTP 服务器 + pywebview 桌面窗口 + 全部 API 逻辑 |
| `build/app.spec` | PyInstaller 打包配置：入口文件、前端资源打包规则、隐藏导入、图标、是否显示控制台 |
| `build/installer.nsi` | NSIS 安装包脚本：安装向导页面、快捷方式、注册表、卸载逻辑（必须为无 BOM 的 UTF-8 编码） |
| `build/icon.ico` | 应用图标（同时用于 exe 和安装包） |

> **⚠️ 编码注意**：`installer.nsi` 必须使用无 BOM 的 UTF-8 编码保存。如果文件包含 UTF-8 BOM（`EF BB BF`），NSIS 会报语法错误。可用以下 PowerShell 命令转换：
> ```powershell
> $content = [System.IO.File]::ReadAllText("build\installer.nsi")
> $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
> [System.IO.File]::WriteAllText("build\installer.nsi", $content, $utf8NoBom)
> ```

---

## 六、版本号管理

发布新版本时，需同步修改以下文件中的版本号：

| 文件 | 字段/位置 | 示例值 |
|------|----------|--------|
| `package.json` | `"version"` | `"2.3.1"` |
| `build/installer.nsi` | `!define APPVERSION` | `"2.3.1"` |
| `build.bat` | 标题文本 | `v2.3.1` |
| `src-tauri/tauri.conf.json` | `"version"` | `"2.3.1"` |
| `src-tauri/Cargo.toml` | `version` | `"2.3.1"` |
| `android/app/build.gradle` | `versionCode` / `versionName` | `6` / `"2.3.1"` |

---

## 七、常见问题

### Q1：打包后运行闪退

检查 `build/dist/PromptImageManager/_internal/frontend/` 目录是否存在且包含 `index.html`。如果不存在，重新执行 `npx vite build` 后再打包。

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

如果 `create_window()` 传入了不支持的参数，会抛出 `TypeError`，被 `except Exception` 捕获后静默降级为浏览器打开。

**排查方法**：检查打包目录下是否存在 `webview_error.log` 文件，如果有则说明 pywebview 启动失败，日志中包含具体错误信息。

**其他可能原因**：
- 未安装 pythonnet：`pip install pythonnet`（pywebview 在 Windows 上依赖 pythonnet 调用 .NET WinForms）
- 未安装 WebView2 Runtime：Windows 10/11 通常已预装，旧系统需手动安装

### Q4：PyInstaller 打包报错找不到模块

在 `build/app.spec` 的 `hiddenimports` 列表中添加缺失的模块名。

### Q5：NSIS 构建报错找不到 makensis

NSIS 未安装或未加入 PATH。参考第 2.2 节安装 NSIS。也可跳过 NSIS 步骤，直接使用便携文件夹。

### Q6：端口 8888 被占用

程序会自动尝试其他端口（最多重试 10 次）。如需手动指定，修改 `build/app_main.py` 中的 `port = 8888`。

---

## 八、构建流程速查图

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
    │  -Setup-2.3.1.exe        │
    └──────────────────────────┘
```
