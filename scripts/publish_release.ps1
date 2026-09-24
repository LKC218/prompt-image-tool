#Requires -Version 5.1
<#
.SYNOPSIS
  One-click release for PromptImageManager:
  verify installers, update README version info, commit/push, create GitHub Release.

.EXAMPLE
  .\scripts\publish_release.ps1

.EXAMPLE
  .\scripts\publish_release.ps1 -Version 2.5.1 -DryRun

.EXAMPLE
  .\scripts\publish_release.ps1 -SkipRelease
#>
[CmdletBinding()]
param(
    [string]$Version,
    [string[]]$Assets,
    [string]$Repo = "LKC218/prompt-image-tool",
    [switch]$SkipReadme,
    [switch]$SkipCommit,
    [switch]$SkipPush,
    [switch]$SkipRelease,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host ("    OK  {0}" -f $Message) -ForegroundColor Green
}

function Write-Warn2([string]$Message) {
    Write-Host ("    WARN  {0}" -f $Message) -ForegroundColor Yellow
}

function Get-RepoRoot {
    $root = Split-Path -Parent $PSScriptRoot
    if (-not (Test-Path (Join-Path $root "package.json"))) {
        throw "package.json not found. Run from project root."
    }
    return (Resolve-Path $root).Path
}

function Get-AppVersion([string]$Root) {
    if ($Version) {
        return ($Version -replace '^[vV]', '')
    }
    $pkgPath = Join-Path $Root "package.json"
    $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    return [string]$pkg.version
}

function Find-Assets([string]$Root, [string]$Ver) {
    if ($Assets -and $Assets.Count -gt 0) {
        $resolved = @()
        foreach ($item in $Assets) {
            $resolved += (Resolve-Path $item).Path
        }
        return $resolved
    }
    $releaseDir = Join-Path $Root "releases"
    if (-not (Test-Path $releaseDir)) {
        return @()
    }
    $patterns = @(
        ("PromptImageManager-Setup-{0}.exe" -f $Ver),
        ("PromptImageManager-Shell-Setup-{0}.exe" -f $Ver),
        ("PromptImageManager-v{0}-Android.apk" -f $Ver),
        ("PromptImageManager-{0}-Android.apk" -f $Ver)
    )
    $found = @()
    foreach ($name in $patterns) {
        $path = Join-Path $releaseDir $name
        if (Test-Path $path) {
            $found += (Resolve-Path $path).Path
        }
    }
    return $found
}

function Get-FileSha256([string]$Path) {
    return (Get-FileHash $Path -Algorithm SHA256).Hash
}

