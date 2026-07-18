## v2.4.1 (2026-07-18)

### 新增

- **图片下载记录**：PC 与移动端新增图片下载记录展示，便于追踪图片保存结果。
- **设置页数据管理**：PC 设置页补充数据备份与导出入口，方便维护本地资料。

### 优化

- **PC 主题切换**：PC 侧栏新增浅色与深色主题切换，并适配系统“减少动态效果”偏好。
- **图片下载反馈**：完善图片地址编码、下载失败提示与移动端相册保存的错误反馈。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本统一升级至 `2.4.1`。
- Android `versionCode` 从 `14` 递增至 `15`，`versionName` 升级为 `2.4.1`。
- 同步主应用与安装器壳 Cargo 锁文件，并将安装器壳内嵌核心安装包路径更新为 `PromptImageManager-Setup-2.4.1.exe`。

---

## v2.4.0 (2026-07-15)

### 新增

- **ZIP 备份图片恢复**：完整备份恢复流程支持还原 ZIP 备份中的原始图片资源，并返回图片恢复数量、冲突项和备份路径。
- **应用内更新记录**：PC 更新记录弹窗补充 `v2.4.0` 的结构化版本说明，未阅读当前版本时可自动提示并支持手动查看。

### 优化

- **PC 详情图片体验**：优化提示词详情页的封面浏览、多图切换和图片预览交互。
- **设置与导航体验**：优化 PC 侧栏工具入口，并统一 PC 与移动端设置页的版本信息展示。
- **运行链路反馈**：完善备份、存储、局域网同步和开发服务启动过程中的状态处理与错误反馈。

### 修复

- **移动端预览遮罩清理**：修复提示词详情图片预览在关闭或页面卸载后可能残留全局遮罩的问题。

### 版本与打包

- 主应用、PC Tauri、Android、NSIS 安装器和安装器壳版本统一升级至 `2.4.0`。
- Android `versionCode` 从 `13` 递增至 `14`，`versionName` 升级为 `2.4.0`。
- 修正主应用与安装器壳 Cargo 锁文件的应用包版本，并将安装器壳内嵌核心安装包路径同步至 `PromptImageManager-Setup-2.4.0.exe`。

---

## v2.3.7 (2026-07-14)

### 版本号统一

- 主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器、README 徽标和 `index.html` 版本元信息统一收口为 `2.3.7`。
- 新增 `src/js/version-info.js` 共享版本号模块，统一为 PC 与移动端设置页提供版本号读取与渲染能力。

# 生图提示词管理器 — 更新记录

> 本文档记录项目各版本的变更历史，方便后续维护和追溯。

---

## v2.3.6 (2026-05-25)

### 版本与打包

- **版本号升级**：主应用、PC 发布配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳发布版本统一升级到 `2.3.6`。
- **Android 版本递增**：Android `versionCode` 从 `11` 递增到 `12`，`versionName` 升级为 `2.3.6`。
- **PC 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.6.exe`。
- **Tauri semver 收口**：Tauri 配置、Cargo 包版本和 Windows 文件版本统一使用合法 semver `2.3.6`。

### 改进

- **提示词库返回位置保留**：PC 端提示词库从详情页返回后保留上次查看的页码、选中提示词和表格滚动位置，减少重新定位成本。

### 构建产物

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.6.exe` | `35448832` 字节 | `389CB81FAE1920D5166DD0A9B8AF781C7A51188ADA1EA51E1FA00D2924540871` |
| `releases/PromptImageManager-Setup-2.3.6.exe` | `25671325` 字节 | `1D1C6366A88E6947463A76AC1DDCC5E312D7AA4FE1434D4A48C27D04E14E1460` |
| `releases/PromptImageManager-v2.3.6-Android.apk` | `46868242` 字节 | `611B96CE2B56F6E46E93AA1E6A64003B2BCE2F54B30FE7B43CB076D9CF102688` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.6`，第三方依赖自身版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='12'`、`versionName='2.3.6'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.6`，文件描述为 `提示词管家安装向导`。
- GitHub Release：已创建 `v2.3.6`，上传 `PromptImageManager-Shell-Setup-2.3.6.exe` 与 `PromptImageManager-v2.3.6-Android.apk`；Release 正文 UTF-8 回读无 ASCII 问号和连续问号替换标记，两份公开下载链接范围请求均返回 `206 Partial Content`。
- Android 真机状态：`adb devices -l` 未检测到已连接设备，因此本轮未执行 APK 真机安装；APK 构建、签名和元信息校验已完成。

