# 数据备份恢复新增单条对话导入按钮计划

> 创建日期：2026-05-24  
> 状态：已实施并通过验证
> 范围：在 PC 设置页“数据备份与恢复”区域新增一个独立按钮，用于导入 ChatGPT Vault 的单条对话归档 JSON；普通完整备份 JSON 的导入入口保持不变。

## 当前任务

- 目标：将 `prompt-image-tool` 双端发版版本号收口为 `2.3.5`，并重打 PC 核心安装包、Tauri 安装壳 UI 包和 Android APK。
- 已完成：版本面已切到 `2.3.5`，安装壳嵌入核心安装包路径已改到 `PromptImageManager-Setup-2.3.5.exe`，版本索引已同步。
- 已完成：`python scripts/build_release_packages.py --all --skip-env-check` 生成 PC 核心安装包和 Android APK。
- 已完成：`python scripts/build_installer_shell_package.py --skip-pc-build` 生成带安装壳 UI 的 PC 安装包。
- 已完成：产物大小、SHA256、APK 签名与版本元信息、安装壳 Windows 版本信息已回填到 `docs/版本记录/changelog.md`。

## 当前判断

- 当前设置页已经有两个主动作：`导入 JSON` 和 `导出 JSON`。
- 目前 `导入 JSON` 既承担完整备份恢复，也承担专用对话归档导入的分流，语义上偏杂。
- 现有共享导入能力已经具备：
  - `src/js/prompt-tool-json-import.js` 能识别 `prompt-image-tool.import.v1`
  - 同时也能识别单条 ChatGPT Vault 对话归档 JSON
  - `pc-settings.js`、`pc-home.js`、`mobile-settings.js`、`mobile-home.js` 都已经接入该共享导入分流
- 因此本次改动重点不是补识别能力，而是把“单条对话归档导入”做成显式按钮，减少用户误以为它是普通备份恢复的概率。

## 实施计划

### Phase 0：交互定义

- 明确按钮语义：
  - `导入 JSON`：导入完整备份 JSON，走 `storage.importData(data)`。
  - 新增按钮：导入 ChatGPT Vault 单条对话归档 JSON，走共享导入解析后进入新建提示词页。
- 确认按钮位置：
  - 优先放在 PC 设置页“数据备份与恢复”区域内，与现有导入/导出并列。
  - 如布局允许，可在导入主按钮右侧以次级按钮或分裂按钮形式呈现。
- 保持移动端行为一致性：
  - 若移动端也存在同类备份恢复入口，同步增加对应按钮。

### Phase 1：共享导入能力复用

- 复用 `src/js/prompt-tool-json-import.js` 的现有识别和标准化逻辑，不重写协议。
- 按钮点击后只负责：
  - 打开文件选择
  - 读取 JSON
  - 调用共享解析器
  - 成功后跳转到新建编辑页
- 若文件不是单条对话归档 JSON，按钮应明确提示格式不匹配，不要误走完整备份恢复。

### Phase 2：PC 设置页改造

- 在 `src/js/pc-settings.js` 的“数据备份与恢复”区新增独立按钮。
- 调整事件分发：
  - 完整备份导入保留原入口
  - 单条对话归档导入走新入口
- 维持现有导出位置模式不变：
  - 下载目录
  - 自定义位置

### Phase 3：移动端一致性检查

- 检查 `src/js/mobile-settings.js` 是否也需要新增同类入口。
- 若移动端当前仅有一个导入按钮，则补一个独立入口，避免 PC 和移动端语义不一致。
- 如移动端空间受限，可至少在文案上明确区分“完整备份导入”和“对话归档导入”。

### Phase 4：验证与回归

- 前端单测：
  - 补按钮语义或导入分流测试
  - 保证完整备份 JSON 仍然走原导入逻辑
  - 保证单条对话归档 JSON 走新入口
- 页面级验证：
  - PC 设置页点击新按钮后能识别单条对话归档 JSON
  - 普通备份 JSON 不会误进新入口
  - 导入后能正确跳转到新建提示词页

### Phase 5：文档同步

- 同步 `docs/apps-code-map.md`
- 同步就近技术文档：
  - `docs/技术文档/pc-technical-doc.md`
  - 如移动端也改动，再同步 `docs/技术文档/mobile-technical-doc.md`
- 如需要，补充一条简短的版本记录或计划说明。

## 任务清单

- [x] T0.1 确认按钮语义和摆放位置。
- [x] T0.2 确认 PC 与移动端是否都要新增独立入口。
- [x] T1.1 设计新的按钮文案与图标。
- [x] T1.2 设计完整备份导入与单条对话导入的分流规则。
- [x] T2.1 改造 PC 设置页按钮布局。
- [x] T2.2 调整 PC 设置页导入事件分发。
- [x] T2.3 如有需要，补移动端同类入口。
- [x] T3.1 补导入分流相关单测。
- [x] T3.2 补页面级回归验证。
- [x] T4.1 同步 `docs/apps-code-map.md`。
- [x] T4.2 同步 PC 或移动端技术文档。
- [x] T4.3 汇总验证结果与剩余风险。

## 验证结果

- `npm.cmd run test -- prompt-tool-json-import.test.js pc-settings.test.js mobile-regression.test.js`：通过，3 个测试文件 23 个用例。
- `npm.cmd run test`：通过，14 个测试文件 129 个用例。
- `npm.cmd run build`：通过，Vite 生产构建完成。
- `python scripts/start_dev_server.py --check-only`：通过，前端与后端均可用；`/api/health`、`?ui=pc`、`?ui=mobile` 均返回 200。

## 风险与边界

- 不改变完整备份 JSON 的导入契约。
- 不改变 ChatGPT Vault 对话归档 JSON 的协议内容，只改变入口暴露方式。
- 若按钮过多导致设置页拥挤，优先保留语义清晰，其次再做布局收敛。
