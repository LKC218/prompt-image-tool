# 图片 WebP 压缩与 JPG 导出实施计划

> 创建日期：2026-07-11
> 范围：PC 端、移动端、Python 后端、Android 本地存储、图片下载与备份链路
> 目标：新导入图片默认使用 WebP 压缩存储，用户下载时可按需导出 JPG，同时保护已有数据不被自动破坏。

---

## 一、背景与当前状态

当前项目的图片导入链路已经支持读取 JPG、PNG、WebP，并且后端与 Android 本地存储均能根据 Data URL 的 MIME 类型落盘为 `.jpg`、`.png` 或 `.webp`。

但现有图片优化参数在 PC 与移动端编辑器中默认写死为 `image/jpeg`：

- PC：`src/js/pc-editor.js` 中 `IMAGE_OPTIMIZE_OPTIONS.outputType = 'image/jpeg'`
- 移动端：`src/js/mobile-editor.js` 中 `IMAGE_OPTIMIZE_OPTIONS.outputType = 'image/jpeg'`
- 通用优化函数：`src/js/image-utils.js` 的 `optimizeImageDataUrl()`

这意味着目前大多数被压缩的导入图片会转为 JPG，而不是 WebP。下载链路则基本保持“当前存储是什么格式，就下载什么格式”。

---

## 二、目标

### 2.1 功能目标

1. 新导入图片默认压缩为 WebP，降低本地数据目录、备份 JSON 和 Android 存储体积。
2. 图片预览下载支持导出 JPG，方便用户在外部工具、聊天软件或平台中使用。
3. 默认下载仍保留原格式，避免用户误以为图片被强制转换。
4. 已有图片数据默认不自动迁移，避免二次压缩和数据断链。
5. 后续可提供“手动存储优化”工具，用户确认后再批量转换历史图片。

### 2.2 非目标

1. 不在启动时自动批量转换历史图片。
2. 不将完整备份导出默认转为 JPG。
3. 不处理 GIF 动图转码；如后续开放 GIF 导入，应保留原格式。
4. 不引入服务端图片处理依赖，第一阶段优先使用浏览器 Canvas 能力完成转码。

---

## 三、设计原则

1. 新数据走新策略，旧数据保持原样。
2. 用户主动下载时才转换 JPG，内部备份保留真实存储格式。
3. 转码结果大于原图时保留原图，避免“压缩后变大”。
4. 透明图片不得静默转 JPG 后丢失透明通道；下载 JPG 时必须明确用白底或指定背景填充。
5. 所有图片字段仍以 `uploadImage()` 返回的 `file` 为准，避免前端猜扩展名导致记录和文件不一致。

---

## 四、推荐方案

### 4.1 第一阶段：新导入图片默认 WebP

修改通用图片优化能力，使编辑器可以声明输出格式为 WebP：

```js
const IMAGE_OPTIMIZE_OPTIONS = {
  maxSide: 2560,
  maxInputPixels: 40_000_000,
  quality: 0.9,
  outputType: 'image/webp'
};
```

移动端可使用更保守参数：

```js
const IMAGE_OPTIMIZE_OPTIONS = {
  maxSide: 2048,
  maxInputPixels: 24_000_000,
  quality: 0.86,
  outputType: 'image/webp'
};
```

保留现有回退逻辑：

- 解码失败：保留原图。
- 无法创建 Canvas：保留原图。
- 未缩放且 WebP 结果大于或等于原图：保留原图。
- MIME 类型不在允许列表中：拒绝或保留既有策略。

### 4.2 第二阶段：图片下载支持 JPG

在 `src/js/image-download-utils.js` 增加下载格式参数：

```js
downloadImage({
  url,
  filename,
  format: 'original' | 'jpg',
  jpgQuality: 0.92,
  jpgBackground: '#FFFFFF'
});
```

格式规则：

| 下载格式 | 行为 |
| --- | --- |
| 原格式 | 直接保存当前 Blob，不转码 |
| JPG | fetch 当前图片后 Canvas 重绘为 `image/jpeg`，透明区域填充白色背景 |

PC 图片查看器与移动端图片查看器下载入口建议提供两个操作：

- 下载原格式
- 导出 JPG

第一阶段不强制加入 PNG 导出，避免范围扩大；后续可用同一转码函数扩展 `png`。

### 4.3 第三阶段：历史图片保持原样

已有数据中图片文件可能是 `.jpg`、`.png`、`.webp`。第一阶段不扫描、不转换、不重写 JSON。

