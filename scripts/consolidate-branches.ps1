# 分支清理与 optimize-v2.6 开线执行说明
#
# 背景：Compose 会话已核实所有 feature/style/backup 分支均无相对 origin/main
# 的独有提交；并已在本地创建 feature/optimize-v2.6（与 origin/main 同点 c928215），
# 将未提交 WIP 保存在 stash@{0}。
#
# 本会话隔离策略禁止跨分支 checkout / 删分支 / 删远程分支。
# 请工程师在能自由操作 git 的终端（PowerShell）中，于仓库根目录执行本文件，
# 或逐条执行下列命令。

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot\..

Write-Host '==> 1. 确认当前状态' -ForegroundColor Cyan
git status -sb
git stash list
git branch -a
git rev-parse HEAD
git rev-parse origin/main
git rev-parse feature/optimize-v2.6

Write-Host '==> 2. 若仍有未提交改动且尚未 stash，先暂停人工确认' -ForegroundColor Cyan
$dirty = git status --porcelain
if ($dirty) {
    Write-Host '工作区不干净，请先人工处理或确认已有 stash，再继续。' -ForegroundColor Yellow
    exit 1
}

Write-Host '==> 3. 快进本地 main 到 origin/main' -ForegroundColor Cyan
git checkout main
git merge --ff-only origin/main

Write-Host '==> 4. 删除已合并本地分支（跳过当前分支）' -ForegroundColor Cyan
$localTargets = @(
    'feature/tetris-game',
    'feature/update-progress',
    'feature/v2.6.0',
    'style/A-by-LKC',
    'backup/v2.5.0'
)
$current = git rev-parse --abbrev-ref HEAD
foreach ($b in $localTargets) {
    if ($b -eq $current) {
        Write-Host "跳过当前分支 $b"
        continue
    }
    git branch -d $b
}

Write-Host '==> 5. 删除已合并远程分支' -ForegroundColor Cyan
git push origin --delete `
    feature/tetris-game `
    feature/update-progress `
    feature/v2.6.0 `
    style/A-by-LKC `
    backup/v2.5.0

Write-Host '==> 6. 切换到 optimize 分支并恢复 stash' -ForegroundColor Cyan
git checkout feature/optimize-v2.6
git stash pop

Write-Host '==> 7. 验收' -ForegroundColor Cyan
Write-Host '期望：本地仅 main + feature/optimize-v2.6；远程仅 origin/main；工作区含 stash 恢复的 WIP'
git branch -a
git status -sb
git stash list

Write-Host '完成。后续优化改动请提交到 feature/optimize-v2.6。' -ForegroundColor Green
