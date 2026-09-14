# 生图提示词管理器 v2.0 — 功能优化计划

> 文档创建日期：2026-05-03
> 项目版本：v2.2.1
> 技术栈：原生 JS + Vite + Tauri 2.x (PC) + Capacitor 8.x (Android) + Python 后端

---

## 一、任务总览与执行顺序

| 优先级 | 编号 | 任务名称 | 核心原因 | 状态 |
|--------|------|----------|----------|------|
| **P0** | T1 | 修复图片导入/预览/查看功能 Bug | 核心功能缺陷，影响 PC 端和移动端基本使用 | ✅ 已完成 |
| **P1** | T2 | 替换软件图标并整理图标到统一文件夹 | 独立任务，不影响其他功能，快速提升产品外观 | ✅ 已完成 |
| **P2** | T3 | 提示词增加一键复制按钮 + 二级窗口完整预览 | 功能增强，基于现有提示词展示逻辑扩展 | ✅ 已完成 |
| **P3** | T4 | 实现暗色/亮色主题切换 | 全局 CSS 变更，放最后确保所有新增组件一次性适配双主题 | ✅ 已完成 |

**执行顺序：** `T1 → T2 → T3 → T4`

**排序逻辑：**
1. Bug 优先 — 图片功能是核心，在缺陷基础上叠加新功能会导致问题扩散
2. 图标独立 — 不依赖其他功能，快速完成可立即提升产品外观
3. 功能增强先于全局样式 — 先完成新 UI 组件（复制按钮、预览窗口），再统一做主题适配，避免主题适配做两遍
4. 主题最后 — 全局 CSS 变更，确保所有已有 + 新增组件一次性适配双主题

---

## 二、T1 — 修复图片导入/预览/查看功能 Bug（P0）

### 2.1 问题描述

| 平台 | 现象 | 根因分析 |
|------|------|----------|
| PC 端 | 点击图片无法正常查看/全屏预览 | `api-storage.js` 的 `getImageUrl()` 返回路径 `${baseUrl}/images/data/images/${file}` 存在路径重复，需对照 Python 后端路由确认正确路径 |
| 移动端 | 图片导入无反应 | 需排查 Capacitor Filesystem 写入权限配置及 `uploadImage()` 中 DataURL 写入的兼容性 |
| 移动端 | 导入后无法查看预览图片 | `sqlite-storage.js` 的 `getImageUrl()` 使用 `Filesystem.getUri()` 返回 `content://` URI，Android WebView 无法直接渲染，需用 `Capacitor.convertFileSrc()` 转换 |

### 2.2 修复项清单

- [x] **F1.1** 修复 PC 端 `api-storage.js` 的 `getImageUrl()` 图片 URL 路径问题
  - 对比 Python 后端 `main.py` 的静态文件服务路由（`do_GET` 中 `/images/` 路径映射）
  - 确认正确的 URL 应为 `${baseUrl}/images/${file}` 还是当前路径
  - 验证 Vite 代理配置 `vite.config.js` 中 `/images` 的转发规则
- [x] **F1.2** 修复移动端 `sqlite-storage.js` 的 `getImageUrl()`
  - 将 `Filesystem.getUri()` 返回的 `content://` URI 通过 `Capacitor.convertFileSrc()` 转换为 `https://localhost/_capacitor_file_/` 格式
  - 添加异常回退逻辑：转换失败时尝试返回 `img.data`（Base64 DataURL）
- [x] **F1.3** 修复 PC 端全屏图片查看器 `viewImage()` 的图片加载问题
  - 确认 `imageViewerImg.src` 赋值后图片是否正常加载
  - 检查 `image-viewer-overlay` 的 z-index 是否被其他元素遮挡
- [x] **F1.4** 排查移动端图片导入流程
  - 检查 `android/app/src/main/AndroidManifest.xml` 中的存储权限声明
  - 检查 Capacitor 配置 `capacitor.config.ts` 中的 Filesystem 插件配置
  - 验证 `uploadImage()` 中 `Filesystem.writeFile()` 的 `Directory.Data` 路径是否可写
- [x] **F1.5** 端到端验证
  - PC 端：图片上传 → 列表预览 → 点击全屏查看 → 删除
  - 移动端：图片上传 → 列表预览 → 点击全屏查看 → 删除

