# 生图提示词管理器 - Android 安装包构建方案

> 适用版本：v2.3.1+  
> 构建方案：Capacitor 8.x + Gradle  
> 最后更新：2026-05-05

---

## 一、架构概览

```
┌─────────────────────────────────────────────────────┐
│               Android 安装包架构                      │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │           Capacitor WebView 容器               │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │         前端 SPA (Vite 构建)              │  │  │
│  │  │       index.html + JS/CSS/Assets         │  │  │
│  │  └─────────────┬───────────────────────────┘  │  │
│  │                │                               │  │
│  │                ▼                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │    Capacitor 插件层                       │  │  │
│  │  │  ┌─────────────────────────────────┐    │  │  │
│  │  │  │ @capacitor-community/sqlite     │    │  │  │
│  │  │  │ 本地 SQLite 数据库存储           │    │  │  │
│  │  │  └─────────────────────────────────┘    │  │  │
│  │  │  ┌─────────────────────────────────┐    │  │  │
│  │  │  │ @capacitor/filesystem           │    │  │  │
│  │  │  │ 图片文件读写                     │    │  │  │
│  │  │  └─────────────────────────────────┘    │  │  │
│  │  │  ┌─────────────────────────────────┐    │  │  │
│  │  │  │ @capacitor/camera               │    │  │  │
│  │  │  │ 相机访问                         │    │  │  │
│  │  │  └─────────────────────────────────┘    │  │  │
│  │  │  ┌─────────────────────────────────┐    │  │  │
│  │  │  │ @capacitor/network              │    │  │  │
│  │  │  │ 网络状态检测                     │    │  │  │
│  │  │  └─────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ⚠️ Android 端不依赖 Python 后端                     │
│     存储层使用 SqliteStorage（非 ApiStorage）         │
└─────────────────────────────────────────────────────┘
```

**核心设计**：Android 端采用**存储策略模式**，通过 `storage.js` 抽象层在运行时自动选择 `SqliteStorage`（Android）或 `ApiStorage`（PC），无需 Python 后端。

---

## 二、环境准备

### 2.1 必装工具

| 工具 | 最低版本 | 用途 | 安装方式 | 验证命令 |
|------|---------|------|---------|---------|
| **Node.js** | 18+ | 前端构建 | https://nodejs.org/ | `node --version` |
| **JDK** | 17 | Android 编译 | https://adoptium.net/ | `java -version` |
| **Android SDK** | API 36 | Android 构建 | Android Studio 或 cmdline-tools | `adb version` |

### 2.2 环境变量

```
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17...
ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
Path+=...%ANDROID_HOME%\platform-tools
```

### 2.3 Java 版本兼容性

项目使用 Gradle 8.13 + AGP，需要 JDK 17。如果系统安装的是 JDK 21，需运行修补脚本：

```bash
powershell -ExecutionPolicy Bypass -File patch-java-version.ps1
```

此脚本会将 `capacitor.build.gradle` 和 `capacitor-cordova-android-plugins/build.gradle` 中的 Java 21 降级为 Java 17。

> **重要**：此脚本必须在 `cap sync android` 之后执行，因为 sync 会重新生成这些文件。

---

## 三、构建流程

### 3.1 一键构建

推荐使用非交互脚本：

```bash
python scripts\build_android_package.py
```

脚本会自动检查版本一致性、签名配置、前端产物、Capacitor 同步结果和 APK 输出，并将正式签名包复制到 `releases/`。

也可以使用批处理菜单：

```bash
build.bat
# 选择 3 → 构建 Android 端（Capacitor）
```

### 3.2 手动构建（5 步）

#### 第1步：构建前端

```bash
npx vite build
```

验证：
```bash
dir dist\index.html
```

#### 第2步：同步到 Capacitor

```bash
npx cap sync android
```

此步骤将 `dist/` 目录下的前端文件复制到 `android/app/src/main/assets/public/`，并更新 Capacitor 插件配置。

验证输出包含：
```
✔ Copying web assets from dist to android\app\src\main\assets\public
✔ update android in xxxms
✔ Sync finished in xxxs
```

#### 第3步：修补 Java 版本兼容性

```bash
powershell -ExecutionPolicy Bypass -File patch-java-version.ps1
```

验证输出：
```
Patched: android\app\capacitor.build.gradle
Patched: android\capacitor-cordova-android-plugins\build.gradle
Java version patch complete (21 -> 17)
```

#### 第4步：构建 Release APK

```bash
cd android
gradlew assembleRelease
cd ..
```

验证：
```bash
dir android\app\build\outputs\apk\release\app-release.apk
```

> 如果输出的是 `app-release-unsigned.apk`，说明签名配置有问题，检查 `keystore.properties`。

#### 第5步：复制到发布目录

```bash
copy android\app\build\outputs\apk\release\app-release.apk releases\PromptImageManager-v2.3.1-Android.apk
```

非交互脚本会自动执行复制。若只生成 `app-release-unsigned.apk`，默认会中断；临时验证可使用：

```bash
python scripts\build_android_package.py --allow-unsigned
```

---

## 四、签名配置

### 4.1 签名文件

| 文件 | 位置 | 说明 |
|------|------|------|
| 密钥库 | `android/prompt-image-manager.keystore` | Release 签名密钥 |
| 配置 | `android/keystore.properties` | 签名参数 |

