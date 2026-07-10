# 新建提示词按钮复刻方案（Uiverse popular-cat-31）

> 参考来源：`https://uiverse.io/Pankaj-Meharchandani/popular-cat-31`  
> 落点文件：`src/js/pc-library.js`、`src/css/pc.css`、`src/js/ripple.js`  
> 相关规范：`docs/设计文档/新拟态按钮设计规范.md`

---

## 一、效果分析

Uiverse `popular-cat-31` 是一款**玻璃拟态风格的「加入购物车」按钮**，核心视觉层次：

1. **按钮本体**：浅色玻璃面、多层外阴影、深色文字。
2. **外晕边框**：`::after` 提供比按钮大一圈的毛玻璃外框，hover 时扩大。
3. **内高光层**：`::before` 提供内部渐变 + 模糊，增强立体感。
4. **主背景层**：`.bg` 使用渐变 + 边框盒渐变，hover 时垂直拉伸。
5. **旋转微光**：`.bg-spin` 锥形渐变，hover 时显现并旋转。
6. **彩虹光晕**：`.bg-gradient` 按钮背后的彩虹色模糊光晕，hover 时增强。
7. **文字拆分**：每个字母独立 span，按 `--i` 延迟播放动画。

**交互状态**：

- **Hover**：按钮缩放 `1.02`、外晕扩大、旋转微光与彩虹光晕显现、文字逐字波浪波动、加号图标居中旋转并轻微放大。
- **Click / Focus**：默认文字逐字消散；加号图标在按钮区域内缩小淡出；对勾图标以 `stroke-dashoffset` 描边绘制入场，状态切换为「创建中」。

---

## 二、复刻目标

将提示词库页「新建提示词」按钮（`.pc-library-primary-btn`）与编辑器页「保存」按钮（`.pc-editor-save-btn`）复刻为同款效果，同时保留原有功能：新建提示词跳转编辑器、保存按钮异步保存后返回库页。

保留效果：

- 玻璃拟态外壳（`::before` 内层高光 + `::after` 外晕边框 + 多层阴影）。
- hover 旋转微光与彩虹光晕。
- 文字拆分后的 hover 波动与点击消失动画。
- 加号图标 hover 居中旋转 + 轻微放大。
- 加号图标从按钮外飞入并旋转归位的入场动画。
- 对勾图标描边绘制入场。

调整效果：

- 将源案例的「Add → Added」状态切换，改为「新建提示词 → 创建中」的短暂反馈。
- 不使用 `:focus` 触发状态切换，改为点击时由 JS 添加 `.is-acting` 临时类，动画结束后再跳转。
- 移除原按钮中无实际功能的下拉箭头与分隔线。
- 移除 TDesign 水波纹，避免与新的点击动效冲突。

---

## 三、实施计划

### 3.1 HTML 结构

```html
<button class="pc-library-primary-btn pc-create-btn" id="pcLibraryCreateBtn" type="button" aria-label="新建提示词">
    <span class="pc-create-btn-bg" aria-hidden="true"></span>
    <span class="pc-create-btn-spin" aria-hidden="true"></span>
    <span class="pc-create-btn-glow" aria-hidden="true"></span>

    <span class="pc-create-btn-state pc-create-btn-state--default">
        <span class="pc-create-btn-icon">${ICONS.plus}</span>
        <span class="pc-create-btn-text" aria-hidden="true">
            <span style="--i:0">新</span>
            <span style="--i:1">建</span>
            <span style="--i:2">提</span>
            <span style="--i:3">示</span>
            <span style="--i:4">词</span>
        </span>
    </span>

    <span class="pc-create-btn-state pc-create-btn-state--acting" aria-hidden="true">
        <span class="pc-create-btn-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>
        </span>
        <span class="pc-create-btn-text">
            <span style="--i:0">创</span>
            <span style="--i:1">建</span>
            <span style="--i:2">中</span>
        </span>
    </span>
</button>
```

- `.pc-create-btn-bg` / `.pc-create-btn-spin` / `.pc-create-btn-glow`：多层背景与光晕。
- `.pc-create-btn-state--default`：默认状态（加号 + 新建提示词）。
- `.pc-create-btn-state--acting`：点击反馈状态（对勾 + 创建中）。
- 拆分文字使用 `aria-hidden="true"`，由按钮 `aria-label` 提供无障碍文本。

### 3.2 CSS 实现

样式集中写入 `src/css/pc.css`，位于 `/* 复制成功反馈动效 */` 之后、`@media (prefers-reduced-motion: reduce)` 之前，使用 `.pc-app .pc-create-btn` 提升特异性以覆盖全局按钮微交互基线。库页按钮与编辑器保存按钮共用该通用类，各自保留原有布局类（`.pc-library-primary-btn` / `.pc-editor-save-btn`）。

