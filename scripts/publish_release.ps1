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
    $latestPattern = [regex]::Escape($latestLabel) + ':\s*\[v[^\]]+\]\(https://github\.com/[^/]+/[^/]+/releases/latest\)'
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
        $existing = gh release view $tag --json tagName 2>$null
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
            $notes = @"
## PromptImageManager v$ver

### Downloads

| Asset | Size | SHA256 |
| --- | ---: | --- |
$table

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
