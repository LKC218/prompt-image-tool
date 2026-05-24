# 生图提示词管理器 — 移动端技术文档

> 版本：2.2.1 | 最后更新：2026-05-04

---

## 一、概述

Android 移动端基于 **Capacitor 8.x** 封装，使用 **SQLite** 本地数据库存储结构化数据，**Filesystem** 插件管理图片文件，无需后端服务即可离线使用。前端通过 `SqliteStorage` 类直接操作本地数据库和文件系统。

### 核心架构

```
┌────────────────────────────────────────────────────┐
│              Android 应用 (Capacitor)               │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │          前端 (index.html + app.js)           │  │
│  │             ↓ SqliteStorage                   │  │
│  └──────────┬───────────────────┬───────────────┘  │
│             │                   │                   │
│  ┌──────────▼────────┐ ┌───────▼──────────────┐   │
│  │  SQLite 数据库     │ │  Filesystem 文件系统  │   │
│  │  (结构化数据)      │ │  (图片文件存储)       │   │
│  └───────────────────┘ └──────────────────────┘   │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  LanSync (局域网同步)                         │  │
│  │  Android 客户端 → PC 服务端 (HTTP)            │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

---

## 二、技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 移动框架 | Capacitor | 8.3.1 | Web → Native 桥接 |
| 数据库 | @capacitor-community/sqlite | 8.1.0 | 本地 SQLite 数据库 |
| 文件存储 | @capacitor/filesystem | 8.1.2 | 本地文件读写 |
| 前端渲染 | Android WebView | - | 系统内置 |
| 构建工具 | Gradle | 8.14.3 | Android 构建系统 |
| 前端构建 | Vite | 8.x | 开发服务器 + 生产构建 |

---

## 二点一、移动端图标资源约定

移动端 UI 控件不使用 Emoji、单字符箭头、星号、省略号、叉号、加号或 CSS `content` 字符充当图标。页面统一通过 [mobile-icon-assets.js](../../src/js/mobile-icon-assets.js) 引入本地图标，并由 `mobileIcon()` 输出稳定尺寸的本地 SVG 图片。

- 通用图标优先复用 [src/assets/icons](../../src/assets/icons) 中已有的 Lucide 本地化资源。
- 移动端缺口图标放在 [src/assets/icons/mobile](../../src/assets/icons/mobile)，用于返回、展开收起、关闭、收藏、加载、全屏预览、文件、刷新和剪贴板等操作。
- 每个 `mobileIcon()` 输出都会附带 `m-svg-icon-{语义名}` 类，图标颜色集中在 [mobile.css](../../src/css/mobile.css) 中维护；普通按钮按语义色显示，彩色底按钮按上下文覆盖为白色图标。
- 图标按钮必须保留 `aria-label`，纯装饰图标默认 `aria-hidden="true"`。
- iconfont 只能作为素材补充来源，必须下载 SVG 到本地、确认授权并记录来源，不接入在线字体、远程脚本或 CDN。

---

## 三、Capacitor 配置

[capacitor.config.ts](../../capacitor.config.ts) 关键配置：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `appId` | `com.promptimagemanager.app` | 应用唯一标识 |
| `appName` | `生图提示词管理器` | 应用显示名称 |
| `webDir` | `dist` | 前端构建产物目录 |
| `server.androidScheme` | `https` | Android URL Scheme |
| `android.allowMixedContent` | `true` | 允许 HTTPS WebView 页面访问局域网 HTTP 同步服务 |
| `SplashScreen.launchShowDuration` | `0` | 启动画面不显示 |
| `CapacitorSQLite.iosIsEncryption` | `false` | SQLite 不加密 |
| `CapacitorSQLite.androidIsEncryption` | `false` | SQLite 不加密 |

---

## 四、Android 配置

### 4.1 构建配置（build.gradle）

| 配置项 | 值 |
|--------|-----|
| `namespace` | `com.promptimagemanager.app` |
| `applicationId` | `com.promptimagemanager.app` |
| `compileSdkVersion` | 36 |
| `minSdkVersion` | 24 (Android 7.0) |
| `targetSdkVersion` | 36 |
| `versionCode` | 4 |
| `versionName` | 2.2.1 |

### 4.2 权限声明（AndroidManifest.xml）

| 权限 | 用途 | 说明 |
|------|------|------|
| `INTERNET` | 网络访问 | 局域网同步、预留网络功能 |
| `READ_EXTERNAL_STORAGE` | 读取外部存储 | 读取存储中的图片 |
| `WRITE_EXTERNAL_STORAGE` (maxSdkVersion=28) | 写入外部存储 | Android 9 及以下写入 |
| `READ_MEDIA_IMAGES` | 读取媒体图片 | Android 13+ 细粒度媒体权限 |

应用同时启用 `android:usesCleartextTraffic="true"`，用于允许 Android 9+ 访问 PC 端局域网 HTTP 同步服务。当前 PC 同步服务运行在 `http://{PC_IP}:8888`，因此 Android WebView 还需要配合 `android.allowMixedContent=true`，避免 `https://localhost/` 页面请求 HTTP 接口时被 Mixed Content 策略拦截。

