# 参考图片导入 ChatGPT 对话 JSON 报错修复计划

## 思考与分析

问题现象：PC 安装版设置页点击 `导入 ChatGPT 对话`，选择带参考图片的 ChatGPT 对话 JSON 后，页面提示 `导入失败，文件格式不正确`。

结合现有代码，当前链路是：

```text
src/js/pc-settings.js
  -> handleChatGptVaultImport()
    -> readJsonFile()
    -> stageChatGptVaultConversationImport()
      -> normalizeChatGptVaultConversationImport()
      -> sessionStorage.setItem(JSON.stringify(normalized))
    -> navigate('/editor/', { importId })

src/js/pc-editor.js
  -> consumePromptImageToolImport(importId)
  -> dataUrlToImportedImage()
  -> optimizeImageDataUrl()
```

初步判断根因不是专用 JSON 协议本身完全不匹配，而是带参考图片时 `images[].dataUrl` 体积较大，`stagePromptImageToolImport()` / `stageChatGptVaultConversationImport()` 会把完整 payload 直接写入 `sessionStorage`。安装版 WebView 的 `sessionStorage` / `localStorage` 配额有限，单张 4MB 原图转 Base64 后约 5.3MB，极易触发 `QuotaExceededError`。该异常被 `handleChatGptVaultImport()` 外层 `catch` 统一显示成“文件格式不正确”，造成误导。

现有导出端还允许最多内嵌 10 张图片、单张最高 4MB，理论 JSON 体积可超过 50MB，因此必须把“导入暂存”从 Web Storage 迁出，或至少对大图走非 Web Storage 通道。

## 实施计划

1. 精准复现与证据补齐
   - 构造一个 `prompt-image-tool.import.v1` 专用 JSON，包含 1 张超过 Web Storage 常见配额的 Data URL 图片。
   - 在 PC 导入入口验证当前报错路径，确认异常类型是否为 `QuotaExceededError`。
   - 增加日志或错误分支，避免把存储配额问题继续伪装成文件格式错误。

2. 改造导入暂存层
   - 将 `src/js/prompt-tool-json-import.js` 的暂存机制从“只写 `sessionStorage`”调整为“优先 IndexedDB，失败时回退内存 Map，小 payload 可继续兼容 Web Storage”。
   - `stagePromptImageToolImport()` 和 `stageChatGptVaultConversationImport()` 改为异步函数，返回标准化 payload。
   - `consumePromptImageToolImport()` 改为异步消费，读取成功后删除暂存记录。
   - PC 与移动端编辑页本身已经在异步函数中调用消费逻辑，改造成本较低。

3. 调整入口调用方
   - `src/js/pc-settings.js`：`handleChatGptVaultImport()` 中 `await stageChatGptVaultConversationImport(data)`。
   - `src/js/pc-home.js`：首页 JSON 导入入口同步改为异步暂存。
   - `src/js/mobile-settings.js`、`src/js/mobile-home.js`：复用同一暂存层，避免双端行为分裂。
   - `src/js/pc-editor.js`、`src/js/mobile-editor.js`：`await consumePromptImageToolImport(importId)`。

4. 优化错误提示
   - JSON 解析失败：仍提示 `导入失败，文件格式不正确`。
   - 非 ChatGPT Vault / 非专用 schema：提示 `请选择 ChatGPT Vault 单条对话归档 JSON`。
   - 暂存失败或浏览器存储不可用：提示 `导入文件过大，暂存失败，请减少图片数量或重新导出`。
   - 图片被跳过：进入编辑页后以轻提示说明 `已导入文本，部分图片因体积过大未导入`。

5. 收紧导出端体积边界
   - 保留当前最多 10 张图片的编辑器上限。
   - 评估将 `APP.promptImageToolJsonMaxImageBytes` 从 4MB 下调到更贴近安装版导入体验的值，或在导出状态里明确提示 JSON 体积。
   - 不改变专用 schema，避免破坏已有导出文件兼容性。

6. 测试与验收
   - 单元测试覆盖：
     - 无图片专用 JSON 可正常暂存和消费。
     - 带大 Data URL 图片的专用 JSON 不再因 Web Storage 配额失败。
     - 暂存失败时错误类型可被调用方区分。
     - 完整备份 JSON 不会误进入对话导入流程。
   - 页面回归覆盖：
     - PC 设置页 `导入 ChatGPT 对话` 可进入新建提示词页。
     - 新建页能看到标题、正向提示词和参考图片预览。
     - 保存后图片通过现有 `storage.uploadImage()` 落入应用存储。
     - 普通 `导入 JSON` 完整备份恢复行为不变。
   - 安装版验收：
     - 在已安装 PC 端复测真实导出的带参考图片 JSON。
     - 如涉及 `build/app_main.py` 或安装包前端资源，重新构建并安装验证。

## 任务清单

- [x] T1 构造或收集一份带参考图片的失败 JSON，确认真实异常类型。
- [x] T2 为 `prompt-tool-json-import` 增加 IndexedDB / 内存 Map 暂存实现。
- [x] T3 将暂存与消费函数改为异步，并更新 PC / 移动端调用方。
- [x] T4 增加可区分的导入错误类型和用户提示。
- [x] T5 补充 `prompt-tool-json-import.test.js` 大图暂存回归测试。
- [x] T6 补充 PC 设置页导入入口回归测试。
- [x] T7 同步 `docs/技术文档/pc-technical-doc.md`、`docs/技术文档/mobile-technical-doc.md` 与本计划状态。
- [ ] T8 在安装版 PC 端使用真实带参考图片 JSON 复测导入、预览和保存闭环。

## 实施状态

- 已完成共享导入暂存层改造：`prompt-tool-json-import` 现在优先使用 IndexedDB 暂存大 payload，并保留 Web Storage 与内存兜底。
- 已完成 PC / 移动端首页、设置页和编辑页异步调用改造。
- 已补充 Web Storage 配额失败时仍可暂存带参考图片专用 JSON 的单元测试。
- 尚未在已安装 PC 端使用真实失败 JSON 做人工复测。

## 验收标准

1. 带 `images[].dataUrl` 的 `prompt-image-tool.import.v1` JSON 在 PC 安装版不再提示“文件格式不正确”。
2. 导入后自动进入新建提示词页，并预填标题、正向提示词、负向提示词、标签和比例。
3. 参考图片进入预览区，数量不超过编辑器现有 10 张上限。
4. 点击保存后，图片走现有 `storage.uploadImage()`，提示词详情页能正常查看图片。
5. 普通完整备份 JSON 的导入恢复链路不受影响。
6. 移动端同一协议导入行为保持兼容。

## 风险与取舍

- IndexedDB 在极端隐私模式或 WebView 存储异常时仍可能不可用，因此保留内存 Map 作为同页跳转兜底。
- 内存 Map 不能跨页面刷新恢复，但本场景是选择文件后立即跳转编辑页，满足主流程。
- 如果真实 JSON 图片本身没有 `dataUrl`，而只有 `asset_pointer` 或 ZIP 相对路径，则导入端无法还原图片，只能导入文本；这种情况应通过错误提示或导出端重新导出解决。
- 若后续要支持超大批量图片，应该改为“导入时先写入后端临时文件，再由编辑器引用”，但当前先按 KISS 原则修复安装版导入失败。
