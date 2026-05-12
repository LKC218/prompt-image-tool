# Tauri安装器壳-NSIS静默安装可行性测试计划

## 思考与分析

本计划目标是验证“使用 Tauri 做自定义安装器界面壳，同时继续保留 NSIS 作为静默安装核心”是否适合当前项目。

当前 PC 安装包链路为：

```text
Vite 前端构建 -> PyInstaller 生成 PC 可执行目录 -> NSIS 生成安装向导 -> releases 发布副本
```

该方案不应直接替换现有安装包流程，而应先以独立原型验证以下关键问题：

1. Tauri 安装器壳是否能实现参考图级别的自定义窗口、插画背景、步骤导航、按钮和任务选项。
2. 现有 NSIS 安装包是否能通过静默参数完成安装，并保持快捷方式、注册表、卸载入口等安装闭环。
3. Tauri 壳调用 NSIS 静默安装时，是否能获得足够可靠的安装状态、失败信息和最终校验结果。
4. 原型是否会显著增加包体、构建复杂度或杀软误报风险。

本次测试的核心原则是低侵入：

- 不修改现有主应用前端页面。
- 不改动现有 Python 后端和数据结构。
- 不替换现有 NSIS 正式安装包。
- 原型代码与构建产物单独隔离，验证通过后再决定是否并入正式构建链路。

## 实施计划

### 1. 基线确认

1. 使用当前脚本构建标准 PC 安装包。
2. 记录当前产物路径、大小、安装目录、快捷方式、卸载项和启动行为。
3. 确认 `build/PromptImageManager-Setup-2.3.1.exe` 可以作为静默安装核心。

验收标准：

- 当前 NSIS 安装包可以正常交互式安装。
- 安装后主程序可启动。
- 桌面快捷方式、开始菜单快捷方式和卸载项存在。

### 2. NSIS 静默安装验证

1. 在测试目录或干净用户环境中执行静默安装。
2. 验证 `/S` 静默参数是否可用。
3. 验证 `/D=目标目录` 是否可指定安装目录。
4. 安装结束后检查主程序、图标、快捷方式、注册表卸载项。
5. 执行卸载器并检查文件、快捷方式和注册表清理情况。

建议命令：

```powershell
build\PromptImageManager-Setup-2.3.1.exe /S /D=%LOCALAPPDATA%\PromptImageManager-Test
```

验收标准：

- 静默安装退出码可靠。
- 指定安装目录生效。
- 安装结果与交互式安装一致。
- 卸载闭环可用。

风险点：

- 当前 NSIS 脚本默认创建桌面快捷方式，后续若 Tauri 壳提供复选框，需要 NSIS 增加命令行变量或生成不同安装脚本。
- NSIS 静默执行期间难以直接获得精细进度，Tauri 壳可能只能展示阶段式进度。

### 3. Tauri 安装器壳原型

1. 新建隔离目录承载安装器壳原型，建议路径为 `installer-shell/`。
2. 使用独立 Vite 页面实现安装器 UI，不复用主应用路由。
3. 配置 Tauri 无边框窗口、固定尺寸、居中、不可调整大小。
4. UI 原型先覆盖最小流程：
   - 欢迎页
   - 许可协议页
   - 安装位置页
   - 附加任务页
   - 正在安装页
   - 安装完成页
5. 点击安装时，通过 Tauri 后端命令启动 NSIS 静默安装。
6. 安装完成后执行文件系统校验，确认主程序和卸载器存在。

验收标准：

- Tauri 壳可打开并展示参考图风格的核心布局。
- 自定义标题栏最小化、关闭按钮可用。
- 下一步、上一步、取消、安装完成启动等交互可用。
- 可以调用 NSIS 静默安装并收到成功或失败状态。

### 4. 安装状态与异常处理验证

1. 验证正常安装路径。
2. 验证取消安装路径。
3. 验证目标目录不可写时的错误提示。
4. 验证 NSIS 安装包缺失时的错误提示。
5. 验证重复安装或覆盖安装。
6. 验证安装完成后启动主程序。

验收标准：

- 安装失败时 Tauri 壳不误报成功。
- 安装完成后可以明确定位主程序路径。
- 重复安装不会破坏旧数据。
- 用户取消时没有残留错误状态。

### 5. 构建链路试接入

1. 保持现有 `scripts/build_pc_package.py` 不变，先新增独立测试脚本。
2. 测试脚本建议命名为 `scripts/build_installer_shell_prototype.py`。
3. 脚本职责：
   - 确认标准 NSIS 安装包已存在。
   - 构建 Tauri 安装器壳。
   - 将 NSIS 安装包作为资源打入 Tauri 壳。
   - 输出原型安装器到 `build/installer-shell/`。
4. 原型稳定后，再评估是否合并进 `scripts/build_pc_package.py`。

验收标准：

- 标准安装包和自定义安装器壳可以并存。
- 原有 `python scripts\build_pc_package.py` 行为不受影响。
- 原型安装器输出路径清晰，不污染正式 releases。

### 6. 对比评估

从以下维度判断是否进入正式开发：

| 维度 | 通过标准 |
|------|----------|
| UI 还原度 | 可接近参考图主要视觉结构 |
| 安装可靠性 | 成功、失败、取消、重复安装均可预测 |
| 构建成本 | 不显著拉长正式构建流程 |
| 维护成本 | NSIS 仍承担安装闭环，Tauri 只承担 UI 和调度 |
| 包体影响 | 增量体积可接受 |
| 用户体验 | 安装流程比标准 NSIS 明显更友好 |

## 欢迎页安装器壳 UI 设计计划

### 思考与分析

参考图的核心价值不是“做一张复杂插画”，而是让安装器第一眼形成“轻松、可靠、有创作陪伴感”的判断。因此欢迎页应保留参考图的三层体验：

1. 第一层是可信的安装器结构：无边框窗口、清晰标题栏、可见步骤、底部固定操作区。
2. 第二层是故事书式视觉记忆点：打开的书本、纸张纹理、柔和天空、品牌角色。
3. 第三层是安装价值表达：提示词管理、快速调用、本地安全三类卖点。

当前 `installer-shell/` 已有最小可运行 UI，但角色和书本主要由 CSS 临时绘制，适合验证结构，不适合作为正式视觉。正式欢迎页应让本地图片承担氛围和角色质感，CSS 只负责布局、阴影、状态和轻量动效，避免把复杂插画硬编码进样式。

设计方向确定为“打开一本创作手册”。整体窗口仍采用 `1280 x 720` 固定尺寸，品牌 Logo、标题和口号统一放在窗口左上天空留白区；视觉重点放在居中的展开书本区域：左页展示角色插画和创作场景，右页展示欢迎标题、三项能力说明和主操作按钮。左侧步骤栏在首版可以保留，但应降低装饰强度，避免和书本主视觉抢焦点。

### 实施计划

1. 先重构欢迎页视觉层级，不改变 Tauri 调用 NSIS 的安装逻辑。
2. 将欢迎页拆为固定结构：
   - 背景氛围层：天空、云朵、柔光。
   - 书本主体层：展开书本、左右页、页脊、书页阴影。
   - 品牌窗口层：应用图标、产品标题和口号固定在窗口左上天空留白区。
   - 品牌插画层：角色、创作道具、少量点缀。
   - 内容交互层：欢迎标题、卖点列表、下一步、取消、窗口控制。
3. 使用 CSS Grid 固定大布局，按钮区使用稳定尺寸，禁止因为图片加载或文字变化导致布局跳动。
4. 欢迎页标题建议：
   - 主标题：`欢迎安装 提示词管家`
   - 辅助文案：`让每一个灵感，都能被更好地记录与使用`
5. 三项卖点建议：
   - `高效管理`：分类、标签、收藏，轻松管理你的提示词。
   - `随时调用`：快速搜索与调用，让创作更高效。
   - `安全可靠`：本地数据存储，隐私安全，安心使用。
6. 动效只做轻量进入和微交互：
   - 窗口打开时书本与内容 `180ms` 淡入上移。
   - 主按钮悬停时轻微上浮，阴影增强。
   - 星星或花瓣点缀可做低频漂浮，但必须遵守 `prefers-reduced-motion`。
   - 不做强翻页动画作为首版核心能力。

### 需要本地图片实现的资源

本轮欢迎页图片来源固定为：

```text
UI设计稿/安装壳UI/
```

该目录作为原始设计稿目录，不直接作为运行时资源目录。正式实现时需要将图片压缩并复制到：

```text
installer-shell/src/assets/installer-welcome/
```

压缩后的资源命名使用英文小写和连字符，避免在业务代码中引用中文文件名。当前设计稿目录已有图片映射如下：

