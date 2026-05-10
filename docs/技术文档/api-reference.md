# 生图提示词管理器 — API 接口文档

> 版本：2.2.1 | 最后更新：2026-05-04
> 后端实现：[python/main.py](../../python/main.py)

---

## 一、基础信息

| 项目 | 值 |
|------|-----|
| 协议 | HTTP |
| 端口 | 8888 |
| 监听地址 | `0.0.0.0`（支持局域网访问） |
| 数据格式 | JSON（`Content-Type: application/json; charset=utf-8`） |
| CORS | 全部接口支持跨域（`Access-Control-Allow-Origin: *`） |
| 服务器 | `socketserver.ThreadingTCPServer`（多线程） |

---

## 二、健康检查

### GET /api/health

健康检查接口，前端启动时轮询此接口等待后端就绪；移动端搜索局域网 PC 端时也通过该接口确认候选地址是否为可同步的 PC 服务。

**响应**：

```json
{
  "status": "ok",
  "dataDir": "/path/to/data",
  "device_name": "PC-NAME",
  "device_id": "uuid",
  "platform": "pc",
  "sync_version": 2,
  "pairing_required": true,
  "capabilities": ["pull", "push", "bidirectional", "pairing"]
}
```

---

## 三、文件夹管理

### GET /api/folders

获取所有文件夹。

**响应**：

```json
[
  {
    "id": "folder001",
    "name": "风景类",
    "color": "#FF6B6B",
    "sortOrder": 0,
    "createdAt": "2026-05-03T14:00:00Z",
    "updatedAt": "2026-05-03T14:00:00Z"
  }
]
```

### POST /api/folders

创建文件夹。

**请求体**：

```json
{
  "name": "风景类",
  "color": "#FF6B6B"
}
```

**响应**：返回创建的文件夹对象。

### POST /api/folder/{id}

更新文件夹。

**请求体**：

```json
{
  "name": "新名称",
  "color": "#4ECDC4"
}
```

**响应**：返回更新后的文件夹对象。

### DELETE /api/folder/{id}

删除文件夹。关联的提示词集合自动移至未分类。

**响应**：

```json
{ "success": true }
```

---

## 四、提示词集合

### GET /api/prompt-sets

获取所有提示词集合摘要列表。

**响应**：

```json
[
  {
    "id": "abc123",
    "name": "风景提示词",
    "folderId": "folder001",
    "versionCount": 3,
    "imageCount": 5,
    "createdAt": "2026-05-03T14:00:00Z",
    "updatedAt": "2026-05-03T15:00:00Z"
  }
]
```

### GET /api/prompt-set/{id}

获取单个集合详情（含完整版本和图片数据）。

**响应**：

```json
{
  "id": "abc123",
  "name": "风景提示词",
  "folderId": "folder001",
  "createdAt": "2026-05-03T14:00:00Z",
  "updatedAt": "2026-05-03T15:00:00Z",
  "versions": [
    {
      "version": "v1",
      "prompt": "beautiful landscape...",
      "negativePrompt": "blurry...",
      "note": "初始版本",
      "images": [
        {
          "id": "img001",
          "name": "landscape.png",
          "path": "",
          "file": "img001.png",
          "note": "",
          "createdAt": "2026-05-03T14:00:00Z"
        }
      ],
      "createdAt": "2026-05-03T14:00:00Z"
    }
  ]
}
```

### POST /api/prompt-sets

创建提示词集合。自动创建 v1 版本。

**请求体**：

```json
{
  "name": "新集合",
  "folderId": "folder001"
}
```

`folderId` 可选，为 `null` 或省略表示未分类。

**响应**：返回创建的集合详情。

### POST /api/prompt-set/{id}

更新提示词集合。

**请求体**：

```json
{
  "name": "更新后的名称",
  "folderId": "folder002",
  "versions": [...]
}
```

**响应**：返回更新后的集合详情。

### DELETE /api/prompt-set/{id}

删除提示词集合及其所有版本和关联图片文件。

**响应**：

```json
{ "success": true }
```

### POST /api/prompt-set/{id}/move

移动集合到指定文件夹。

**请求体**：

```json
{
  "folderId": "folder002"
}
```

`folderId` 为 `null` 表示移至未分类。

**响应**：

```json
{ "success": true }
```

---

## 五、版本操作

### POST /api/prompt-set/{id}/version

添加新版本。

**请求体**：

```json
{
  "prompt": "",
  "negativePrompt": "",
  "note": ""
}
```

**响应**：返回更新后的集合详情。

### POST /api/prompt-set/{id}/delete-version

删除版本。至少保留一个版本。

**请求体**：

```json
{
  "versionIndex": 0
}
```

**响应**：返回更新后的集合详情。

### POST /api/prompt-set/{id}/rename-version

重命名版本。

**请求体**：

```json
{
  "versionIndex": 0,
  "version": "最终版"
}
```

**响应**：返回更新后的集合详情。

### POST /api/prompt-set/{id}/duplicate-version

复制版本。深拷贝版本内容（含图片文件复制），备注标记来源。

**请求体**：

```json
{
  "versionIndex": 0
}
```

**响应**：返回更新后的集合详情。

---

## 六、图片操作

### POST /api/image/{imageId}

上传图片。

**请求体**：

```json
{
  "data": "data:image/png;base64,iVBORw0KGgo...",
  "name": "原始文件名.png"
}
```

**响应**：

```json
{
  "success": true,
  "filename": "img001.png"
}
```

### DELETE /api/image/{filename}

删除图片文件。

**响应**：

```json
{ "success": true }
```

