# PC 侧边栏模拟时钟

> 参考来源：Uiverse `chase2k25/nice-fly-98`  
> URL：`https://uiverse.io/chase2k25/nice-fly-98`  
> 落点文件：`src/js/pc-app.js`、`src/css/pc.css`  
> 相关规范：`docs/设计文档/新拟态按钮设计规范.md`

---

## 一、效果分析

本项目 PC 侧边栏时钟**复刻 Uiverse `chase2k25/nice-fly-98` 的新拟态（Neumorphism）视觉风格，采用 JavaScript 实时时间驱动**，显示当前真实时间。核心视觉由以下元素构成：

1. **新拟态钟面**：背景 `#e0e5ec`，靠双层 `box-shadow` 的明暗投影营造凸起/凹陷质感。
2. **12 个时刻标记**：3、6、9、12 点标记稍大，其余为小圆点，均带内凹阴影。
3. **12 个阿拉伯数字**：沿圆周分布，容器旋转后文字先径向推出再反向旋转，保持正向可读，带雕刻文字阴影。
4. **三根指针**：时针 `#4a5463`、分针 `#7a8a9e`、秒针 `#e65e5e`，由 JS 读取系统时间并动态设置 `transform` 角度。
5. **中心装饰圆点**：覆盖指针根部，增强拟物感。

由于侧边栏空间限制，源案例 `300px × 300px` 的表盘按比例缩放为 `180px × 180px`。时钟显示当前真实时间，秒针采用跳秒，分针/时针连续转动。

---

## 二、复刻目标

将 PC 端左侧边栏底部原有的「本地数据」存储卡片（`.pc-sidebar-storage`）替换为新拟态模拟时钟（`.pc-sidebar-clock`），并保留真实时间驱动。

保留的效果：

- 新拟态钟面与时刻标记。
- 12 个阿拉伯数字。
- 时针、分针、秒针。
- 中心装饰圆点。
- 折叠态下隐藏。

调整的效果：

- 视觉完全复刻源案例新拟态风格，但**由 JavaScript 实时时间驱动**，显示当前真实时间。
- 尺寸从源案例 `300px × 300px` 缩放为 `180px × 180px`。
- 颜色完全回归源案例冷灰蓝色调：`#e0e5ec` 表盘、`#a3b1c6` 暗部、`#ffffff` 高光、`#b8c1d1` 数字、`#4a5463` 时针、`#7a8a9e` 分针、`#e65e5e` 秒针。
- 秒针每秒跳 6°，分针/时针由 JS 每秒连续更新。
- 外容器移除卡片背景、圆角与阴影，仅作为居中占位容器。

---

## 三、实施计划

### 3.1 HTML 结构

```html
<div class="pc-sidebar-clock" id="pcSidebarClock" aria-label="当前时间">
    <div class="pc-sidebar-clock-face" aria-hidden="true">
        <div class="pc-clock-markers">${CLOCK_MARKERS}</div>
        <div class="pc-clock-numbers">${CLOCK_NUMBERS}</div>
        <div class="pc-clock-hand pc-clock-hour-hand" id="pcClockHour"></div>
        <div class="pc-clock-hand pc-clock-minute-hand" id="pcClockMinute"></div>
        <div class="pc-clock-hand pc-clock-second-hand" id="pcClockSecond"></div>
        <div class="pc-clock-center-pin"></div>
    </div>
</div>
```

- `aria-label` 由外层提供，内部装饰元素使用 `aria-hidden="true"`，避免屏幕阅读器读取拆分后的数字或指针。
- 刻度与数字通过 JS 数组生成，避免手写 12 组重复结构。

### 3.2 CSS 实现

1. **外容器 `.pc-sidebar-clock`**：移除原卡片背景/圆角/阴影，仅保留 `padding` 与 `max-height: 216px`，作为居中占位容器。
2. **钟面 `.pc-sidebar-clock-face`**：圆形，`180px × 180px`，背景 `#e0e5ec`，外凸双层阴影 `8px 8px 16px #a3b1c6 / -8px -8px 16px #ffffff`；`::before` 伪元素增加内凹阴影，直径 `92%`。
3. **时刻标记**：每个标记容器先 `rotate(calc(var(--i) * 30deg))` 旋转到对应角度，内部圆点背景 `#e0e5ec`，带 `inset` 内凹阴影；普通刻度 `4px`，3/6/9/12 刻度 `5px`。
4. **数字**：容器旋转后，内部 `span` 先 `translateY(21px)` 向外推，再 `rotate(calc(var(--i) * -30deg))` 反向转正，保持可读；字号 `14px`（按源案例 `24px` 缩放），颜色 `#b8c1d1`，带雕刻文字阴影。
5. **指针**：`bottom: 50%; left: 50%; transform-origin: bottom center;`，通过 JS 实时设置 `transform` 角度；时针 `#4a5463` 宽 `5px` 长 `30px`，分针 `#7a8a9e` 宽 `4px` 长 `48px`，秒针 `#e65e5e` 宽 `2px` 长 `60px`。
6. **中心点**：`12px` 新拟态圆点 `#e0e5ec`，带内凹阴影，中心 `4px` 深色小点，覆盖指针根部。

### 3.3 JS 实时时间驱动

由 `setupSidebarClock()` 读取系统时间并计算指针角度：

- 时针角度：`hours * 30 + minutes * 0.5 + seconds * (0.5 / 60)`。
- 分针角度：`minutes * 6 + seconds * 0.1`。
- 秒针角度：`seconds * 6`（跳秒）。
- 使用 `setTimeout` 对齐到系统秒边界，遵循「绝对时间同步」原则，避免累计误差。
- 初始化后立即更新一次，随后每秒触发。
- `prefers-reduced-motion: reduce` 下仅初始化一次，指针停留在当前真实时间位置，不再走动。