## v2.3.5 (2026-05-25)

### 版本与打包

- **版本号升级**：主应用、PC 发布配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳发布版本统一升级到 `2.3.5`。
- **Android 版本递增**：Android `versionCode` 从 `10` 递增到 `11`，`versionName` 升级为 `2.3.5`。
- **PC 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.5.exe`。
- **Tauri semver 收口**：Tauri 配置、Cargo 包版本和 Windows 文件版本统一使用合法 semver `2.3.5`，不再使用四段式发布版本。

### 构建产物

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.5.exe` | `35324416` 字节 | `9357E6C3EE6FD1E083DF7E3FD68639E4334B150F77D10030A78EC3A5904C0E9D` |
| `releases/PromptImageManager-Setup-2.3.5.exe` | `25558163` 字节 | `A968F9DFA1E285383B781095A43687103FA150BB6993E7BB3B43A0CF1BDB7514` |
| `releases/PromptImageManager-v2.3.5-Android.apk` | `46758299` 字节 | `0DE9D05C086B5F37F3061EE50F4F3213C20AF6FD44A88FE31559DA94E8E5FF26` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.5`，第三方依赖自身的 `fsevents 2.3.3` 版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='11'`、`versionName='2.3.5'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.5`，文件描述为 `提示词管家安装向导`。

## v2.3.4.1 (2026-05-24)

### 版本与打包

- **版本号升级**：主应用、PC 发布配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳发布版本统一升级到 `2.3.4.1`。
- **Android 版本递增**：Android `versionCode` 从 `9` 递增到 `10`，`versionName` 升级为 `2.3.4.1`。
- **PC 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.4.1.exe`。
- **Tauri semver 兼容**：Tauri 配置版本采用合法 semver `2.3.4+1`，对外发布文件名和 Android `versionName` 继续使用 `2.3.4.1`。

### 构建产物

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.4.1.exe` | `35321344` 字节 | `C89FAD75D0F0F8E19F5238146496E9ABD66FF156E62540BF470C2EE8EEB8A364` |
| `releases/PromptImageManager-Setup-2.3.4.1.exe` | `25555622` 字节 | `829CE5C733D55E2B58D59E12A74CEEF11FB51FF2CDE9DB165E54FA12957CF264` |
| `releases/PromptImageManager-v2.3.4.1-Android.apk` | `46755417` 字节 | `BBC50C24837EEA655660CDD4B35B7F3635A711C7BE22C098DF9E0084C0B9EF3F` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.4.1`，第三方依赖自身的 `fsevents 2.3.3` 版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='10'`、`versionName='2.3.4.1'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.4+1`，文件描述为 `提示词管家安装向导`。

## v2.3.4 (2026-05-24)

### 版本与打包

- **版本号升级**：主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳统一升级到 `2.3.4`。
- **Android 版本递增**：Android `versionCode` 从 `8` 递增到 `9`，`versionName` 升级为 `2.3.4`。
- **PC Tauri 安装器壳配置同步**：安装器壳的 bundle resource、内置 NSIS 安装核心和运行时查找路径统一指向 `PromptImageManager-Setup-2.3.4.exe`，避免后续打包时继续嵌入旧版本核心安装包。