### 2.3 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/js/api-storage.js` | `getImageUrl()` 方法路径修正 |
| `src/js/sqlite-storage.js` | `getImageUrl()` URI 转换 + `uploadImage()` 兼容性修复 |
| `src/js/app.js` | `viewImage()`、`processImageFiles()` 函数排查 |
| `python/main.py` | 图片服务路由路径确认 |
| `vite.config.js` | 代理转发规则确认 |
| `android/app/src/main/AndroidManifest.xml` | 存储权限确认 |
| `capacitor.config.ts` | Filesystem 插件配置确认 |

---

## 三、T2 — 替换软件图标并整理图标到统一文件夹（P1）

### 3.1 当前状态

- **新图标源文件**：`src/assets/icons/ChatGPT Image 2026年5月3日 10_07_15 (1).png`（已就位）
- **Tauri 桌面端图标**：位于 `src-tauri/icons/`，包含 icon.png、icon.ico、icon.icns 及各尺寸变体（当前为 Tauri 默认图标）
- **Android 移动端图标**：位于 `android/app/src/main/res/mipmap-*/`，包含 ic_launcher.png、ic_launcher_round.png、ic_launcher_foreground.png（当前为 Capacitor 默认图标）
- **UI 内图标**：全部使用内联 SVG 和 Emoji（🎨📤📥🔄✏️📋🗑），无独立图标文件
- **图标目录**：`src/assets/icons/` 已存在，当前仅含新图标源文件

### 3.2 操作清单

- [x] **F2.1** 使用已有图标源文件生成各平台所需尺寸
  - 源文件：`src/assets/icons/ChatGPT Image 2026年5月3日 10_07_15 (1).png`
  - 使用图像处理工具（如 sharp / canvas / 在线工具）从源图裁剪生成各尺寸
- [x] **F2.2** 替换 Tauri 桌面端图标
  - 使用源图生成所有尺寸：icon.png、icon.ico、icon.icns、32x32.png、128x128.png、128x128@2x.png、StoreLogo.png、Square*.png
  - 写入 `src-tauri/icons/` 目录
  - 确认 `tauri.conf.json` 中的图标路径引用无需变更
- [x] **F2.3** 替换 Android 移动端图标
  - 使用源图生成各密度尺寸（mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi）
  - 写入 `android/app/src/main/res/mipmap-*/` 目录
  - 同时更新 ic_launcher.png、ic_launcher_round.png、ic_launcher_foreground.png
- [x] **F2.4** 整理 UI 内图标到 `src/assets/icons/` 目录
  - 将 `index.html` 和 `app.js` 中的内联 SVG 抽取为独立 `.svg` 文件，放入 `src/assets/icons/`
  - 涉及的 SVG：空状态图标、添加图片区域图标
- [x] **F2.5** 替换 Emoji 图标为 SVG 图标引用
  - 将 Emoji（🎨📤📥🔄✏️📋🗑）替换为对应语义的 SVG 图标
  - SVG 图标放入 `src/assets/icons/` 统一管理
  - 更新 `index.html` 和 `app.js` 中的引用方式
- [x] **F2.6** 验证图标显示
  - PC 端：任务栏图标、窗口标题栏图标、桌面快捷方式图标
  - 移动端：应用列表图标、最近任务图标
  - Web 端：页面内所有 SVG/Emoji 替换后的图标显示

### 3.3 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/assets/icons/ChatGPT Image 2026年5月3日 10_07_15 (1).png` | 图标源文件（已就位） |
| `src-tauri/icons/*` | 替换桌面端图标 |
| `android/app/src/main/res/mipmap-*/*` | 替换移动端图标 |
| `src/assets/icons/*.svg` | 新增抽取的 SVG 图标文件 |
| `src/index.html` | Emoji → SVG 引用替换 |
| `src/js/app.js` | Emoji + 内联 SVG → SVG 引用替换 |
| `src-tauri/tauri.conf.json` | 确认图标路径配置 |

### 3.4 前置依赖

- ~~需提供新的应用图标设计素材~~ ✅ 图标源文件已就位于 `src/assets/icons/`

---

## 四、T3 — 提示词增加一键复制按钮 + 二级窗口完整预览（P2）

### 4.1 当前状态