### 4.3 Activity 配置

- `MainActivity` — 主 Activity，`singleTask` 启动模式
- 支持配置变更（`configChanges`）避免 Activity 重建
- `FileProvider` — 文件分享提供者

---

## 五、SQLite 数据库设计

### 5.1 表结构

#### folders（文件夹）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | 文件夹唯一标识 |
| name | TEXT | NOT NULL | 文件夹名称 |
| color | TEXT | DEFAULT '' | 颜色标签（如 `#FF6B6B`） |
| sort_order | INTEGER | DEFAULT 0 | 排序序号 |
| created_at | TEXT | NOT NULL | 创建时间（ISO8601） |
| updated_at | TEXT | NOT NULL | 更新时间（ISO8601） |

#### prompt_sets（提示词集合）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | 集合唯一标识 |
| name | TEXT | NOT NULL | 集合名称 |
| folder_id | TEXT | DEFAULT NULL | 所属文件夹 ID |
| created_at | TEXT | NOT NULL | 创建时间（ISO8601） |
| updated_at | TEXT | NOT NULL | 更新时间（ISO8601） |

#### versions（版本）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | 版本唯一标识 |
| prompt_set_id | TEXT | NOT NULL, FK | 所属集合 ID |
| version | TEXT | NOT NULL | 版本名称（如 v1） |
| prompt | TEXT | DEFAULT '' | 正向提示词 |
| negative_prompt | TEXT | DEFAULT '' | 反向提示词 |
| note | TEXT | DEFAULT '' | 版本备注 |
| sort_order | INTEGER | DEFAULT 0 | 排序序号 |
| created_at | TEXT | NOT NULL | 创建时间 |

#### images（图片）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | 图片唯一标识 |
| version_id | TEXT | NOT NULL, FK | 所属版本 ID |
| name | TEXT | DEFAULT '' | 原始文件名 |
| path | TEXT | DEFAULT '' | 显示路径 |
| file | TEXT | DEFAULT '' | 存储文件名 |
| note | TEXT | DEFAULT '' | 图片备注 |
| created_at | TEXT | NOT NULL | 创建时间 |

### 5.2 外键关系

```
folders ←──(folder_id)── prompt_sets
prompt_sets ←──(prompt_set_id)── versions ←──(version_id)── images
    ON DELETE CASCADE                    ON DELETE CASCADE
```

### 5.3 数据库迁移

`SqliteStorage.init()` 中包含迁移逻辑：

- 检测 `prompt_sets` 表是否缺少 `folder_id` 列
- 若缺少则执行 `ALTER TABLE prompt_sets ADD COLUMN folder_id TEXT DEFAULT NULL`
- 检测 `folders` 表是否存在，不存在则创建

---

## 六、图片文件存储

### 6.1 存储配置

| 配置项 | 值 |
|--------|-----|
| 存储位置 | `Directory.Data/images/` |
| 文件命名 | `{imageId}.{ext}`（如 `m1a2b3c.png`） |
| 支持格式 | PNG、JPG、WEBP |

