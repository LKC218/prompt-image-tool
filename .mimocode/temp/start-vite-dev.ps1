$ErrorActionPreference = 'Stop'
$workdir = 'G:\项目\prompt-image-tool-main'
$logDir = Join-Path $workdir '.mimocode\temp'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$out = Join-Path $logDir 'vite-dev-out.log'
$err = Join-Path $logDir 'vite-dev-err.log'

$node = $env:MIMO_NODE
if (-not $node) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source } else { $node = 'node' }
}

$args = @('run', 'dev')
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $node
$psi.Arguments = '"' + $env:MIMO_NPM + '" run dev'
if (-not $env:MIMO_NPM) {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCmd) { $psi.Arguments = '"' + $npmCmd.Source + '" run dev' }
}
$psi.WorkingDirectory = $workdir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

$proc = [System.Diagnostics.Process]::Start($psi)
$proc.EnableRaisingEvents = $true

$outWriter = [System.IO.File]::CreateText($out)
$errWriter = [System.IO.File]::CreateText($err)
$outWriter.AutoFlush = $true
$errWriter.AutoFlush = $true

Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
  if ($EventArgs.Data) { [System.IO.File]::AppendAllText($out, $EventArgs.Data + [Environment]::NewLine) }
} | Out-Null
Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
  if ($EventArgs.Data) { [System.IO.File]::AppendAllText($err, $EventArgs.Data + [Environment]::NewLine) }
} | Out-Null

$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()

"STARTED_PID=$($proc.Id)" | Out-File -FilePath (Join-Path $logDir 'vite-dev.pid.txt') -Encoding utf8
Start-Sleep -Seconds 4
"PID_FILE_WRITTEN"
