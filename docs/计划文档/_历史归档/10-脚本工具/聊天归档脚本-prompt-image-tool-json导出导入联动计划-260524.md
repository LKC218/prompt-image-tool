# 聊天归档脚本 prompt-image-tool JSON 导出导入联动计划

## 背景

当前 ChatGPT 本地档案馆用户脚本已经具备当前对话保存、图片发现、图片下载和 ZIP 导出能力。下一步目标是新增一种专门面向 `prompt-image-tool` 的 JSON 导出格式，把 ChatGPT 对话中的提示词文本和图片 Data URL 写入单个 JSON 文件。

`prompt-image-tool` 侧导入 JSON 时识别该专用格式，自动打开新建提示词页，并把标题、正向提示词、负向提示词和图片预览填好，形成从 ChatGPT 对话到提示词库新建页面的半自动迁移链路。

本计划承接：

- `docs/计划文档/聊天归档脚本-图片导出与作者栏移除计划-260524.md`
- `docs/计划文档/聊天归档脚本-图片按对话名称命名计划-260524.md`
- `docs/计划文档/聊天归档脚本-prompt-image-tool-json对话命名计划-260524.md`
- `docs/技术文档/聊天归档脚本图片导出技术说明-260524.md`

## 总体目标

1. ChatGPT Vault 增加 `导出为 prompt-image-tool JSON`。
2. 导出的 JSON 文件名以对话名称为主，并用 `-prompt-image-tool.json` 后缀区分普通归档。
3. JSON 内写入可被 `prompt-image-tool` 识别的 `schema`。
4. JSON 内包含标题、提示词文本、图片 Data URL、图片文件名和来源元数据。
5. `prompt-image-tool` 导入 JSON 时识别专用 schema，自动进入新建提示词页并预填表单。
6. 不破坏现有普通备份恢复、导出当前 ZIP、官方历史备份和本地库导出功能。

## 协议设计

建议专用 JSON 顶层结构：

```json
{
  "schema": "prompt-image-tool.import.v1",
  "sourceTool": "ChatGPT Conversation Vault - CheeseTa",
  "targetTool": "prompt-image-tool",
  "conversationId": "chatgpt-conversation-id",
  "conversationTitle": "平面化图片生成要求",
  "exportedFileName": "平面化图片生成要求-prompt-image-tool.json",
  "exportedAt": "2026-05-24T00:00:00.000Z",
  "prompt": {
    "title": "平面化图片生成要求",
    "positivePrompt": "参考附加图片，将其中的物品名称生成一张平面化图片...",
    "negativePrompt": "",
    "note": "从 ChatGPT 对话导入",
    "tags": ["ChatGPT导入"],
    "aspectRatio": "1:1"
  },
  "images": [
    {
      "id": "image-001",
      "fileName": "平面化图片生成要求-图片-001.png",
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,...",
      "source": "chatgpt-current-dom",
      "width": 1024,
      "height": 1024
    }
  ],
  "raw": {
    "messageCount": 10,
    "model": ""
  }
}
```

协议原则：

- `schema` 是导入端唯一可靠识别依据，文件名只用于用户可读区分。
- `conversationTitle` 保留原始对话名。
- `prompt.title` 默认同对话名。
- 图片必须以 `dataUrl` 内嵌，避免依赖 ZIP 相对路径。
- 图片 `fileName` 使用对话名称加序号，和图片导出命名计划保持一致。

## 第一步：ChatGPT Vault 导出端

### 目标

在用户脚本中新增独立导出入口，例如：

```text
导出提示词JSON
```

该入口不替代现有 `导出当前` ZIP，而是额外生成一个专用 JSON 文件。

### 导出流程

建议调用链：

```text
handlePanelClick()
  -> exportPromptImageToolJson()
    -> saveCurrentConversation('prompt-image-tool-export')
    -> collectCurrentConversationImageAssets(stored, 'prompt-image-tool')
    -> buildPromptImageToolPayload(stored, imageAssets)
    -> buildPromptImageToolJsonFilename(stored)
    -> downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
```

### 文件命名

沿用前置命名计划：

```text
{安全化对话名称}-prompt-image-tool.json
```

示例：

```text
平面化图片生成要求-prompt-image-tool.json
```

### 提示词提取规则

第一版采用保守规则，避免误拆：

1. `prompt.title` 使用 `stored.title`。
2. `positivePrompt` 默认取对话中第一条非空消息的第一段自然语言正文。
3. 如果开头是代码块、类 JSON 块或 `content_type / asset_pointer / metadata` 等结构化元数据块，则跳过该块，取后续第一段正文。
4. 如果文本中存在明确字段，如 `负向提示词`、`Negative Prompt`，再解析为负向提示词。
5. 未识别到负向提示词时留空。

后续可以再加更复杂的规则，但第一版应保持可解释、可回退。

### 图片 Data URL

当前图片导出链路已经能下载图片为 `Uint8Array`。专用 JSON 导出需要新增转换：

```text
Uint8Array + mimeType -> data:image/...;base64,...
```

图片条目保留：

- `fileName`
- `mimeType`
- `dataUrl`
- `source`
- `width`
- `height`

建议设置上限：

- 默认最多内嵌 10 张图片，与 prompt-image-tool 单版本最多 10 张图片的编辑上限保持一致。
- 单张图片超过阈值时跳过或写入失败原因。
- JSON 中记录 `skippedImages`，便于用户知道哪些图片未内嵌。

## 第二步：prompt-image-tool 导入端

### 目标

设置页现有 `导入 JSON` 入口读取文件后，先判断是否为专用 schema。