### 6.2 图片操作流程

| 操作 | 实现方式 |
|------|---------|
| 上传 | `Filesystem.writeFile()` 写入 Data URL |
| 读取 | `Filesystem.getUri()` → `Capacitor.convertFileSrc()` 转换为可访问 URL |
| 删除 | `Filesystem.deleteFile()` 删除文件 + 数据库记录 |
| 复制 | `Filesystem.copy()` 复制图片文件（版本复制时） |

### 6.3 导入压缩策略

移动端编辑器导入图片时复用 `src/js/image-utils.js`，但参数更保守：

- 支持 JPG、PNG、WebP，单张源文件上限为 10MB，单版本最多 10 张。
- 使用 Canvas 输出 JPEG，质量参数为 `0.86`。
- 最大边长限制为 `2048px`，最大输入像素为 `2400 万`，降低 Android WebView 解码和绘制压力。
- 当未缩放且 JPEG 结果不小于原图时保留原始 Data URL，避免 PNG/WebP 反向增大。
- 图片元数据中的 `file` 字段以 `uploadImage()` 返回值为准，保证 SQLite 记录与 `Directory.Data/images/` 实际文件一致。

### 6.4 提示词长度限制

移动端新建/编辑页的提示词长度限制由 `src/js/mobile-editor.js` 前端常量维护：

- 正向提示词：`MAX_POSITIVE_PROMPT_LEN = 6666`，用于 `maxlength`、字数统计、全屏预览底部计数和超限样式。
- 负向提示词：`MAX_NEGATIVE_PROMPT_LEN = 2000`，继续保持原有输入上限。
- SQLite 表结构不变，仍写入 `versions.prompt` 和 `versions.negative_prompt` 字段。

### 6.5 图片 URL 转换

`getImageUrl(img)` 方法的关键逻辑：

```javascript
async getImageUrl(img) {
    try {
        const result = await Filesystem.getUri({
            path: `images/${img.file}`,
            directory: Directory.Data
        });
        return Capacitor.convertFileSrc(result.uri);
        // 将 content:// URI 转换为 https://localhost/_capacitor_file_/ 格式
    } catch (e) {
        return img.data || '';  // fallback 到 Base64 DataURL
    }
}
```

### 6.6 prompt-image-tool 专用 JSON 导入联动

移动端设置页同样会先检查导入 JSON 的 `schema`。若命中 `prompt-image-tool.import.v1`，则不走完整备份恢复，而是复用 `src/js/prompt-tool-json-import.js` 临时暂存 payload 后跳转到 `/editor/`。

- 普通备份 JSON 继续走 `getStorage().importData(data)`。
- 专用 JSON 会分流到 `navigate('/editor/', { importId })`。
- 移动端编辑页会在创建模式下回填标题、正向提示词、负向提示词、标签、比例和参考图片。
- 图片仍会复用现有导入压缩流程，最终保存到 SQLite 与 Filesystem。

---

## 七、前端存储层（SqliteStorage）

[sqlite-storage.js](../../src/js/sqlite-storage.js) 实现了 `SqliteStorage` 类，通过 Capacitor SQLite 插件操作本地数据库。

### 7.1 初始化

```javascript
async init() {
    // 1. 创建/打开 SQLite 数据库
    // 2. 执行 CREATE TABLE IF NOT EXISTS 创建表结构
    // 3. 执行数据库迁移（添加 folder_id 列等）
}
```

### 7.2 方法列表

