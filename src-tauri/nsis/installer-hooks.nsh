; 安装/卸载前结束本应用相关进程，避免 Sidecar/回退后端锁文件导致写入失败。
; 由 tauri.conf.json → bundle.windows.nsis.installerHooks 引用。

!macro KillPromptImageManagerProcesses
    ; 主程序 + Python Sidecar（含子进程树）
    nsExec::ExecToLog 'cmd /c taskkill /F /T /IM 生图提示词管理器.exe'
    Pop $0
    nsExec::ExecToLog 'cmd /c taskkill /F /T /IM PromptImageManager.exe'
    Pop $0
    nsExec::ExecToLog 'cmd /c taskkill /F /T /IM app.exe'
    Pop $0
    nsExec::ExecToLog 'cmd /c taskkill /F /T /IM PromptImageManager-Server.exe'
    Pop $0
    ; 系统 Python 回退后端：仅结束命令行归属本项目的 python
    nsExec::ExecToLog 'cmd /c powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq \"python.exe\" -or $_.Name -eq \"pythonw.exe\") -and ($_.CommandLine -like \"*PromptImageManager*\" -or $_.CommandLine -like \"*prompt-image-tool*\") } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"'
    Pop $0
    Sleep 400
!macroend

!macro NSIS_HOOK_PREINSTALL
    !insertmacro KillPromptImageManagerProcesses
!macroend

!macro NSIS_HOOK_PREUNINSTALL
    !insertmacro KillPromptImageManagerProcesses
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