| 原始图片 | 压缩后建议文件名 | 建议路径 | 推荐格式 | 用途 | 说明 |
|------|------------|----------|----------|------|------|
| `天空云朵背景.jpg` | `welcome-sky.jpg` | `installer-shell/src/assets/installer-welcome/` | 压缩 JPG，必要时转 WebP | 窗口底层氛围 | 原图约 `50KB`，尺寸 `1672 x 941`，适合覆盖 `1280 x 720` 窗口背景 |
| `书本主体角色插画.png` | `welcome-book-mascot.webp` | `installer-shell/src/assets/installer-welcome/` | WebP，必要时保留压缩 PNG | 欢迎页主视觉 | 作为书本主体和角色插画的核心图片，优先替换 CSS 临时绘制角色 |
| `对话.png` | `feature-manage.png` | `installer-shell/src/assets/installer-welcome/` | 压缩 PNG | 卖点图标 | 对应“高效管理”或提示词对话语义 |
| `收藏.png` | `feature-quick-access.png` | `installer-shell/src/assets/installer-welcome/` | 压缩 PNG | 卖点图标 | 对应“随时调用”或收藏调用语义 |
| `爱心.png` | `feature-secure.png` | `installer-shell/src/assets/installer-welcome/` | 压缩 PNG | 卖点图标 | 对应“安全可靠”或安心使用语义 |

首版明确使用 `天空云朵背景.jpg` 承担窗口底层氛围，使用 `书本主体角色插画.png` 承担主视觉。暂不再单独规划枝叶、桌面道具、书签等额外图片；如果主视觉已包含这些内容，应优先使用合成图降低切图和对位成本。后续只有在截图验证发现背景留白不足、层次不够或局部遮挡时，再补充拆分素材。

图片准备规则：

- `UI设计稿/安装壳UI/` 只保存原始图片，不在页面中直接引用。
- 页面只引用 `installer-shell/src/assets/installer-welcome/` 内的压缩后图片。
- 天空背景可先保留 JPG；如果后续视觉压缩后出现明显色带，再尝试 WebP 或提高 JPG 质量。
- 主视觉图片优先压缩为 WebP；如果透明通道或边缘质量受影响，则保留压缩 PNG。
- 三个小图标保持 PNG 即可，但需要压缩，避免图标资源体积异常。
- 首版目标是欢迎页全部图片资源增量不超过 `1.5MB`；若主视觉压缩后仍超过 `1MB`，需要继续降尺寸或调整压缩质量。
- 所有图片必须预留安全留白，避免在 `1280 x 720` 内遮挡标题栏、步骤栏和底部按钮。
- 压缩前后需要记录文件体积，作为后续是否进入正式方案的评估依据。

### 外部图标接入计划

欢迎页功能卖点和标题栏控制按钮可以使用外部图标，但必须按《外部图标本地化接入规范》落地：

1. 图标库建议统一选择 Lucide，授权为 ISC License。
2. 不使用 CDN、在线字体或运行时远程图标。
3. SVG 下载后保存到：

```text
installer-shell/src/assets/icons/
```

4. 建议图标清单：

| 用途 | 建议图标语义 | 建议文件名 |
|------|--------------|------------|
| 高效管理 | folders 或 tags | `prompt-manage.svg` |
| 随时调用 | search 或 zap | `quick-access.svg` |
| 安全可靠 | shield-check 或 lock-keyhole | `local-secure.svg` |
| 下一步箭头 | arrow-right | `arrow-right.svg` |
| 最小化 | minus | `window-minimize.svg` |
| 关闭 | x | `window-close.svg` |

5. SVG 清理要求：
   - 保留 `viewBox`。
   - 删除固定 `width`、`height`。
   - 颜色使用 `currentColor`。
   - 不把整段 SVG 直接粘进 HTML。
6. 授权记录在正式接入时补充到本计划或对应提交说明中，记录来源、协议、是否商用、是否二次修改和本地路径。

### 视觉与交互验收标准

- `1280 x 720` 窗口内完整显示，不出现滚动条。
- 欢迎页第一眼能识别“提示词管家”和“安装向导”。
- 主按钮只保留一个，首屏文案为 `下一步`。
- 取消按钮视觉弱于主按钮，但仍清晰可点。
- 标题栏最小化和关闭按钮可用，关闭安装前弹出确认。
- 图片未加载时仍有可读标题和可用按钮，不出现空白主界面。
- 卖点图标、文字和按钮在浅色背景上对比清晰。
- 动效关闭时页面仍完整、稳定、可操作。

### 任务清单

- [x] 确认欢迎页原始图片来源目录：`UI设计稿/安装壳UI/`。
- [x] 确认当前可用原始图片：`天空云朵背景.jpg`、`书本主体角色插画.png`、`对话.png`、`收藏.png`、`爱心.png`。
- [x] 准备 `installer-shell/src/assets/installer-welcome/` 压缩图片输出目录。
- [x] 将 `天空云朵背景.jpg` 压缩或复制为 `welcome-sky.jpg`。
- [x] 将 `书本主体角色插画.png` 压缩为 `welcome-book-mascot.webp` 或压缩 PNG。
- [x] 将 `对话.png`、`收藏.png`、`爱心.png` 压缩并重命名为英文资源文件。
- [x] 记录压缩前后文件体积，确认欢迎页图片资源增量不超过 `1.5MB`。
- [ ] 准备 `installer-shell/src/assets/icons/` 图标目录及 Lucide 授权记录。
- [x] 将 CSS 临时绘制角色和书本主体替换为压缩后的本地主视觉图片。
- [x] 优化欢迎页右页文案、卖点列表和按钮布局。
- [x] 为窗口控制和主按钮补充 CSS 图标与聚焦状态；首屏暂不展示步骤状态。
- [x] 增加低动效适配，确保 `prefers-reduced-motion` 下禁用漂浮和入场动画。
- [x] 截图验证 1280 x 720 下无重叠、无溢出、按钮可见。
- [x] 同步更新 `docs/apps-code-map.md` 和 `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md`。

### 实施记录-260511

已将欢迎页从 CSS 临时绘制书本与角色，调整为本地图片复刻参考图的单屏书本安装器 UI。

260511 补充修正：欢迎页外层窗口固定为 `1280 x 720`，书本图片与欢迎标题、卖点列表、按钮统一放入固定书本画布中定位，品牌 Logo 和标题移到窗口左上天空留白区，避免宽屏环境下文字和标题脱离预期位置。

260511 布局精修：右页欢迎标题、卖点列表和按钮进一步收进书页安全区；三枚卖点图标改为 CSS 遮罩着色，分别使用蓝色、黄色、粉色，避免纯白图形在浅色底座上辨识度不足。

260511 按钮区修正：将欢迎页底部操作区改为右页安全区内的绝对定位元素，并上移到第三条卖点下方留白区域，避免按钮压到书本蓝色外壳或窗口外部背景。

260511 品牌与装饰资源修正：将品牌 Logo 和标题移到窗口左上天空留白区；将漂浮装饰替换为 `UI设计稿/安装壳UI/星星.png` 压缩后的 `sparkle-star.png`；将分割线中间图标替换为 `UI设计稿/安装壳UI/宠物管理.png` 压缩后的 `pet-manage.png`，并使用暖色遮罩避免纯白低对比。

本次压缩后的运行时资源如下：

| 资源 | 输出文件 | 体积 |
|------|----------|------|
| 天空背景 | `installer-shell/src/assets/installer-welcome/welcome-sky.jpg` | `69994` 字节 |
| 书本主体角色插画 | `installer-shell/src/assets/installer-welcome/welcome-book-mascot.webp` | `62422` 字节 |
| 应用图标 | `installer-shell/src/assets/installer-welcome/app-icon.png` | `11017` 字节 |
| 高效管理图标 | `installer-shell/src/assets/installer-welcome/feature-manage.png` | `1909` 字节 |
| 随时调用图标 | `installer-shell/src/assets/installer-welcome/feature-quick-access.png` | `1589` 字节 |
| 安全可靠图标 | `installer-shell/src/assets/installer-welcome/feature-secure.png` | `1378` 字节 |
| 漂浮星星装饰 | `installer-shell/src/assets/installer-welcome/sparkle-star.png` | `1472` 字节 |
| 分割线宠物管理图标 | `installer-shell/src/assets/installer-welcome/pet-manage.png` | `1303` 字节 |

图片资源合计仍低于 `1.5MB` 目标。静态预览截图检查已通过，截图证据不纳入版本控制。

## 许可协议页安装器壳 UI 设计计划

### 思考与分析

许可协议页需要比欢迎页更强调“可读、可确认、可信赖”。参考图的关键不是增加装饰，而是把协议阅读放入右页纸张安全区，让用户明确知道当前处于第 2 页，并通过勾选协议后再继续安装。

本页采用“左页陪伴插画 + 右页协议阅读”的双页书本结构：全局品牌区固定在窗口左上天空留白区，左页继续承载角色氛围，右页只承载协议标题、页码分割线、协议正文框、同意复选框和底部操作按钮。协议正文框独立滚动，页面整体不滚动，避免底部按钮被长文本挤出窗口。

### 实施计划

1. 复用欢迎页的 `1280 x 720` 无边框窗口、天空背景、标题栏和固定书本画布。
2. 将 `UI设计稿/安装壳UI/许可协议页插画.png` 压缩为运行时资源 `installer-shell/src/assets/installer-license/license-book.webp`。
3. 应用图标、产品名和一句品牌文案由全局窗口品牌区统一展示，不进入书本左页内容层。
4. 右页采用居中标题：主标题 `安装协议`，副标题 `阅读许可协议`，下方显示 `第 2 页 · 安装协议` 分割线。
5. 协议正文框固定高度并独立滚动，使用纸张白底、浅棕描边和柔和滚动条。
6. 复选框文案为 `我已阅读并同意许可协议`；未勾选时禁用 `下一步`，勾选后恢复蓝色主按钮。
7. 底部按钮按参考图排列为 `上一步`、`下一步`、`取消`，三者必须全部位于右页纸张安全区内。

