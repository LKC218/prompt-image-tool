# 聊天归档脚本 prompt-image-tool JSON 对话命名计划

## 背景

当前讨论的目标是新增一种面向 `prompt-image-tool` 的专用 JSON 导出格式：从 ChatGPT 本地档案馆当前对话中提取提示词文本和图片信息，导出后可被 `prompt-image-tool` 的导入 JSON 功能识别，并自动填入新建提示词页面。

用户补充要求：导出的 `prompt-image-tool JSON` 文件需要和对话名称一致，同时要和普通归档 JSON 做好区分，避免混淆。

## 可行性结论

可以实现。当前脚本在 `exportCurrentZip()` 和当前对话保存链路里已经能拿到 `stored.title`，即对话名称；后续新增 `导出为 prompt-image-tool JSON` 时，可直接使用 `stored.title` 作为文件名主体。

但为了“和对话名称一样”与“做好区分”同时成立，建议采用“对话名称作为主文件名 + 专用后缀标识”的命名规则。

## 命名规则

建议文件名格式：

```text
{安全化对话名称}-prompt-image-tool.json
```

示例：

```text
平面化图片生成要求-prompt-image-tool.json
Git自动保存ChatGPT历史-prompt-image-tool.json
```

如果需要进一步中文化，可选格式：

```text
{安全化对话名称}-提示词工具导入.json
```

第一版建议使用英文后缀 `prompt-image-tool`，原因是：

1. 和目标应用名称完全一致。
2. 便于用户搜索和批量筛选。
3. 和普通对话归档 JSON 明确区分。
4. 文件名仍以对话名称开头，满足“命名和对话名称一样”的可读性目标。

## 与现有导出的区分

当前归档类文件可能包含：

```text
chatgpt_vault_current_{对话名称}_{时间}.zip
{对话名称}_{对话ID}_{时间}.json
```

新增的 `prompt-image-tool JSON` 应避免伪装成普通归档。区分策略：

1. 文件名增加 `-prompt-image-tool` 后缀。
2. JSON 顶层增加专用 `schema`。
3. JSON 顶层增加 `sourceTool` 和 `targetTool`。
4. 导出按钮文案单独命名，例如 `导出提示词JSON` 或 `导出PIT JSON`。

建议 JSON 顶层：

```json
{
  "schema": "prompt-image-tool.import.v1",
  "sourceTool": "ChatGPT Conversation Vault - CheeseTa",
  "targetTool": "prompt-image-tool",
  "conversationTitle": "平面化图片生成要求",
  "exportedFileName": "平面化图片生成要求-prompt-image-tool.json"
}
```

## 文件名生成函数

新增纯函数：

```js
function buildPromptImageToolJsonFilename(stored) {
  const title = safeFileName(stored.title || 'Untitled Conversation');
  return `${title}-prompt-image-tool.json`;
}
```

如需防止极长路径，可加入标题裁剪：

```js
function promptToolTitlePrefix(title) {
  return safeFileName(title || 'Untitled Conversation').slice(0, 80) || 'Untitled';
}
```

## 重名处理

同一对话重复导出时，浏览器下载通常会自动追加 `(1)`、`(2)`。第一版可以依赖浏览器行为，不必强行加时间戳。

如果后续需要脚本层明确防重，可用：

```text
{安全化对话名称}-prompt-image-tool-{YYYYMMDD_HHMMSS}.json
```

但这会削弱“文件名和对话名称一样”的直观性。因此第一版建议不加时间戳，只保留专用后缀。

## prompt-image-tool 导入识别

`prompt-image-tool` 导入 JSON 时不应只靠文件名识别，而应优先识别 `schema`：

```js
schema === 'prompt-image-tool.import.v1'
```

识别后进入“新建提示词预填充”流程：

1. `title` 或 `conversationTitle` 填入标题。
2. `positivePrompt` 填入正向提示词。
3. `negativePrompt` 填入负向提示词。
4. `images[].dataUrl` 转成预览图。
5. `images[].fileName` 作为图片名称。

文件名只作为用户可见层区分，不能作为唯一协议判断依据。

## 任务清单

- [ ] 设计 `prompt-image-tool JSON` 顶层 schema 和字段。
- [ ] 新增 `buildPromptImageToolJsonFilename(stored)`，以对话名称生成文件名。
- [ ] 文件名后缀采用 `-prompt-image-tool.json`，区分普通归档 JSON。
- [ ] 导出的 JSON 内写入 `exportedFileName`，便于排查和二次处理。
- [ ] 新增独立导出入口，避免覆盖现有 `导出当前` ZIP 行为。
- [ ] 确认中文标题、特殊字符、空标题、超长标题都能生成安全文件名。
- [ ] 在 `prompt-image-tool` 导入端按 `schema` 识别专用 JSON，而不是只靠文件名。
- [ ] 更新 `docs/技术文档/聊天归档脚本图片导出技术说明-260524.md`，补充 prompt-image-tool JSON 命名协议。
- [ ] 运行用户脚本语法检查和导入 JSON 结构检查。

## 验收标准

1. 对话名为 `平面化图片生成要求` 时，导出文件名为 `平面化图片生成要求-prompt-image-tool.json`。
2. 普通归档 JSON 和 prompt-image-tool JSON 可以通过文件名和 `schema` 双重区分。
3. JSON 顶层包含 `schema: "prompt-image-tool.import.v1"`。
4. JSON 顶层包含原始 `conversationTitle`。
5. JSON 内图片条目保留可导入的 `fileName`、`mimeType`、`dataUrl`。
6. `prompt-image-tool` 导入端能自动识别该 JSON 并进入新建提示词预填充流程。

## 风险与取舍

- 文件名包含对话名称可能暴露对话主题；这是为了可读性做出的取舍。
- 如果完全不加后缀，用户很难区分普通归档 JSON 和 prompt-image-tool 导入 JSON，因此必须保留专用后缀或前缀。
- 仅依赖文件名识别不可靠，必须使用 JSON 内部 `schema`。
- Base64 图片会显著增大 JSON 文件体积，后续需要设置图片数量或大小上限。