### GET /images/{filename}

获取图片文件。返回二进制流，`Content-Type` 根据文件扩展名自动设置。

**支持格式**：PNG、JPG、WEBP、GIF

---

## 七、数据导入导出

### GET /api/export

导出完整备份数据，包含文件夹、提示词集合、版本、图片元数据和图片文件内容。

**响应**：

```json
{
  "backup_meta": {
    "app": "prompt-image-tool",
    "format": "prompt-image-tool-backup",
    "version": 1,
    "createdAt": "2026-05-09T21:00:00",
    "imageCount": 2,
    "imageBytes": 123456
  },
  "folders": [],
  "prompt_sets": [
    {
      "id": "abc123",
      "name": "风景提示词",
      "folderId": "folder001",
      "createdAt": "2026-05-03T14:00:00Z",
      "updatedAt": "2026-05-03T15:00:00Z",
      "versions": [
        {
          "version": "v1",
          "images": [
            {
              "id": "img1",
              "file": "img1.png",
              "data": "data:image/png;base64,...",
              "mimeType": "image/png",
              "size": 1024
            }
          ]
        }
      ]
    }
  ]
}
```

### POST /api/export-file

让 Python 后端直接生成完整备份文件，作为 PC 桌面端 WebView 下载不可靠时的兜底保存方式。

**请求体**：

```json
{
  "filename": "prompt-backup-2026-05-09-210000.json"
}
```

**响应**：

```json
{
  "success": true,
  "filename": "prompt-backup-2026-05-09-210000.json",
  "path": "D:\\Work\\git\\prompt-image-tool\\python\\data\\backups\\prompt-backup-2026-05-09-210000.json",
  "directory": "D:\\Work\\git\\prompt-image-tool\\python\\data\\backups",
  "size": 123456,
  "promptSetCount": 3,
  "versionCount": 6,
  "imageCount": 2
}
```

### POST /api/import

导入数据。相同 ID 的集合会覆盖更新。

**请求体**：完整备份对象；兼容旧版 `Array<PromptSet>`。相同 ID 的集合默认覆盖，本地旧图片会清理并按备份中的图片内容恢复。

**响应**：

```json
{
  "imported": 3,
  "added": 2,
  "updated": 1,
  "imagesRestored": 5
}
```

---

## 八、局域网同步接口

### GET /api/sync

同步数据接口，一次性返回所有数据供 Android 端拉取。

**响应**：

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

### GET /api/sync/images/{filename}

下载单张图片，返回二进制流。

### GET /api/sync/capabilities

返回 PC 端局域网互通能力，供 PC 设置页展示和 Android 端判断是否支持回传、双向同步。

**响应**：

```json
{
  "status": "ok",
  "device_id": "uuid",
  "device_name": "PC-NAME",
  "platform": "pc",
  "sync_version": 2,
  "ip": "192.168.1.100",
  "port": 8888,
  "pairing_required": true,
  "capabilities": ["pull", "push", "bidirectional", "pairing"]
}
```

### GET /api/sync/pairing

返回当前 PC 的局域网同步令牌。Android 回传或双向同步前会读取该令牌，并在写入类请求中通过 `X-Sync-Token` 提交。

**响应**：

```json
{
  "success": true,
  "device_id": "uuid",
  "device_name": "PC-NAME",
  "sync_token": "token",
  "pairing_code": "ABC123",
  "expires": null
}
```

### POST /api/sync/import

Android 将本机完整备份回传到 PC。该接口必须携带 `X-Sync-Token`，默认保护 PC 端同 ID 数据。

**请求头**：

```text
X-Sync-Token: token
X-Device-Id: android-device-id
X-Device-Name: Android
```

**请求体**：

```json
{
  "mode": "keep_pc",
  "payload": {
    "folders": [],
    "prompt_sets": []
  }
}
```

`mode` 支持：

| 模式 | 说明 |
|------|------|
| `keep_pc` | 默认模式，同 ID 冲突时保留 PC 数据，并将 Android 数据保存为冲突副本 |
| `add_only` | 只新增 PC 不存在的数据，同 ID 冲突跳过 |
| `android_wins` | Android 覆盖 PC，仅适合明确确认后的强制回传 |

**响应**：

```json
{
  "success": true,
  "imported": 1,
  "added": 1,
  "updated": 0,
  "conflicts": 1,
  "skipped": 0,
  "imagesRestored": 2,
  "conflictItems": []
}
```

### POST /api/sync/bidirectional

Android 上传本机快照，PC 以 `keep_pc` 策略合并后返回最新 PC 同步快照。移动端随后可用该快照刷新本机数据。

写入权限同 `/api/sync/import`，必须携带 `X-Sync-Token`。

**响应**：

```json
{
  "success": true,
  "pushReport": {},
  "syncData": {}
}
```

### GET /api/network-info

返回 PC 端局域网 IP 和端口。

移动端搜索 PC 功能不新增后端接口，仍使用 `/api/health` 对候选 IP 做健康检查；`/api/network-info` 主要用于 PC 端设置页展示本机同步地址。

**响应**：

```json
{
  "ip": "192.168.1.100",
  "port": 8888
}
```

---

## 九、错误响应

所有接口在出错时返回统一格式：

```json
{
  "error": "错误描述信息"
}
```

常见 HTTP 状态码：

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 405 | 请求方法不允许 |
| 500 | 服务器内部错误 |

---

## 十、CORS 配置

所有响应均包含以下 CORS 头：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

`OPTIONS` 预检请求返回 `200 OK`，不处理业务逻辑。
