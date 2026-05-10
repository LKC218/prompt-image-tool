# 局域网同步功能 — 设计文档

> 版本：1.1.0 | 最后更新：2026-05-04

---

## 一、功能概述

实现 Android 端与 PC 端在同一局域网内一键互通数据。PC 端作为局域网 HTTP 服务端，Android 端作为发起方，通过 HTTP 协议完成数据与图片的拉取、回传和双向合并。

### 核心目标

- Android 端一键拉取 PC 端全量数据
- Android 端可将本机数据回传到 PC
- Android 端可发起双向同步，先回传本机数据，再拉取 PC 最新结果
- 同步过程有状态反馈，防止重复操作
- 同步完成后校验数据完整性
- 拉取模式同 ID 数据以 PC 端为准覆盖移动端；回传模式默认保护 PC 数据并生成冲突副本

### 前提条件

- PC 端软件必须启动（Python HTTP 服务运行中）
- 两端处于同一局域网
- PC 端防火墙允许 8888 端口入站

---

## 二、整体架构

```
┌──────────────┐     局域网 HTTP      ┌──────────────────┐
│  Android 端   │  ─────────────────→  │     PC 端         │
│  (客户端)     │                      │  (服务端)         │
│               │  ←─────────────────  │                   │
│  SqliteStorage│   JSON + 图片流      │  Python HTTP 服务 │
│  + Filesystem │                      │  + JSON 文件存储  │
└──────────────┘                       └──────────────────┘
```

### 数据流

```
Android 选择同步方向
  → 输入 PC 的局域网 IP（如 192.168.1.100）
  → 拉取：GET /api/sync → 写入 Android SQLite → 下载图片
  → 回传：GET /api/sync/pairing → POST /api/sync/import → PC 写入 JSON 和图片
  → 双向：先回传，再拉取 PC 最新快照
```

---

## 三、PC 端改动

### 3.1 Python 服务监听地址

**现状**：监听 `localhost:8888`，仅本机可访问

**改动**：监听 `0.0.0.0:8888`，允许局域网设备访问

```python
# 修改前
httpd = socketserver.ThreadingTCPServer(("localhost", 8888), RequestHandler)

# 修改后
httpd = socketserver.ThreadingTCPServer(("0.0.0.0", 8888), RequestHandler)
```

### 3.2 新增同步接口

#### GET /api/sync

一次性返回所有数据，供 Android 端拉取。

**响应格式**：

```json
{
  "folders": [
    {
      "id": "folder001",
      "name": "角色",
      "color": "#FF6B9A"
    }
  ],
  "prompt_sets": [
    {
      "id": "xxx",
      "name": "集合名称",
      "folder_id": "folder001",
      "tags": "[\"角色\"]",
      "is_favorite": false,
      "created_at": "2026-05-03T14:00:00Z",
      "updated_at": "2026-05-03T15:00:00Z"
    }
  ],
  "versions": [
    {
      "id": "xxx",
      "prompt_set_id": "xxx",
      "version": "v1",
      "prompt": "...",
      "negative_prompt": "...",
      "note": "...",
      "sort_order": 0,
      "aspect_ratio": "1:1",
      "style_preset": "",
      "sampler": "DPM++ 2M Karras",
      "steps": 30,
      "cfg_scale": 7.0,
      "hr_fix": true,
      "model": "",
      "created_at": "2026-05-03T14:00:00Z"
    }
  ],
  "images": [
    {
      "id": "xxx",
      "version_id": "xxx",
      "name": "原始文件名.png",
      "path": "",
      "file": "abc123.png",
      "note": "",
      "created_at": "2026-05-03T14:00:00Z"
    }
  ],
  "sync_meta": {
    "server_time": "2026-05-03T15:00:00Z",
    "total_folders": 1,
    "total_prompt_sets": 3,
    "total_versions": 8,
    "total_images": 20
  }
}
```

#### GET /api/sync/images/{filename}

下载单张图片，返回二进制流。

#### GET /api/sync/capabilities

返回 PC 端互通能力，包含 `device_id`、`sync_version`、`pairing_required` 和 `capabilities`。Android 搜索结果会据此展示“支持回传”或“支持双向”。

#### GET /api/sync/pairing

返回当前 PC 的同步令牌。Android 回传和双向同步会在写入类请求中通过 `X-Sync-Token` 携带该令牌。

#### POST /api/sync/import

Android 回传本机备份数据到 PC。默认 `mode=keep_pc`，同 ID 冲突时保留 PC 端数据，将 Android 数据保存为“Android冲突副本”。

#### POST /api/sync/bidirectional

Android 上传本机快照，PC 合并后返回最新同步快照。当前实现仍以 PC 作为服务端，不要求 Android 常驻 HTTP 服务。