### 需要本地图片实现的资源

| 原始图片 | 压缩后文件名 | 路径 | 推荐格式 | 用途 |
|------|------|------|------|------|
| `许可协议页插画.png` | `license-book.webp` | `installer-shell/src/assets/installer-license/` | WebP | 许可协议页书本主体与左页角色插画 |

本页暂不新增外部 SVG 图标。标题栏控制、箭头和复选框先沿用 CSS 绘制，避免为单页原型引入不必要的图标授权记录；后续若统一替换为 Lucide，需要按《外部图标本地化接入规范》记录来源、协议、用途和本地路径。

### 实施记录-260511

已将许可协议页接入 `installer-shell/` 静态原型。运行时资源如下：

| 资源 | 输出文件 | 体积 |
|------|----------|------|
| 许可协议页书本与左页插画 | `installer-shell/src/assets/installer-license/license-book.webp` | `95484` 字节 |

本次页面实现包含：

- 右页协议标题、页码分割线、说明文案和协议正文滚动框。
- `我已阅读并同意许可协议` 复选框。
- 未勾选协议时禁用 `下一步`，勾选后启用并通过 `aria-live` 更新辅助状态。
- `上一步 / 下一步 / 取消` 三按钮固定在右页底部安全区。

## 安装位置页安装器壳 UI 设计计划

### 思考与分析

安装位置页是用户第一次需要做路径决策的步骤，视觉上必须继续保持前两页的“同一本书”连续感，不能因为加入路径输入控件而变成普通表单窗口。参考图的关键约束是：书本主视觉大小、画布位置和前面的首页、引导页保持一致；右页标题也沿用引导页的标题锚点和居中排版，只替换为安装位置相关文案。

本页采用“左页场景插画 + 右页路径选择”的双页书本结构。左页继续承担陪伴感和品牌记忆，右页只承载当前页码、安装位置标题、路径选择卡片、空间信息、提示条和底部操作按钮。书本图片本身不参与交互，路径选择、浏览按钮和底部按钮必须使用真实 HTML 控件，方便后续接入 Tauri 目录选择与路径校验。

### 实施计划

1. 复用欢迎页和许可协议页的 `1280 x 720` 无边框窗口、天空背景、标题栏和固定书本画布。
2. 书本图片大小必须和首页、引导页保持一致：沿用现有 `.welcome-page .book-canvas` 与 `.license-page .book-canvas` 的 `1210 x 681` 画布尺寸，不为安装位置页单独缩放书本。
3. 将 `UI设计稿/安装壳UI/安装位置页.png` 压缩为运行时资源 `installer-shell/src/assets/installer-location/location-book.webp`。
4. 安装位置页标题位置必须和引导页保持一致：右页标题面板沿用许可协议页的标题安全区锚点，主标题、副标题和页码分割线只替换文案，不下移、不扩宽到书页边缘。
5. 右页采用居中标题：页码 `第 3 页 · 安装位置`，主标题 `选择安装位置`，其中 `安装位置` 使用蓝色强调，副标题为 `选择提示词管家的安装文件夹`。
6. 路径选择卡片使用真实控件样式，包含文件夹图标、当前路径文本和 `浏览` 按钮；首版路径文案为 `C:\Program Files\提示词管家`。
7. 空间信息行展示 `可用空间：120 GB` 与 `所需空间：256 MB`，后续接入真实磁盘检测前先作为静态原型数据。
8. 提示条使用浅蓝底和灯泡图标，文案为 `建议安装到默认路径，以确保程序正常运行和自动更新。`
9. 底部按钮按参考图排列为 `上一步`、`下一步`、`取消`，三者必须全部位于右页纸张安全区内，并和许可协议页底部按钮区保持同一视觉节奏。

### 需要本地图片实现的资源

| 原始图片 | 压缩后文件名 | 路径 | 推荐格式 | 用途 |
|------|------|------|------|------|
| `安装位置页.png` | `location-book.webp` | `installer-shell/src/assets/installer-location/` | WebP，必要时保留压缩 PNG | 安装位置页书本主体、左页角色场景和右页纸张底纹 |
| `星星.png` | 复用 `sparkle-star.png` | `installer-shell/src/assets/installer-welcome/` | PNG | 标题和按钮附近的轻量装饰 |

路径输入框、空间信息、提示条和按钮不使用整图切片实现，必须保留为真实 DOM，确保后续可以接入目录选择、路径校验、错误提示和键盘焦点。

### 外部图标接入计划

安装位置页可以按《外部图标本地化接入规范》引入 Lucide SVG，统一保存到：

```text
installer-shell/src/assets/icons/installer-location/
```

| 用途 | 建议图标语义 | 建议文件名 |
|------|--------------|------------|
| 路径输入 | folder | `folder.svg` |
| 磁盘空间 | hard-drive | `hard-drive.svg` |
| 提示条 | lightbulb | `lightbulb.svg` |
| 下一步箭头 | arrow-right | `arrow-right.svg` |

SVG 需要保留 `viewBox`，删除固定 `width`、`height` 和硬编码颜色，颜色统一交给 `currentColor` 或 CSS 控制；不得使用 CDN 或运行时外链。

### 实施记录-260511

已将安装位置页接入 `installer-shell/` 静态原型，并保持与欢迎页、许可协议页一致的书本显示基准：

- 运行时书本素材：`1279 x 720`。
- 页面书本画布：`1210 x 681`。
- 右页标题面板：沿用 `top: 70px; right: 136px; width: 418px`。

运行时资源如下：

| 资源 | 输出文件 | 体积 |
|------|----------|------|
| 安装位置页书本与左页插画 | `installer-shell/src/assets/installer-location/location-book.webp` | `87282` 字节 |
| 路径输入图标 | `installer-shell/src/assets/icons/installer-location/folder.svg` | `319` 字节 |
| 磁盘空间图标 | `installer-shell/src/assets/icons/installer-location/hard-drive.svg` | `439` 字节 |
| 提示条图标 | `installer-shell/src/assets/icons/installer-location/lightbulb.svg` | `358` 字节 |
| 下一步箭头图标 | `installer-shell/src/assets/icons/installer-location/arrow-right.svg` | `238` 字节 |

图标来源记录：

```text
来源：Lucide
授权：ISC License
用途：安装位置页路径、磁盘空间、提示条和下一步箭头图标
本地路径：installer-shell/src/assets/icons/installer-location/
修改：清理固定尺寸，统一使用 currentColor
授权文本：installer-shell/src/assets/icons/lucide-license.txt
```

本次页面实现包含：

- 安装位置页页面模块 `installer-shell/src/pages/install-location.js`。
- `welcome -> license -> install-location` 步骤流。
- `?step=install-location` 和 `?step=location` 静态预览入口。
- 右页路径选择卡片、空间信息、默认路径提示条和底部操作按钮。
- `浏览` 按钮首版保留为原型交互，点击后提示后续接入目录选择，暂不调用系统目录选择器。

静态预览截图检查已通过，截图证据不纳入版本控制。

### 布局验证记录-260511

针对“内部 UI 不要超过书本”的要求，已重新收紧安装位置页右页控件：

- 页码分割线从右页顶部向内收进。
- 路径选择卡片宽度收紧为 `396px`。
- 提示条宽度控制为 `406px`，并调整字号避免换行溢出。
- 底部按钮区左右各内收 `12px`，底部上移到 `22px`。

静态截图复测结果：

| 验证项 | 结果 |
|------|------|
| 书本画布尺寸 | `1210 x 681`，通过 |
| 运行时截图尺寸 | `1280 x 720`，通过 |
| 页码分割线 | 位于书本和右页安全区内 |
| 路径选择卡片 | 位于书本和右页安全区内 |
| 提示条 | 位于书本和右页安全区内 |
| 底部按钮区 | 位于书本和右页安全区内 |

复测截图检查已通过，截图证据不纳入版本控制。

260511 标题超出修正：安装位置页标题组不再贴近右页顶部弧形纸面，已将 `.install-location-panel` 从 `top: 70px` 下移到 `top: 92px`，主标题字号从 `38px` 收敛到 `34px`；页码分割线调整为相对标题组 `top: -20px`。同步压缩标题下方间距，让路径卡、空间信息、提示条和底部按钮仍完整位于右页纸张安全区内。复测坐标校验显示页码、标题、路径卡、提示条和底部按钮均在书本与右页安全区内。

260511 按钮位置对齐修正：安装位置页底部按钮区已和许可协议引导页使用同一视觉基准，`.location-actions` 改为 `left: 0; right: 0; bottom: 34px`，列宽改为 `120px 154px 120px`。因为安装位置页标题组整体下移到 `top: 92px`，`bottom: 34px` 可让按钮区最终视口坐标与许可协议页 `.license-actions` 的 `bottom: 12px` 保持一致。坐标校验结果显示两页按钮区均为 `x=691, y=525.5, width=418, height=48`，且仍在书本内部。