### 构建产物

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.4.exe` | `35320832` 字节 | `46781A78725DE3064DC7340FB3EB9198F437C94C2B8522CA1B8E4AB3FDA4C679` |
| `releases/PromptImageManager-Setup-2.3.4.exe` | `25555099` 字节 | `6B8BB87DA0408949253D229011CBD298738F8F4279147C6462C90601D45724DA` |
| `releases/PromptImageManager-v2.3.4-Android.apk` | `46754849` 字节 | `3D3B5D41F908ABF8C69ED42DDFC72BD6C758A7F88FE32B777A9201753DE8F0E9` |

### 验证

- 版本配置静态检查：确认发布相关源码与配置已切换到 `2.3.4`，第三方依赖自身的 `fsevents 2.3.3` 版本保持不变。
- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='9'`、`versionName='2.3.4'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.4`，文件描述为 `提示词管家安装向导`。
- 自动化回归：`npm.cmd run test` 通过，14 个测试文件、127 个测试用例全部通过；`python -m pytest python/tests -q` 通过，45 个测试用例全部通过；`python -m pytest python/tests/test_build_app_main.py -q` 通过，9 个测试用例全部通过。
- PC 打包版运行探针：开发后端占用 `8888` 时，打包后的 `PromptImageManager.exe` 自动回退到 `8890`，`/api/health`、`/`、`/index.html` 均返回 200。
- PC 核心安装器静默安装验收：临时目录安装返回退出码 `0`，主程序、卸载器、桌面快捷方式、开始菜单启动项和开始菜单卸载项均真实落地；验收后已卸载临时安装并恢复安装前已有快捷方式。
- Android 真机状态：`adb devices` 未检测到已连接设备，因此本轮未执行 APK 真机安装；APK 构建、签名和元信息校验已完成。

---

## v2.3.3 (2026-05-22)

### 版本与打包

- **版本号升级**：主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳统一升级到 `2.3.3`。
- **Android 版本递增**：Android `versionCode` 从 `7` 递增到 `8`，`versionName` 升级为 `2.3.3`。
- **PC Tauri 安装器壳交付**：PC 端正式产物为带 Tauri 安装器壳 UI 的 `PromptImageManager-Shell-Setup-2.3.3.exe`，内部嵌入 `PromptImageManager-Setup-2.3.3.exe` 核心安装包。

### 构建产物

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.3.exe` | `35314176` 字节 | `71685CEDDEF0E90E21A07A9EB8E7422BE044BE6BE5F1DEBCCFAF132490089476` |
| `releases/PromptImageManager-Setup-2.3.3.exe` | `25547667` 字节 | `6813CC0CFA1013A8D73196A8BD19A9C41CBEF1BA824CCD6F4B6EC9E10950786D` |
| `releases/PromptImageManager-v2.3.3-Android.apk` | `46748583` 字节 | `9FB48F2E4D0E8A09C974C8E55707296D9F625094374C113D51D71EA60E79CD72` |

### 验证

- `python scripts/build_release_packages.py --all --skip-env-check`：通过，生成 PC 核心 NSIS 安装包和签名 Android Release APK，并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='8'`、`versionName='2.3.3'`、`targetSdkVersion='36'`。
- PC 安装器壳版本信息校验：`ProductVersion` 与 `FileVersion` 均为 `2.3.3`，文件描述为 `提示词管家安装向导`。

---

## v2.3.2 (2026-05-13)

### 2026-05-21 局域网同步冲突优化补充

- 新增 `/api/sync/preview`，移动端同步写入前可查看新增、跳过、冲突、PC 独有数量和字段级差异。
- 回传冲突副本新增稳定 `conflictKey` 与 `syncMeta` 来源信息，重复回传同一冲突内容时不再生成重复副本。
- `LanSync.bidirectional()` 改为统一调用 `/api/sync/bidirectional`，后端返回合并报告和最新快照后再写入 Android 本地。
- PC 源码后端与安装包后端写入前生成同步前备份，并通过 `backupPath` 返回恢复线索。
- 补充源码后端、安装包后端和移动端同步测试，覆盖预览接口、字段差异、幂等冲突副本和双向统一接口。
- 验证通过：`npm.cmd run test`（9 个测试文件、98 个测试用例）、`python -m pytest python/tests -q`（36 个测试用例）、`npm.cmd run build`。

### 版本与打包

- **版本号升级**：主应用、PC Tauri 配置、Android Gradle 配置、NSIS 安装器和 Tauri 安装器壳统一升级到 `2.3.2`。
- **Android 版本递增**：Android `versionCode` 从 `6` 递增到 `7`，`versionName` 升级为 `2.3.2`。
- **PC Tauri 安装器壳交付**：PC 端正式产物为带 Tauri 安装器壳的 `PromptImageManager-Shell-Setup-2.3.2.exe`，内部嵌入 `PromptImageManager-Setup-2.3.2.exe` 核心安装包。