### 3.3 新增本机 IP 查询接口

#### GET /api/network-info

返回 PC 端局域网 IP，方便 Android 端显示或确认。

```json
{
  "ip": "192.168.1.100",
  "port": 8888
}
```

### 3.4 PC 端界面提示

在 PC 端界面显示本机 IP、端口和互通能力，提示 Android 可搜索此 PC，并说明 Android 回传时会保护 PC 端同 ID 数据。

---

## 四、Android 端改动

### 4.1 同步 UI

- 在设置页添加「局域网同步」区域
- 支持「搜索 PC」自动发现同一局域网内已打开的 PC 端
- 支持手动填写 PC 端 IP 地址作为搜索失败时的兜底路径
- 支持选择「从 PC 拉取」「回传到 PC」「双向同步」
- 同步过程中显示进度和状态
- 同步完成后显示结果报告

### 4.2 PC 搜索流程

```
1. 用户点击「搜索 PC」
2. 优先探测最近连接过的 PC 地址
3. 尝试通过 WebRTC 获取移动端当前局域网 IP，推导当前网段
4. 扫描当前网段和常见回退网段
5. 对候选地址请求 GET http://IP:8888/api/health
6. 仅 status=ok 的设备进入结果列表
7. 用户点击结果后自动填入 IP，并再次执行连接测试
8. 搜索不到时保留手动输入 IP 的路径
```

### 4.3 同步流程

```
1. 用户输入 PC 端 IP（如 192.168.1.100）
2. 连接测试：GET http://192.168.1.100:8888/api/health
   → 失败：提示"无法连接 PC 端，请检查 IP 和网络"
   → 成功：继续
3. 拉取数据：GET http://192.168.1.100:8888/api/sync
4. PC 优先覆盖合并（见第五章）
5. 写入本地 SQLite
6. 逐个下载图片：GET http://192.168.1.100:8888/api/sync/images/{filename}
   → 写入 Filesystem
7. 校验数据完整性（见第六章）
8. 显示同步报告
```

### 4.4 网络权限

Android 端已声明 `INTERNET` 权限，无需额外添加。

由于 Capacitor Android 端页面来源为 `https://localhost/`，而 PC 同步服务为 `http://{PC_IP}:8888`，Android 端需要启用：

- `android.allowMixedContent=true`：允许 WebView HTTPS 页面请求局域网 HTTP 接口。
- `android:usesCleartextTraffic="true"`：允许 Android 9+ 明文 HTTP 访问局域网同步服务。

---

## 五、覆盖与冲突策略

### 5.1 拉取模式

Android 从 PC 拉取时，同一个 prompt_set 在 PC 和 Android 两端都存在，以 PC 端数据作为同步基准。

**规则**：PC 端赢。移动端本机更新时间更晚也会被 PC 端覆盖。

```
PC 端 prompt_set A: updated_at = 2026-05-03 14:00
Android 端 prompt_set A: updated_at = 2026-05-03 15:00

→ PC 的版本覆盖 Android 本机版本
```

**覆盖逻辑**：

| 情况 | 处理方式 |
|------|---------|
| 仅 PC 端有 | 同步到 Android |
| 仅 Android 端有 | 保留不动 |
| 两端都有同 ID 记录 | 删除 Android 本机该记录，写入 PC 端记录和图片 |

### 5.2 回传模式

Android 回传到 PC 时，默认采用 `keep_pc` 策略，保护 PC 端已有数据。

| 情况 | 处理方式 |
|------|---------|
| 仅 Android 端有 | 新增到 PC |
| 两端同 ID 且业务内容一致 | 跳过，不生成冲突副本 |
| 两端同 ID 但业务内容不同 | 保留 PC 数据，将 Android 数据保存为“Android冲突副本” |

冲突判断必须先归一化为业务内容摘要，不直接比较完整 JSON。生成型 ID、创建更新时间、图片 Data URL、图片体积、MIME 类型，以及 `camelCase` 与 `snake_case` 命名差异不应触发冲突。

### 5.3 双向模式

双向同步由 Android 发起，流程为先回传本机快照到 PC，再拉取 PC 最新快照回 Android。回传阶段沿用 `keep_pc`，拉取阶段沿用 PC 优先覆盖。

### 5.4 版本向量（暂不实现）

每个记录加 `version` 递增计数器 + 修改来源标记，适合频繁双向同步或多人协作。当前项目为个人工具，暂不需要此方案。

---

## 六、同步状态管理

### 6.1 同步锁

防止用户重复点击同步按钮。

```
同步中 → 按钮禁用 + 显示进度动画
同步完成 → 按钮恢复 + 显示成功提示
同步失败 → 按钮恢复 + 显示错误信息 + 支持重试
```