| 方法 | 数据库操作 | 功能 |
|------|-----------|------|
| `init()` | CREATE TABLE + 迁移 | 初始化数据库和表结构 |
| `query(sql, values)` | SELECT | 通用查询方法 |
| `run(sql, values)` | INSERT/UPDATE/DELETE | 通用执行方法 |
| `generateId()` | - | 生成唯一 ID（时间戳 36 进制 + 随机数） |
| `getFolders()` | SELECT * FROM folders | 获取所有文件夹 |
| `createFolder(name, color)` | INSERT INTO folders | 创建文件夹 |
| `updateFolder(id, data)` | UPDATE folders | 更新文件夹 |
| `deleteFolder(id)` | UPDATE + DELETE | 删除文件夹，关联集合移至未分类 |
| `movePromptToFolder(promptSetId, folderId)` | UPDATE prompt_sets | 移动集合到文件夹 |
| `getPromptSets()` | SELECT + 子查询 | 获取集合摘要（含版本数和图片数统计） |
| `getPromptSet(id)` | SELECT + JOIN | 获取集合详情（含版本和图片） |
| `createPromptSet(name, folderId)` | INSERT | 创建集合（自动创建 v1 版本） |
| `updatePromptSet(id, data)` | UPDATE | 更新集合 |
| `deletePromptSet(id)` | DELETE 级联 | 删除集合及关联数据 |
| `addVersion(id, data)` | INSERT INTO versions | 添加新版本 |
| `deleteVersion(id, versionIndex)` | DELETE | 删除版本（至少保留一个） |
| `renameVersion(id, versionIndex, newName)` | UPDATE versions | 重命名版本 |
| `duplicateVersion(id, versionIndex)` | INSERT + Filesystem.copy | 复制版本（含图片文件） |
| `uploadImage(imageId, dataUrl, name)` | Filesystem.writeFile | 上传图片 |
| `deleteImage(filename)` | Filesystem.deleteFile | 删除图片 |
| `exportData()` | SELECT + Filesystem.readFile | 生成完整备份对象，包含文件夹、提示词、版本和图片文件内容 |
| `importData(data)` | DELETE + INSERT + Filesystem.writeFile | 导入完整备份，相同 ID 覆盖并恢复图片 |
| `getImageUrl(img)` | Filesystem.getUri + convertFileSrc | 获取图片可访问 URL |
| `getPlatform()` | - | 返回 `'android'` |

---

## 八、局域网同步

### 8.1 同步架构

```
Android 客户端 (LanSync)  ──HTTP──→  PC 服务端 (Python HTTP)
     ↓                                    ↓
  SqliteStorage                      ApiStorage
  + Filesystem                       + JSON 文件
```

### 8.2 搜索 PC 端

移动端设置页通过 `LanScanner` 搜索局域网内的 PC 服务端：

- 优先探测 `localStorage` 中的最近设备，降低重复使用时的等待时间。
- WebRTC 能获取本机 IP 时，优先扫描当前网段。
- WebRTC 失败时回退扫描常见网段，例如 `192.168.1.x`、`192.168.0.x`、`192.168.31.x`、`192.168.43.x`、`192.168.50.x`、`192.168.100.x`、`10.0.0.x`、`172.16.0.x`。
- 每个候选地址通过 `GET http://IP:{port}/api/health` 验证，默认扫描端口范围为 `8888-8897`，只有 `status=ok` 的设备会进入结果列表。
- 点击搜索结果后会自动填入完整 `IP:port` 地址并再次测试连接，连接成功后保存为最近设备。
- 搜索失败时仍可手动输入 PC 设置页显示的完整地址。

### 8.3 同步流程

```
1. 用户选择同步方向：从 PC 拉取、回传到 PC、双向同步
2. 连接测试：GET http://IP:{port}/api/health
3. 同步前预览：GET /api/sync/pairing 后 POST /api/sync/preview，展示新增、跳过、冲突和 PC 独有数量
4. 拉取模式：用户确认后 GET http://IP:{port}/api/sync，PC 优先覆盖 Android 同 ID 数据
5. 回传模式：用户确认后 POST /api/sync/import，默认保护 PC 数据并生成幂等冲突副本
6. 双向模式：用户确认后 POST /api/sync/bidirectional，PC 返回合并结果和最新同步快照，Android 再写入本地
7. 显示同步报告和 PC 同步前备份路径
```

### 8.4 同步状态机

```
IDLE → CONNECTING → SYNCING → VERIFYING → SUCCESS/PARTIAL/ERROR
```

### 8.5 覆盖策略

