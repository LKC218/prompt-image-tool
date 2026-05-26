# 数据备份恢复 ChatGPT Vault 单条对话导入按钮计划

> 创建日期：2026-05-24  
> 状态：已实施并通过验证  
> 范围：在设置页“数据备份与恢复”区域新增独立入口，用于导入 ChatGPT Vault 的单条对话归档 JSON；完整备份导入和导出功能保持原有语义。

## 一、背景

当前 `prompt-image-tool` 已经具备两类 JSON 导入能力：

1. 完整备份 JSON：包含提示词、分类、版本和图片内容，用于恢复整套本地数据。
2. ChatGPT Vault 单条对话归档 JSON：包含 `messages[]`、标题和归档标识，用于转成新建提示词页的预填内容。

现状问题在于：设置页只有一个 `导入 JSON` 按钮。该按钮内部虽然已经能自动分流，但用户从界面上无法判断自己应该选择完整备份文件，还是 ChatGPT Vault 的单条对话归档文件。新增独立按钮可以把“恢复数据”和“从对话新建提示词”区分开。

## 二、目标

- 在“数据备份与恢复”区域新增一个显式入口：
  - 建议文案：`导入 ChatGPT 对话`
  - 辅助文案：`从 Vault 单条对话 JSON 新建提示词`
- 保留现有 `导入 JSON` 入口用于完整备份恢复。
- 保留现有 `导出 JSON` 入口和导出位置选择。
- 新入口只接受可识别为 ChatGPT Vault 单条对话归档的 JSON，不接受普通完整备份 JSON。
- 成功导入后进入新建提示词页，并预填标题、正向提示词、标签和可用图片。

## 三、现有基础

- `src/js/prompt-tool-json-import.js`
  - 已支持 `prompt-image-tool.import.v1`
  - 已支持单条 ChatGPT Vault 对话归档 JSON
  - 已提供暂存与消费能力
- `src/js/pc-settings.js`
  - 当前“数据备份与恢复”区域渲染两个按钮：`导入 JSON`、`导出 JSON`
  - 当前导入入口会先尝试 `stagePromptImageToolImport(data)`，再回退到完整备份导入
- `src/js/pc-editor.js`
  - 已能消费暂存的导入 payload 并回填编辑页
- `src/js/mobile-settings.js`
  - 移动端设置页也有数据备份恢复入口，需评估是否同步增加独立按钮

## 四、交互方案

### PC 端

建议将当前两按钮布局调整为三按钮布局：

1. `导入 JSON`
   - 用途：完整备份恢复
   - 行为：读取 JSON 后直接校验完整备份结构，通过后调用 `storage.importData(data)`
   - 如果用户选择单条对话归档 JSON，提示“请使用导入 ChatGPT 对话入口”

2. `导入 ChatGPT 对话`
   - 用途：导入 ChatGPT Vault 单条对话归档 JSON
   - 行为：读取 JSON 后调用共享导入解析器
   - 成功后跳转到 `/editor/`，携带 `importId`
   - 如果用户选择完整备份 JSON，提示“请选择 ChatGPT Vault 单条对话归档 JSON”

3. `导出 JSON`
   - 用途：完整数据备份
   - 行为保持不变

布局上优先采用三列卡片；窄屏下退化为单列。导出位置分段选择继续只影响 `导出 JSON`。

### 移动端

移动端空间更紧，建议同步新增一个按钮，但可采用两行网格：

1. `本地备份`
2. `导入备份`
3. `导入对话`

若移动端本轮不做实现，也必须在文档中明确 PC 先行、移动端待补。

## 五、实现计划

### Phase 1：导入分流职责拆分

- 保留共享解析器，不新增协议。
- 在设置页新增两个明确函数：
  - `handleBackupImport()`：只处理完整备份 JSON
  - `handleChatGptVaultImport()`：只处理 ChatGPT Vault 单条对话归档 JSON
