# 生图提示词管理器

面向 AI 绘图工作流的提示词管理工具，包含 Web、PC 桌面端和 Android 移动端工程。

## 快速开始

```powershell
npm install
npm run dev
```

Python 后端开发：

```powershell
pip install -r requirements.txt
python python\main.py
```

PC 独立安装包构建：

```powershell
python scripts\build_pc_package.py
```

Android 安装包构建：

```powershell
python scripts\build_android_package.py
```

PC 与 Android 发布包一键构建：

```powershell
python scripts\build_release_packages.py
```

## 目录说明

- `src/`：前端源码、样式、交互脚本和运行时资源。
- `python/`：Python 后端与测试；`python/data/` 为本地运行时数据目录，仅保留占位文件。
- `src-tauri/`：Tauri 桌面端工程。
- `android/`：Capacitor Android 原生工程。
- `build/`：PC 打包入口、配置和中间产物目录。
- `scripts/`：专项维护脚本。
- `docs/`：项目文档中心。
- `releases/`：发布产物落点，仅保留占位文件，安装包不进入 Git。

## 仓库规范

- 源码、配置、文档和必要静态资源进入 Git。
- 安装包、构建缓存、运行时数据、备份文件和本地私有配置不进入 Git。
- 发布安装包请使用 GitHub Releases 或本地构建产物目录，不直接提交到仓库历史。

更多文档见 `docs/README.md` 与 `docs/apps-code-map.md`。