如果是 `prompt-image-tool.import.v1`：

1. 不走普通 `storage.importData(data)` 备份恢复逻辑。
2. 把专用 JSON 转成编辑器预填 payload。
3. 暂存 payload。
4. 自动导航到新建提示词页。
5. 新建提示词页读取暂存 payload，填好标题、提示词和图片预览。

如果不是专用 schema：

1. 保持现有普通备份导入逻辑不变。

### 现有入口

PC 端当前导入入口在：

```text
src/js/pc-settings.js
```

现有逻辑是读取 JSON 后直接调用：

```js
storage.importData(data)
```

计划新增分支：

```js
if (isPromptImageToolImportJson(data)) {
  const payload = normalizePromptImageToolImport(data);
  stagePromptImageToolImport(payload);
  navigate('/editor/', { importId: payload.id });
  return;
}
```

移动端同类入口在：

```text
src/js/mobile-settings.js
```

如需双端统一，应使用同一个协议解析模块。

### 建议新增共享模块

新增：

```text
src/js/prompt-tool-json-import.js
```

职责：

- `isPromptImageToolImportJson(data)`
- `normalizePromptImageToolImport(data)`
- `stagePromptImageToolImport(payload)`
- `consumePromptImageToolImport(importId)`
- `dataUrlToImportedImage(image)`

暂存位置建议使用 `sessionStorage`，避免长期残留：

```text
prompt-image-tool-import:{id}
```

### 编辑器预填

PC 编辑器当前有：

- `formData`
- `importedImages`
- `createDefaultFormData()`
- `importedImages` 保存时会走 `storage.uploadImage()`
- 本地预览支持 `compressedUrl`、`data`、`dataUrl`

因此新建页读取暂存 payload 后可填：

```js
formData.name = payload.title;
formData.tags = payload.tags;
formData.versions[0].prompt = payload.positivePrompt;
formData.versions[0].negativePrompt = payload.negativePrompt;
formData.versions[0].note = payload.note;
formData.versions[0].aspectRatio = payload.aspectRatio || '1:1';
importedImages = payload.images.map(...)
```

图片对象建议转成编辑器已有结构：

```js
{
  dataUrl,
  compressedUrl,
  name,
  type
}
```

其中 `compressedUrl` 可复用 `optimizeImageDataUrl()` 生成，保持和用户手动导入图片一致。

## 文档同步

实施时需要同步：

- `docs/技术文档/聊天归档脚本图片导出技术说明-260524.md`
- `docs/技术文档/pc-technical-doc.md`
- `docs/技术文档/mobile-technical-doc.md`，如果移动端也同步实现
- `docs/apps-code-map.md`
- 必要时新增测试记录

## 任务清单

- [ ] 确认 `gpt本地档案馆工具/ChatGPT Conversation Vault - CheeseTa Integrated-2026.05.24.10.user.js` 为用户脚本实施目标。
- [ ] 在 ChatGPT Vault 中新增 `导出提示词JSON` UI 入口和事件分支。
- [ ] 实现 `buildPromptImageToolJsonFilename(stored)`，文件名采用 `{对话名称}-prompt-image-tool.json`。
- [ ] 实现 `buildPromptImageToolPayload(stored, imageAssets)`。
- [ ] 实现提示词文本提取规则，默认取对话第一段自然语言正文，并跳过首段代码块或结构化元数据块。
- [ ] 将图片二进制转换为 Data URL，并写入 `images[]`。
- [ ] 为图片数量和大小设置上限，避免 JSON 过大。
- [ ] 在 `prompt-image-tool` 新增共享导入解析模块。
- [ ] PC 设置页导入 JSON 时优先识别 `schema === "prompt-image-tool.import.v1"`。
- [ ] 识别成功后暂存 payload 并自动导航到新建提示词页。
- [ ] PC 新建提示词页消费暂存 payload，预填标题、正向提示词、负向提示词、标签和图片预览。
- [ ] 如需要移动端同步，移动端设置页和移动端编辑页复用同一协议。
- [ ] 补充单元测试：schema 识别、payload 标准化、Data URL 图片转编辑器图片对象。
- [ ] 补充页面级回归：普通备份 JSON 仍走原导入，专用 JSON 进入新建页预填。
- [ ] 同步技术文档、计划状态和代码地图。

## 验收标准

1. ChatGPT Vault 能导出 `{对话名称}-prompt-image-tool.json`。
2. JSON 顶层包含 `schema: "prompt-image-tool.import.v1"`。
3. JSON 内 `prompt.positivePrompt` 有可导入提示词文本。
4. JSON 内图片使用 `dataUrl` 内嵌，且包含 `fileName` 和 `mimeType`。
5. `prompt-image-tool` 导入该 JSON 后自动打开新建提示词页。
6. 新建页标题自动填入对话名称。
7. 正向提示词自动填入 JSON 中的提示词文本。
8. 负向提示词在有字段时填入，没有字段时留空。
9. 图片自动出现在新建页预览图区。
10. 保存后图片能通过现有 `storage.uploadImage()` 进入应用存储。
11. 普通备份 JSON 导入行为不变。

## 风险与取舍

- Base64 图片会让 JSON 体积明显增大，必须设置数量或大小上限。
- 提示词提取存在语义不确定性，第一版应保守提取并允许用户在编辑页调整。
- 文件名包含对话名称会暴露对话主题，需接受该可读性与隐私的取舍。
- 导入端不能只看文件名，必须以 `schema` 判断，避免误导入。
- PC 和移动端编辑器状态结构类似但不完全相同，双端同步实现时需要分别验证。
