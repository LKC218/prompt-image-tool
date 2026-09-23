# PC端自定义光标模块

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `src/js/pc/pc-cursor.js` | 初始化、可点目标判定、圆环状态切换、GSAP 跟随、生命周期清理 |
| `src/js/pc-cursor.test.js` | 精细指针门禁、native 回退、hover/disabled/loading/pressed 与销毁行为测试 |
| `src/css/theme-tokens.css` | 根级主题与品牌配色令牌 |
| `src/css/pc/01-foundation-shell.css` | 圆环光标样式、原生光标 CSS 回退 |

## 状态协议

| 标记或条件 | 状态 | 行为 |
| --- | --- | --- |
| `data-cursor="native"`、文本输入、原生缩放边缘 | `native` | 隐藏自定义光标，保留浏览器原生光标 |
| `disabled`、`aria-disabled="true"`、`data-cursor="disabled"` | `disabled` | 圆环降低不透明度，描边淡化 |
| `aria-busy="true"`、`data-cursor="loading"` | `loading` | 圆环略放大并降低填充对比 |
| `button` / `a[href]` / `[role="button"]` / `cursor: pointer` 等可点目标（含遗留 `data-cursor` 语义标记） | `hover` | 圆环放大 + 低透明品牌色填充 + `blur` 柔光 |
| 按下操作目标 | `pressed` | 圆环略缩小 |
| 其他可用区域 | `idle` | 28px 品牌色描边空心圆环 |

状态优先级：`native > disabled > loading > hover`。页面模块可继续使用 `data-cursor` 描述可点性，但不再区分 media/favorite/menu 等图形语义；不得自行创建或控制光标节点。

光标直接继承 `:root` 的 `--color-brand-primary`，主题切换后无需移动鼠标即可同步。

## 运行约束

- 仅在 `(hover: hover) and (pointer: fine)` 且未启用 `prefers-reduced-motion: reduce` 时初始化。
- 启用后对 `.pc-app.pc-custom-cursor-enabled` 及其全部子节点施加 `cursor: none !important`，压过页面内各处 `cursor: pointer`，避免系统指针与圆环叠影；`native` 模式整树恢复 `auto`；文本输入保持 `text`。
- 光标为单节点固定定位挂载到 `document.body`；通过 GSAP `xPercent/yPercent` 做居中，`quickTo`（约 `0.16s` + `power3.out`）跟随视口坐标，避免与 CSS `transform` 抢占。
- 自定义光标在 `is-custom-active`（进入应用区域且非 native）时显示；`is-hover` 切换柔光；根节点 `pc-custom-cursor-native` 恢复原生指针。
- 默认尺寸：空闲 `28px`，hover `44px`，pressed `24px`，loading `36px`；过渡约 `0.18s`。
- `blur` 仅在 hover 状态开启，离开后关闭，避免常驻影响合成性能。
- 指针离开应用或窗口失焦时立即回收状态与可见性。
- 重复调用 `initPcCursor` 会先销毁上一实例。
