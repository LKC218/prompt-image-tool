# 生图提示词管理器 - PC端构建流程文档

## 一、项目整体架构

```
prompt-image-tool/
├── src/                    # 前端源码（HTML + CSS + JS）
├── dist/                   # 前端构建产物（Vite 输出）
├── python/                 # Python 后端源码（开发用）
├── build/                  # PC端打包相关文件
│   ├── app_main.py         # PC独立版入口（Python服务器 + pywebview窗口）
│   ├── app.spec            # PyInstaller 打包配置
│   ├── installer.nsi       # NSIS 安装包脚本
│   └── icon.ico            # 应用图标
├── src-tauri/              # Tauri 桌面端配置
│   ├── src/lib.rs          # Tauri 入口（自动启动Python后端）
│   ├── tauri.conf.json     # Tauri 窗口和打包配置
│   └── capabilities/       # Tauri 权限配置
├── build.bat               # 一键构建脚本
└── package.json            # Node.js 项目配置
```

**核心思路**：前端 + Python后端 是固定的，PC端只是换不同的"壳"来包装它们。

---

## 二、环境准备

### 2.1 必装工具（所有方式都需要）

| 工具 | 最低版本 | 用途 | 安装方式 | 验证命令 |
|------|---------|------|---------|---------|
| **Node.js** | 18+ | 前端构建 | https://nodejs.org/ | `node --version` |
| **Python** | 3.9+ | 后端运行 | https://python.org/ | `python --version` |

### 2.2 方式A（PyInstaller）额外需要

| 工具 | 用途 | 安装方式 | 验证命令 |
|------|------|---------|---------|
| **PyInstaller** | 把Python打包成exe | `pip install pyinstaller` | `pip show pyinstaller` |
| **pywebview** | 独立桌面窗口 | `pip install pywebview` | `pip show pywebview` |
| **NSIS** | 制作安装包（可选） | 见下方 2.4 节 | `where makensis` |

### 2.3 方式B（Tauri）额外需要

| 工具 | 用途 | 安装方式 | 验证命令 |
|------|------|---------|---------|
| **Rust** | Tauri编译依赖 | https://rustup.rs/ | `cargo --version` |

### 2.4 NSIS 安装

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

## 三、两种PC端构建方式对比

| | 方式A：PyInstaller | 方式B：Tauri |
|---|---|---|
| **窗口技术** | pywebview（系统WebView） | Tauri（系统WebView） |
| **是否跳转浏览器** | 否，独立窗口 | 否，独立窗口 |
| **需要Rust** | 不需要 | 需要 |
| **打包体积** | ~26 MB（解压后） | 较小 |
| **安装包体积** | ~14 MB（NSIS压缩后） | 较小 |
| **构建速度** | 较快（~30秒） | 较慢（需编译Rust） |
| **输出格式** | exe文件夹 / NSIS安装包 | exe安装包 |
| **推荐场景** | 快速打包、无需Rust环境 | 追求专业桌面应用体验 |

---

## 四、方式A：PyInstaller 构建（推荐）

### 4.1 一键构建

```bash
build.bat
# 选择 1 → 构建 PC 安装包（PyInstaller + NSIS）
```

### 4.2 标准构建流程（手动）

> 以下流程经过实际验证，每一步都包含必要的检查和容错处理。

#### 第1步：安装依赖

```bash
pip install pyinstaller pywebview
npm install
```

验证：
```bash
pip show pyinstaller    # 确认已安装
pip show pywebview      # 确认已安装
```

#### 第2步：构建前端

```bash
npx vite build
```

验证：
```bash
dir dist\index.html    # 确认 dist/ 目录下有 index.html
```

这一步把 `src/` 下的前端代码编译到 `dist/` 目录。**如果 dist/ 不存在或为空，后续打包会失败。**

#### 第3步：打包exe

```bash
python -m PyInstaller build/app.spec --workpath build/build --distpath build/dist --clean -y
```

> **注意**：必须加 `-y` 参数，否则当输出目录已存在时会报错中断。

验证：
```bash
dir build\dist\PromptImageManager\PromptImageManager.exe
dir build\dist\PromptImageManager\_internal\frontend\index.html
```

两个文件都存在才算成功。如果 `frontend\index.html` 缺失，说明第2步的前端构建未生效，需重新执行第2步。

#### 第4步：制作NSIS安装包（可选）

```bash
cd build
makensis installer.nsi
cd ..
```

验证：
```bash
dir build\PromptImageManager-Setup-2.0.0.exe
```