- 提示词通过 `<textarea>` 展示，支持编辑和 500ms 防抖自动保存
- 无一键复制功能，用户只能手动选中文本复制
- 无二级窗口预览功能，提示词仅在编辑区域内查看
- 版本对比视图中提示词以只读文本展示，但无复制按钮

### 4.2 功能 A：一键复制按钮

- [x] **F3.1** 在正向提示词 `<textarea>` 旁添加「复制」按钮
- [x] **F3.2** 在反向提示词 `<textarea>` 旁添加「复制」按钮
- [x] **F3.3** 实现复制逻辑
  - 调用 `navigator.clipboard.writeText()` 写入剪贴板
  - 兼容回退：`navigator.clipboard` 不可用时使用 `document.execCommand('copy')`
  - 复制成功后调用 `showToast('已复制到剪贴板')`
  - 复制失败时调用 `showToast('复制失败', 'error')`
- [x] **F3.4** 按钮样式
  - 使用 `var(--accent)` 主色调，与现有 UI 风格一致
  - 使用 SVG 图标（复制图标）+ 文字「复制」
  - 悬停/点击状态反馈

### 4.3 功能 B：二级窗口完整预览提示词

- [x] **F3.5** 在 `index.html` 中添加提示词预览模态窗口 HTML 结构
  ```html
  <div class="prompt-preview-overlay" id="promptPreview">
    <div class="prompt-preview-modal">
      <div class="prompt-preview-header">
        <h3 id="previewTitle"></h3>
        <button class="close-preview-btn" id="closePreviewBtn">✕</button>
      </div>
      <div class="prompt-preview-body">
        <div class="preview-section">
          <div class="preview-section-header">
            <span>正向提示词</span>
            <button class="copy-btn" data-target="positive">复制</button>
          </div>
          <div class="preview-content" id="previewPositive"></div>
        </div>
        <div class="preview-section">
          <div class="preview-section-header">
            <span>反向提示词</span>
            <button class="copy-btn" data-target="negative">复制</button>
          </div>
          <div class="preview-content" id="previewNegative"></div>
        </div>
        <div class="preview-section" id="previewNoteSection" style="display:none">
          <div class="preview-section-header"><span>版本备注</span></div>
          <div class="preview-content" id="previewNote"></div>
        </div>
      </div>
    </div>
  </div>
  ```
- [x] **F3.6** 在 `app.js` 中实现预览窗口逻辑
  - 添加「预览」按钮到版本详情区域（与编辑区域并列）
  - 点击预览按钮 → 填充模态窗口内容 → 显示模态窗口
  - 模态窗口内复制按钮绑定对应提示词内容的复制逻辑
  - ESC 关闭 + 点击遮罩关闭
- [x] **F3.7** 在 `main.css` 中添加模态窗口样式
  - 遮罩层：`position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200`
  - 模态框：`max-width: 700px; max-height: 80vh; overflow-y: auto; background: var(--surface); border-radius: 12px`
  - 内容区：只读展示，保留换行格式（`white-space: pre-wrap`）
- [x] **F3.8** 在 `responsive.css` 中添加响应式适配
  - 移动端（≤768px）：模态框全屏展示，圆角为 0
  - 小屏（≤480px）：字体和间距适当缩小

### 4.4 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/index.html` | 添加预览模态窗口 HTML 结构 |
| `src/js/app.js` | 添加复制逻辑 + 预览窗口渲染/交互逻辑 |
| `src/css/main.css` | 复制按钮样式 + 预览模态窗口样式 |
| `src/css/responsive.css` | 预览窗口响应式适配 |

---

## 五、T4 — 实现暗色/亮色主题切换（P3）

### 5.1 当前状态

- 仅有暗色主题，CSS 变量定义在 `:root` 中
- 无 `[data-theme="light"]`、`@media (prefers-color-scheme: light)` 等亮色定义
- 无主题切换 UI 和逻辑
- 设计文档 `ui-ux-design-doc.md` 中将主题切换列为低优先级改进项 UX-008

### 5.2 实现清单

- [x] **F4.1** 在 `main.css` 中定义亮色主题变量
  ```css
  [data-theme="light"] {
    --bg: #f5f5f5;
    --surface: #ffffff;
    --surface2: #f0f0f0;
    --border: #e0e0e0;
    --text: #1a1a1a;
    --text2: #666;
    --accent: #6c5ce7;
    --accent2: #5a4bd1;
    --danger: #e74c3c;
    --success: #27ae60;
    --warning: #f39c12;
  }
  ```
