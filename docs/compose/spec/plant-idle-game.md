---
feature: plant-idle-game
status: delivered
updated: 2026-09-17
branch: feature/plant-idle-game
commits: c928215..HEAD
---

# 首页挂机种植物

## Report

**What was built** — 首页横幅 30 天挂机镜面草：日历轮回（生长/开花/凋落/铲除）、日变化装饰、养护动画、园艺光标；正式档双写 `plant.json` + localStorage，备份含 plant；无调试面板。增强：满级铲除提示、天数徽章、设置重置、离线轻提示。

**Verification** — plant 相关 27 测过；`npm run build` 成功；`probe_install.py` 已含 plant API 落盘与 export 检查（安装版需重打 exe 后跑探针）。

**Journey log** — 1) 在线时长模型改为 30 天日历。2) 叠 leaf 精灵失败，改整图档位。3) Windows CSS cursor url 失败，改 pc-custom-cursor 皮肤。4) 持久化挂 Python DATA_DIR 与业务同寿命。5) 发布去掉 debug UI。

## [S1] Problem

主功能（30 天轮回、养护、持久化、去调试面板）已可用。仍缺四点体验增强：
1. 满级后「可铲除」不够显眼，用户可能不知道能重开轮回  
2. 看不到「本轮已陪伴多少天」  
3. 设置里无法主动重置植物  
4. 后端离线时几乎无反馈（静默降级 LS）

## [S2] Design

### E1 满级铲除提示更明显

**现状：** day≥30 在盆底出现小「铲除」钮，易忽略。

**改动：**
- day 28–30：植物槽加轻微 `is-ready-shovel` 呼吸描边（横幅内，不破 176px）
- day≥30：铲除钮加主色底 + 「可重开」文案；进入时播一次 pulse
- 点击铲除前 `confirm` 弱确认：「铲除后将从第 1 天重新开始」（可取消）
- 确认后：`shovelCycle` + `totalCycles+1` + immediate persist

**文件：** `plant-view.js`、`11-plant.css`、`plant-core.js`（`totalCycles`）、`plant-tracker.js`

**验收：** 跳到/到第 30 天，铲除钮对比度与脉冲可见；取消不重置；确认后回到 seed 且 `totalCycles` 增加。

---

### E2 本轮累计打开天数

**现状：** core 已有 `activeDays`（跨日 +1），UI 未展示。

**改动：**
- 植物槽右下角小徽章：`第 N 天`（cycleDay）+ 可选 `本轮第 A 天`（activeDays）
- 横幅高度紧张时仅显示 `cycleDay/30`；hover title 显示 `本轮打开 A 天`
- 不新增路由；不进游戏中心

**文件：** `plant-view.js`、`11-plant.css`

**验收：** 首页可见天数；跨日打开 `activeDays`+1 且与 `plant.json` 一致。

---

### E3 设置页「重置植物」

**现状：** 无入口。

**改动：**
- `pc-settings.js`「本地数据 / 危险操作」区增加「重置挂机植物」
- 二次确认后：`shovel` 或直接 `createInitialState` + `persistPlant` + 清 debug 档
- 文案说明：仅重置植物，不影响提示词

**文件：** `pc-settings.js`（+样式若需）、`plant-persist.js`（`resetPlant`）

**验收：** 设置里可重置；确认后首页为第 1 天；提示词数据不变。

---

### E4 离线轻提示（可选）

**现状：** API 失败静默写 LS。

**改动：**
- `plant-persist` 暴露 `lastPersistSource: 'api' | 'local' | 'fail'`
- 后端连续失败 ≥2 次：植物区 title/小字「离线暂存本地」；恢复后清除
- **不**弹 Toast 刷屏；横幅内一行小字即可

**文件：** `plant-persist.js`、`plant-tracker.js`、`plant-view.js`

**验收：** 停 8888 后养护仍成功且有轻提示；恢复后提示消失。

---

### 数据契约增量

```json
{
  "plant": {
    "...": "既有字段",
    "totalCycles": 0
  }
}
```

- `totalCycles`：铲除次数，缺省 0，兼容旧档  
- `activeDays`：已在用，继续跨日累计  

## [S3] Out of Scope

- 植物图鉴/多盆  
- 云同步 activeDays  
- 大改横幅布局或移动端  
- 复杂通知中心  

## Tasks

- [x] T1: E1 铲除提示 + 弱确认 + totalCycles — acceptance: 第 30 天视觉显著；确认/取消行为正确 (covers: E1)
- [x] T2: E2 天数徽章 — acceptance: 首页显示 cycleDay；activeDays 有 title 或副文案 (covers: E2)
- [x] T3: E3 设置重置植物 — acceptance: 设置可重置到第 1 天且落盘 (covers: E3)
- [x] T4: E4 离线轻提示 — acceptance: 断后端有提示、恢复清除 (covers: E4)
- [x] T5: 单测/构建/文档 — acceptance: core 仍全过；build 成功；模块说明更新 (covers: 全部)


# 首页挂机种植物

## Report

（正式持久化实装完成后填写）

## [S1] Problem

首页横幅已有 30 天轮回挂机植物（成长/开花/凋落/铲除、养护交互、园艺光标），但状态目前只写 **WebView `localStorage`**。安装包升级通常还能保留；**重装/清用户数据会丢档**，与提示词业务数据「更新重装不重置」策略不一致。