### 构建产物

| 产物 | 大小 | SHA256 |
|------|------|--------|
| `releases/PromptImageManager-Shell-Setup-2.3.2.exe` | `35276800` 字节 | `25E7CE8EC939F427BFD1DEFAC9CA24E46798FB1283830E9088452F2F21832DBD` |
| `releases/PromptImageManager-Setup-2.3.2.exe` | `25518130` 字节 | `00A895BF5D9831D586A258CC9109315E6115FE32974BC76862977E5729302FBF` |
| `releases/PromptImageManager-v2.3.2-Android.apk` | `46744828` 字节 | `51F1FD83C8ADCCE95B0A6145B12BEC54EFDB99CB6D38AC166C032685791F6404` |

### 验证

- `npm.cmd run build`：通过，Vite 生产构建成功。
- `npm.cmd run test`：通过，8 个测试文件、86 个测试用例全部通过。
- `python scripts/build_pc_package.py --skip-env-check`：通过，生成 PC 核心 NSIS 安装包并复制到 `releases/`。
- `python scripts/build_installer_shell_package.py --skip-pc-build --skip-env-check`：通过，`node --check`、`cargo check` 和 Tauri release 构建均完成。
- `python scripts/build_android_package.py --skip-env-check`：通过，生成签名 Release APK 并复制到 `releases/`。
- APK 签名校验：`apksigner verify --verbose --print-certs` 通过，APK Signature Scheme v2 为 `true`，签名者数量为 `1`。
- APK 元信息校验：`aapt dump badging` 返回 `package='com.promptimagemanager.app'`、`versionCode='7'`、`versionName='2.3.2'`、`targetSdkVersion='36'`。
- PC 打包版运行探针：打包后的 `PromptImageManager.exe` 在 `8888` 被占用时回退到 `8889`，`/api/health`、`/index.html`、`/api/sync/capabilities` 均返回 200。
- PC UI 变动后重打包：2026-05-13 重新执行 PC 核心安装包和 Tauri 安装器壳构建，发布产物大小与 SHA256 已刷新。
- PC 二次 UI 变动后重打包：2026-05-13 再次重新执行 PC 核心安装包和 Tauri 安装器壳构建，打包版直接监听 `8888`，`/api/health`、`/index.html`、`/api/sync/capabilities` 均返回 200。

### 已知情况

- 当前执行时 `adb devices -l` 未检测到已连接设备，因此未执行 APK 真机安装；APK 本地构建、签名和元信息校验已完成。
- Android 构建过程中仍有来自 Capacitor 依赖的 Kotlin/Gradle 警告，不阻断 Release APK 生成。

---

## v2.3.1 (2026-05-10)

### 本轮补充

- **局域网动态端口连接**：移动端同步目标统一支持 `IP`、`IP:端口` 和 `http://IP:端口`，搜索 PC 时扫描默认端口范围 `8888-8897`，最近设备按 `ip:port` 保存；PC 安装包端口占用时按顺序回退到 `8889-8897`，拉取、回传、双向同步和图片下载均使用实际端口。

### 新增功能

- **PC 与 Android 局域网互通**：Android 端在同一局域网内支持从 PC 拉取、回传到 PC 和双向同步；PC 端新增同步能力声明、设备 ID、配对令牌和写入类接口令牌校验，避免未配对设备直接写入数据
- **Android 回传与双向合并**：新增 `/api/sync/import` 和 `/api/sync/bidirectional`，Android 独有提示词可回传到 PC，双向同步会先回传 Android 本机快照，再拉取 PC 最新结果
- **移动端同步方向选择**：移动端设置页新增“从 PC 拉取 / 回传到 PC / 双向同步”模式选择，同步报告区区分展示新增、覆盖、冲突副本、跳过和图片接收结果
- **局域网 PC 搜索增强**：移动端搜索 PC 时优先探测最近设备，支持搜索进度、结果来源、互通能力标签、点击设备自动填入 IP 并测试连接；保留手动输入 IP 作为稳定兜底
- **PC 图片查看器缩放平移**：PC 端全屏图片查看器支持鼠标滚轮缩放、拖拽平移、双击缩放/复位、复位按钮、缩放比例显示和点击遮罩关闭，详情页封面图与提示词库预览图共用同一能力
- **PC 侧边栏收拉**：PC 左侧导航栏新增展开/收起按钮，收起态保留图标导航并隐藏文字和复杂底部信息，收拉状态持久化到 `localStorage`
- **发布包构建脚本**：新增 Android 安装包构建脚本和 PC/Android 总构建入口，支持将正式发布产物复制到 `releases/`