### 4.2 keystore.properties 格式

```properties
storeFile=prompt-image-manager.keystore
storePassword=<密码>
keyAlias=<别名>
keyPassword=<密钥密码>
```

### 4.3 build.gradle 签名配置

`android/app/build.gradle` 中的签名逻辑：

```groovy
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
}
```

### 4.4 创建新密钥库（如需重新生成）

```bash
keytool -genkey -v -keystore prompt-image-manager.keystore -alias <别名> -keyalg RSA -keysize 2048 -validity 10000
```

---

## 五、构建产物

```
android/app/build/outputs/apk/release/
├── app-release.apk              # 签名 Release APK（~26 MB）
└── output-metadata.json         # 构建元数据

releases/
└── PromptImageManager-v2.3.1-Android.apk   # 发布用副本
```

### APK 信息

| 属性 | 值 |
|------|-----|
| applicationId | `com.promptimagemanager.app` |
| minSdkVersion | 24 (Android 7.0) |
| targetSdkVersion | 36 |
| versionCode | 6 |
| versionName | `2.3.1` |

2026-05-10 使用 `scripts/build_android_package.py` 构建的发布副本：

```text
releases/PromptImageManager-v2.3.1-Android.apk
```

APK 大小：`45025277` 字节。签名校验通过 APK Signature Scheme v2，签名者数量为 `1`。

---

## 六、关键配置文件

| 文件 | 作用 |
|------|------|
| `capacitor.config.ts` | Capacitor 配置：appId、webDir、SQLite 插件参数 |
| `android/app/build.gradle` | Android 构建配置：SDK 版本、签名、依赖 |
| `android/variables.gradle` | SDK 版本变量定义 |
| `android/keystore.properties` | 签名密钥参数（不入库） |
| `patch-java-version.ps1` | Java 版本兼容性修补脚本 |
| `src/js/sqlite-storage.js` | Android 端存储实现（SQLite） |
| `src/js/storage.js` | 存储抽象层（策略模式入口） |

---

## 七、版本号管理

发布新版本时，需同步修改以下文件：

| 文件 | 字段 | 示例值 |
|------|------|--------|
| `package.json` | `"version"` | `"2.3.1"` |
| `android/app/build.gradle` | `versionCode` | `6`（每次 +1） |
| `android/app/build.gradle` | `versionName` | `"2.3.1"` |
| `capacitor.config.ts` | `appName` | 无版本号，但需确认 |

> `versionCode` 必须为整数且每次发布递增，Google Play 用此值判断 APK 新旧。

---

## 八、存储策略模式详解

```
┌─────────────────────────────────┐
│          storage.js             │
│       (存储抽象层入口)            │
│                                 │
│  运行时检测平台：                 │
│  ┌─────────────┐ ┌────────────┐│
│  │  PC 环境     │ │ Android 环境 ││
│  │  → ApiStorage│ │→SqliteStorage│
│  │  (HTTP API) │ │ (SQLite DB) ││
│  └─────────────┘ └────────────┘│
└─────────────────────────────────┘
```

- **ApiStorage**：通过 HTTP API (`/api/*`) 与 Python 后端通信，数据存储为 JSON 文件
- **SqliteStorage**：直接操作 Capacitor SQLite 插件，数据存储在本地 SQLite 数据库

Android 端**不依赖 Python 后端**，是纯前端 + WebView 的架构。

---

## 九、常见问题

### Q1：gradlew 报错 "Unsupported class file major version 65"

JDK 版本过高（JDK 21）。运行 `patch-java-version.ps1` 降级为 Java 17，或设置 `JAVA_HOME` 指向 JDK 17。

### Q2：APK 构建成功但未签名

检查 `android/keystore.properties` 文件是否存在且配置正确。确保 `storeFile` 指向的 `.keystore` 文件存在于 `android/` 目录下。

### Q3：cap sync 后前端未更新

确认 `dist/` 目录包含最新构建的前端文件。执行 `npx vite build` 后再 `npx cap sync android`。

### Q4：Android Studio 打开项目报错

确保 Gradle 版本与 AGP 版本匹配。项目使用 Gradle 8.13 + AGP 8.13.0。

### Q5：安装 APK 后闪退

检查 `logcat` 日志。常见原因：
- SQLite 插件初始化失败
- 前端资源未正确同步
- `capacitor.config.json` 配置错误

### Q6：patch-java-version.ps1 执行后仍报 Java 版本错误

确保在 `cap sync` 之后执行修补脚本。`cap sync` 会重新生成 `capacitor.build.gradle`，覆盖之前的修补。

---

## 十、构建流程速查图

```
    ┌──────────────────────────┐
    │     npm install          │
    │     npx vite build       │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │   npx cap sync android   │
    │   (dist/ → android/      │
    │    assets/public/)       │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  patch-java-version.ps1  │
    │  (Java 21 → 17)          │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  cd android              │
    │  gradlew assembleRelease │
    │  cd ..                   │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  app-release.apk         │
    │  (~26 MB, 已签名)         │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │  复制到 releases/        │
    │  PromptImageManager      │
    │  -v2.3.1-Android.apk     │
    └──────────────────────────┘
```
