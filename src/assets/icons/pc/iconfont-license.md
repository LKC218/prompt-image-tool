# PC端本地图标来源说明

- 选型入口：<https://www.iconfont.cn/search/index?searchType=icon&q=%E4%BF%9D%E5%AD%98&page=1&fromCollection=-1>；更新记录入口使用 <https://www.iconfont.cn/collections/detail?cid=10585> 中“版本更新”的云朵箭头语义图标。
- 处理日期：260513
- 用途：补齐 PC 端保存、收藏、关闭、箭头、复位、正负向提示、信息、对比等语义图标，彻底移除 UI 中的文字图标和字符图标。
- 接入方式：所有图标均作为本地 SVG 资产使用，不接入 iconfont 在线字体、远程脚本或 CDN。
- 说明：命令行接口访问 iconfont 搜索接口时返回站点应用壳，无法直接批量下载图标元数据；本批图标按 iconfont 搜索页的语义方向本地化整理为单色线性 SVG，便于项目内离线使用和统一样式控制。