function New-LatestJson([string]$Root, [string]$Ver, [System.Collections.IEnumerable]$AssetMetas, [string]$Repo) {
    $setup = $null
    foreach ($meta in $AssetMetas) {
        if ($meta.Name -like ("*Setup-{0}.exe" -f $Ver) -and $meta.Name -notlike "*Shell*") {
            $setup = $meta
            break
        }
    }
    if (-not $setup) {
        foreach ($meta in $AssetMetas) {
            if ($meta.Name -like "*Setup*.exe" -and $meta.Name -notlike "*Shell*") {
                $setup = $meta
                break
            }
        }
    }
    if (-not $setup) {
        Write-Warn2 "No core Setup exe found; skip latest.json"
        return $null
    }

    $downloadUrl = "https://github.com/{0}/releases/download/v{1}/{2}" -f $Repo, $Ver, $setup.Name
    $payload = [ordered]@{
        version   = $Ver
        pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
        notes     = "PromptImageManager v$Ver"
        platform  = "windows-x86_64"
        url       = $downloadUrl
        sha256    = $setup.Sha256.ToLowerInvariant()
    }
    $json = $payload | ConvertTo-Json -Depth 4
    $outPath = Join-Path $Root "releases\latest.json"
    $releaseDir = Join-Path $Root "releases"
    if (-not (Test-Path $releaseDir)) {
        New-Item -ItemType Directory -Path $releaseDir | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($outPath, $json + "`n", $utf8NoBom)
    Write-Ok ("latest.json -> {0}" -f $downloadUrl)
    return $outPath
}

function Get-ReleaseSections([string]$Root, [string]$Ver) {
    # 返回有序对象列表：@{ Title=...; Items=@(...) }
    # 与应用内弹窗同源，含「发布」；无条目的分类不返回。
    # 中文标题用码点拼接，避免控制台/文件编码差异。
    $tAdd = [string]([char]0x65B0) + [char]0x589E      # 新增
    $tOpt = [string]([char]0x4F18) + [char]0x5316      # 优化
    $tFix = [string]([char]0x4FEE) + [char]0x590D      # 修复
    $tPub = [string]([char]0x53D1) + [char]0x5E03      # 发布

    $path = Join-Path $Root "src\js\release\release-notes-data.js"
    if (-not (Test-Path $path)) {
        return @()
    }
    $text = Get-Content $path -Raw -Encoding UTF8
    $escaped = [regex]::Escape($Ver)
    $blockPattern = "(?s)\{\s*version:\s*'$escaped'.*?(?=\{\s*version:\s*'|\]\s*;\s*$)"
    $m = [regex]::Match($text, $blockPattern)
    if (-not $m.Success) {
        return @()
    }
    $block = $m.Value
    $order = @($tAdd, $tOpt, $tFix, $tPub)
    $byTitle = @{}
    $sectionPattern = "(?s)\{\s*title:\s*'([^']+)'.*?items:\s*\[(.*?)\]\s*,?\s*\}"
    foreach ($sec in [regex]::Matches($block, $sectionPattern)) {
        $title = $sec.Groups[1].Value
        $items = @()
        foreach ($im in [regex]::Matches($sec.Groups[2].Value, "'((?:\\'|[^'])*)'")) {
            $item = $im.Groups[1].Value -replace "\\'", "'"
            $item = ($item -replace '\s+', ' ').Trim()
            if ($item) {
                $items += $item
            }
        }
        if ($items.Count -gt 0) {
            $byTitle[$title] = $items
        }
    }
    $result = @()
    foreach ($t in $order) {
        if ($byTitle.ContainsKey($t)) {
            $result += [pscustomobject]@{ Title = $t; Items = $byTitle[$t] }
        }
    }
    return $result
}

function Get-GitHubToken {
    if ($env:GH_TOKEN) { return $env:GH_TOKEN }
    if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN }
    $payload = "protocol=https`nhost=github.com`n`n"
    $filled = $payload | git credential fill 2>$null
    if (-not $filled) { return $null }
    $line = $filled | Where-Object { $_ -like "password=*" } | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Substring(9)
}

function Update-ReadmeVersion([string]$Root, [string]$Ver, [string[]]$AssetPaths) {
    $readmePath = Join-Path $Root "README.md"
    if (-not (Test-Path $readmePath)) { return $false }
    $text = Get-Content $readmePath -Raw -Encoding UTF8
    $original = $text

    $hasSetup = $false
    $hasApk = $false
    $apkName = $null
    foreach ($p in $AssetPaths) {
        $leaf = Split-Path $p -Leaf
        if ($leaf -like ("*Setup-{0}.exe" -f $Ver) -and $leaf -notlike "*Shell*") {
            $hasSetup = $true
        }
        if ($leaf -like "*.apk") {
            $hasApk = $true
            $apkName = $leaf
        }
    }

    # "当前最新"
    $latestLabel = [string]([char]0x5F53) + [char]0x524D + [char]0x6700 + [char]0x65B0
    $latestPattern = [regex]::Escape($latestLabel) + '[:：]\s*\[v[^\]]+\]\(https://github\.com/[^/]+/[^/]+/releases/latest\)'
    $latestReplace = ("{0}：[v{1}](https://github.com/{2}/releases/latest)" -f $latestLabel, $Ver, $Repo)
    $text = [regex]::Replace($text, $latestPattern, $latestReplace)

    if ($hasSetup) {
        $winPattern = '-\s*Windows：`PromptImageManager-Setup-[^`]+`'
        $winReplace = "- Windows：``PromptImageManager-Setup-{0}.exe``" -f $Ver
        $text = [regex]::Replace($text, $winPattern, $winReplace)
    }

    $andPattern = '-\s*Android：`PromptImageManager-[^`]+`(?:（[^）]*）)?'
    if ($hasApk -and $apkName) {
        $andReplace = "- Android：``" + $apkName + "``"
        $text = [regex]::Replace($text, $andPattern, $andReplace)
    }
    else {
        $andReplace = "- Android：``PromptImageManager-v{0}-Android.apk``（若该版本未附带 APK，请继续使用 Release 页中可用的最新 Android 包）" -f $Ver
        $text = [regex]::Replace($text, $andPattern, $andReplace)
    }

    if ($text -ne $original) {
        if ($DryRun) {
            Write-Ok ("DryRun: README would update to v{0}" -f $Ver)
        }
        else {
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($readmePath, $text, $utf8NoBom)
            Write-Ok ("README updated to v{0}" -f $Ver)
        }
        return $true
    }
    Write-Ok ("README already at v{0}" -f $Ver)
    return $false
}

