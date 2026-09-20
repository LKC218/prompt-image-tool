# GitHub 个人自述页 CRT 动态名片实施计划

> 日期：2026-09-16  
> 状态：**已交付**  
> 项目仓：`LKC218/crt-profile-card`（本地 `G:\项目\LKC218-LKC218`，main `45bcb91`）  
> Profile 仓：`LKC218/LKC218`（本地 `G:\项目\profile-LKC218`，main `1bc1e8c`）  
> 参考规格：[docs/compose/spec/github-crt-profile-card.md](../../compose/spec/github-crt-profile-card.md)

---

## 一、结论（能不能实现）

**能实现。** 已本地交付手写无脚本 SMIL SVG，不依赖 typed-crt 源码。

---

## 二、已锁定决策

| 决策轴 | 选择 | 理由 |
| --- | --- | --- |
| 托管方式 | **双仓** | 项目名更贴切；Profile 仓名必须等于用户名 |
| 项目仓 | `LKC218/crt-profile-card` | 源 SVG + 维护文档 |
| Profile 仓 | `LKC218/LKC218` | GitHub 自动读取的 Profile README |
| 名片内容 | 极简自我介绍 | 大字身份 + slogan |
| 视觉主题 | monochrome-green / green-scanlines | 经典绿屏 CRT |

---

## 三、GitHub 硬约束

1. README **不执行**任意脚本。
2. Profile 名片只能来自仓库 `用户名/用户名`（`LKC218/LKC218`）。
3. 双仓时必须用绝对 raw URL 引用 SVG（相对路径只在同仓有效）。
4. 动画为 SVG 内建 SMIL。
5. raw/CDN 可能缓存；更新后可用 `?v=N` 刷新。

---

## 四、交付物与目录

### 项目仓 `LKC218/crt-profile-card`

```text
README.md
README-维护说明.md
.gitignore
assets/crt-card.svg
```

### Profile 仓 `LKC218/LKC218`

```text
README.md
```

Profile README 顶部：

```markdown
<p align="center">
  <img src="https://raw.githubusercontent.com/LKC218/crt-profile-card/main/assets/crt-card.svg" alt="LKC218 CRT 名片" width="720">
</p>
```

---

## 五、文案

```text
> whoami
LKC218
> slogan
Building local-first tools. / 做本地优先的小工具。
```

画布 960×300，README 展示宽 720。

---

## 六、实施步骤

| 步骤 | 动作 | 产出 |
| --- | --- | --- |
| 1 | 手写 SMIL SVG 打字机 | `assets/crt-card.svg` |
| 2 | 本地项目仓 README / 维护说明 | 可独立预览 |
| 3 | Playwright 延迟截图验收 | 本地通过 |
| 4 | 网页建 `LKC218/crt-profile-card`，push 本目录 | 源资产上线 |
| 5 | 网页建 `LKC218/LKC218`，push Profile README（raw 引用） | 主页名片 |
| 6 | 打开 Profile 验收动画与移动端 | 线上通过 |
| 7 | （可选）静态 PNG 兜底 | `crt-card-static.png` |

---

## 七、风险与对策

| 风险 | 对策 |
| --- | --- |
| 项目仓改名/删档 | Profile raw 失效 → 先保证项目仓长期存在 |
| raw 缓存旧图 | README 加 `?v=N` |
| GitHub 不播 SMIL | 静态 SVG 或 PNG 降级 |
| 中文缺字 | 已本地确认可读 |

---

## 八、明确不做

- 不在 `prompt-image-tool` 做 CRT 功能页
- 不嵌 Canvas/WebGL 播放器
- 不 fork typed-crt 源码
- 不做完整技能树名片

---

## 九、任务清单

- [x] T1: 手写 CRT 打字机 SVG
- [x] T2: 本地项目仓 assets + README
- [x] T3: Playwright 延迟截图验收
- [ ] T4:（可选）静态 PNG 兜底
- [x] T5: 远程 `LKC218/crt-profile-card` 已 push
- [x] T6: 远程 `LKC218/LKC218` 已 push Profile README
- [x] T7: 线上 raw 验收通过

---

## 十、验收入口

- Profile：https://github.com/LKC218
- 项目仓：https://github.com/LKC218/crt-profile-card
- 名片 SVG：https://raw.githubusercontent.com/LKC218/crt-profile-card/main/assets/crt-card.svg