### 改进

- **PC 默认 16:9 窗口**：Tauri 桌面端默认窗口调整为 `1366 x 768`，最小窗口调整为 `1024 x 576`，提升默认桌面体验比例
- **PC 自适应排版优化**：基于主内容区安全内边距和最大宽度优化首页、提示词库、详情页、编辑页、分类与标签页、设置页的抗挤压排版；表格表头保持单行可读，必要时使用横向滚动兜底
- **提示词详情页重构**：PC 详情页升级为顶部面包屑、天空氛围、16:9 封面、左主右辅双栏、信息概览、版本记录和本地安全提示结构
- **提示词库列表优化**：PC 提示词库表格增加稳定列宽、列表工作台视觉分区、浅蓝选中强调、柔和横向滚动条和分页区重排
- **图片导入共享工具**：图片读取、压缩、最大边长缩放、MIME 与扩展名识别逻辑抽取到 `src/js/image-utils.js`，PC 与移动端编辑页复用同一优化链路
- **已保存图片预览回填**：PC 与移动端编辑页可通过存储层 `getImageUrl()` 回填已保存图片，避免编辑已有提示词时图片预览缺失
- **移动端分类与设置增强**：移动端分类页补充分类重命名、改色、删除、批量改色、合并分类和清理空分类等快捷操作；设置页同步区补齐搜索、连接测试、拉取、回传和双向同步流程
- **安装包中文与图标规范**：构建脚本和 NSIS 构建流程统一 UTF-8 处理，安装器、快捷方式和卸载项统一绑定应用图标，降低中文乱码和白板图标风险

### Bug 修复

- **Android WebView Mixed Content 拦截**：启用 `android.allowMixedContent=true` 和 `android:usesCleartextTraffic="true"`，修复 Android 应用内 HTTPS 页面无法请求局域网 HTTP 同步服务的问题
- **同内容回传误判冲突**：后端新增 `normalize_prompt_for_compare()` 与 `is_same_prompt_set()`，冲突判断忽略端侧生成型 ID、时间字段、图片 Data URL、图片体积、MIME 类型和字段命名差异；同内容回传计入跳过，不再生成重复冲突副本
- **局域网写入接口保护**：回传和双向同步接口缺少或携带错误 `X-Sync-Token` 时返回 `401`，避免未配对写入
- **PC 安装包局域网互通不可用**：修复 `build/app_main.py` 落后于源码后端的问题，安装包后端改为监听 `0.0.0.0`，并补齐能力声明、配对、回传和双向同步接口；前端 API 层对 HTML 响应给出明确错误提示

### 技术细节

- `/api/health` 扩展返回 `device_id`、`device_name`、`platform`、`sync_version`、`pairing_required` 和 `capabilities`
- 新增 `/api/sync/capabilities`、`/api/sync/pairing`、`/api/sync/import`、`/api/sync/bidirectional`
- 新增 `sync-device.json` 运行时设备信息文件，用于保存 PC 设备 ID 和同步令牌
- `LanScanner` 支持最近设备优先探测、候选网段去重、扫描进度回调和搜索中止
- `LanSync` 支持拉取、回传、双向同步和配对令牌读取
- `pc-utils.js` 内部新增图片查看器状态模型，统一维护缩放倍数、平移量、拖拽状态和复位逻辑
- `pc-app.js` 新增侧边栏收起状态读取、切换、持久化和本地数据占用圆环展示
- `python/tests/test_main.py` 补充同步令牌校验、冲突副本、同内容跳过和双向同步相关测试
- 新增 `src/js/image-utils.test.js` 和 `src/js/lan-sync.test.js`，覆盖图片处理与局域网同步核心逻辑

