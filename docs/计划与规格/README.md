# 计划与规格

**活跃**实施计划与 compose 功能规格。已完成材料在 [_归档/计划/](../_归档/计划/)。

## 放什么 / 不放什么

- **放**：未完成、有后续任务、或远程未同步的实施计划；compose 功能规格。
- **不放**：已发布且无后续任务的计划（→ `_归档/计划/`）；测试结果（→ `质量与复盘/测试记录/`）。

## 目录结构

```
计划与规格/
├── 计划文档-分类索引.md     # 活跃计划导航（本目录主索引）
├── 01-Bug修复与异常排查/     # 当前无活跃项
├── 02-视觉与交互优化/
├── 03-UI页面重构/
├── 04-新功能实装与增强/
├── 07-测试验证/
├── 09-项目治理/
└── compose-spec/            # MiMo compose 功能规格
```

分类编号与原 `计划文档/` 保持一致；空分类目录可不创建，有新计划时再建。

## 活跃计划导航

详见 [计划文档-分类索引.md](./计划文档-分类索引.md)。

## compose 规格

| 规格 | 主题 |
|------|------|
| [plant-idle-game.md](./compose-spec/plant-idle-game.md) | 首页挂机种植物 |
| [pc-games-hub-plane.md](./compose-spec/pc-games-hub-plane.md) | 游戏中心与飞机大战 |
| [pc-tetris-minigame.md](./compose-spec/pc-tetris-minigame.md) | 俄罗斯方块 |
| [pc-image-viewer-flip.md](./compose-spec/pc-image-viewer-flip.md) | 图片查看器 FLIP |
| [update-auto-restart.md](./compose-spec/update-auto-restart.md) | 更新后自动重启 |
| [update-progress-modal.md](./compose-spec/update-progress-modal.md) | 更新进度弹窗 |
| [goal-cover-optimize.md](./compose-spec/goal-cover-optimize.md) | 目标封面优化 |
| [github-crt-profile-card.md](./compose-spec/github-crt-profile-card.md) | GitHub CRT 名片 |
| [branch-consolidation-optimize-v2.6.md](./compose-spec/branch-consolidation-optimize-v2.6.md) | 分支整合优化 |

## 完成后的动作

1. 确认无后续任务 / 已随版本发布。
2. `git mv` 至 `_归档/计划/<原分类>/`。
3. 更新 [计划文档-分类索引.md](./计划文档-分类索引.md)。
4. 若改动了模块或路径，同步 [模块说明/](../模块说明/) 与 [导航/apps-code-map.md](../导航/apps-code-map.md)。