| 情况 | 处理方式 |
|------|---------|
| 仅 PC 端有 | 同步到 Android |
| 仅 Android 端有 | 保留不动 |
| 拉取模式两端都有同 ID 记录 | 以 PC 端为准覆盖 Android 本机记录，即使 Android 本机更新时间更新 |
| 回传模式两端都有同 ID 记录 | 默认保留 PC 数据，将 Android 数据保存为带 `conflictKey` 的冲突副本 |
| 重复回传同一份冲突内容 | 识别已存在的 `conflictKey` 并跳过，不重复生成副本 |

### 8.6 前提条件

- PC 端软件必须启动（Python HTTP 服务运行中）
- 两端处于同一局域网
- PC 端防火墙允许 PC 设置页显示的实际同步端口入站，默认优先端口为 8888

---

## 九、移动端功能清单

### 9.1 核心功能

| 功能 | 描述 | 实现位置 |
|------|------|---------|
| 提示词集合 CRUD | 创建/删除/重命名/搜索集合 | `app.js` → `SqliteStorage` → SQLite |
| 文件夹管理 | 创建/删除/重命名/颜色标签/移动集合 | `app.js` → `SqliteStorage` → SQLite |
| 多版本管理 | 添加/删除/重命名/复制版本 | `app.js` → `SqliteStorage` → SQLite |
| 提示词编辑 | 正向提示词前端上限 6666 字符，反向提示词前端上限 2000 字符 | `mobile-editor.js` |
| 提示词预览 | 二级窗口完整预览 + 一键复制 | `app.js` → `openPromptPreview()` |
| 图片上传 | 点击/拖拽上传，存储到本地文件系统 | `app.js` → `SqliteStorage` → Filesystem |
| 图片查看 | 详情页全屏查看、点击关闭、缩放和平移、下载当前图片并写入手机相册；图片预览遮罩由详情页维护活动引用，返回或卸载时会立即清理 | `mobile-detail.js` → `showImageViewer()` → `image-download-utils.js` / `mobile-gallery.js` |
| 版本对比 | 并排对比两个版本的提示词和图片 | `app.js` → `toggleCompare()` |
| 数据导入导出 | 完整备份 JSON，包含图片内容；Android 原生端通过 Capacitor Filesystem 写入 `backups/`；相同 ID 默认覆盖 | `mobile-settings.js` / `mobile-library.js` / `backup-utils.js` → `SqliteStorage` → SQLite + Filesystem |
| 暗色/亮色主题 | 主题切换，localStorage 持久化 | `app.js` → `initTheme()` / `toggleTheme()` |
| 长按菜单 | 长按集合项弹出操作菜单 | `app.js` → `setupLongPress()` |

### 9.2 移动端特有功能

| 功能 | 描述 | 实现位置 |
|------|------|---------|
| 离线使用 | 无需网络和后端服务 | SQLite + Filesystem 本地存储 |
| 移动端适配 | 列表/详情切换模式，返回按钮导航 | `app.js` + `responsive.css` |
| 手势返回 | 系统返回键/手势返回上一级；Android 硬件返回键在 Capacitor `App` 模块异步导入完成后注册，并通过防重入标记避免重复监听 | `mobile-app.js` → `popstate` / `App.addListener('backButton')` |
| 局域网 PC 搜索 | 搜索同一局域网内已打开的 PC 端并填入完整地址 | `lan-sync.js` → `LanScanner.scan()` / `mobile-settings.js` |
| 局域网同步 | 从 PC 端拉取全量数据、回传 Android 数据、发起双向同步，并在写入前展示冲突预览 | `lan-sync.js` → `LanSync.preview()` / `LanSync.sync()` / `LanSync.push()` / `LanSync.bidirectional()` |
| 图片下载历史 | 设置页展示最近图片下载记录，并支持一键清空历史 | `download-history.js` → `mobile-settings.js` |

---

## 十、移动端与 PC 端差异对比