原因：

- 旧 JPG 再转 WebP 是二次有损压缩。
- 旧 PNG 可能包含透明通道，自动转换有视觉风险。
- 批量转换中断可能造成 `prompt_sets.json` 与 `data/images/` 断链。
- 局域网同步和备份恢复会因为文件名变更增加复杂度。

---

## 五、历史数据处理策略

### 5.1 默认策略

| 类型 | 处理方式 |
| --- | --- |
| 旧 JPG | 保持原文件，不自动转 WebP |
| 旧 PNG | 保持原文件，不自动转 WebP |
| 旧 WebP | 保持原文件 |
| 备份 JSON 中的历史图片 | 按原格式导出与恢复 |
| 局域网同步图片 | 按当前文件名与 MIME 类型传输 |

### 5.2 可选存储优化工具

后续可在设置页增加“存储优化”入口，但必须是手动操作。

推荐流程：

1. 扫描 `data/images/` 与提示词版本引用关系。
2. 统计可转换图片数量、预计节省空间、跳过数量和风险项。
3. 用户确认后创建完整备份。
4. 转换到临时目录。
5. 转换成功后更新对应 `image.file` 字段。
6. 原图片移动到历史备份目录。
7. 全部成功后提示用户可手动清理历史备份。

不建议第一阶段实现该工具。

---

## 六、涉及文件

### 6.1 前端通用模块

| 文件 | 改动点 |
| --- | --- |
| `src/js/image-utils.js` | 增强输出格式能力，补充 WebP 支持检测与 JPG 转码辅助 |
| `src/js/image-download-utils.js` | 增加 `format: 'jpg'` 下载转码分支 |
| `src/js/image-utils.test.js` | 增加 WebP 输出、回退、扩展名识别测试 |
| `src/js/image-download-utils.test.js` | 增加 JPG 导出文件名、MIME、Canvas 转码测试 |

### 6.2 PC 端

| 文件 | 改动点 |
| --- | --- |
| `src/js/pc-editor.js` | 将新导入优化默认输出改为 WebP |
| `src/js/pc-utils.js` | 图片查看器下载菜单增加“下载原格式 / 导出 JPG” |
| `src/js/pc-detail.js` | 如详情页存在直接下载入口，同步接入 JPG 导出 |
| `src/css/pc.css` | 下载菜单新增按钮样式时再补充 |

### 6.3 移动端

| 文件 | 改动点 |
| --- | --- |
| `src/js/mobile-editor.js` | 将新导入优化默认输出改为 WebP |
| `src/js/mobile-detail.js` | 图片查看器下载入口增加 JPG 导出动作 |
| `src/js/mobile-gallery.js` | 确认 JPG Data URL 写入相册流程兼容 |
| `src/css/mobile.css` | 如新增 action sheet 项视觉不够清晰，再补充 |

### 6.4 存储与后端

| 文件 | 改动点 |
| --- | --- |
| `python/main.py` | 第一阶段无需改动；已有 WebP MIME 与扩展名支持 |
| `src/js/sqlite-storage.js` | 第一阶段无需改动；已有 WebP 扩展名识别 |
| `src/js/api-storage.js` | 第一阶段无需改动 |

### 6.5 文档

| 文件 | 改动点 |
| --- | --- |
| `docs/apps-code-map.md` | 增加图片压缩与下载格式导航 |
| `docs/技术文档/pc-technical-doc.md` | 更新 PC 图片导入压缩与下载格式说明 |
| `docs/技术文档/mobile-technical-doc.md` | 更新移动端图片导入压缩与下载格式说明 |
| `docs/项目开发经验/项目开发经验.md` | 若实施中沉淀出透明通道、Canvas 转码或历史数据迁移经验，再追加 |

---

## 七、实施步骤

### Step 1：补齐通用转码能力

1. 在 `image-utils.js` 增加 `convertImageBlob()` 或 `convertImageDataUrl()`。
2. 支持输出 `image/webp` 与 `image/jpeg`。
3. JPG 输出前填充白底，避免透明区域变黑。
4. 保留“转码后更大则使用原图”的保护。
5. 增加单元测试。

### Step 2：新导入默认 WebP

