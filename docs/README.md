# 生图提示词管理器 — 技术文档中心

> 版本：2.2.1 | 最后更新：2026-05-04

---

## 项目简介

生图提示词管理器是一款面向 AI 绘图用户的提示词管理工具，支持 PC 桌面端、Android 移动端和 Web 端三种运行环境。用户可以创建提示词集合、管理多版本提示词、上传生成图片、进行版本对比、文件夹分类、局域网同步以及数据导入导出。

---

## 架构概览

```
              ┌─────────────────────────────────────┐
              │       共享前端 (Vite + 原生 JS)       │
              │    src/index.html + js + css         │
              └──────────────┬──────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │        storage.js 抽象层      │
              │  isTauri? isCapacitor?       │
              └──────┬───────────────┬───────┘
                     │               │
        ┌────────────▼──────┐ ┌─────▼──────────────┐
        │   PC 桌面端        │ │   Android 移动端     │
        │   Tauri + Rust    │ │   Capacitor         │
        │   → Python API    │ │   → SQLite 本地      │
        │   ApiStorage      │ │   SqliteStorage      │
        └───────────────────┘ └─────────────────────┘
```

**平台检测逻辑**（[storage.js](../src/js/storage.js)）：

```javascript
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;
const isCapacitor = typeof window !== 'undefined' && window.Capacitor
                    && window.Capacitor.isNativePlatform
                    && window.Capacitor.isNativePlatform();
```

- `isCapacitor === true` → 动态加载 `SqliteStorage`
- 其他情况 → 动态加载 `ApiStorage`

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [技术文档](技术文档/README.md) | API、PC、移动端、Web 和局域网同步技术说明 |
| [设计文档](设计文档/README.md) | UI/UX 设计系统、组件规范和响应式设计 |
| [构建方案](构建方案/README.md) | PC、Android、独立安装包和平台打包流程 |
| [计划文档](计划文档/) | 版本计划、功能实施计划和优化计划 |
| [工程文档](工程文档/README.md) | 工程交接、迁移和目录职责说明 |
| [UI计划](UI计划/) | PC 与移动端页面级 UI 计划和复刻设计文档 |
| [项目开发经验](项目开发经验/) | 可复用工程规范、问题经验和跨页面实施约定 |
| [已修复问题](已修复问题/) | 问题复盘与修复记录 |
| [版本记录](版本记录/README.md) | 版本迭代历史与变更记录 |
| [版本发布与更新记录维护指南](版本发布与更新记录维护指南.md) | 汇总最新修改、迭代版本号并同步 PC 更新记录弹窗的标准流程 |
| [对话历史](对话历史/) | 重要构建与开发对话归档 |

---

## 技术栈总览

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | 原生 JavaScript (ES Module) | - |
| 构建工具 | Vite | 8.x |
| PC 桌面框架 | Tauri | 2.11.0 |
| PC 后端 | Python (http.server) | 3.9+ |
| 移动框架 | Capacitor | 8.3.1 |
| 移动数据库 | @capacitor-community/sqlite | 8.1.0 |
| 移动文件系统 | @capacitor/filesystem | 8.1.2 |
| 前端测试 | Vitest + jsdom | 4.x |
| Rust 版本 | - | 1.77.2+ |

---

## 项目目录结构

```
prompt-image-tool/
├── src/                        # 前端源码
│   ├── index.html              # 主页面
│   ├── css/
│   │   ├── main.css            # 主样式（暗/亮主题、CSS 变量体系）
│   │   └── responsive.css      # 响应式断点样式
│   ├── js/
│   │   ├── app.js              # 核心业务逻辑（1526行）
│   │   ├── storage.js          # 存储抽象层（平台检测 + 动态加载）
│   │   ├── api-storage.js      # PC/Web 端 API 存储实现
│   │   ├── sqlite-storage.js   # Android 端 SQLite 存储实现
│   │   ├── lan-sync.js         # 局域网同步逻辑
│   │   ├── tutorial.js         # 新手引导教程
│   │   └── utils.js            # 工具函数
│   └── assets/                 # 静态资源
├── python/
│   ├── main.py                 # Python HTTP 后端（638行）
│   └── tests/                  # Python 测试
├── src-tauri/                  # Tauri 桌面端
│   ├── src/lib.rs              # Rust 入口
│   ├── Cargo.toml              # Rust 依赖
│   └── icons/                  # 桌面端图标
├── android/                    # Android 移动端
│   ├── app/                    # Android 应用模块
│   └── build.gradle            # Gradle 构建
├── dist/                       # 前端构建产物
├── build/                      # PC 端打包相关（PyInstaller）
├── docs/                       # 技术文档
├── capacitor.config.ts         # Capacitor 配置
├── vite.config.js              # Vite 配置
├── package.json                # Node.js 项目配置
└── build.bat                   # 一键构建脚本
```

---

## 快速开始

### 开发模式

```bash
npm install

# 方式一：浏览器开发（两个终端）
python python/main.py          # 终端1：启动 Python 后端
npx vite                       # 终端2：启动前端开发服务器

# 方式二：Tauri 开发
npx tauri dev

# 方式三：一键脚本
build.bat → 选择 4（开发模式）
```

### 构建

```bash
# PC 桌面端
npx tauri build

# Android 端
npx vite build && npx cap sync android
cd android && ./gradlew assembleDebug

# 一键脚本
build.bat → 选择 2（PC）或 3（Android）
```