需要：植物生长记录 **持久化到本地稳定数据目录**，与业务数据同寿命，并纳入备份导出。

## [S2] Design

### 目标行为

1. 植物正式档落在 **用户数据目录**（与 `prompt_sets.json` 同级）：
   - 安装版默认：`%APPDATA%\PromptImageManager\data\plant.json`
   - 开发：与 `DATA_DIR` 策略一致（Python 侧 `APP_DIR/data`）
   - 支持 `PROMPT_IMAGE_TOOL_DATA_DIR` 覆盖（测试隔离）
2. **重装/覆盖安装/升级** 后打开软件，`cycleStartAt` / 养护 / 历史天数不丢。
3. 首次启动若仅有旧 `localStorage['pc-plant-state']` → **自动迁移** 到文件，迁移成功后可保留 LS 做只读备份或清除。
4. 设置页「备份导出/导入」JSON **包含** `plant` 字段；导入时可恢复植物档。
5. Debug 档仍隔离，**不进** 正式 `plant.json`。
6. 离线/后端未起时：读写失败不阻塞首页；可降级读写 localStorage 并提示「未持久化」。

### 存储契约

**文件：** `DATA_DIR/plant.json`

```json
{
  "schemaVersion": 1,
  "plant": {
    "cycleStartAt": 0,
    "cycleDay": 1,
    "todayKey": "YYYY-MM-DD",
    "care": { "watered": false, "fertilized": false, "deugged": false },
    "activeDays": 1,
    "lastSeenKey": "YYYY-MM-DD",
    "bugCleared": false,
    "stageKey": "01-seed",
    "canShovel": false,
    "totalCycles": 0
  },
  "updatedAt": 0
}
```

- `normalizeState` / `refreshCycle` 兼容缺字段。
- 新增可选 `totalCycles`：铲除次数统计（本轮外历史）。

### 后端 API（Python `main.py`，与 goals 同风格）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plant` | 读 `plant.json`，不存在返回 `{ plant: null }` |
| PUT | `/api/plant` | 写完整 plant 对象，原子写临时文件再 replace |

- 路径常量：`PLANT_FILE = os.path.join(DATA_DIR, 'plant.json')`
- 写权限与 `goals.json` 一致；错误返回 500 JSON。
- 单测：`python/tests/test_main.py` 增读写/覆盖/缺文件用例。

### 前端存储层

| 文件 | 变更 |
|------|------|
| `src/js/plant-persist.js`（新） | `loadPlantFromApi` / `savePlantToApi`；超时/失败回退 LS |
| `src/js/plant-tracker.js` | start 时：API 优先 → LS 迁移；save 节流写 API + 同步 LS |
| `src/js/api-storage.js` | `getPlant()` / `savePlant(plant)` |
| `src/js/backup-utils.js` / export | `exportData` 附带 `plant` |
| `src/js/pc-settings.js` | 导入时若含 `plant` 则写入 API/LS |

**写策略：**

- 养护/铲除：立即 `savePlant`（防丢）
- 心跳跨天：立即 save
- 同会话重复 save：500ms debounce
- 校验：`schemaVersion`；未知字段忽略

**读策略（启动）：**

```text
1. GET /api/plant → 有则 normalize + refreshCycle
2. 无则读 localStorage → 有则 PUT 迁移
3. 皆无 → createInitialState
```

### 与现有视觉/交互关系

- 30 天轮回、12 档素材、日装饰、养护动画、园艺光标 **不变**
- 仅替换「写到哪、启动读哪、备份带不带」

### 测试边界

- core：已覆盖轮回逻辑（保持）
- 新增：`plant-persist` 单测（mock fetch）：成功/失败回退/迁移
- Python：GET/PUT plant
- 手动验收见 Tasks

## [S3] Out of Scope

- 云同步 / 多设备合并植物档
- 移动端 SQLite 植物表（可后续 mirror 文件接口）
- 植物成就图鉴、多盆并行
- 改 30 天数值或美术

## Tasks

- [x] T1: Python `GET/POST /api/plant` + `plant.json` 落盘 — acceptance: `python/main.py` 与 `build/app_main.py` 均含 load/save_plant 与路由；py_compile 通过 (covers: S2)
- [x] T2: 前端 `api-storage.getPlant/savePlant` + `plant-persist` 迁移/回退 — acceptance: `plant-persist.test.js` 7 测通过 (covers: S2; depends: T1)
- [x] T3: tracker 接入持久化（启动读、关键动作写、debounce） — acceptance: `pc-home` 传入 apiStorage；养护/铲除 immediate save；后端失败不阻塞 (covers: S2; depends: T2)
- [x] T4: 备份导出/导入包含 plant — acceptance: `build_backup_payload` 含 plant；`handle_import` 写回 plant.json (covers: S2; depends: T2)
- [x] T5: 文档与规格同步 — acceptance: 模块说明/代码地图含 plant.json 与 API (covers: S2; depends: T3)

### 手动验收清单（T3）

- [ ] 浇水后重启软件，当日养护仍为已完成
- [ ] 第 N 天打开，stage 与 N 一致
- [ ] 铲除后重启，回到第 1 天且 `totalCycles` +1（若实现）
- [ ] 删除 localStorage 键后启动，仍从 `plant.json` 恢复
- [ ] 后端 8888 未启动：可玩且 LS 回退，不白屏
- [ ] 设置页导出备份再导入，植物档恢复