1. 修改 PC 编辑器 `IMAGE_OPTIMIZE_OPTIONS.outputType` 为 `image/webp`。
2. 修改移动端编辑器 `IMAGE_OPTIMIZE_OPTIONS.outputType` 为 `image/webp`。
3. 检查导入 ChatGPT 对话 JSON、普通文件导入、粘贴图片导入是否都走同一优化链路。
4. 增加或更新编辑器测试，确认 `uploadImage()` 收到 WebP Data URL。

### Step 3：图片下载支持 JPG

1. 扩展 `downloadImage()` 参数，支持 `format: 'jpg'`。
2. JPG 文件名统一使用 `.jpg` 后缀。
3. PC 图片查看器增加“导出 JPG”入口。
4. 移动端图片查看器 action sheet 增加“导出 JPG”入口。
5. 下载历史记录中记录实际导出文件名和方法。

### Step 4：验证历史图片兼容

1. 使用旧 JPG、旧 PNG、旧 WebP 数据打开详情页。
2. 验证原格式下载不改变历史图片。
3. 验证历史 PNG 可导出 JPG，透明区域为白底。
4. 验证完整备份仍保留历史图片原格式。
5. 验证局域网同步仍能传输 WebP。

### Step 5：文档同步

1. 更新 PC 技术文档的图片导入压缩策略。
2. 更新移动端技术文档的图片导入压缩策略。
3. 更新 `docs/apps-code-map.md` 的相关导航。
4. 如产生可复用经验，再追加项目开发经验。

---

## 八、测试计划

### 8.1 单元测试

```powershell
npm run test -- image-utils.test.js
npm run test -- image-download-utils.test.js
npm run test -- pc-editor.test.js
npm run test -- mobile-regression.test.js
```

全量：

```powershell
npm run test
```

### 8.2 Python 测试

```powershell
.\venv\Scripts\python.exe -m pytest python\tests -q
```

### 8.3 构建验证

```powershell
npm run build
```

### 8.4 手工验证

| 场景 | 预期 |
| --- | --- |
| 导入 JPG 大图 | 保存为 WebP，体积下降 |
| 导入 PNG 大图 | 保存为 WebP 或在结果变大时保留 PNG |
| 导入 WebP | 若无需优化则保留 WebP |
| PC 下载原格式 | 文件扩展名与当前存储格式一致 |
| PC 导出 JPG | 文件为 `.jpg`，能正常打开 |
| 移动端导出 JPG | 能保存到相册或浏览器下载 |
| 备份导出 | JSON 中图片 Data URL 保持实际存储格式 |
| 备份恢复 | WebP 图片能恢复并显示 |
| 局域网同步 | PC 与 Android 均能显示 WebP 图片 |

---

## 九、风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 某些 WebView 不支持 WebP Canvas 输出 | 导入仍可能输出 PNG 或空 Blob | 检测 `toBlob` 结果，失败时回退原图或 JPG |
| PNG 透明转 JPG 丢透明 | 用户看到白底 | 只有用户主动“导出 JPG”才转，默认下载原格式 |
| WebP 对线稿或截图压缩效果差 | 文字边缘糊 | 转码后更大则保留原图；后续可增加“保留 PNG”判定 |
| 历史数据批量转换失败 | 图片断链 | 第一阶段不自动迁移历史数据 |
| Android 相册对 WebP 兼容性差 | 外部查看不便 | 下载入口提供 JPG 导出 |
| 备份体积仍可能大 | 大量历史 PNG 不会变小 | 后续单独做手动存储优化工具 |

---

## 十、验收标准

1. 新导入普通大图在 PC 与移动端默认以 WebP 文件保存。
2. 旧图片不被自动修改，详情页仍可正常显示。
3. 图片查看器可以下载原格式，也可以导出 JPG。
4. 导出 JPG 后文件扩展名、MIME 和实际内容一致。
5. 完整备份导出与恢复不破坏 WebP 图片。
6. `npm run test` 通过。
7. `.\venv\Scripts\python.exe -m pytest python\tests -q` 通过。
8. `npm run build` 通过。
9. 文档已同步 `docs/apps-code-map.md` 与 PC/移动端技术文档。

---

## 十一、建议实施顺序

建议分两次提交：

1. `feat(image): 新导入图片默认压缩为 WebP`
   - 通用图片优化
   - PC/移动端编辑器接入
   - 单元测试

2. `feat(image): 支持图片导出为 JPG`
   - 下载工具支持 JPG 转码
   - PC/移动端下载入口
   - 下载历史与回归测试
   - 文档同步

历史图片批量转换不纳入本轮提交，后续以独立计划推进。