### 验证

- `npm run test`：7 files passed，76 tests passed
- `npm run build`：通过，Vite 构建成功
- `python -m pytest python/tests/test_main.py -q`：25 passed
- `npm run test -- lan-sync.test.js`：5 passed
- Android 真机与 PC 局域网互通验证通过，覆盖连接测试、从 PC 拉取、Android 回传到 PC、双向同步、图片传输和同内容回传去重

### 已知风险

- 真机测试数据中仍保留首次冲突误判前产生的两个 `Android冲突副本`，后续修复不会再因同内容、不同生成型字段或时间字段重复生成此类副本
- Android 自动搜索在 WebRTC 获取本机网段失败时仍依赖最近设备和常见网段，手动输入 IP 仍是稳定兜底路径
- PC 图片查看器与 PC 16:9 排版仍保留部分人工视觉验收项，当前已完成构建验证

---

## v2.2.21 (2026-05-04)

### 新增功能

- **局域网自动发现 PC 端**：移动端打开同步弹窗时自动扫描局域网内的 PC 端设备，点击设备卡片即可自动填入 IP 地址，无需手动输入；支持刷新扫描和手动输入回退
- **同步进度条增强**：新增进度百分比显示、已用时间和预估剩余时间，方便用户判断同步进度和等待时长

### 改进

- **暗色模式图标修复**：暗色模式下所有 SVG 图标（顶栏按钮、详情页操作按钮、右键菜单、帮助弹窗、同步状态等）通过 CSS `filter` 方案正确显示为浅色，不再因 `currentColor` 无法继承而显示为不可见的黑色
- **暗色模式全局配色一致性**：新增 `--mono-icon-filter` CSS 变量统一控制暗色/亮色模式下的图标滤镜，主题切换时图标颜色平滑过渡
- **图片导入 JPG 压缩**：导入图片时自动转换为 JPG 格式并压缩（quality=0.92），透明通道自动填充白色背景，压缩后体积大于原图时保留原始格式，显著减少存储空间和同步传输量
- **PC 端设备标识**：`/api/health` 接口新增 `device_name` 字段，返回计算机名称，方便移动端识别目标设备

### 技术细节

- 新增 `LanScanner` 类（`lan-sync.js`）：WebRTC 获取本机 IP + HTTP 并发扫描局域网，并发数 30，超时 1.5s
- 新增 `compressImageToJpeg()` 函数（`app.js`）：Canvas API 压缩，白底填充透明通道，体积对比保底
- 新增 `formatDuration()` 函数（`app.js`）：毫秒转可读时间格式（Xs / Xm Ys / Xh Ym）
- `main.css` 新增 `--mono-icon-filter` 变量、设备发现区域样式、进度条增强样式
- `index.html` 同步弹窗新增设备发现区域和进度条增强元素
- `python/main.py` 新增 `import platform`，`/api/health` 返回 `device_name`

---

## v2.2.1 (2026-05-04)

### 新增功能

- **新手引导教程**：首次使用时弹出分步引导教程，手绘风格箭头指引，聚光灯高亮，支持跳过和重播
- **帮助按钮**：Header 新增帮助按钮，可重新触发引导教程
- **启动画面**：新增启动画面（Splash Screen），最小展示 1.2 秒后淡出
- **SVG 图标系统**：所有 Emoji 图标替换为语义化 SVG 图标，统一管理于 `src/assets/icons/` 目录

### 改进

- `app.js` 从 1402 行扩展到 1526 行，新增引导教程集成、SVG 图标引用、帮助按钮逻辑
- `sqlite-storage.js` 从 351 行扩展到 367 行
- `main.css` 从 1087 行扩展到 1384 行，新增引导教程样式、启动画面样式、帮助按钮样式
- `responsive.css` 从 272 行扩展到 423 行，新增引导教程和启动画面的响应式适配
- 新增 `tutorial.js`（462 行）引导教程模块

### Bug 修复

- 修复 Android 端构建兼容性问题（Java 版本修补脚本）

---

## v2.1.0 (2026-05-03)

### 新增功能