- [x] **F4.2** 在 `index.html` 导航栏添加主题切换按钮
  - 使用太阳/月亮 SVG 图标
  - 暗色模式显示太阳图标（切换到亮色），亮色模式显示月亮图标（切换到暗色）
  - 按钮位置：导航栏右侧（导出/导入/同步按钮之后）
- [x] **F4.3** 在 `app.js` 中实现主题切换逻辑
  - 切换 `document.documentElement.dataset.theme`（值为 `"dark"` 或 `"light"`）
  - 将主题偏好存入 `localStorage`（key: `theme`）
  - 页面加载时读取 `localStorage` 中的主题偏好
  - 若无存储偏好，跟随系统 `window.matchMedia('(prefers-color-scheme: dark)')` 判断
  - 监听系统主题变化 `matchMedia.addEventListener('change', ...)` 自动跟随（仅当用户未手动设置时）
- [x] **F4.4** 动态更新 `<meta name="theme-color">`
  - 暗色模式：`#0f0f0f`
  - 亮色模式：`#f5f5f5`
- [x] **F4.5** 补充亮色主题下的特殊样式
  - 图片查看器遮罩层：暗色 `rgba(0,0,0,0.9)` → 亮色 `rgba(255,255,255,0.9)`
  - 模态框遮罩层：暗色 `rgba(0,0,0,0.6)` → 亮色 `rgba(0,0,0,0.3)`
  - 拖拽区域高亮：暗色 `rgba(108,92,231,0.1)` → 亮色 `rgba(108,92,231,0.15)`
  - 输入框焦点边框、按钮悬停等交互状态在亮色下的对比度调整
- [x] **F4.6** 确保所有组件双主题兼容
  - 已有组件：侧边栏、详情页、图片网格、版本对比、模态框、Toast
  - 新增组件（T3）：复制按钮、提示词预览窗口
  - 所有颜色必须使用 CSS 变量，禁止硬编码颜色值
- [x] **F4.7** 移动端验证
  - Android 端状态栏颜色跟随主题
  - 触摸交互在亮色主题下的视觉反馈

### 5.3 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/css/main.css` | 亮色主题变量 + 特殊样式覆盖 |
| `src/js/app.js` | 主题切换逻辑 + localStorage 读写 + 系统偏好跟随 |
| `src/index.html` | 主题切换按钮 + theme-color meta 动态更新 |
| `src/css/responsive.css` | 亮色主题响应式调整（如有必要） |

### 5.4 注意事项

- 所有新增 CSS 必须使用 CSS 变量，不得硬编码颜色值，确保主题切换生效
- 主题切换需平滑过渡，可在 `body` 上添加 `transition: background-color 0.3s, color 0.3s`
- `localStorage` 存储的主题偏好需在 PC 端和移动端均生效

---

## 六、风险与注意事项

| 风险项 | 影响 | 应对措施 |
|--------|------|----------|
| 移动端图片 Bug 根因不明 | T1 修复时间可能超预期 | 先在 PC 端验证修复，移动端逐步排查 |
| ~~新图标素材未准备~~ | ~~T2 无法执行~~ | ✅ 图标源文件已就位，T2 可正常执行 |
| `navigator.clipboard` 兼容性 | T3 复制功能在部分环境不可用 | 实现 `execCommand('copy')` 回退方案 |
| 主题切换影响范围大 | T4 可能遗漏硬编码颜色 | 全局搜索 `#` 和 `rgb` 确认所有颜色值均使用变量 |

---

## 七、验收标准

| 任务 | 验收条件 |
|------|----------|
| T1 | PC 端和移动端图片上传→预览→全屏查看→删除全流程正常 |
| T2 | 桌面端/移动端图标替换完成，UI 内 Emoji 替换为 SVG，图标文件统一管理 |
| T3 | 正向/反向提示词均可一键复制；预览窗口弹出正常，内容完整，ESC/遮罩可关闭 |
| T4 | 暗色/亮色切换正常，所有页面/组件双主题显示无异常，主题偏好持久化 |