- 将当前“先尝试对话导入，再回退备份导入”的隐式行为改为显式入口行为。

### Phase 2：PC 设置页 UI

- 修改 `src/js/pc-settings.js`
  - 新增按钮卡片
  - 新增 `data-settings-action="import-chatgpt-vault"`
  - 调整事件分发
- 修改 `src/css/pc.css`
  - 三按钮布局
  - 窄屏退化
  - 保持按钮尺寸稳定，避免文案挤压
- 评估是否新增或复用现有设置页图标资源。

### Phase 3：移动端设置页一致性

- 修改 `src/js/mobile-settings.js`
  - 新增导入对话按钮
  - 复用共享导入解析器
- 如需样式调整，修改 `src/css/mobile.css`
  - 保持触控尺寸稳定
  - 避免三按钮在窄屏中拥挤

### Phase 4：测试与验证

- 单元测试：
  - 完整备份 JSON 不应被单条对话入口接受
  - 单条 ChatGPT Vault JSON 应被对话入口接受
  - 单条 ChatGPT Vault JSON 不应触发完整备份恢复
- 页面级回归：
  - PC 设置页三按钮可见
  - 点击 `导入 ChatGPT 对话` 后选择单条对话 JSON，可跳转新建页
  - 点击 `导入 JSON` 后选择完整备份 JSON，仍可恢复数据
  - 错选文件时提示明确
- 常规验证：
  - `npm.cmd run test`
  - `npm.cmd run build`

### Phase 5：文档同步

- `docs/apps-code-map.md`
- `docs/技术文档/pc-technical-doc.md`
- 如移动端同步实现：`docs/技术文档/mobile-technical-doc.md`
- 如 UI 计划有明确设置页文档，也同步对应设置页 UI 计划。

## 六、任务清单

- [x] T1 设计按钮文案、图标和布局。
- [x] T2 拆分完整备份导入与 ChatGPT Vault 单条对话导入函数。
- [x] T3 在 PC 设置页新增 `导入 ChatGPT 对话` 按钮。
- [x] T4 调整 PC 设置页三按钮响应式布局。
- [x] T5 评估并同步移动端设置页独立入口。
- [x] T6 补充导入入口分流测试。
- [x] T7 执行 `npm.cmd run test`。
- [x] T8 执行 `npm.cmd run build`。
- [x] T9 同步 `docs/apps-code-map.md` 和就近技术文档。

## 九、实施与验证记录

- PC 设置页新增 `导入 ChatGPT 对话`，移动端设置页新增 `导入对话`。
- 完整备份导入入口只走备份恢复；对话归档入口走暂存并跳转新建提示词页。
- 错选文件时给出明确提示，不再静默混用入口。
- `npm.cmd run test -- prompt-tool-json-import.test.js pc-settings.test.js mobile-regression.test.js`：通过，3 个测试文件 23 个用例。
- `npm.cmd run test`：通过，14 个测试文件 129 个用例。
- `npm.cmd run build`：通过。
- `python scripts/start_dev_server.py --check-only`：通过，前端与后端均可用；`/api/health`、`?ui=pc`、`?ui=mobile` 均返回 200。

## 七、验收标准

1. 设置页“数据备份与恢复”区域能看到独立的 `导入 ChatGPT 对话` 按钮。
2. 完整备份 JSON 仍通过 `导入 JSON` 恢复数据。
3. ChatGPT Vault 单条对话归档 JSON 通过新按钮进入新建提示词预填流程。
4. 错选文件时提示明确，不静默失败，也不误覆盖本地数据。
5. 自动化测试和前端构建通过。

## 八、风险

- 如果保留旧 `导入 JSON` 的自动分流能力，用户仍可能混用入口；实现时应考虑是否把旧入口改成只接受完整备份。
- 如果按钮文案过长，窄屏会挤压；需要稳定宽度和响应式退化。
- 单条对话归档 JSON 通常不包含图片二进制；需要在文案中避免暗示一定会导入图片。