260511 标题与步数顺序最终修正：安装位置页标题区改为和许可协议引导页一致的内容顺序，先显示标题与说明，再显示 `第 3 页 · 安装位置` 步数分割线。`.install-location-panel` 恢复为与引导页一致的 `top: 70px`，`.location-actions` 恢复为与引导页一致的 `bottom: 12px`，按钮区继续保持 `x=691, y=525.5, width=418, height=48`。复测截图显示标题在上、步数在下，标题、步数、路径卡、提示条和按钮均位于右页书本内部。

## 附加任务页安装器壳 UI 设计计划

### 思考与分析

附加任务页位于安装页之前，紧跟安装位置页之后。它的职责不是展示安装进度，也不能在进入页面时触发安装，而是让用户在点击“开始安装”前确认安装后要执行的便利行为，例如创建桌面快捷方式、添加开始菜单入口、安装完成后启动应用或检查更新。因此本页需要比欢迎页更偏“设置确认”，但仍必须严格复刻参考图的双页书本排版，不能退回普通系统安装器表单。

参考图的核心布局由五层组成：

1. 窗口层：右上角最小化、关闭按钮位于窗口天空背景层，和前几页保持一致。
2. 书本主视觉层：使用本地图片承载展开书本、左页角色场景、右页纸张底纹和页角装饰。
3. 右页标题层：右边标题必须和引导页排版保持一致，沿用许可协议页、安装位置页的标题面板锚点、居中方式、字号层级和“标题/说明在上、页码分割线在下”的顺序。
4. 附加任务列表层：使用真实 DOM 复选框、图标底座、标题与说明文案实现，不能把选项切到图片里。
5. 底部操作层：`上一步`、`开始安装`、`取消` 固定在右页纸张安全区内，主按钮为唯一高亮操作。

本页的设计方向是“安装前的轻量确认清单”。视觉上保留参考图中柔和卡片、蓝色勾选、图标底座和右页信息摘要，但交互上必须服从真实安装逻辑：复选框状态要能传递给 NSIS 或后续安装后动作，不做纯装饰性勾选。

### 实施计划

1. 新增页面模块 `installer-shell/src/pages/install-tasks.js`，页面模块只返回语义化 HTML，不直接绑定全局流程事件。
2. 在 `installer-shell/src/main.js` 注册 `install-tasks` 步骤，首版按“附加任务页直接进入正在安装页”的流程调整为：
   - `welcome`
   - `license`
   - `install-location`
   - `install-tasks`
   - `installing`
   - `complete`
   如果后续恢复独立“准备安装页”，则 `install-tasks` 仍保持在真正安装页之前，流程变为 `install-tasks -> ready-to-install -> installing`。
3. 继续复用统一书本基准：
   - 窗口画布固定为 `1280 x 720`。
   - 书本素材运行时画布保持 `1279 x 720`。
   - 页面书本画布保持 `1210 x 681`。
   - 全局品牌区继续固定在窗口左上天空留白区，不参与右页内容排版。
4. 将 `UI设计稿/安装壳UI/附加任务页.png` 压缩为运行时资源：

```text
installer-shell/src/assets/installer-tasks/tasks-book.webp
```

5. 右页标题必须和引导页排版保持一致：
   - 标题面板沿用统一基准 `top: 70px; right: 136px; width: 418px`。
   - 主标题建议为 `安装选项`，深棕色、居中、加粗。
   - 强调标题建议为 `附加任务`，主蓝色、居中、加粗，和欢迎页 `提示词管家`、安装位置页 `安装位置` 保持同一层级。
   - 说明文案为 `选择您希望在安装过程中执行的附加任务`。
   - 页码分割线为 `第 4 页 · 安装选项`，放在标题说明下方，不贴近书页右上角。
6. 附加任务列表使用真实 DOM 复选框实现，首版建议包含：
   - `创建桌面快捷方式`，默认勾选。
   - `添加到开始菜单`，默认勾选。
   - `开机后自动检查更新`，默认不勾选；如果后端暂未支持该能力，首版只保留 UI 状态并在实现记录里标注暂不接入安装行为。
7. 选项行布局严格参考图片：
   - 左侧为自定义复选框，尺寸稳定，不因勾选状态导致布局跳动。
   - 中间为图标底座，建议 `42px x 42px`，图标居中。
   - 右侧为两行文字，标题 `15px-16px` 加粗，说明 `12px-13px`。
   - 每个选项行保持圆角白底、浅色描边和轻微阴影，宽度不超过右页安全区。
8. 底部应用摘要卡可作为附加任务页的安装前确认信息：
   - 显示应用图标、`提示词管家`、一句短说明。
   - 显示安装大小，例如 `128 MB`，首版如无真实计算可使用静态文案并在后续接入真实包体。
   - 右侧圆环装饰可以用 CSS 实现，不建议切图。
9. 底部按钮区使用与许可协议页、安装位置页一致的三按钮节奏：
   - `上一步` 返回安装位置页。
   - `开始安装` 是本页唯一会推进到安装执行阶段的动作，点击后才进入正在安装页并触发后续安装流程。
   - `取消` 弹出确认后退出安装向导。
10. 附加任务状态由 `main.js` 管理，建议结构为：

```js
installTasks: {
  desktopShortcut: true,
  startMenuShortcut: true,
  autoCheckUpdates: false,
}
```

11. 接入 NSIS 前先明确能力边界：
   - 如果 NSIS 当前只能默认创建快捷方式，本页首版需要将勾选状态保存为 UI 状态，不误称已经控制安装脚本。
   - 若要真正生效，需要后续让 NSIS 支持命令行变量，或在安装完成后由 Tauri 壳执行补充动作。

### 需要本地图片实现的资源

本页图片来源固定为：

```text
UI设计稿/安装壳UI/
```

原始设计稿目录只保存源文件，页面不得直接引用中文路径。正式接入时需要压缩并复制到：

```text
installer-shell/src/assets/installer-tasks/
```

| 原始图片 | 压缩后文件名 | 建议路径 | 推荐格式 | 用途 | 是否必须用图片 |
|------|------|------|------|------|------|
| `附加任务页.png` | `tasks-book.webp` | `installer-shell/src/assets/installer-tasks/` | WebP，必要时保留压缩 PNG | 附加任务页书本主体、左页插画、右页纸张底纹和页角装饰 | 必须 |
| `天空云朵背景.jpg` | 复用 `welcome-sky.jpg` | `installer-shell/src/assets/installer-welcome/` | JPG | 窗口底层天空背景 | 建议复用 |
| `星星.png` | 复用 `sparkle-star.png` | `installer-shell/src/assets/installer-welcome/` | PNG | 标题两侧轻量闪光点缀 | 建议复用 |
| `宠物管理.png` | 复用 `pet-manage.png` | `installer-shell/src/assets/installer-welcome/` | PNG | 页码分割线两侧语义点缀 | 可复用 |
| `app-icon.png` | 复用 `app-icon.png` | `installer-shell/src/assets/installer-welcome/` | PNG | 底部应用摘要卡图标 | 建议复用 |

更适合用真实 DOM 和 CSS 实现的内容：

| UI 元素 | 实现方式 | 原因 |
|------|------|------|
| 标题、说明文案和页码 | DOM 文本 | 需要和引导页统一排版，后续页码可能调整 |
| 三个附加任务选项 | DOM 复选框 | 状态需要可读、可聚焦、可传递给安装流程 |
| 勾选态蓝色对勾 | CSS 或本地 SVG | 不能只依赖颜色表达状态 |
| 选项图标底座 | DOM + CSS | 需要 hover、focus、禁用状态 |
| 安装大小摘要 | DOM 文本 | 后续可接入真实包体大小 |
| 右侧圆环装饰 | CSS | 纯装饰，不需要增加图片切片 |
| 底部按钮 | 原生按钮 | 需要禁用、聚焦、键盘访问和事件绑定 |

图片准备规则：

- `附加任务页.png` 作为本页主视觉底图，优先压缩为 WebP。
- 压缩后目标体积建议不超过 `180KB`；若超过 `320KB`，需要降尺寸或调整质量。
- 保留与前几页一致的 `1279 x 720` 或等比例运行时画布，禁止单独裁切成不同宽高比。
- 右页纸张区域必须给 DOM 覆盖内容预留安全留白，不能让设计稿自带不可交互的复选框文字或按钮成为唯一信息来源。
- 压缩前后记录文件体积，写入实施记录。

### 外部图标接入计划

本页可以按《外部图标本地化接入规范》引入 Lucide SVG，并统一保存到：

```text
installer-shell/src/assets/icons/installer-tasks/
```

| 用途 | 建议图标语义 | 建议文件名 | 说明 |
|------|------|------|------|
| 创建桌面快捷方式 | monitor 或 screen | `desktop-shortcut.svg` | 对应桌面快捷方式选项 |
| 添加到开始菜单 | grid-2x2 或 layout-grid | `start-menu.svg` | 对应开始菜单入口选项 |
| 自动检查更新 | refresh-cw | `auto-update.svg` | 对应启动后检查更新选项 |
| 开始安装箭头 | arrow-right | `start-install.svg` | 主按钮右侧箭头，可复用已有 `arrow-right.svg` |

