# 侧边栏折叠按钮复刻方案（Uiverse 00Kubi/red-crab-76）

> 参考来源：`https://uiverse.io/00Kubi/red-crab-76`  
> 落点文件：`src/js/pc-app.js`、`src/css/pc.css`  
> 相关规范：`docs/设计文档/新拟态按钮设计规范.md`

> 当前实现恢复旋转描边、文字拆分、图标飞走和尾迹动效；侧栏状态在图标起飞动画结束时切换，`prefers-reduced-motion: reduce` 下直接切换。本文件与 `docs/设计文档/PC左侧导航栏轻拟态设计.md` 共同作为现行说明。

---

## 一、效果分析

Uiverse `red-crab-76` 是一款**3D 新拟态发送按钮**，核心视觉由以下四层构成：

1. **3D 凸起外壳**：`background` 本身无硬边框，靠 `::before` 内层高光渐变 + `::after` 边框渐变 + 多层 `box-shadow` 共同塑造立体感。
2. **旋转描边**：hover 时 `.outline` 内 `conic-gradient` 旋转，呈现主题色流动光边。
3. **文字波动**：把文字拆成单个字母，每个字母按 `--i` 延迟播放 `wave` 关键帧。
4. **图标飞走**：点击后 `:focus` 触发图标 `takeOff` 动画，同时拉出尾迹 `contrail`。
5. **状态切换**：点击后从默认态切换到「已发送」态，新图标/文字以 `land` / `slideDown` 入场。

该按钮本身服务于「发送」语义，直接套用到「切换」按钮需要把「状态切换」概念改为「对向状态切换」（收起 ↔ 展开）。

---

## 二、复刻目标

将 PC 端左侧边栏的「收起/展开侧栏」按钮（`.pc-sidebar-toggle`）复刻为同款效果，同时保留侧边栏的折叠/展开功能。

保留的效果：

- 3D 新拟态外壳（双层渐变 + 多层阴影）。
- hover 旋转 conic-gradient 主题色描边。
- 文字拆分后的 hover 波动动画。
- 点击时文字消失动画。
- 图标点击飞走 + 尾迹 + 重新着陆动画。

调整的效果：

- 将源案例的 `:focus` 触发改为点击时 JS 添加 `.is-flying` 临时类，避免 toggle 按钮长期处于 focus 飞走态。
- 将「发送成功」状态替换为「对向状态文字切换」（收起侧栏 → 展开侧栏）。
- 折叠态（`.pc-sidebar-collapsed`）下按钮缩为 44px 图标按钮，文字隐藏。

---

## 三、实施计划

### 3.1 HTML 结构

```html
<button class="pc-sidebar-toggle" id="pcSidebarToggle" type="button" ...>
    <span class="pc-sidebar-toggle-outline" aria-hidden="true"></span>
    <span class="pc-sidebar-toggle-icon">${SIDEBAR_TOGGLE_ICON}</span>
    <span class="pc-sidebar-toggle-text" aria-hidden="true">
        <span class="pc-sidebar-toggle-letter" style="--i:0">收</span>
        <span class="pc-sidebar-toggle-letter" style="--i:1">起</span>
        <span class="pc-sidebar-toggle-letter" style="--i:2">侧</span>
        <span class="pc-sidebar-toggle-letter" style="--i:3">栏</span>
    </span>
</button>
```

- `.pc-sidebar-toggle-outline`：旋转 conic-gradient 描边容器。
- `.pc-sidebar-toggle-text`：文字拆分为 `.pc-sidebar-toggle-letter`。
- 文字使用 `aria-hidden="true"`，由外层 `aria-label` 提供无障碍文本。

### 3.2 CSS 实现

1. **3D 外壳**：`.pc-sidebar-toggle` 自身负责背景与多层外阴影；`::before` 做内层高光渐变；`::after` 做边框渐变。
2. **旋转描边**：`.pc-sidebar-toggle-outline` 绝对定位，hover 时显示并播放旋转动画。
3. **文字拆分**：`.pc-sidebar-toggle-letter` 默认播放 `slideDown` 入场；hover 时播放 `wave`；`.is-flying` 时播放 `disappear`。
4. **图标飞走**：`.pc-sidebar-toggle-icon svg` 默认播放 `land`；hover 旋转 45°；`.is-flying` 时播放 `takeOff`。
5. **尾迹**：`.pc-sidebar-toggle-icon::before` 在 `.is-flying` 时播放 `contrail`。
6. **折叠态**：`.pc-app.pc-sidebar-collapsed .pc-sidebar-toggle` 缩小尺寸并减弱阴影，文字隐藏。

### 3.3 JS 交互时序

```
点击按钮
  ├─ 检查是否处于 is-flying，避免连点
  ├─ 如 prefers-reduced-motion，直接切换 sidebar 状态
  ├─ 添加 .is-flying 类
  │   ├─ 文字消失动画（0.6s）
  │   ├─ 图标飞走动画（0.8s）
  │   └─ 尾迹动画（0.8s）
  ├─ 等待 800ms
  ├─ 移除 .is-flying 类
  └─ 调用 applySidebarState() 切换状态并重新渲染文字
      └─ 新文字自动播放 slideDown 入场；新图标自动播放 land 入场
```

### 3.4 无障碍与减少动画

- 保留 `aria-expanded`、`aria-label`、`title`。
- `prefers-reduced-motion: reduce` 下禁用所有动画与过渡，直接切换状态。
- 拆分文字 `aria-hidden`，避免屏幕阅读器逐字朗读。

---

## 四、源码落点

| 文件 | 职责 |
|------|------|
| `src/js/pc-app.js` | `splitTextToSpans()` 拆分文字；`renderShell()` / `applySidebarState()` 渲染结构；`setupSidebarToggle()` 控制飞走时序。 |
| `src/css/pc.css` | `.pc-sidebar-toggle` 系列规则与关键帧：`pc-sidebar-toggle-spin`、`pc-sidebar-toggle-wave`、`pc-sidebar-toggle-slide-down`、`pc-sidebar-toggle-disappear`、`pc-sidebar-toggle-take-off`、`pc-sidebar-toggle-land`、`pc-sidebar-toggle-contrail`。 |
| `docs/设计文档/新拟态按钮设计规范.md` | 规范第十章「侧边栏折叠按钮变体」。 |
| `docs/apps-code-map.md` | 更新 `pc.css` 与 `pc-app.js` 的说明。 |
| `docs/设计文档/侧边栏折叠按钮复刻-Uiverse-red-crab-76.md` | 本文档，记录完整方案。 |

---

## 五、变更记录

- 2026-07-09：初稿，完成效果分析、实施计划与源码落点说明。
