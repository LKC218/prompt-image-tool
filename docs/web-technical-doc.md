# 生图提示词管理器 — 网页端技术文档

> 版本：2.2.1 | 最后更新：2026-05-04

---

## 一、产品概述

生图提示词管理器网页端通过浏览器访问，后端由 Python HTTP 服务提供数据支撑。用户可以创建提示词集合、管理多版本提示词、上传生成图片、进行版本对比、文件夹分类，以及导入导出数据。

---

## 二、架构总览

```
┌─────────────────────────────────────────────┐
│              浏览器 (前端)                    │
│   index.html + app.js + storage.js + css    │
│         ↓ ApiStorage (HTTP Fetch)           │
└──────────────────┬──────────────────────────┘
                   │ HTTP REST API
┌──────────────────▼──────────────────────────┐
│         Python 后端 (main.py)                │
│   http.server + ThreadingTCPServer          │
│   端口: 8888 | 数据: JSON 文件 + 图片文件     │
└─────────────────────────────────────────────┘
```

**技术栈**：
- 前端：原生 JavaScript（ES Module），无框架依赖
- 构建：Vite 8.x
- 后端：Python 3.9+，`http.server` 标准库
- 数据存储：JSON 文件（`data/prompt_sets.json`、`data/folders.json`）+ 图片文件（`data/images/`）

---

## 三、功能模块

### 3.1 提示词集合管理

| 功能 | 描述 | 对应函数/API |
|------|------|-------------|
| 创建集合 | 新建提示词集合，自动创建 v1 版本 | `createPromptSet()` → `POST /api/prompt-sets` |
| 删除集合 | 删除集合及其所有版本和关联图片文件 | `deletePromptSet()` → `DELETE /api/prompt-set/{id}` |
| 重命名集合 | 修改集合名称，500ms 防抖自动保存 | `updatePromptSetName()` → `POST /api/prompt-set/{id}` |
| 集合列表 | 按更新时间倒序展示，显示版本数和图片数 | `renderPromptList()` → `GET /api/prompt-sets` |
| 搜索过滤 | 根据名称关键词实时过滤集合列表 | `filterPromptSets()` |
| 右键菜单 | 右键集合项弹出操作菜单（删除/重命名/复制/移动） | `showContextMenu()` |

### 3.2 文件夹管理

| 功能 | 描述 | 对应函数/API |
|------|------|-------------|
| 创建文件夹 | 创建文件夹，支持颜色标签选择 | `createFolder()` → `POST /api/folders` |
| 删除文件夹 | 删除文件夹，关联集合移至未分类 | `handleContextAction('deleteFolder')` → `DELETE /api/folder/{id}` |
| 重命名文件夹 | 修改文件夹名称 | `handleContextAction('renameFolder')` → `POST /api/folder/{id}` |
| 颜色标签 | 预设颜色选择，以圆点形式显示 | `createFolder()` 颜色选择器 |
| 移动集合 | 将集合移动到指定文件夹 | `handleContextAction('moveToFolder')` → `POST /api/prompt-set/{id}/move` |
| 视图切换 | 列表视图/文件夹视图切换 | `toggleViewMode()` |

### 3.3 版本管理

| 功能 | 描述 | 对应函数/API |
|------|------|-------------|
| 添加版本 | 新版本提示词为空（不继承旧版本内容） | `addNewVersion()` → `POST /api/prompt-set/{id}/version` |
| 删除版本 | 至少保留一个版本，删除时清理关联图片 | `deleteVersion()` → `POST /api/prompt-set/{id}/delete-version` |
| 重命名版本 | 通过弹窗修改版本名称（如 v1 → 最终版） | `renameVersion()` → `POST /api/prompt-set/{id}/rename-version` |
| 复制版本 | 深拷贝版本（含图片文件），备注标记来源 | `duplicateVersion()` → `POST /api/prompt-set/{id}/duplicate-version` |
| 切换版本 | 点击版本标签切换当前查看的版本 | `switchVersion()` |

