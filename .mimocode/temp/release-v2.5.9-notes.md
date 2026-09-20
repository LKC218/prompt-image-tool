## PromptImageManager v2.5.9

### Downloads

| Asset | Size | SHA256 |
| --- | ---: | --- |
| `PromptImageManager-Setup-2.5.9.exe` | 37.6 MB | `3C308CA97C4573E59D3BCF4DBF98196F681D47FD204C9552F8CD531DE6D941A4` |
| `latest.json` | 0.0 MB | `5702DCAFE9B163F54C9B1F4656B8E9F9E1DC81E8AF8D2E18312107BE110F0BED` |

### 新增

- 更新后自动重启：PC 应用内自动更新静默安装完成后，自动拉起新版本应用，无需再手动打开软件。

### 优化

- 安装覆盖目录：静默安装会带上当前安装目录参数，降低自定义路径被装回默认目录的概率。
- 安装结果校验：安装请求携带目标版本号，启动新版本前核对版本信息。

### 发布

- 版本号统一升级至 v2.5.9；基于当前主分支重新构建 Windows Setup 安装包。

> Full changelog: `docs/版本记录/changelog.md` in this repository.
