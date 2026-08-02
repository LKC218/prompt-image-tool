# PC端自定义光标模块

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `src/js/pc-cursor.js` | 初始化、语义目标解析、四角位置计算、光标图形状态、滚动与尺寸同步、生命周期清理 |
| `src/js/pc-cursor.test.js` | 精细指针、语义优先级、四角目标接管和销毁行为测试 |
| `src/css/theme-tokens.css` | 根级主题与品牌配色令牌 |
| `src/css/pc/01-foundation-shell.css` | 光标状态样式、四角样式、语义图形和原生光标 CSS 回退 |

## 状态协议

| 标记或条件 | 状态 | 行为 |
| --- | --- | --- |
| `data-cursor="native"`、文本输入、原生缩放边缘 | `native` | 隐藏自定义光标与四角，保留浏览器原生光标 |
| `disabled`、`aria-disabled="true"`、`data-cursor="disabled"` | `disabled` | 四角锁定不可用目标，中心显示禁用符号 |
| `aria-busy="true"`、`data-cursor="loading"` | `loading` | 四角锁定处理中目标，中心显示进度环 |
| `data-cursor="drag"`、`data-cursor="zoom"` | `drag`、`zoom` | 四角锁定目标，中心显示拖拽或缩放符号 |
| `data-cursor="favorite"`、`menu`、`copy` | `favorite`、`menu`、`copy` | 子控件优先接管四角，中心显示对应操作符号 |
| `data-cursor="media"` | `media` | 四角以较大间距锁定图片、预览或画布目标 |
| `data-cursor="action"` 或语义交互元素 | `action` | 四角锁定可点击目标 |
| 其他可用区域 | `idle` | 中心点与四角保持紧凑状态 |

状态优先级固定为 `native > disabled > loading > drag/zoom > favorite/menu/copy > media > action > idle`。页面模块只能通过 `data-cursor` 描述目标语义，不得自行创建或控制光标节点。

目标同时具备 `.active`、`.selected`、`aria-current` 或 `aria-selected="true"` 时进入选中视觉层：普通操作目标切换为主题主色，媒体目标从主题主色派生深色并保留外发光。光标直接继承 `:root` 的品牌令牌，主题切换后无需移动鼠标即可同步。

## 运行约束

- 仅在 `(hover: hover) and (pointer: fine)` 且未启用 `prefers-reduced-motion: reduce` 时初始化。
- 光标 wrapper 以零尺寸固定定位挂载到 `document.body`，通过 GSAP `x/y` 跟随视口坐标，避免应用容器建立 containing block 时产生偏移。
- 空闲状态以 `2s` 一圈旋转；命中目标时暂停旋转，四角以 `0.2s` 吸附，并在 ticker 中维持目标内的延迟视差。
- 鼠标按下时中心点缩放至 `0.7`、外框缩放至 `0.9`；松开后恢复。
- 当前激活目标由 `ResizeObserver` 监听；滚动时使用 `elementFromPoint()` 校验鼠标下方目标，窗口失焦或鼠标离开应用后立即回收四角。