首版优先复用现有 `installer-location/arrow-right.svg` 作为主按钮箭头；附加任务三枚图标若从 Lucide 新增，必须保留 `viewBox`，删除固定 `width`、`height` 和硬编码颜色，统一使用 `currentColor`，不得使用 CDN、在线字体或运行时外链。正式引入时补充授权记录：

```text
来源：Lucide
授权：ISC License
用途：附加任务页选项图标
本地路径：installer-shell/src/assets/icons/installer-tasks/
修改：清理固定尺寸，统一使用 currentColor
授权文本：installer-shell/src/assets/icons/lucide-license.txt
```

### 视觉与交互验收标准

- `1280 x 720` 下无滚动条、无遮挡、无文字溢出。
- 书本主体尺寸与欢迎页、许可协议页、安装位置页、正在安装页切换时不跳变。
- 右页标题锚点、居中方式、字号层级和标题/说明/页码顺序与引导页保持一致。
- 三个附加任务选项全部位于右页纸张安全区内，复选框、图标和文字对齐稳定。
- 默认状态为桌面快捷方式、开始菜单勾选，自动检查更新未勾选。
- 复选框状态不能只靠颜色表达，必须有清晰勾选图形。
- `开始安装` 是唯一主按钮，点击后进入正在安装页。
- `上一步` 返回安装位置页时保留用户已选择的附加任务状态。
- `取消` 和关闭窗口在开始安装前需要确认，开始安装后遵守正在安装页的退出确认逻辑。
- 附加任务页本身不得调用 `install_with_nsis`，不得展示安装中进度，也不得把未开始安装的状态伪装成正在安装。
- 图片未加载时仍显示标题、任务选项和按钮，不出现空白主界面。
- 若附加任务状态尚未真正接入 NSIS，页面实现记录必须明确标注“UI 状态已保存，安装脚本生效待接入”，不能误报完整闭环。

### 任务清单

- [x] 确认 `UI设计稿/安装壳UI/附加任务页.png` 可作为本页主视觉底图。
- [x] 新建 `installer-shell/src/assets/installer-tasks/` 运行时资源目录。
- [x] 将 `附加任务页.png` 压缩为 `tasks-book.webp`，并记录压缩前后体积。
- [x] 准备或复用附加任务页图标，并补充 Lucide 授权记录。
- [x] 新增 `installer-shell/src/pages/install-tasks.js` 页面模块。
- [x] 在 `main.js` 注册 `install-tasks` 步骤和附加任务状态。
- [x] 在 `styles.css` 增加附加任务页右页标题、任务选项、摘要卡和按钮样式。
- [x] 将安装位置页 `下一步` 调整为进入附加任务页。
- [x] 将附加任务页 `开始安装` 调整为进入正在安装页并触发安装。
- [x] 将正在安装页页码调整为 `第 5 页 · 正在安装`，避免和附加任务页 `第 4 页 · 安装选项` 冲突。
- [x] 评估附加任务状态是否能传递给 NSIS；不能传递时在实施记录中明确边界。
- [x] 截图验证 `1280 x 720` 下 UI 严格落在书本安全区内。
- [x] 同步更新 `docs/apps-code-map.md` 和 `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md`。

### 实施记录-260511

已将附加任务页接入 `installer-shell/` 静态原型，页面位于安装位置页之后、正在安装页之前，进入附加任务页本身不会调用 `install_with_nsis`。

运行时资源如下：

| 资源 | 输出文件 | 体积 |
|------|----------|------|
| 附加任务页书本与左页插画 | `installer-shell/src/assets/installer-tasks/tasks-book.webp` | `51804` 字节 |

新增本地化 Lucide SVG 图标如下：

| 用途 | 输出文件 |
|------|----------|
| 创建桌面快捷方式 | `installer-shell/src/assets/icons/installer-tasks/desktop-shortcut.svg` |
| 添加到开始菜单 | `installer-shell/src/assets/icons/installer-tasks/start-menu.svg` |
| 开机后自动检查更新 | `installer-shell/src/assets/icons/installer-tasks/auto-update.svg` |

授权记录：

```text
来源：Lucide
授权：ISC License
用途：附加任务页选项图标
本地路径：installer-shell/src/assets/icons/installer-tasks/
修改：清理固定尺寸，统一使用 currentColor
授权文本：installer-shell/src/assets/icons/lucide-license.txt
```

本次页面实现包含：

- 附加任务页页面模块 `installer-shell/src/pages/install-tasks.js`。
- `welcome -> license -> install-location -> install-tasks -> installing` 步骤流。
- `?step=install-tasks` 和 `?step=tasks` 静态预览入口。
- 桌面快捷方式、开始菜单、自动检查更新三项真实 DOM 复选框。
- 附加任务状态保存在 `main.js` 的 `state.installTasks` 中，返回上一步后状态保留。
- `开始安装` 点击后才进入正在安装页；正在安装页进入后才触发安装命令。
- 当前 NSIS 命令仍只接收安装目录，附加任务状态暂未传递给安装脚本；后续若要真正控制快捷方式行为，需要扩展 NSIS 命令行变量或由 Tauri 在安装后执行补充动作。
- 正在安装页页码已顺延为 `第 5 页 · 正在安装`。

静态预览截图检查已通过，截图证据不纳入版本控制。

## 正在安装页安装器壳 UI 设计计划

### 思考与分析

正在安装页是安装流程里最需要“稳定感”的页面。参考图的重点不是让用户继续做选择，而是让用户明确知道程序正在执行安装、当前执行到哪个阶段、是否仍可取消，以及安装器没有卡死。因此本页需要严格延续前几页的 `1280 x 720` 固定窗口、天空背景、展开书本画布和右页安全区排版，同时把右页内容从“表单决策”切换为“进度反馈”。

参考图布局拆解为五个稳定区域：

1. 顶部窗口层：右上角最小化、关闭按钮保持在窗口层，安装中关闭需要二次确认。
2. 左页品牌插画层：继续使用书本左页角色与书架场景，强化“提示词管家正在帮你整理工具”的陪伴感。
3. 右页标题层：标题区域必须和引导页排版保持一致，沿用许可协议页和安装位置页的右页标题锚点、居中方式、字号层级和标题/步数顺序；不为正在安装页单独改成右上偏移排版。
4. 右页进度层：蓝色进度条、阶段百分比、当前文件或当前动作说明、阶段列表全部放在右页纸张安全区内。
5. 底部操作层：主按钮显示禁用态 `安装中`，取消按钮保留可点但必须弹出确认；不提供上一步。

由于 NSIS 静默安装无法天然返回真实逐文件进度，本页不能假装展示精确文件复制百分比。首版采用“阶段式进度”：准备安装、复制文件、注册组件、校验结果、完成安装。百分比可以作为阶段展示值，例如复制文件阶段显示 `72%`，但必须由安装阶段状态驱动，而不是声明为真实文件复制比例。当前文件路径文案也应作为“正在处理”说明，后续只有在 Tauri 后端能够获得明确文件名时才替换为真实路径。

### 实施计划

1. 新增页面模块 `installer-shell/src/pages/installing.js`，只返回语义化 HTML，不在模块内绑定全局事件。
2. 在 `installer-shell/src/main.js` 注册安装流程步骤，建议顺序为：
   - `welcome`
   - `license`
   - `install-location`
   - 后续附加任务或准备安装页
   - `installing`
   - `complete`
3. 复用书本页统一基准：
   - 窗口固定 `1280 x 720`。
   - 书本画布保持 `1210 x 681`。
   - 全局品牌区继续固定在窗口左上天空留白区。
   - 右页内容不得超过书页安全区。
4. 将 `UI设计稿/安装壳UI/正在安装页.png` 压缩为运行时资源 `installer-shell/src/assets/installer-installing/installing-book.webp`。
5. 右页标题必须和引导页排版保持一致：
   - 标题面板沿用引导页统一基准：`top: 70px; right: 136px; width: 418px`。
   - 内容顺序沿用引导页：先显示主标题和说明文案，再显示页码分割线。
   - 主标题：`正在安装`，深棕色、居中、加粗，字号不大于引导页主标题。
   - 说明文案：`程序正在安装到您的设备中，请稍候...`，居中显示在主标题下方。
   - 页码分割线：附加任务页接入后调整为 `第 5 页 · 正在安装`，放在标题说明下方，不贴近书页右上角。
6. 进度条使用真实 DOM 实现，宽度由状态变量控制，不做图片切片。默认阶段建议：
   - 准备安装：`20%`
   - 复制文件：`72%`
   - 注册组件：`84%`
   - 校验结果：`94%`
   - 完成安装：`100%`
7. 当前动作区使用真实 DOM 实现，包含小图标底座、动作标题和路径说明：
   - 动作标题示例：`正在写入程序文件...`
   - 路径示例：`C:\Program Files\PromptManager\core\data\library.db`
8. 阶段列表使用真实 DOM 实现，不直接嵌入图片，方便安装状态更新：
   - `准备安装`：完成态，绿色圆点，右侧 `已完成`
   - `复制文件`：进行态，蓝色圆点，右侧 `进行中`
   - `注册组件`：等待态，灰色圆点，右侧 `等待中`