function Invoke-GitSafe([string[]]$GitArgs) {
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw ("git {0} failed (exit={1})" -f ($GitArgs -join ' '), $LASTEXITCODE)
    }
}

$root = Get-RepoRoot
Set-Location $root
$ver = Get-AppVersion $root
Write-Step ("Target version v{0}" -f $ver)

# 版本一致性：package.json / meta[name=version] / RELEASE_NOTES 首项
$pkg = Get-Content (Join-Path $root "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$metaHtml = Get-Content (Join-Path $root "src/index.html") -Raw -Encoding UTF8
$metaMatch = [regex]::Match($metaHtml, 'name="version"\s+content="([^"]+)"')
$notesPath = Join-Path $root "src/js/release/release-notes-data.js"
$notesText = Get-Content $notesPath -Raw -Encoding UTF8
$notesFirst = [regex]::Match($notesText, "version:\s*'([^']+)'")

$mismatches = @()
if ([string]$pkg.version -ne $ver) {
    $mismatches += ("package.json={0}" -f $pkg.version)
}
if ($metaMatch.Success -and $metaMatch.Groups[1].Value -ne $ver) {
    $mismatches += ("index.html meta={0}" -f $metaMatch.Groups[1].Value)
}
if ($notesFirst.Success -and $notesFirst.Groups[1].Value -ne $ver) {
    $mismatches += ("RELEASE_NOTES 首项={0}" -f $notesFirst.Groups[1].Value)
}
if ($mismatches.Count -gt 0) {
    throw ("Version mismatch for v{0}: {1}" -f $ver, ($mismatches -join "; "))
}
Write-Ok "Version consistency: package.json / meta / RELEASE_NOTES aligned"

$assetPaths = Find-Assets -Root $root -Ver $ver
if ($assetPaths.Count -eq 0) {
    throw ("No installer for v{0} under releases/. Build first or pass -Assets." -f $ver)
}

Write-Step "Installer list"
$assetMeta = @()
foreach ($path in $assetPaths) {
    $item = Get-Item $path
    $sha = Get-FileSha256 $path
    $assetMeta += [pscustomobject]@{
        Path = $item.FullName
        Name = $item.Name
        Size = $item.Length
        Sha256 = $sha
    }
    Write-Ok ("{0}  {1} bytes  SHA256={2}" -f $item.Name, $item.Length, $sha)
}

Write-Step "Generate latest.json for in-app updater"
$latestJsonPath = New-LatestJson -Root $root -Ver $ver -AssetMetas $assetMeta -Repo $Repo
if ($latestJsonPath) {
    $latestItem = Get-Item $latestJsonPath
    $assetMeta += [pscustomobject]@{
        Path = $latestItem.FullName
        Name = $latestItem.Name
        Size = $latestItem.Length
        Sha256 = (Get-FileSha256 $latestItem.FullName)
    }
    Write-Ok ("Attached {0}" -f $latestItem.Name)
}

if (-not $SkipReadme) {
    Write-Step "Update README version info"
    [void](Update-ReadmeVersion -Root $root -Ver $ver -AssetPaths $assetPaths)
}
else {
    Write-Warn2 "Skip README update"
}

if (-not $SkipCommit) {
    Write-Step "Git commit if needed"
    $status = git status --porcelain
    if (-not $status) {
        Write-Ok "Working tree clean"
    }
    else {
        if ($DryRun) {
            Write-Warn2 "DryRun: dirty tree, skip real commit"
            $status | Select-Object -First 20 | ForEach-Object { Write-Host ("      {0}" -f $_) }
        }
        else {
            Invoke-GitSafe @("add", "-A")
            $msg = "chore(release): publish v{0}" -f $ver
            Invoke-GitSafe @("commit", "-m", $msg)
            Write-Ok ("Committed: {0}" -f $msg)
        }
    }
}
else {
    Write-Warn2 "Skip commit"
}

if (-not $SkipPush -and -not $DryRun) {
    Write-Step "Push branch"
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    Invoke-GitSafe @("push", "origin", $branch)
    Write-Ok ("Pushed origin/{0}" -f $branch)
    if ($branch -ne "main") {
        $sha = (git rev-parse HEAD).Trim()
        Invoke-GitSafe @("push", "origin", ("{0}:main" -f $sha))
        Write-Ok ("Fast-forwarded origin/main -> {0}" -f $sha)
    }
}
elseif ($DryRun) {
    Write-Warn2 "DryRun: skip push"
}
else {
    Write-Warn2 "Skip push"
}

if (-not $SkipRelease) {
    Write-Step ("Create GitHub Release v{0}" -f $ver)
    if ($DryRun) {
        Write-Warn2 "DryRun: skip release create"
    }
    else {
        $token = Get-GitHubToken
        if (-not $token) {
            throw "GitHub token not found (GH_TOKEN / GITHUB_TOKEN / git credential)."
        }
        $env:GH_TOKEN = $token
        $env:GITHUB_TOKEN = $token

        $gh = Get-Command gh -ErrorAction SilentlyContinue
        if (-not $gh) {
            $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
            $user = [Environment]::GetEnvironmentVariable("Path", "User")
            $env:Path = "{0};{1}" -f $machine, $user
            $gh = Get-Command gh -ErrorAction SilentlyContinue
        }
        if (-not $gh) {
            throw "gh CLI not found. Install: winget install GitHub.cli"
        }

        $tag = "v{0}" -f $ver
        $existing = $null
        try {
            $existing = gh release view $tag --json tagName 2>$null
        } catch {
            $existing = $null
        }
        if ($LASTEXITCODE -ne 0) { $existing = $null }
        if ($existing) {
            Write-Warn2 ("Release {0} exists, upload missing assets" -f $tag)
            foreach ($meta in $assetMeta) {
                gh release upload $tag $meta.Path --clobber
                if ($LASTEXITCODE -ne 0) {
                    throw ("Upload failed: {0}" -f $meta.Name)
                }
                Write-Ok ("Uploaded {0}" -f $meta.Name)
            }
        }
        else {
            $sha = (git rev-parse HEAD).Trim()
            $rows = @()
            foreach ($meta in $assetMeta) {
                $mb = [math]::Round($meta.Size / 1MB, 1)
                $row = "| ``{0}`` | {1} MB | ``{2}`` |" -f $meta.Name, $mb, $meta.Sha256
                $rows += $row
            }
            $table = $rows -join "`n"

            $sections = Get-ReleaseSections -Root $root -Ver $ver
            $sectionMd = ""
            foreach ($sec in $sections) {
                $bulletLines = @()
                foreach ($item in $sec.Items) {
                    $bulletLines += ("- {0}" -f $item)
                }
                $sectionMd += @"

### $($sec.Title)

$($bulletLines -join "`n")
"@
            }

            $notes = @"
## PromptImageManager v$ver

### Downloads

| Asset | Size | SHA256 |
| --- | ---: | --- |
$table
$sectionMd

> Full changelog: ``docs/版本记录/changelog.md`` in this repository.
"@
            $notesPath = Join-Path $env:TEMP ("prompt-image-tool-release-v{0}.md" -f $ver)
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($notesPath, $notes, $utf8NoBom)

            $releaseArgs = @("release", "create", $tag)
            foreach ($meta in $assetMeta) {
                $releaseArgs += $meta.Path
            }
            # "提示词管家"
            $title = [string]([char]0x63D0) + [char]0x793A + [char]0x8BCD + [char]0x7BA1 + [char]0x5BB6
            $releaseArgs += @(
                "--target", $sha,
                "--title", ("{0} v{1}" -f $title, $ver),
                "--notes-file", $notesPath,
                "--latest"
            )
            & gh @releaseArgs
            if ($LASTEXITCODE -ne 0) {
                throw "gh release create failed"
            }
            Remove-Item $notesPath -ErrorAction SilentlyContinue
            Write-Ok ("https://github.com/{0}/releases/tag/{1}" -f $Repo, $tag)
        }
    }
}
else {
    Write-Warn2 "Skip GitHub Release"
}

Write-Step "Done"
Write-Host ""
Write-Host ("Version: v{0}" -f $ver) -ForegroundColor Green
Write-Host ("Release: https://github.com/{0}/releases/tag/v{1}" -f $Repo, $ver) -ForegroundColor Green
foreach ($meta in $assetMeta) {
    Write-Host (" - {0}  SHA256={1}" -f $meta.Name, $meta.Sha256)
}
