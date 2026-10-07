# JPEG 无损引擎

执行 `python scripts/prepare_image_engines.py` 准备官方 jpegoptim 1.5.6 Windows x64 发布包。固定归档 SHA256，运行时校验可执行文件，不自动更新。下载产物不提交 Git。

来源：https://github.com/tjko/jpegoptim/releases/tag/v1.5.6

该工具通过独立进程调用，许可为 GPL；准备脚本同时提取 LICENSE、COPYRIGHT、README。正式构建另外调用 `prepare_release_sources.py`，提供 jpegoptim 与上游构建指定的 MozJPEG 对应源码。材料随安装包和独立源码附件分发，具体见 `docs/构建方案/第三方图片引擎分发说明.md`。
