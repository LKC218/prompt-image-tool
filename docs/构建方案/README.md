# 生图提示词管理器 - 构建方案总览

> 适用版本：v2.3.1+  
> 最后更新：2026-05-05

---

## 一、项目技术栈

| 层次 | 技术 |
|------|------|
| **前端** | Vite 8.x + 原生 JavaScript (ES Module) + 原生 CSS |
| **前端测试** | Vitest 4.x + jsdom |
| **PC 桌面壳** | PyInstaller + pywebview 6.x (方案A，推荐) |
| **PC 安装包** | NSIS |
| **Python 后端** | 原生 `http.server` + `socketserver` (端口 8888) |
| **Android 壳** | Capacitor 8.x (WebView) |
| **Android 存储** | @capacitor-community/sqlite |
| **Android 构建** | Gradle 8.13 + AGP 8.13 |

---

## 二、双平台构建一览

| 维度 | PC 端 | Android 端 |
|------|-------|-----------|
| **构建方案** | PyInstaller + NSIS | Capacitor + Gradle |
| **后端依赖** | Python HTTP Server (内嵌) | 无（SQLite 本地存储） |
| **存储方式** | ApiStorage (HTTP API → JSON) | SqliteStorage (SQLite DB) |
| **输出格式** | `.exe` 安装包 | `.apk` 安装包 |
| **输出大小** | ~15 MB | ~26 MB |
| **签名** | 不需要 | 需要 keystore 签名 |
| **详细文档** | [PC端安装包构建方案](./PC端安装包构建方案.md) | [Android安装包构建方案](./Android安装包构建方案.md) |

---

## 三、完整构建流程（PC + Android）

### 3.1 环境准备

```bash
# 通用
npm install

# PC 端
pip install pyinstaller pywebview pythonnet

# Android 端（需 JDK 17 + Android SDK）
# 确保 JAVA_HOME 指向 JDK 17
```

### 3.2 构建前端（共用）

```bash
npx vite build
```

### 3.3 构建 PC 安装包

```bash
# PyInstaller 打包
python -m PyInstaller build\app.spec --workpath build\build --distpath build\dist --clean -y

# NSIS 安装包
cd build
makensis installer.nsi
cd ..

# 复制到发布目录
copy build\PromptImageManager-Setup-2.3.1.exe releases\
```

### 3.4 构建 Android APK

```bash
# 同步前端到 Capacitor
npx cap sync android

# 修补 Java 版本
powershell -ExecutionPolicy Bypass -File patch-java-version.ps1

# 构建 Release APK
cd android
gradlew assembleRelease
cd ..

# 复制到发布目录
copy android\app\build\outputs\apk\release\app-release.apk releases\PromptImageManager-v2.3.1-Android.apk
```

### 3.5 一键构建（全部）

```bash
build.bat
# 依次选择 1（PC）和 3（Android）
```

---

## 四、版本号管理

发布新版本时，需同步修改以下 6 个文件：

| 文件 | 字段/位置 | 示例值 |
|------|----------|--------|
| `package.json` | `"version"` | `"2.3.1"` |
| `build/installer.nsi` | `!define APPVERSION` | `"2.3.1"` |
| `build.bat` | 标题文本 | `v2.3.1` |
| `src-tauri/tauri.conf.json` | `"version"` | `"2.3.1"` |
| `src-tauri/Cargo.toml` | `version` | `"2.3.1"` |
| `android/app/build.gradle` | `versionCode` / `versionName` | `6` / `"2.3.1"` |

> `versionCode` 必须为整数且每次发布递增。

---

## 五、发布产物

```
releases/
├── PromptImageManager-Setup-2.3.1.exe        # PC 安装包 (~15 MB)
└── PromptImageManager-v2.3.1-Android.apk     # Android APK (~26 MB)
```

---

## 六、构建流程总图

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
                ┌────────────────┴────────────────┐
                │                                 │
       ┌────────▼────────┐              ┌────────▼────────┐
       │   PC 端构建      │              │  Android 端构建  │
       │                 │              │                 │
       │ PyInstaller     │              │ cap sync        │
       │ + NSIS          │              │ + Java patch    │
       │                 │              │ + Gradle        │
       └────────┬────────┘              └────────┬────────┘
                │                                 │
       ┌────────▼────────┐              ┌────────▼────────┐
       │ Setup-2.3.1.exe │              │ v2.3.1-Android  │
       │ (~15 MB)        │              │ .apk (~26 MB)   │
       └─────────────────┘              └─────────────────┘
```

---

## 七、相关文档

| 文档 | 说明 |
|------|------|
| [PC端安装包构建方案](./PC端安装包构建方案.md) | PC 端 PyInstaller + NSIS 详细构建流程 |
| [Android安装包构建方案](./Android安装包构建方案.md) | Android 端 Capacitor + Gradle 详细构建流程 |
| [../PC端构建流程.md](../PC端构建流程.md) | PC 端构建流程（含 Tauri 方案） |
| [../mobile-technical-doc.md](../mobile-technical-doc.md) | 移动端技术文档 |
| [../pc-technical-doc.md](../pc-technical-doc.md) | PC 端技术文档 |