9. 按钮区固定在右页底部安全区：
   - `安装中` 主按钮禁用，保留蓝色浅化状态。
   - `取消` 按钮可用，点击后弹出确认；首版若不支持中断 NSIS 子进程，则文案明确为“安装正在进行，强制退出可能导致安装不完整”。
   - 不展示 `上一步`。
10. 安装状态由 `main.js` 管理：
    - 进入本页时禁止重复触发安装。
    - Tauri 命令开始前切到“准备安装”。
    - 调用 NSIS 静默安装时切到“复制文件/执行安装程序”。
    - 退出码返回后切到“校验结果”。
    - 校验成功后进入完成页，校验失败进入错误状态页。

### 需要本地图片实现的资源

本页图片来源固定为：

```text
UI设计稿/安装壳UI/
```

原始设计稿目录只保存源文件，页面不得直接引用中文路径。正式接入时需要压缩并复制到：

```text
installer-shell/src/assets/installer-installing/
```

| 原始图片 | 压缩后文件名 | 建议路径 | 推荐格式 | 用途 | 是否必须用图片 |
|------|------|------|------|------|------|
| `正在安装页.png` | `installing-book.webp` | `installer-shell/src/assets/installer-installing/` | WebP，必要时保留压缩 PNG | 正在安装页书本主体、左页角色插画、右页纸张底纹和页角装饰 | 必须 |
| `天空云朵背景.jpg` | 复用 `welcome-sky.jpg` | `installer-shell/src/assets/installer-welcome/` | JPG | 窗口底层天空背景 | 建议复用图片 |
| `星星.png` | 复用 `sparkle-star.png` | `installer-shell/src/assets/installer-welcome/` | PNG | 标题两侧轻量闪光点缀 | 建议复用图片 |

更适合用真实 DOM 和 CSS 实现的内容：

| UI 元素 | 实现方式 | 原因 |
|------|------|------|
| 页码 `第 5 页 · 正在安装` | DOM 文本 | 附加任务页位于安装页之前，因此正在安装页需要顺延为第 5 页 |
| 主标题和说明文案 | DOM 文本 | 需要可读、可本地化、可适配错误状态 |
| 进度条和百分比 | DOM + CSS 变量 | 需要随安装阶段更新，不能做成图片 |
| 当前动作文件路径 | DOM 文本 | 后续接入真实路径或阶段说明 |
| 阶段列表 | DOM 列表 | 需要切换完成、进行中、等待中状态 |
| `安装中` 和 `取消` 按钮 | 原生按钮 | 需要禁用、聚焦、确认弹窗和键盘可访问 |

图片准备规则：

- `正在安装页.png` 作为本页主视觉底图，优先压缩为 WebP。
- 压缩后目标体积建议不超过 `160KB`；若超过 `300KB`，需要降尺寸或调整质量。
- 保留与前几页一致的 `1279 x 720` 或等比例运行时画布，禁止单独裁切成不同宽高比。
- 右页纸张区域必须给 DOM 覆盖内容预留安全留白，不能让插画本身带有不可覆盖的文字或按钮。
- 压缩前后记录文件体积，写入实施记录。

### 外部图标接入计划

本页可以按《外部图标本地化接入规范》引入 Lucide SVG，并统一保存到：

```text
installer-shell/src/assets/icons/installer-installing/
```

| 用途 | 建议图标语义 | 建议文件名 | 说明 |
|------|------|------|------|
| 当前动作文件 | folder 或 file-cog | `installing-file.svg` | 用于“正在写入程序文件”图标底座 |
| 准备安装 | check-circle 或 circle-check | `stage-ready.svg` | 可选，若阶段圆点用 CSS 则不需要 |
| 复制文件 | copy 或 files | `stage-copy.svg` | 可选，首版可用 CSS 圆点代替 |
| 注册组件 | package-check 或 settings | `stage-register.svg` | 可选，后续增强阶段列表时使用 |
| 取消确认 | x-circle | `cancel-install.svg` | 可选，用于确认弹窗 |

首版建议只引入 `installing-file.svg`，阶段状态圆点用 CSS 实现即可，避免图标过多导致视觉噪声。所有 SVG 必须保留 `viewBox`，删除固定 `width`、`height` 和硬编码颜色，统一使用 `currentColor`；不得使用 CDN、在线字体或运行时外链。正式引入时补充授权记录：

```text
来源：Lucide
授权：ISC License
用途：正在安装页当前动作图标
本地路径：installer-shell/src/assets/icons/installer-installing/
修改：清理固定尺寸，统一使用 currentColor
授权文本：installer-shell/src/assets/icons/lucide-license.txt
```

### 视觉与交互验收标准

- `1280 x 720` 下无滚动条、无遮挡、无文字溢出。
- 书本主体尺寸与欢迎页、许可协议页、安装位置页切换时不跳变。
- 右页标题锚点、居中方式、字号层级和标题/步数顺序与引导页保持一致。
- 页码、标题、进度条、当前动作、阶段列表和按钮全部位于右页纸张安全区内。
- 进度条颜色与参考图一致，使用清晰蓝色，不使用大面积紫蓝渐变。
- “安装中”按钮禁用态清晰，不可重复触发安装。
- “取消”按钮点击后必须确认，不能误触直接退出。
- 安装过程关闭窗口必须确认；若安装已经进入 NSIS 执行阶段，提示可能导致安装不完整。
- 低动效模式下关闭闪光漂浮和入场动画，进度状态仍清晰可见。
- 图片未加载时仍显示标题、进度说明和按钮，不出现空白主界面。
- 安装成功后自动进入完成页；安装失败时进入错误状态，不误报成功。

### 任务清单

- [x] 确认 `UI设计稿/安装壳UI/正在安装页.png` 可作为本页主视觉底图。
- [x] 新建 `installer-shell/src/assets/installer-installing/` 运行时资源目录。
- [x] 将 `正在安装页.png` 压缩为 `installing-book.webp`，并记录压缩前后体积。
- [x] 复用已本地化 Lucide 文件夹图标作为当前动作图标，暂不新增独立图标目录。
- [x] 新增 `installer-shell/src/pages/installing.js` 页面模块。
- [x] 在 `main.js` 注册 `installing` 步骤和安装阶段状态。
- [x] 在 `styles.css` 增加正在安装页右页标题、进度条、当前动作、阶段列表和按钮样式。
- [x] 接入 Tauri 安装命令状态流，防止重复触发安装。
- [x] 增加取消与关闭确认逻辑。
- [x] 截图验证 `1280 x 720` 下 UI 严格落在书本安全区内。
- [x] 同步更新 `docs/apps-code-map.md` 和 `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md`。

### 实施记录-260511

已将正在安装页接入 `installer-shell/` 静态原型，页面继续沿用欢迎页、许可协议页和安装位置页的同一书本显示基准：

- 运行时书本素材：`1279 x 720`。
- 页面书本画布：`1210 x 681`。
- 右页标题面板：沿用引导页基准 `top: 70px; right: 136px; width: 418px`。
- 标题顺序：先显示主标题 `正在安装` 和说明文案，再显示 `第 5 页 · 正在安装` 分割线。

260511 补充修正：附加任务页确认位于正在安装页之前。正在安装页页码已从 `第 4 页 · 正在安装` 顺延为 `第 5 页 · 正在安装`，步骤流已从 `welcome -> license -> install-location -> installing` 调整为 `welcome -> license -> install-location -> install-tasks -> installing`。

运行时资源如下：

| 资源 | 输出文件 | 体积 |
|------|----------|------|
| 正在安装页书本与左页插画 | `installer-shell/src/assets/installer-installing/installing-book.webp` | `78182` 字节 |

本次页面实现包含：

- 正在安装页页面模块 `installer-shell/src/pages/installing.js`。
- `welcome -> license -> install-location -> install-tasks -> installing` 步骤流。
- `?step=installing` 静态预览入口。
- 阶段式进度条、百分比、当前动作、阶段列表和安装中按钮。
- 安装中主按钮禁用，取消与关闭窗口均需要确认。
- 静态浏览器预览下不调用 Tauri 命令；Tauri 环境下进入本页后调用 `install_with_nsis` 并根据返回结果更新安装阶段。

静态预览截图检查已通过，截图证据不纳入版本控制。

## 安装完成页安装器壳 UI 设计计划

### 思考与分析

安装完成页是整个安装器壳的收束页，核心不是继续承载复杂信息，而是用稳定、明确、愉悦的成功反馈告诉用户“安装已经可靠完成”，并给出最后一步操作。参考图的关键布局需要严格保留：

1. 仍然是 `1280 x 720` 固定窗口和展开书本主体。
2. 左页由完整插画承担情绪价值，表达轻松、创作陪伴和完成奖励。
3. 右页上方保持引导页统一标题排版，中部用成功图标和结果文案形成视觉锚点，下方用两个完成后选项和主按钮完成闭环。
4. 完成页不显示右上角页码提示，避免弱信息干扰最终成功状态；步骤顺序只由内部流程状态维护。

当前项目已经形成稳定模式：`installer-shell/src/index.html` 保留窗口壳，步骤内容由 `installer-shell/src/pages/*.js` 渲染，`main.js` 管理步骤和状态。因此安装完成页不新增 HTML、不引入路由，只新增页面模块和必要状态。正在安装页 `phase: complete` 后再跳转到完成页；安装失败不得进入完成页。