### 6.2 同步状态机

```
  空闲 (IDLE)
    │
    ▼ 点击同步
  连接中 (CONNECTING)
    │
    ├── 连接失败 → 报错，回到空闲
    │
    ▼ 连接成功
  同步中 (SYNCING)
    │
    ├── 局部失败 → 记录进度，继续
    │
    ▼ 全部完成
  校验中 (VERIFYING)
    │
    ├── 校验通过 → 成功 (SUCCESS) → 显示报告 → 回到空闲
    └── 校验失败 → 部分成功 (PARTIAL) → 显示差异 → 回到空闲
```

### 6.3 断点续传

图片下载过程中可能因网络中断导致部分图片未完成。

**记录已同步的图片列表**：

```json
{
  "sync_progress": {
    "status": "partial",
    "synced_images": ["img1.png", "img2.png"],
    "total_images": 50,
    "failed_at": "img31.png"
  }
}
```

- 已下载的图片不重复下载
- 重试时从失败处继续
- 全部完成后清除进度记录

---

## 七、数据完整性校验

### 7.1 数量校验

同步完成后，对比两端数据数量：

| 数据类型 | 校验方式 |
|---------|---------|
| prompt_sets | PC 端总数 == Android 端总数 |
| versions | PC 端总数 == Android 端总数 |
| images 元数据 | PC 端总数 == Android 端总数 |
| images 文件 | 下载成功数 == 元数据记录数 |

### 7.2 关键字段校验

对比每个 prompt_set 的 `updated_at` 是否与 PC 端一致；同 ID 记录应已被 PC 端覆盖。

### 7.3 同步报告

同步完成后向用户展示报告：

```
✅ 3 个集合同步成功
✅ 8 个版本同步成功
✅ 20 张图片同步成功
⚠️ 2 个同 ID 集合已按 PC 端覆盖
❌ img15.png 下载失败（可重试）
```

---

## 八、安全性考虑

| 风险 | 当前状态 | 建议 |
|------|---------|------|
| 局域网内任意设备可访问 API | 无认证 | 第一版可接受，后续可加简单 Token |
| 数据明文传输 | HTTP 无加密 | 局域网内风险较低，HTTPS 需证书管理 |
| 误操作覆盖数据 | PC 优先覆盖 | 同步入口明确提示“PC 端同 ID 数据会覆盖本机” |

### Token 认证方案（可选）

PC 端启动时生成随机 Token，Android 端同步时需携带：

```
GET /api/sync?token=abc123def456
```

- Token 在 PC 端界面显示
- Android 端首次同步时需输入 Token
- 后续可缓存 Token，无需重复输入

---

## 九、实现优先级

| 优先级 | 功能 | 说明 | 状态 |
|--------|------|------|------|
| P0 | PC 端监听 `0.0.0.0` | 基础前提 | ✅ 已实现 |
| P0 | `/api/sync` 接口 | 核心功能 | ✅ 已实现 |
| P0 | `/api/sync/images/{filename}` 接口 | 图片下载 | ✅ 已实现 |
| P0 | Android 端同步 UI + 流程 | 核心功能 | ✅ 已实现 |
| P1 | 同步锁 + 状态机 | 防重复操作 | ✅ 已实现 |
| P1 | 数据完整性校验 | 确保同步可靠 | ✅ 已实现 |
| P1 | 同步报告 | 用户反馈 | ✅ 已实现 |
| P2 | PC 优先覆盖策略 | 明确同步基准 | ✅ 已实现 |
| P2 | 断点续传 | 大量图片场景 | ❌ 未实现 |
| P2 | `/api/network-info` 接口 | 便捷获取 IP | ✅ 已实现 |
| P3 | Token 认证 | 安全加固 | ❌ 未实现 |
| P3 | PC 端界面显示 IP | 用户体验优化 | ✅ 已实现 |

---

## 十、PC 端是否需要启动

**当前架构：必须启动。**

PC 端数据存储在 Python HTTP 服务中，服务未运行则无法响应同步请求。

### 替代方案（如需脱离 PC 启动）

| 方案 | 描述 | 优缺点 |
|------|------|--------|
| 独立同步服务 | Python 小脚本开机自启，独立于 Tauri 应用 | ✅ Tauri 关了也能同步；❌ 多一个东西维护 |
| 共享文件存储 | PC 数据存到 NAS/Samba/WebDAV，Android 直接读写 | ✅ 不需要服务；❌ Android 访问 Samba 需额外插件 |
| Rust 内嵌服务 | 在 Tauri 的 Rust 侧实现 HTTP 服务，随系统自启 | ✅ 一体化；❌ 开发成本高 |

**建议**：个人工具场景下，同步时打开 PC 软件即可，无需额外投入。