### 3.4 无障碍与减少动画

- 外层 `#pcSidebarClock` 提供 `aria-label="当前时间"`，内部装饰元素使用 `aria-hidden="true"`。
- 侧边栏折叠态（`.pc-sidebar-collapsed`）下隐藏时钟。

---

## 四、源码落点

| 文件 | 职责 |
|------|------|
.| `src/js/pc-app.js` | `renderShell()` 渲染时钟 HTML；底部 footer 仅保留时钟。 |
| `src/css/pc.css` | `.pc-sidebar-clock*` 系列规则（新拟态视觉、指针 transform）；`.pc-sidebar-mascot` 位于 nav 与 footer 之间（红框区域）；`prefers-reduced-motion` 与折叠态适配。 |
| `docs/apps-code-map.md` | 更新 `pc.css` 与 `pc-app.js` 的说明。 |
| `docs/设计文档/PC侧边栏模拟时钟.md` | 本文档，记录设计来源、方案与源码落点。 |

---

## 五、颜色适配

| 元素 | 源案例 | 本项目实现 | 说明 |
|------|--------|-----------|------|
| 钟面背景 | `#e0e5ec` | `#e0e5ec` | 完全复刻源案例冷灰蓝 |
| 外容器背景 | 无（独立表盘） | 透明 | 移除卡片背景，让表盘独立呈现 |
| 数字 | `#b8c1d1` | `#b8c1d1` | 源案例雕刻文字色 |
| 数字文字阴影 | `#ffffff` / `#a3b1c6` | `#ffffff` / `#a3b1c6` | 完全复刻 |
| 刻度点 | `#e0e5ec` + inset 阴影 | `#e0e5ec` + inset 阴影 | 完全复刻 |
| 时针 | `#4a5463` | `#4a5463` | 完全复刻 |
| 分针 | `#7a8a9e` | `#7a8a9e` | 完全复刻 |
| 秒针 | `#e65e5e` | `#e65e5e` | 完全复刻 |
| 中心点 | `#e0e5ec` + inset 阴影 | `#e0e5ec` + inset 阴影 | 完全复刻 |
| 外部投影 | `#a3b1c6` / `#ffffff` | `#a3b1c6` / `#ffffff` | 源案例 `12px`；本项目按 `180px/300px = 0.6` 缩放为 `8px` |
| 内部投影 | `#a3b1c6` / `#ffffff` | `#a3b1c6` / `#ffffff` | 源案例 `8px`；本项目缩放为 `5px` |

---

## 六、变更记录

- 2026-07-09：制定方案，将 Uiverse `chase2k25/nice-fly-98` 新拟态时钟落地到 PC 侧边栏，替换原「本地数据」存储卡片；秒针采用跳秒，时针/分针连续转动；颜色适配项目暖色调；文档同步完成。
- 2026-07-10：基于工程师提供的参考图将时钟风格调整为极简扁平风；钟面改为 `#FFFDF8` 并削弱阴影；数字/刻度改为 `#3a3a3a`；时针加粗加深为 `#2a2a2a`；分针改为青蓝色 `#3B9EBF`；中心点缩小为 `6px` 实心深色；同步更新本文档。
- 2026-07-10：按工程师要求改回方案 A，完全复刻 Uiverse `chase2k25/nice-fly-98` 源案例新拟态风格；移除 JS 真实时间逻辑，改用纯 CSS `@keyframes` 动画；表盘放大到 `180px × 180px`（源案例 `300px` 的 60% 缩放）；吉祥物上移（`max-height: 80px`）为时钟腾出空间；颜色回归源案例冷灰蓝调。
- 2026-07-10：修复数字错位问题：将 `.pc-clock-number span` 的 `transform` 从 `rotate(...) translateY(...)` 改为 `translateY(...) rotate(...)`，使数字先沿旋转后的径向推出再反向转正，与源案例一致。
- 2026-07-10：按工程师要求将 `.pc-sidebar-mascot` 吉祥物从 footer 内移到 `.pc-sidebar-header` 与 `.pc-sidebar-nav` 之间，避免与底部时钟 UI 重叠；同步更新 `docs/apps-code-map.md` 与本文档。
- 2026-07-10：按工程师要求彻底移除 `.pc-sidebar-mascot` 吉祥物：删除 `src/js/pc-app.js` 中的 import 与 DOM、`src/css/pc.css` 中的相关样式、`src/assets/mobile/mascots/tip-mascot.png` 图片文件；同步更新 `docs/apps-code-map.md` 与本文档。
- 2026-07-10：按工程师截图中的红框位置，将 `.pc-sidebar-mascot` 吉祥物重新放回侧边栏，位于 `.pc-sidebar-nav` 与 `.pc-sidebar-footer` 之间；通过 `git checkout` 恢复 `tip-mascot.png`；同步更新 `docs/apps-code-map.md` 与本文档。
- 2026-07-10：修复吉祥物与时钟 UI 重叠问题：将 `.pc-sidebar-mascot` 的 `margin-bottom` 从 `var(--pc-space-lg)` 加大到 `28px`；将 `.pc-sidebar-clock` 的 `padding-top` 从 `var(--pc-space-lg)` 加大到 `var(--pc-space-xl)`；为 `.pc-sidebar-mascot-img` 增加 `height: 100%` 与 `object-fit: contain`，避免图片撑开父元素；同步更新本文档。