本页视觉方向确定为“打开创作手册后的完成奖励页”。右页标题必须和引导页排版保持一致：标题面板继续沿用 `right: 136px; width: 418px` 的右页基准，完成页收束态整体面板上移到 `top: 58px`，标题居中、字号层级沿用正在安装页，不单独放大、不下移、不为了完成页另起一套版式。

### 实施计划

1. 新增页面模块 `installer-shell/src/pages/complete.js`，只返回语义 HTML。
2. 在 `main.js` 注册 `complete` 步骤，顺序为 `welcome -> license -> install-location -> install-tasks -> installing -> complete`。
3. 安装成功状态处理从“停留在正在完成安装”改为自动进入完成页；失败状态继续留在正在安装页或后续错误页。
4. 完成页右页结构固定为：
   - 主标题：`安装完成`。
   - 装饰分割线：细线、爪印或轻量图标点缀。
   - 成功状态图标：绿色勾选圆形。
   - 主结果文案：`提示词管家已成功安装到你的电脑`。
   - 辅助文案：`感谢你的选择，祝你创作愉快，灵感不断！`。
   - 完成后选项：`立即启动软件`、`创建桌面快捷方式`。
   - 主按钮：`完成`。
5. 两个完成后选项必须使用真实 DOM 开关，不切在图片里；状态需要写入 `state.installTasks` 或新增 `state.completeOptions`，点击完成时传给 Tauri/Rust 命令处理。
6. `完成` 按钮点击逻辑：
   - 若勾选 `立即启动软件`，调用 Tauri 命令启动已安装的主程序。
   - 若勾选 `创建桌面快捷方式`，首版优先复用前一页附加任务状态；若 NSIS 已经固定创建快捷方式，则页面只表达结果，不误称可改变安装脚本行为。
   - 最后关闭安装器壳窗口。
7. 新增完成页样式到 `installer-shell/src/styles.css`，复用现有书本画布、标题、按钮、开关和点缀基础类，避免引入新的全局样式体系。
8. 同步更新 `docs/apps-code-map.md` 和 `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md`，说明完成页模块、资源目录、跳转逻辑和右页标题基准。

### 需要优先用图片实现的效果

本轮图片来源固定为：

```text
UI设计稿/安装壳UI/
```

该目录只作为原始设计稿目录，不直接作为运行时资源目录。正式实现时压缩并复制到：

```text
installer-shell/src/assets/installer-complete/
```

| 原始图片 | 建议运行时文件名 | 建议格式 | 用途 | 是否必须用图片 | 说明 |
|------|------|------|------|------|------|
| `安装完成页.png` | `complete-book.webp` | WebP，必要时保留压缩 PNG | 完成页书本主体、左页插画、右页纸张底纹 | 是 | 这是还原参考图布局的核心素材，负责书本、角色、场景、纸张质感和大氛围 |
| `天空云朵背景.jpg` | 复用 `installer-welcome/welcome-sky.jpg` 或抽到共享背景 | JPG/WebP | 窗口底层天空背景 | 建议复用图片 | 保持所有页面天空和云朵背景一致，避免页面切换跳变 |
| `星星.png` | `complete-star.png` 或复用现有星星素材 | PNG/WebP | 标题两侧和按钮附近点缀 | 建议用图片 | 比 CSS 十字星更接近参考图的柔和插画感 |
| `爱心.png` | `complete-heart.png` 或复用现有爱心素材 | PNG/WebP | 标题右侧粉色爱心点缀 | 建议用图片 | 参考图中爱心属于情绪化插画点缀，用图片更稳定 |
| `图标/打勾勾.png` | `complete-check.png` | PNG 透明图 | 中间成功勾轮廓 | 是 | 作为 CSS mask 使用，由样式填充成功绿色，避免纯白勾图标与页面调性脱节 |
| `宠物管理.png` 或应用图标 | 复用 `installer-welcome/app-icon.png` | PNG/WebP | 左页品牌或右页选项图标补充 | 可选图片 | 若主视觉已包含品牌露出，可以不额外使用 |

不建议切图的内容：

- `安装完成` 标题、结果文案、按钮文字必须用 DOM 文本。
- 成功勾选使用本地 PNG 透明图作为 CSS mask，并由 CSS 填充成功绿色；开关控件、完成按钮必须用 DOM/CSS 或本地 SVG 图标实现。
- 两个完成后选项必须是可聚焦、可切换的真实控件，不能在整图里写死。

### 外部图标接入计划

可以按《外部图标本地化接入规范》引入 Lucide SVG，统一保存到：

```text
installer-shell/src/assets/icons/installer-complete/
```

| 用途 | 建议图标语义 | 建议文件名 | 首版建议 |
|------|------|------|------|
| 成功勾选 | 本地 PNG 遮罩 | `complete-check.png` | 使用 `UI设计稿/图标/打勾勾.png`，通过 CSS mask 填充成功绿色，不使用纯白色 |
| 立即启动软件 | rocket | `launch-app.svg` | 建议引入，和参考图火箭语义一致 |
| 创建桌面快捷方式 | monitor 或 panel-top | `desktop-shortcut.svg` | 建议引入 |
| 完成按钮装饰 | check 或 arrow-right | `finish.svg` | 可选，按钮首版只用文字即可 |

所有 SVG 必须本地化，不使用 CDN、在线字体或运行时外链；保留 `viewBox`，删除固定 `width`、`height` 和硬编码颜色，统一使用 `currentColor`。正式接入时记录：

```text
来源：Lucide
授权：ISC License
用途：安装完成页成功状态和完成后选项图标
本地路径：installer-shell/src/assets/icons/installer-complete/
修改：清理固定尺寸，统一使用 currentColor
授权文本：installer-shell/src/assets/icons/lucide-license.txt
```

### 视觉与交互验收标准

- `1280 x 720` 下无滚动条、无遮挡、无文字溢出。
- 书本主体尺寸与欢迎页、许可协议页、安装位置页、附加任务页、正在安装页切换时不跳变。
- 右页标题排版与引导页保持一致：标题面板、居中方式和字号层级沿用统一基准。
- 完成页不显示 `第 6 页 · 安装完成` 页码提示，避免最终成功页信息冗余。
- 成功图标、结果文案、两个选项和完成按钮全部位于右页纸张安全区内，不压到书脊、页角装饰、书页下沿或蓝色书壳。
- `立即启动软件` 和 `创建桌面快捷方式` 开关可键盘聚焦，状态表达不能只依赖颜色。
- `完成` 是唯一主按钮，视觉优先级高于所有开关项。
- 安装失败时不得跳转到完成页。
- 图片未加载时仍能显示标题、成功文案、选项和完成按钮，不出现空白主界面。
- 低动效模式下关闭星星/爱心漂浮和成功图标弹入动画，页面仍完整可操作。

### 任务清单

- [x] 确认原始素材目录存在 `UI设计稿/安装壳UI/安装完成页.png`。
- [x] 新建 `installer-shell/src/assets/installer-complete/` 运行时资源目录。
- [x] 将 `安装完成页.png` 压缩为 `complete-book.webp`，并记录压缩前后体积。
- [x] 准备或复用星星、爱心、本地应用图标等点缀资源。
- [x] 准备 `installer-shell/src/assets/icons/installer-complete/` 图标目录和 Lucide 授权记录。
- [x] 新增 `installer-shell/src/pages/complete.js` 页面模块。
- [x] 在 `main.js` 注册 `complete` 步骤、预览入口和安装成功跳转。
- [x] 在 `styles.css` 增加完成页右页标题、成功状态、选项开关和完成按钮样式。
- [x] 接入“完成”按钮关闭窗口和可选启动主程序逻辑。
- [x] 截图验证 `1280 x 720` 下 UI 严格落在书本安全区内。
- [x] 同步更新 `docs/apps-code-map.md` 和 `docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md`。

### 实施记录-260511-安装完成页

已将安装完成页接入 `installer-shell/` 静态原型，页面继续沿用前序页面的同一书本显示基准：

- 运行时书本素材：`1279 x 720`。
- 页面书本画布：`1210 x 681`。
- 右页标题面板：沿用引导页右页排版基准，并针对完成页收束态上移为 `top: 58px; right: 136px; width: 418px`。
- 页码提示：不显示。

运行时资源如下：

| 资源 | 输出文件 | 体积 |
|------|----------|------|
| 安装完成页书本与左页插画 | `installer-shell/src/assets/installer-complete/complete-book.webp` | `69110` 字节 |
| 安装完成页星星点缀 | `installer-shell/src/assets/installer-complete/complete-star.png` | `1472` 字节 |
| 安装完成页爱心点缀 | `installer-shell/src/assets/installer-complete/complete-heart.png` | `3736` 字节 |
| 成功勾图标遮罩 | `installer-shell/src/assets/installer-complete/complete-check.png` | `5247` 字节 |
| 桌面快捷方式图标 | `installer-shell/src/assets/icons/installer-complete/desktop-shortcut.svg` | `323` 字节 |
| 完成按钮图标 | `installer-shell/src/assets/icons/installer-complete/finish.svg` | `238` 字节 |

