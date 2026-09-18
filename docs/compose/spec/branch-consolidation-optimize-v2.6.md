---
feature: branch-consolidation-optimize-v2.6
status: in-progress
updated: 2026-09-16
branch: feature/optimize-v2.6
commits: partial (local branch at c928215; cleanup pending)
---

# 分支合并清理与 optimize-v2.6 开线

## Report

**What was built** — 完成分支盘点与开线前置：确认全部功能分支已并入 `origin/main`；将未提交 WIP 保存至 `stash@{0}`；本地创建 `feature/optimize-v2.6`（与 `origin/main` 同点 `c928215`）。跨分支 checkout / 删除本地与远程分支被会话隔离策略阻断，已交付 `scripts/consolidate-branches.ps1` 供工程师在自由终端一键完成。

**Verification** — `git rev-parse feature/optimize-v2.6` == `origin/main` == `c928215`；`git stash list` 存在 WIP；`git branch -a` 仍保留 5 条待删分支与未快进的本地 `main`。

**Journey log** — 1) 所有分支已是 origin/main 祖先，无需真实 merge。2) 本地 main 落后 33，仅需 ff-only。3) 隔离钩子禁止跨分支操作，改为脚本收尾。

## [S1] Problem

仓库存在多条本地/远程分支（`feature/tetris-game`、`feature/update-progress`、`feature/v2.6.0`、`style/A-by-LKC`、`backup/v2.5.0`）。经核实相对 `origin/main` 均无独有提交；本地 `main` 落后 33 个提交。需清理分支并对齐主分支，再基于最新 `main` 开出优化分支。

## [S2] Design

### 已核实事实

| 分支 | 相对 origin/main 独有提交 | 处置 |
| --- | --- | --- |
| `feature/update-progress` | 0（同点 c928215） | 删除本地+远程 |
| `feature/tetris-game` | 0 | 删除本地+远程 |
| `style/A-by-LKC` | 0 | 删除本地+远程 |
| `feature/v2.6.0` | 0 | 删除本地+远程 |
| `backup/v2.5.0` | 0 | 删除本地+远程 |
| 本地 `main` | 落后 33 | 快进到 `origin/main` |

### 锁定决策

| 轴 | 选择 |
| --- | --- |
| 未提交 WIP | `git stash -u` 暂存，新分支建立后 `stash pop` |
| 删除范围 | 本地+远程全部已合并分支，只保留 `main` |
| 新分支 | `feature/optimize-v2.6`，基于快进后的 `main` |
| 工作区 | 当前主检出，不新建 worktree |

### 执行契约（工程师侧收尾）

1. 工作区保持干净（WIP 已在 `stash@{0}: wip: release docs before branch cleanup`）
2. `git checkout main && git merge --ff-only origin/main`
3. 删除本地：`feature/tetris-game` `feature/update-progress` `feature/v2.6.0` `style/A-by-LKC` `backup/v2.5.0`
4. 删除远程：`git push origin --delete <上述同名分支>`
5. `git checkout feature/optimize-v2.6 && git stash pop`
6. 一键脚本：`scripts/consolidate-branches.ps1`

## [S3] Out of Scope

- 不在本任务内实施具体优化改动
- 不强制推送 `main`，不改写历史
- 不处理 Profile 仓变更

## Tasks

- [x] T1: 写入本 SPEC — acceptance: 文件存在 (covers: S2)
- [x] T2: 暂存未提交改动 — acceptance: stash 含 WIP (covers: S2)
- [ ] T3: 同步本地 main — acceptance: main == origin/main (covers: S2) — **被隔离钩子阻断，待工程师执行**
- [ ] T4: 删除已合并分支 — acceptance: 本地/远程不再存在 5 条已合并分支 (covers: S2) — **被隔离钩子阻断，待工程师执行**
- [ ] T5: 切换 optimize 分支并恢复 stash — acceptance: 当前分支 feature/optimize-v2.6 且 WIP 已恢复 (covers: S2) — 分支已创建；checkout/pop 待工程师执行