- **提示词一键复制**：正向/反向提示词一键复制到剪贴板（含 `execCommand` fallback）
- **提示词预览弹窗**：二级窗口完整预览正向/反向提示词和版本备注，支持弹窗内复制
- **暗色/亮色主题切换**：支持主题切换，localStorage 持久化，系统偏好跟随，动态更新 theme-color meta

### 改进

- CSS 变量体系完善：新增亮色主题变量定义（`[data-theme="light"]`）
- 动画增强：新增 `fadeIn`、`modalIn`、`zoomIn`、`slideIn` 动画
- 主题切换按钮图标：暗色模式显示太阳☀，亮色模式显示月亮🌙

---

## v2.0.0 (2026-05-03)

### 新增功能

- **文件夹管理**：支持创建/删除/重命名文件夹，颜色标签分类，集合移动到文件夹
- **暗色/亮色主题切换**：支持主题切换，localStorage 持久化，系统偏好跟随
- **提示词预览**：二级窗口完整预览正向/反向提示词和版本备注
- **一键复制**：正向/反向提示词一键复制到剪贴板（含 fallback）
- **右键/长按菜单**：集合项右键弹出操作菜单（删除/重命名/复制/移动到文件夹）
- **视图切换**：列表视图/文件夹视图切换
- **局域网同步**：Android 端从 PC 端拉取全量数据，冲突检测与合并
- **手势返回**：移动端支持系统返回键/手势返回上一级（History API）
- **PC 端 IP 显示**：PC 端显示本机局域网 IP，方便同步
- **同步接口**：新增 `/api/sync`、`/api/sync/images/{filename}`、`/api/network-info`

### Bug 修复

- **BUG-001**：CORS 跨域请求被拒绝 — 新增 `do_OPTIONS()` 方法，所有响应添加 CORS 头
- **BUG-002**：数据文件为空或损坏时后端崩溃 — `load_data()` 增加容错处理
- **BUG-003**：随机端口导致前端无法连接后端 — 固定使用 8888 端口
- **BUG-004**：并发请求导致数据丢失 — 改用 `ThreadingTCPServer` 多线程处理
- **BUG-005**：应用目录无写权限时数据无法保存 — 新增 `get_data_dir()` 回退机制
- **BUG-006**：前端无法检测后端是否就绪 — 新增 `/api/health` 健康检查 + 轮询重试
- **BUG-007**：v1 自动打开浏览器 — 移除自动打开浏览器逻辑
- **图片 Bug 修复**：修复 PC 端图片 URL 路径问题、移动端图片预览/导入问题

### 改进

- 新增版本时提示词为空（不继承旧版本内容），「复制为新版本」保持复制行为
- Python 后端监听地址从 `localhost` 改为 `0.0.0.0`，支持局域网访问
- 前端代码重构：`app.js` 从 596 行扩展到 1402 行，支持更多功能
- CSS 变量体系完善：新增 `--text3`、`--radius-sm/md/lg`、`--transition-fast/normal` 等变量
- 亮色主题变量定义（`[data-theme="light"]`）
- 动画增强：新增 `fadeIn`、`modalIn`、`zoomIn` 动画

### 技术栈升级

- Tauri 2.11.0
- Capacitor 8.3.1
- @capacitor-community/sqlite 8.1.0
- @capacitor/filesystem 8.1.2
- Vite 8.x
- Vitest 4.x

---

## v1.0.0 (初始版本)

### 基础功能

- 提示词集合 CRUD
- 多版本管理（添加/删除/重命名/复制版本）
- 提示词编辑（正向/反向，500ms 防抖自动保存）
- 图片上传/删除/查看
- 版本对比
- 数据导入导出（JSON 格式）
- PC 桌面端（Tauri 封装）
- Android 移动端（Capacitor 封装）
- Web 端（Vite + Python 后端）

### 已知问题（已在 v2.0 修复）

- CORS 跨域请求被拒绝
- 数据文件为空或损坏时后端崩溃
- 随机端口导致前端无法连接后端
- 并发请求导致数据丢失
- 应用目录无写权限时数据无法保存
- 前端无法检测后端是否就绪
- 自动打开浏览器（桌面端不需要）