| 对比项 | PC 端 (Tauri) | Android 端 (Capacitor) |
|--------|---------------|----------------------|
| 后端服务 | Python HTTP Server | 无（本地 SQLite） |
| 数据存储 | JSON 文件 + 图片文件 | SQLite 数据库 + Filesystem |
| 图片路径 | `http://localhost:8888/images/{file}` | `capacitor://localhost/_capacitor_file_/...` |
| 导入策略 | 相同 ID 覆盖更新 | 相同 ID 覆盖更新并恢复图片 |
| 版本复制 | `shutil.copy2()` 复制图片文件 | `Filesystem.copy()` 复制图片文件 |
| 网络需求 | 无（本地服务） | 仅同步时需要 |
| 进程管理 | Tauri 自动启动/管理 Python 进程 | 无需额外进程 |
| 同步角色 | 服务端（提供数据并接收回传） | 客户端（发起拉取、回传和双向同步） |
| 文件夹数据 | `folders.json` 文件 | `folders` 数据库表 |

---

## 十一、Capacitor 依赖

| 包名 | 版本 | 用途 | 使用状态 |
|------|------|------|---------|
| `@capacitor/core` | 8.3.1 | 核心运行时 | ✅ 使用中 |
| `@capacitor/cli` | 8.3.1 | 命令行工具 | ✅ 使用中 |
| `@capacitor/android` | 8.3.1 | Android 平台 | ✅ 使用中 |
| `@capacitor-community/sqlite` | 8.1.0 | SQLite 数据库 | ✅ 使用中 |
| `@capacitor/filesystem` | 8.1.2 | 文件系统操作 | ✅ 使用中 |
| `@capacitor/camera` | 8.2.0 | 相机访问 | ⚠️ 已安装未使用 |
| `@capacitor/network` | 8.0.1 | 网络状态检测 | ⚠️ 已安装未使用 |

---

## 十二、构建与部署

### 局域网同步动态端口

移动端局域网同步目标统一按 `IP:port` 解析。用户可手动输入 `192.168.6.109`、`192.168.6.109:8890` 或 `http://192.168.6.109:8890`；未填写端口时默认使用 `8888`。搜索 PC 时会优先探测最近设备；若旧最近设备没有端口，则按默认端口范围 `8888-8897` 继续探测。搜索结果和最近设备都保存实际端口。

`LanSync.preview()`、`LanSync.sync()`、`LanSync.push()` 和 `LanSync.bidirectional()` 均使用同一个目标对象构造 `/api/health`、`/api/sync`、`/api/sync/pairing`、`/api/sync/preview`、`/api/sync/import`、`/api/sync/bidirectional` 与图片下载地址，避免 PC 安装包回退到非 `8888` 端口后移动端仍请求旧端口。

### 12.1 环境准备

| 工具 | 最低版本 | 用途 | 安装方式 | 验证命令 |
|------|---------|------|---------|---------|
| **Node.js** | 18+ | 前端构建 + Capacitor CLI | https://nodejs.org/ | `node --version` |
| **JDK** | 17 | Gradle 编译（**不可用 21+**） | https://adoptium.net/ | `java -version` |
| **Android SDK** | API 36 | Android 构建 | Android Studio 或命令行工具 | `echo %ANDROID_HOME%` |
| **Gradle** | 8.x | Android 构建系统 | 项目自带 gradlew | 无需单独安装 |

> **⚠️ JDK 版本注意**：Capacitor 8.x 的部分插件使用 Java 21 语法，但 Gradle 编译需要 JDK 17。项目提供了 `patch-java-version.ps1` 脚本，在 `cap sync` 之后自动将 Java 21 降级为 17。**不要使用 JDK 21+ 作为 JAVA_HOME**。

### 12.2 版本号管理

每次发布新版本时，需同步修改以下文件中的版本号：

| 文件 | 修改项 | 示例 |
|------|--------|------|
| `package.json` | `"version"` | `"2.2.1"` |
| `android/app/build.gradle` | `versionCode` | `4`（每次 +1） |
| `android/app/build.gradle` | `versionName` | `"2.2.1"` |