### 3.4 提示词编辑与预览

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| 正向提示词 | 文本域输入，500ms 防抖自动保存 | `promptInput` → `promptHandler('prompt')` |
| 反向提示词 | 文本域输入，500ms 防抖自动保存 | `negativePromptInput` → `promptHandler('negativePrompt')` |
| 版本备注 | 记录版本修改说明，500ms 防抖自动保存 | `versionNoteInput` → 定时保存 |
| 一键复制 | 复制提示词到剪贴板，含 fallback | `copyToClipboard()` |
| 提示词预览 | 二级窗口完整预览正向/反向提示词和备注 | `openPromptPreview()` |

### 3.5 图片管理

| 功能 | 描述 | 对应函数/API |
|------|------|-------------|
| 上传图片 | 支持点击选择和拖拽上传，支持多选 | `processImageFiles()` → `POST /api/image/{imageId}` |
| 删除图片 | 移除图片记录并删除图片文件 | `removeImage()` → `DELETE /api/image/{filename}` |
| 查看大图 | 全屏查看图片，点击或 ESC 关闭 | `viewImage()` / `closeImageViewer()` |
| 图片备注 | 为每张图片添加备注说明，500ms 防抖保存 | `image-card-note` 输入框 |
| 支持格式 | PNG、JPG、WEBP、GIF | `save_image()` 自动识别 MIME 类型 |

### 3.6 版本对比

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| 选择对比版本 | 下拉框选择两个版本进行对比 | `renderCompareView()` |
| 提示词对比 | 并排展示两个版本的正向提示词 | `updateCompare()` |
| 图片对比 | 并排展示两个版本的生成图片 | `renderImages()` |
| 图片查看 | 对比视图中点击图片可全屏查看 | `viewImage()` |

### 3.7 数据导入导出

| 功能 | 描述 | 对应函数/API |
|------|------|-------------|
| 导出数据 | 导出所有集合为 JSON 文件，文件名含日期 | `exportData()` → `GET /api/export` |
| 导入数据 | 从 JSON 文件导入，相同 ID 的集合会覆盖更新 | `importData()` → `POST /api/import` |

### 3.8 主题管理

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| 暗色/亮色切换 | 点击主题切换按钮切换主题 | `toggleTheme()` |
| 主题持久化 | 主题偏好存入 localStorage | `initTheme()` → `localStorage.getItem('theme')` |
| 系统偏好跟随 | 无手动设置时跟随系统主题 | `matchMedia('(prefers-color-scheme: dark)')` |
| theme-color 同步 | 动态更新 meta theme-color | `applyTheme()` |

### 3.9 响应式布局

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| 桌面端 | 侧边栏 + 主内容区并排显示 | CSS `@media (min-width: 769px)` |
| 移动端 | 列表/详情切换模式，返回按钮导航 | `isMobile()` + `showMobileDetail()` / `showMobileList()` |
| 手势返回 | 系统返回键/手势返回上一级 | `popstate` 事件监听 |
| 断点 | 768px（平板/手机）、480px（小屏手机） | `responsive.css` |

### 3.10 UI 交互

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| Toast 通知 | 操作成功/失败提示，3 秒自动消失 | `showToast()` |
| 确认弹窗 | 删除操作前二次确认 | `showConfirmModal()` |
| 重命名弹窗 | 版本重命名输入框，自动聚焦选中 | `renameVersion()` |
| 右键菜单 | 集合项右键弹出操作菜单 | `showContextMenu()` / `hideContextMenu()` |
| 长按菜单 | 移动端长按集合项弹出菜单 | `setupLongPress()` |
| 键盘快捷键 | ESC 关闭图片查看器和弹窗 | `keydown` 事件监听 |

---

## 四、数据模型

### PromptSet（提示词集合）

```json
{
  "id": "string (UUID[:8])",
  "name": "string",
  "folderId": "string | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "versions": [Version]
}
```

### Version（版本）

```json
{
  "version": "string (如 v1, v2)",
  "prompt": "string (正向提示词)",
  "negativePrompt": "string (反向提示词)",
  "images": [Image],
  "note": "string (版本备注)",
  "createdAt": "ISO8601"
}
```