> 如果系统未安装 NSIS，可跳过此步。直接使用第3步产出的 `build\dist\PromptImageManager\` 文件夹即可。

### 4.3 构建产物

**方式A-1：NSIS安装包（推荐分发）**

```
build/PromptImageManager-Setup-2.0.0.exe    # ~14 MB，带安装向导
```

安装后包含：桌面快捷方式、开始菜单、卸载程序、注册表条目。

**方式A-2：便携文件夹**

```
build/dist/PromptImageManager/
├── PromptImageManager.exe      # 主程序（双击运行）
├── _internal/
│   ├── frontend/               # 前端文件
│   │   ├── index.html
│   │   └── assets/
│   └── ...                     # Python运行时依赖
```

整个文件夹可复制到任意位置运行，无需安装。

### 4.4 关键文件说明

| 文件 | 作用 |
|------|------|
| `build/app_main.py` | PC独立版主程序：Python HTTP服务器 + pywebview桌面窗口 + 全部API逻辑 |
| `build/app.spec` | PyInstaller打包配置：入口文件、前端资源打包规则、隐藏导入、图标、是否显示控制台 |
| `build/installer.nsi` | NSIS安装包脚本：安装向导页面、快捷方式、注册表、卸载逻辑 |
| `build/icon.ico` | 应用图标（同时用于exe和安装包） |

### 4.5 版本号管理

发布新版本时，需同步修改以下文件中的版本号：

| 文件 | 当前值 | 位置 |
|------|--------|------|
| `package.json` / `package-lock.json` | `"version": "2.4.1"` | 第3行 / 第3、8行 |
| `src/index.html` | `<meta name="version" content="2.4.1">` | 第9行 |
| `build/installer.nsi` | `!define APPVERSION "2.4.1"` | 第2行 |
| `build.bat` | `v2.4.1` 与 `PromptImageManager-Setup-2.4.1.exe` | 构建标题与发布路径 |
| `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` | `2.4.1` | 主桌面端配置与锁文件 |
| `installer-shell/` 下的包、Tauri 和 Cargo 文件 | `2.4.1` | 安装器壳配置与锁文件 |
| `android/app/build.gradle` | `versionCode 15` / `versionName "2.4.1"` | 第16-17行 |

---

## 五、方式B：Tauri 构建

### 5.1 一键构建

```bash
build.bat
# 选择 2 → 构建 PC 桌面端（Tauri）
```

### 5.2 手动构建

```bash
npm install
npx tauri build
```

> 首次构建会自动下载 NSIS 和 WebView2 引导程序，需确保网络通畅。如果下载失败，参考第2.4节手动安装NSIS，并将文件放置到 `%LOCALAPPDATA%\tauri\NSIS` 目录。

### 5.3 构建产物

```
src-tauri/target/release/bundle/
└── nsis/
    └── 生图提示词管理器_2.0.0_x64-setup.exe
```

### 5.4 关键文件说明

| 文件 | 作用 |
|------|------|
| `src-tauri/src/lib.rs` | Tauri入口，启动时自动寻找并运行Python后端 |
| `src-tauri/tauri.conf.json` | Tauri配置：窗口大小、打包格式、资源包含、图标等 |
| `src-tauri/capabilities/default.json` | 权限配置：允许shell操作等 |

---

## 六、开发模式

### 6.1 浏览器开发模式（两个终端）

```bash
# 终端1：启动Python后端
python python/main.py

# 终端2：启动前端开发服务器
npx vite
```

访问 http://localhost:5173，前端请求会自动代理到后端 8888 端口。

### 6.2 Tauri开发模式（一个终端）

```bash
npx tauri dev
```

Tauri会自动启动前端开发服务器和Python后端。

---

## 七、常见问题

### Q1：打包后运行闪退

检查 `build/dist/PromptImageManager/_internal/frontend/` 目录是否存在且包含 `index.html`。如果不存在，说明前端没有正确打包，重新执行 `npx vite build` 后再打包。

### Q2：PyInstaller 报错 "output directory is not empty"

在命令末尾加 `-y` 参数：

```bash
python -m PyInstaller build/app.spec --workpath build/build --distpath build/dist --clean -y
```

### Q3：pywebview 窗口打开失败

确保安装了 pywebview：`pip install pywebview`。如果pywebview不可用，程序会自动降级为浏览器模式打开。

### Q4：PyInstaller 打包报错找不到模块

在 `build/app.spec` 的 `hiddenimports` 列表中添加缺失的模块名。

### Q5：NSIS 构建报错找不到 makensis

NSIS 未安装或未加入 PATH。参考第2.4节安装NSIS。也可跳过NSIS步骤，直接使用便携文件夹。

### Q6：Tauri 构建报错找不到 Rust

安装 Rust：https://rustup.rs/，安装后重启终端。

### Q7：Tauri 构建报 TLS 证书错误

网络问题导致自动下载NSIS失败。参考第2.4节手动安装NSIS到 `%LOCALAPPDATA%\tauri\NSIS`。

### Q8：端口 8888 被占用

关闭占用端口的程序，或修改 `build/app_main.py` 和 `python/main.py` 中的 `port = 8888` 为其他端口。

---

## 八、构建流程速查图

```
                    ┌──────────────────────────┐
                    │     npm install          │
                    │   pip install pywebview  │
                    │   pip install pyinstaller│
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │   npx vite build         │
                    │   (src/ → dist/)         │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │                          │
           ┌───────▼───────┐         ┌────────▼────────┐
           │  方式A         │         │  方式B           │
           │  PyInstaller   │         │  Tauri           │
           │               │         │                  │
           │ python -m     │         │ npx tauri build  │
           │ PyInstaller   │         │                  │
           │ app.spec      │         │                  │
           │ --clean -y    │         │                  │
           └───────┬───────┘         └────────┬────────┘
                   │                          │
           ┌───────▼───────┐         ┌────────▼────────┐
           │ build/dist/   │         │ src-tauri/      │
           │ PromptImage   │         │ target/release/ │
           │ Manager.exe   │         │ bundle/nsis/    │
           └───────┬───────┘         └─────────────────┘
                   │
           ┌───────▼───────┐
           │  makensis     │  ← 可选，需安装NSIS
           │  installer.nsi│
           └───────┬───────┘
                   │
           ┌───────▼───────┐
           │ PromptImage   │
           │ Manager-Setup │
           │ -2.0.0.exe    │
           └───────────────┘
```