1. **玻璃拟态外壳**：
   - 按钮自身：透明背景、白色文字、多层阴影。
   - `::before`：白色半透明高光渐变 + 模糊。
   - `::after`：主题色柔光外晕。
2. **多层背景**：`.pc-create-btn-bg` 主渐变、`.pc-create-btn-spin` 旋转微光、`.pc-create-btn-glow` 彩虹光晕。
3. **文字拆分**：`.pc-create-btn-text span` 默认执行 `slide-down` 入场；hover 执行 `wave`；`.is-acting` 执行 `disappear`。
4. **图标动画**：
   - 加号默认态执行 `plus-land` 入场：从按钮左下方飞入 + 旋转归位。
   - 加号 hover 执行 `plus-rotate`：原地旋转 90° 并轻微放大回弹。
   - 加号点击执行 `plus-fade`：在按钮区域内缩小淡出，不飞出按钮。
   - 对勾执行 `check` 描边绘制，同时状态层从 `opacity: 0 / scale(0.8)` 过渡到 `opacity: 1 / scale(1)`，避免切换空档。
5. **状态切换**：`.is-acting` 时默认文字层绝对定位，创建中层显示。

### 3.3 JS 交互时序

#### 新建提示词按钮

```
点击按钮
  ├─ 检查是否处于 is-acting，避免连点
  ├─ 如 prefers-reduced-motion，直接跳转 /editor/
  ├─ 添加 .is-acting 类
  │   ├─ 默认文字消失动画（0.6s）
  │   ├─ 加号在按钮区域内缩小淡出（0.3s）
  │   └─ 对勾描边绘制与「创建中」文字入场（0.5s）
  └─ 350ms 后 navigate('/editor/')
```

#### 编辑器保存按钮

```
点击按钮
  ├─ savePromptSet() 开始，先设置 isSaving = true
  ├─ setEditorSavingState() 添加 disabled + pc-editor-save-busy + .is-acting
  │   ├─ 默认文字消失动画
  │   ├─ 保存图标在按钮区域内缩小淡出
  │   └─ 对勾描边绘制与「保存中」文字入场
  ├─ 异步保存完成
  ├─ setEditorSavingState() 移除上述类
  └─ navigate('/library')
```

---

## 四、与源案例的差异

| 源案例 | 本项目适配 |
|---|---|
| 浅色中性渐变（#e6e6e6 → #6e6e6e） | 改为项目主题色渐变（`--pc-accent` → `--pc-accent-strong`），白色文字，增强 CTA 显眼度 |
| 外发光为冷蓝紫色 | 外发光改为 `color-mix(var(--pc-accent), transparent)` 主题色柔光，随主题色切换 |
| 加号 click 时飞出按钮区域 | 加号 click 时在按钮区域内缩小淡出，不飞出 |
| 无显式加号入场动画 | 增加加号从按钮外飞入并旋转归位的入场动画 |
| 文本为「Add to cart」→「Added」 | 文本为「新建提示词」→「创建中」 |
| 购物车图标从左侧飞入 | 使用对勾图标直接描边绘制入场，无需购物车飞入 |
| `:focus` 触发状态切换 | 点击时由 JS 添加 `.is-acting` 临时类，避免 focus 长期驻留 |
| 无跳转行为 | 动画结束后 `navigate('/editor/')` |

---

## 五、源码落点

- HTML 结构：
  - 库页按钮：`src/js/pc-library.js` 的 `render()`。
  - 编辑器保存按钮：`src/js/pc-editor.js` 的 `render()`。
- 样式与动画：`src/css/pc.css` 末尾「新建提示词按钮 — Uiverse popular-cat-31 复刻」区块。
- 交互时序：
  - 库页按钮：`src/js/pc-library.js` 的 `setupLibraryEvents()`。
  - 编辑器保存按钮：`src/js/pc-editor.js` 的 `setEditorSavingState()`。
- 水波纹移除：`src/js/ripple.js` 的 `RIPPLE_SELECTOR`。

---

## 六、无障碍

- 按钮通过 `aria-label="新建提示词"` 描述主操作。
- 拆分文字与状态层使用 `aria-hidden="true"`，避免屏幕阅读器重复朗读单字。
- 保留 `:focus-visible` 品牌色聚焦环（由 `src/css/pc.css` 中既有规则提供）。
- 支持 `prefers-reduced-motion`：在 reduced-motion 媒体查询下禁用所有动画与过渡，并直接跳转，无延迟。

---

## 八、配色显眼度优化

为进一步强化提示词库页主 CTA 的号召力，在保留 Uiverse 层次结构与动画的前提下做了以下配色调整：