**版本号规则**：
- `versionName`：语义化版本 `MAJOR.MINOR.PATCH`
- `versionCode`：整数，每次发布递增 1，Google Play 用于判断新旧版本
- APK 命名格式：`PromptImageManager-v{versionName}.apk`

### 12.3 标准构建流程（6 步）

> 以下流程经过实际验证，每一步都必须按顺序执行。

#### 第 1 步：更新版本号

修改 `package.json` 和 `android/app/build.gradle` 中的版本号（参见 12.2 节）。

#### 第 2 步：构建前端

```bash
npx vite build
```

验证：确认 `dist/index.html` 存在。

#### 第 3 步：同步到 Capacitor

```bash
npx cap sync android
```

此步骤将 `dist/` 中的前端文件复制到 `android/app/src/main/assets/public/`，并同步 Capacitor 插件配置。

验证：输出 `Sync finished in X.Xs` 且无错误。

#### 第 4 步：修补 Java 版本兼容性

```bash
powershell -ExecutionPolicy Bypass -File patch-java-version.ps1
```

**此步骤不可跳过！** `cap sync` 会从 node_modules 恢复 Java 21 的配置，而项目需要 JDK 17 编译。脚本会将以下文件中的 `JavaVersion.VERSION_21` 和 `jvmToolchain(21)` 替换为 17：

- `android/app/capacitor.build.gradle`
- `android/capacitor-cordova-android-plugins/build.gradle`
- `node_modules/@capacitor*/android/build.gradle`（如存在）

验证：输出 `Patched: ...` 且无错误。

#### 第 5 步：构建 Release APK

```bash
cd android
.\gradlew assembleRelease
cd ..
```

验证：输出 `BUILD SUCCESSFUL`，APK 位于 `android/app/build/outputs/apk/release/app-release.apk`。

#### 第 6 步：复制并重命名 APK

```bash
copy android\app\build\outputs\apk\release\app-release.apk PromptImageManager-v{versionName}.apk
```

示例：`copy android\app\build\outputs\apk\release\app-release.apk PromptImageManager-v2.2.1.apk`

同时删除项目根目录下的旧版本 APK 文件。

### 12.4 一键构建

```bash
build.bat → 选择 3（构建 Android 端）
```

> **注意**：`build.bat` 的 Android 构建流程不包含版本号更新和 APK 重命名步骤，需手动执行。

### 12.5 构建产物

```
项目根目录/
└── PromptImageManager-v2.2.1.apk          ← 最终发布文件

android/app/build/outputs/apk/release/
└── app-release.apk                         ← Gradle 原始输出

android/app/build/outputs/apk/debug/
└── app-debug.apk                           ← Debug 版本（开发调试用）
```

### 12.6 签名配置

Release 构建使用 `android/keystore.properties` 配置签名：

```properties
storeFile=../prompt-image-manager.keystore
storePassword=***
keyAlias=prompt-image-manager
keyPassword=***
```

签名密钥库文件：`android/prompt-image-manager.keystore`

> **⚠️ 安全提醒**：`keystore.properties` 和 `.keystore` 文件包含签名密钥，切勿提交到公开仓库。项目 `.gitignore` 应包含这两项。

### 12.7 Debug 构建（开发调试）

```bash
npx vite build
npx cap sync android
powershell -ExecutionPolicy Bypass -File patch-java-version.ps1
cd android
.\gradlew assembleDebug
cd ..
```

Debug APK 无需签名配置，输出在 `android/app/build/outputs/apk/debug/app-debug.apk`。

### 12.8 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `BUILD FAILED: JavaVersion.VERSION_21` | 跳过了第 4 步 Java 版本修补 | 执行 `patch-java-version.ps1` 后重新构建 |
| `BUILD FAILED: Could not find keystore` | keystore 文件不存在或路径错误 | 确认 `android/prompt-image-manager.keystore` 存在，`keystore.properties` 中 `storeFile` 路径正确 |
| APK 构建成功但安装后白屏 | 前端未构建或 `cap sync` 未执行 | 按顺序执行第 2-3 步后重新构建 |
| `cap sync` 报错 `npm package not found` | 未安装依赖 | 执行 `npm install` |
| Gradle 下载依赖缓慢 | 默认 Maven 仓库在国内访问慢 | 项目已配置腾讯云和阿里云镜像（`android/build.gradle`） |
| `JAVA_HOME` 设置为 JDK 21 导致编译失败 | JDK 版本过高 | 安装 JDK 17 并设置 `JAVA_HOME` 指向 JDK 17 |