### Image（图片）

```json
{
  "id": "string",
  "name": "string (原始文件名)",
  "path": "string (显示路径)",
  "file": "string (存储文件名，如 abc123.png)",
  "note": "string (图片备注)",
  "createdAt": "ISO8601"
}
```

### Folder（文件夹）

```json
{
  "id": "string",
  "name": "string",
  "color": "string (颜色标签，如 #FF6B6B)",
  "sortOrder": "number",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

---

## 五、文件结构

```
src/
├── index.html              # 主页面
├── css/
│   ├── main.css            # 主样式（暗/亮主题、CSS 变量体系，1384行）
│   └── responsive.css      # 响应式断点样式（423行）
└── js/
    ├── app.js              # 核心业务逻辑（1526行）
    ├── storage.js          # 存储抽象层（平台检测 + 动态加载）
    ├── api-storage.js      # API 存储实现（HTTP Fetch 封装，116行）
    ├── sqlite-storage.js   # SQLite 存储实现（Android 端，367行）
    ├── lan-sync.js         # 局域网同步逻辑（341行）
    ├── tutorial.js         # 新手引导教程（462行）
    └── utils.js            # 工具函数（ID生成、日期格式化、Toast、移动端判断）

python/
├── main.py                 # Python HTTP 后端（638行）
└── tests/
    ├── test_main.py        # 单元测试
    └── _test_api.py        # 集成测试
```

---

## 六、构建与部署

### 开发模式

```bash
# 方式一：使用构建脚本
build.bat → 选择 4（开发模式）

# 方式二：手动启动
# 终端1：启动 Python 后端
cd python && python main.py

# 终端2：启动 Vite 开发服务器
npx vite
# 访问 http://localhost:5173
```

### 生产构建

```bash
npx vite build
# 输出到 dist/ 目录
```

### Vite 配置要点

| 配置项 | 值 |
|--------|-----|
| 开发端口 | 5173 |
| API 代理 | `/api` 和 `/images` 转发到 `http://localhost:8888` |
| 测试环境 | jsdom（Vitest） |
| 根目录 | `src/` |
| 输出目录 | `../dist` |

---

## 七、测试覆盖

### 前端测试（Vitest + jsdom）

| 测试文件 | 覆盖内容 |
|----------|---------|
| `storage.test.js` | 平台检测（isTauri/isCapacitor）、getStorage 异常、initStorage 初始化 |
| `api-storage.test.js` | ApiStorage 初始化重试、平台检测、图片 URL 生成、所有 CRUD 方法 |
| `utils.test.js` | generateId 唯一性、formatDate 格式化、isMobile 判断 |

### Python 测试（pytest）

| 测试文件 | 覆盖内容 |
|----------|---------|
| `test_main.py` | 数据加载/保存、图片保存/删除、Unicode 支持、CRUD 操作、导入导出 |
| `_test_api.py` | 集成测试：启动后端进程、发送 HTTP 请求验证 API 响应 |

> 注：`SqliteStorage` 和 `LanSync` 目前无独立单元测试，需在 Android 设备/模拟器上手动测试

---

## 八、已知问题与改进建议

| 编号 | 问题描述 | 严重程度 | 建议 |
|------|---------|---------|------|
| WEB-001 | `load_data()` / `save_data()` 非原子操作，高并发下仍可能数据丢失 | 中 | 加文件锁（`fcntl` / `msvcrt`）或改用 SQLite |
| WEB-002 | 自动保存每次完整读取再写入数据，效率较低 | 低 | 实现增量更新或脏标记机制 |
| WEB-003 | Python 后端日志被静默（`log_message` 为空函数），生产环境无法排查问题 | 中 | 接入日志文件输出 |
| WEB-004 | API 无认证机制，局域网内任何人可访问 | 低 | 按需添加 Token 认证 |
| WEB-005 | `@capacitor/camera` 和 `@capacitor/network` 已安装但未使用，增加包体积 | 低 | 移除未使用的依赖 |
