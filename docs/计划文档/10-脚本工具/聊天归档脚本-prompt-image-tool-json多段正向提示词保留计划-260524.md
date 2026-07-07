# 聊天归档脚本 prompt-image-tool JSON 多段正向提示词保留计划

> 状态：已实施，待真实 ChatGPT 页面重新导出验证。

## 背景

ChatGPT 本地档案馆导出 `prompt-image-tool.import.v1` 专用 JSON 时，正向提示词原先按空行切段后只取第一段自然语言正文。真实提示词经常用空行分隔结构、文字、色彩等要求，导致空行后的后续提示词没有进入 `prompt.positivePrompt`，导入到 prompt-image-tool 后内容不完整。

## 目标

1. 空行只作为提示词段落分隔，不作为截断点。
2. 继续跳过开头的 fenced code block、类 JSON 块和 `content_type / asset_pointer / metadata` 等结构化噪声。
3. 从第一段有效自然语言开始，保留后续所有有效自然语言段落。
4. 导出端和导入端规则一致，避免导出保留全文后又在导入阶段二次截断。

## 实施范围

- `gpt本地档案馆工具/ChatGPT Conversation Vault - CheeseTa Integrated-2026.05.24.10.user.js`
- `src/js/prompt-tool-json-import.js`
- `src/js/prompt-tool-json-import.test.js`
- `docs/技术文档/聊天归档脚本图片导出技术说明-260524.md`
- `docs/计划文档/聊天归档脚本-prompt-image-tool-json首段跳过代码块计划-260524.md`
- `docs/apps-code-map.md`

## 任务清单

- [x] 将导出端正向提示词提取从“第一段”调整为“首个有效段落起的完整多段正文”。
- [x] 将导入端 `positivePrompt` 标准化逻辑同步为完整多段正文。
- [x] 增加空行后续提示词不丢失的回归测试。
- [x] 更新就近技术文档和相关计划文档。
- [x] 执行用户脚本语法校验和导入工具单测。

## 验收标准

1. 图示这类提示词中，第一段、空行后的文字结构段和色彩段都会进入正向提示词。
2. 首段元数据或代码块仍会被跳过，不污染正向提示词。
3. `prompt-tool-json-import.test.js` 中多段保留测试通过。