### 12.9 构建流程速查图

```
┌─────────────────────────────────────────────────────────┐
│  1. 更新版本号                                           │
│     package.json → version                              │
│     build.gradle → versionCode + versionName            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  2. 构建前端                                             │
│     npx vite build                                      │
│     (src/ → dist/)                                      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  3. 同步到 Capacitor                                     │
│     npx cap sync android                                │
│     (dist/ → android/app/src/main/assets/public/)       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  4. 修补 Java 版本  ⚠️ 不可跳过                          │
│     powershell -File patch-java-version.ps1             │
│     (Java 21 → 17)                                      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  5. 构建 Release APK                                     │
│     cd android && gradlew assembleRelease               │
│     → android/app/build/outputs/apk/release/            │
│       app-release.apk                                   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  6. 复制并重命名 APK                                      │
│     copy app-release.apk PromptImageManager-vX.Y.Z.apk  │
│     删除旧版本 APK                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 十三、已知问题与改进建议

| 编号 | 问题描述 | 严重程度 | 建议 |
|------|---------|---------|------|
| AND-001 | `deleteImage()` 只删除文件不清理数据库 images 记录 | 高 | 删除文件后同步删除数据库记录 |
| AND-002 | 导入覆盖前缺少更细的数量预览 | 中 | 在导入确认前展示新增、覆盖和图片恢复数量 |
| AND-003 | `@capacitor/camera` 和 `@capacitor/network` 已安装但未使用 | 低 | 移除未使用的依赖减小包体积 |
| AND-004 | Gradle 构建有弃用警告（Groovy DSL 赋值语法） | 低 | 更新为 `propName = value` 语法 |
| AND-005 | SQLite 未启用 WAL 模式，并发写入性能受限 | 低 | 启用 WAL 模式提升并发性能 |
| AND-006 | 图片存储在应用内部目录，卸载后数据丢失 | 中 | 考虑支持外部存储备份 |

---

## 十四、发布检查清单

- [ ] 版本号已更新（`package.json` + `build.gradle` 的 versionCode/versionName）
- [ ] 前端构建无错误（`npx vite build`）
- [ ] Capacitor 同步无错误（`npx cap sync android`）
- [ ] Java 版本修补已执行（`patch-java-version.ps1`）
- [ ] Gradle 构建无错误（`gradlew assembleRelease`）
- [ ] APK 已复制到项目根目录并按规范命名（`PromptImageManager-vX.Y.Z.apk`）
- [ ] 旧版本 APK 已删除
- [ ] SQLite 数据库初始化正常
- [ ] 图片上传/删除/查看正常
- [ ] 数据导入导出正常
- [ ] 移动端响应式布局正常（768px / 480px 断点）
- [ ] 返回按钮/手势导航正常
- [ ] 权限申请流程正常（存储权限）
- [ ] 文件夹管理功能正常
- [ ] 暗色/亮色主题切换正常
- [ ] 局域网同步功能正常
- [ ] 长按菜单功能正常

## 十五、移动端回归测试入口

- 页面级回归测试：`npm.cmd run test -- mobile-regression.test.js`，覆盖首页、提示词库、详情、编辑、分类与标签、设置页、数据导入导出入口、局域网连接入口、详情页图片预览卸载清理和图片预览下载入口。
- 全量前端回归：`npm.cmd run test`。
- 移动端构建闭环：`npm.cmd run build` → `npx.cmd cap sync android` → `powershell -ExecutionPolicy Bypass -File scripts\patch-java-version.ps1` → `android\gradlew.bat -p android assembleDebug`。
- 最新测试记录：[移动端全功能回归测试记录-260515.md](../测试记录/移动端全功能回归测试记录-260515.md)。
