# 本地遗留分支清理脚本
# 在仓库根目录以 PowerShell 执行：powershell -File scripts\cleanup-local-branches.ps1
# 前置：远程 main 已合入 feature/plant-idle-game（ec50e30）；本脚本只处理本地 ref。

$ErrorActionPreference = 'Stop'
Set-Location -Path (Join-Path $PSScriptRoot '..')

Write-Host '==> 1. 拉取远程状态' -ForegroundColor Cyan
git fetch origin --prune
Write-Host "origin/main = $(git rev-parse origin/main)"

Write-Host '==> 2. 确认工作区干净（忽略未跟踪临时文件）' -ForegroundColor Cyan
$dirty = git status --porcelain | Where-Object { $_ -notmatch '^\?\? (\.mimocode/temp/|\.vite-dev\.err$)' }
if ($dirty) {
    Write-Host '存在未提交改动，请先处理后再清理：' -ForegroundColor Yellow
    $dirty | ForEach-Object { Write-Host "  $_" }
    exit 1
}

Write-Host '==> 3. 切到 main 并快进到 origin/main' -ForegroundColor Cyan
git checkout main
git merge --ff-only origin/main

Write-Host '==> 4. 删除已完全合入 origin/main 的本地遗留分支' -ForegroundColor Cyan
# 验收：相对 origin/main 无独有提交才允许 -d 删除
$targets = @(
    'feature/plant-idle-game',
    'feature/optimize-v2.6'
)
foreach ($b in $targets) {
    if (-not (git show-ref --verify --quiet "refs/heads/$b")) {
        Write-Host "跳过（不存在）: $b"
        continue
    }
    $ahead = git rev-list --count "origin/main..$b"
    if ([int]$ahead -gt 0) {
        Write-Host "跳过（仍有 $ahead 个未合入提交）: $b" -ForegroundColor Yellow
        continue
    }
    git branch -d $b
    Write-Host "已删除: $b" -ForegroundColor Green
}

Write-Host '==> 5. 验收' -ForegroundColor Cyan
Write-Host '期望：本地仅 main，且 main == origin/main'
git branch -vv
Write-Host "main        = $(git rev-parse main)"
Write-Host "origin/main = $(git rev-parse origin/main)"
git stash list

Write-Host '完成。' -ForegroundColor Green