本次页面实现包含：

- 安装完成页页面模块 `installer-shell/src/pages/complete.js`。
- `welcome -> license -> install-location -> install-tasks -> installing -> complete` 步骤流。
- `?step=complete` 静态预览入口。
- 安装成功后从正在安装页自动进入完成页；安装失败仍留在失败状态，不进入完成页。
- 完成页真实 DOM 成功状态、立即启动软件开关、桌面快捷方式开关和完成按钮。
- Tauri 命令 `launch_installed_app` 用于完成后启动主程序。
- Tauri 命令 `apply_desktop_shortcut` 用于根据完成页开关保留或移除桌面快捷方式。
- 补齐 `installer-shell/src-tauri/icons/icon.ico`，让安装器壳 `cargo check` 不再因为 Windows 资源图标缺失失败。
- `.gitignore` 增加 `installer-shell/src-tauri/target/`，避免 Tauri 原型编译缓存进入版本控制。

静态预览截图检查已通过，截图证据不纳入版本控制。

260511 补充修正：`安装完成页.png` 原图带透明通道，运行时 `complete-book.webp` 必须以 `-background none` 方式压缩，保持 `srgba` 透明通道，避免书本外出现白色矩形底。

260511 右页排版修正：完成页页码改为绝对定位，不再占用标题文档流；`安装完成` 标题按引导页右页标题基准单独居中排布，成功图标、结果文案、完成后选项和底部按钮跟随统一安全区节奏排列。默认完成状态文案不再显示在选项和按钮之间，避免挤压按钮区域；仅在点击“完成”执行收尾操作时显示动态状态。

260511 严格安全区修正：完成页右侧 DOM 容器高度收敛到右页纸张安全区，底部按钮改为固定 `top` 定位，避免任何交互层压到书本蓝色外壳或书本图片外。成功勾图标改为两段圆角线条组合，不再使用容易看成下箭头的边框旋转画法。浏览器运行时边界检查使用安全框 `left=690; top=96; right=1112; bottom=616`，检查结果为 `panel`、`label`、`title`、`check`、`result`、`options`、`button` 全部在安全框内。

260511 排版优化修正：红框内容区按“完成确认卡片”节奏重新整理，缩小成功勾、选项卡和选项图标，拉开选项卡与完成按钮间距，按钮宽度收窄并上移，保留书页底部安全留白。最终浏览器运行时边界检查结果为：`panel=(691,100)-(1109,616)`、`title=(691,158)-(1109,191)`、`check=(871,255)-(929,313)`、`options=(721,396)-(1079,524)`、`button=(777,548)-(1023,596)`，均位于安全框 `left=690; top=96; right=1112; bottom=616` 内。

260511 删除页码提示：按最终成功页简化要求，删除完成页右上角 `第 6 页 · 安装完成` UI，移除 `complete-page-label` DOM 和对应 CSS。完成页保留主标题、成功勾、结果文案、完成后选项和主按钮作为核心信息。

260511 成功勾图标替换：按最新设计稿要求，成功勾使用 `UI设计稿/图标/打勾勾.png`，运行时复制为 `installer-shell/src/assets/installer-complete/complete-check.png`。由于源图是白色勾透明底，页面不直接渲染原图，而是将其作为 CSS mask，由 `.complete-check span` 填充 `#35bf72` 成功绿色，使图标与圆形成功底座、开关成功色保持一致，避免纯白色图标显得割裂。

260511 整体上移修正：按视觉反馈将完成页右侧整组 UI 从 `top: 70px` 调整为 `top: 58px`，标题、成功勾、结果文案、选项卡、完成按钮和星星爱心装饰整体上移 `12px`。该改动只调整外层完成页面板定位，不改变内部元素间距、成功色、开关状态和完成按钮交互。

上移后浏览器运行时边界检查结果为：`title=(691,146)-(1109,179)`、`check=(871,243)-(929,301)`、`options=(721,384)-(1079,512)`、`button=(777,536)-(1023,584)`，均位于安全框 `left=690; top=96; right=1112; bottom=616` 内。

最新静态预览截图检查已通过，截图证据不纳入版本控制。

验证结果：

```text
node --check installer-shell/src/main.js
node --check installer-shell/src/pages/*.js
cargo check --manifest-path installer-shell/src-tauri/Cargo.toml
```

以上验证均已通过。

## 任务清单

- [x] 确认测试不替换现有正式 NSIS 安装包。
- [x] 构建当前标准 PC 安装包作为基线。
- [x] 测试 NSIS `/S` 静默安装。
- [x] 测试 NSIS `/D=目标目录` 自定义安装目录。
- [x] 校验静默安装后的主程序、快捷方式、卸载项和注册表。
- [x] 校验静默卸载闭环。
- [x] 建立 `installer-shell/` 原型目录。
- [x] 实现 Tauri 壳最小 UI 流程。
- [x] 实现许可协议页书本式 UI、协议滚动框和同意后继续交互。
- [x] 实现安装位置页书本式 UI、路径选择卡片和空间信息展示。
- [x] 实现附加任务页书本式 UI、任务复选框和安装前任务状态保存。
- [x] 实现 Tauri 调用 NSIS 静默安装。
- [x] 实现安装完成后的文件系统校验。
- [x] 实现正在安装页书本式 UI、阶段式进度和安装中交互。
- [x] 实现安装完成页书本式 UI、完成后选项和完成按钮闭环。
- [ ] 测试安装失败、取消、重复安装和安装后启动。
- [ ] 新增独立原型构建脚本。
- [ ] 记录包体、构建耗时和可维护性评估。
- [ ] 根据测试结果决定是否进入正式方案设计。

## 测试记录-260510

### 1. 标准安装包基线

已复用当前本地标准 NSIS 安装包作为基线：

```text
build\PromptImageManager-Setup-2.3.1.exe
releases\PromptImageManager-Setup-2.3.1.exe
```

两处文件大小均为 `25541321` 字节，确认 `build/` 与 `releases/` 的安装包副本一致。

### 2. NSIS 静默安装验证

测试命令使用独立安装目录：

```powershell
build\PromptImageManager-Setup-2.3.1.exe /S /D=%LOCALAPPDATA%\PromptImageManager-TauriShellTest
```

测试结果：

```text
INSTALL_EXIT=0
TARGET_EXISTS=True
```

安装后校验通过：

- `PromptImageManager.exe` 存在。
- `uninstall.exe` 存在。
- `icon.ico` 存在。
- 桌面快捷方式、开始菜单启动快捷方式、开始菜单卸载快捷方式均创建成功。
- `HKCU\Software\PromptImageManager` 写入 `InstallDir`。
- `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptImageManager` 写入卸载项。
- `DisplayName`、`DisplayIcon`、`DisplayVersion`、`UninstallString` 均正确。

### 3. NSIS 静默卸载验证

测试命令：

```powershell
%LOCALAPPDATA%\PromptImageManager-TauriShellTest\uninstall.exe /S
```

测试结果：

```text
UninstallExit=0
TargetExists=False
ExeExists=False
LeftShortcutCount=0
RegMainExists=False
RegUninstallExists=False
```

结论：NSIS 可以继续作为静默安装核心，且当前脚本已能完成安装目录、快捷方式、注册表和卸载清理闭环。

### 4. Tauri 安装器壳原型

已新增隔离原型目录：

```text
installer-shell/
```

当前原型包含：

- 独立静态安装向导页面。
- 无边框、固定尺寸、透明窗口 Tauri 配置。
- Rust 命令 `install_with_nsis`，用于调用 NSIS 安装包 `/S` 静默安装。
- 安装后主程序与卸载器存在性校验。

`npm --prefix installer-shell run tauri -- info` 已通过，确认本机 Tauri、WebView2、MSVC、Rust、Node 和 npm 环境可识别该原型配置。

当前阻塞：

- `cargo check --manifest-path installer-shell/src-tauri/Cargo.toml` 在线检查超过 5 分钟未完成。
- `cargo check --offline --manifest-path installer-shell/src-tauri/Cargo.toml` 提示缺少 `tokio v1.52.3` 本地缓存。

判断：该阻塞属于 Rust 依赖获取或缓存问题，不是当前原型代码已经暴露出的语法错误。后续需要在网络稳定时执行一次完整 `cargo check` 或补齐依赖缓存。

### 5. 阶段结论

当前方案进入“部分可行”状态：

- NSIS 静默安装核心已验证可行。
- Tauri 壳工程入口与配置识别已验证可行。
- Tauri 壳完整编译与运行仍需补一次依赖构建验证。

## 暂不纳入范围

- 暂不重写完整安装逻辑。
- 暂不替换现有 releases 发布产物。
- 暂不处理代码签名。
- 暂不实现精确文件复制进度条。
- 暂不改动主应用 PC 页面 UI。

## 预期结论口径

测试结束后输出以下三类结论之一：

1. 可行：Tauri 壳体验达标，NSIS 静默安装稳定，可进入正式开发。
2. 部分可行：UI 可行，但安装状态、包体或构建链路存在约束，需要缩小范围。
3. 不建议：维护成本或可靠性问题超过收益，回退到 NSIS 轻量美化方案。