1. **按钮面**：从浅灰中性渐变改为 `linear-gradient(var(--pc-accent), var(--pc-accent-strong))`，随项目 5 套主题色自动切换。
2. **文字**：从 `#4a4a4a` 改为 `#fff`，确保在饱和主题色上有足够对比度。
3. **内高光层**：`::before` 改为白色半透明渐变（`rgba(255,255,255,0.45) → rgba(255,255,255,0.1)`），既保留玻璃拟态高光，又不冲淡主题色。
4. **外发光**：`::after` 的冷蓝紫光晕改为 `color-mix(in srgb, var(--pc-accent) 35%, transparent)`，hover 时扩大到 `-9px`，形成主题色柔光晕。
5. **hover/active 阴影**：在原有黑白阴影基础上，混入 `--pc-accent` 主题色，增强品牌识别。

---

## 十、加号图标动画优化

为进一步贴合 Uiverse 源案例并满足「不飞出按钮区域」的要求，对加号图标动画做了以下调整：

1. **入场动画 `plus-land`**：加号从按钮左下方（`translateX(-60px) translateY(30px)`）飞入，同时从 `-100deg` 旋转归位并缩放到正常尺寸，带轻微模糊到清晰的过渡。
2. **Hover 居中旋转 `plus-rotate`**：合并原 `rotate-plus` 与 `scale-plus` 为单一关键帧，加号在原地旋转 90° 并放大到 1.3 倍后回弹，动画曲线使用 `cubic-bezier(0.5, 1, 0.3, 1.6)` 增强弹性感。
3. **Click 区域内淡出 `plus-fade`**：移除原 `move-plus` 飞出动画，改为在按钮区域内旋转 45° 并缩放到 0，同时透明度降到 0，整个过程 0.3s。
4. **状态切换无空档**：`.pc-create-btn-state--acting` 从 `display: none` 改为 `opacity: 0 / scale(0.8)` + `transition`，点击时同步放大淡入，与加号淡出形成平滑替换。

---

## 十一、复用到编辑器保存按钮

将库页「新建提示词」按钮的视觉效果与交互复用到编辑器页顶部「保存」按钮，实现统一的主 CTA 体验。

### 11.1 抽象可复用类 `.pc-create-btn`

原效果的选择器为 `.pc-app .pc-library-primary-btn`，现在改为 `.pc-app .pc-create-btn`。库页按钮与编辑器保存按钮的 HTML 分别保留各自的布局类，并额外添加 `.pc-create-btn`：

```html
<!-- 库页 -->
<button class="pc-library-primary-btn pc-create-btn" id="pcLibraryCreateBtn" ...>

<!-- 编辑器 -->
<button class="pc-editor-save-btn pc-create-btn" id="pcEditorSave" ...>
```

### 11.2 编辑器保存按钮结构

与库页按钮结构一致，仅替换图标与文字：

- 默认态：保存图标 +「保存」。
- acting 态：对勾图标 +「保存中」。
- 保存图标使用内联 stroke SVG，与 `.pc-create-btn-icon svg` 的 `currentColor` 描边保持一致。

### 11.3 JS 状态联动

`src/js/pc-editor.js` 的 `setEditorSavingState()` 在原有 `disabled` / `pc-editor-save-busy` 切换基础上，新增 `.is-acting` 切换：

```js
saveBtn.classList.toggle('is-acting', saving);
```

文字切换由双状态层 CSS 处理，不再直接修改 `textContent`。

### 11.4 清理旧样式

- 移除 `.pc-welcome-banner-editor .pc-editor-save-btn` 及其 hover 状态中的粉色渐变、边框、阴影。
- 移除 `.pc-welcome-banner-editor .pc-editor-save-icon` 的 `filter` 覆盖。
- 移除通用 `.pc-editor-save-btn` 样式。
- 从 `src/js/ripple.js` 的 `RIPPLE_SELECTOR` 中移除 `.pc-editor-save-btn`。

---

## 十二、变更记录

- 2026-07-10：复刻效果扩展至编辑器保存按钮：提取 `.pc-create-btn` 通用类，库页按钮与编辑器保存按钮共用同一套玻璃拟态 + 动画。
- 2026-07-10：按 Uiverse `Pankaj-Meharchandani/popular-cat-31` 复刻 PC 端新建提示词按钮，含玻璃拟态、旋转光晕、文字拆分、点击状态切换。
- 2026-07-10：优化按钮配色显眼度：主题色渐变面、白色文字、主题色外发光与阴影。
- 2026-07-10：优化加号图标动画：增加入场动画、hover 居中旋转、click 区域内缩小淡出，状态切换无空档。
