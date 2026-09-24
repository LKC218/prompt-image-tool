!define APPNAME "PromptImageManager"

!define APPVERSION "2.5.23"

!define APPEXE "PromptImageManager.exe"

!define APPDISPLAYNAME "生图提示词管理器"

!define LEGACYDATA "$APPDATA\${APPNAME}\legacy-install-data"



Name "${APPDISPLAYNAME} ${APPVERSION}"

Caption "${APPDISPLAYNAME} ${APPVERSION} 安装向导"

UninstallCaption "${APPDISPLAYNAME} ${APPVERSION} 卸载向导"

InstallDir "$LOCALAPPDATA\${APPNAME}"

OutFile "PromptImageManager-Setup-${APPVERSION}.exe"

RequestExecutionLevel user

Unicode true

Icon "icon.ico"

UninstallIcon "icon.ico"



!include "MUI2.nsh"



!define MUI_ABORTWARNING

!define MUI_TEXT_ABORTWARNING "确定要退出${APPDISPLAYNAME}安装向导吗？"

!define MUI_WELCOMEPAGE_TITLE "欢迎安装${APPDISPLAYNAME}"

!define MUI_WELCOMEPAGE_TEXT "安装向导将引导你完成${APPDISPLAYNAME}的安装。$\r$\n$\r$\n建议在安装前关闭其他应用程序，以便更新系统文件时无需重启。$\r$\n$\r$\n点击「下一步」继续。"

!define MUI_DIRECTORYPAGE_TEXT_TOP "安装向导将把${APPDISPLAYNAME}安装到以下文件夹。若要安装到其他文件夹，请点击「浏览」更改路径。点击「下一步」继续。"

!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "安装完成"

!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "${APPDISPLAYNAME}已成功安装到你的电脑。"

!define MUI_FINISHPAGE_TITLE "${APPDISPLAYNAME} 安装完成"

!define MUI_FINISHPAGE_TEXT "安装向导已完成${APPDISPLAYNAME}的安装。$\r$\n$\r$\n点击「完成」关闭安装向导。"

!define MUI_FINISHPAGE_RUN

!define MUI_FINISHPAGE_RUN_FUNCTION LaunchInstalledApp

!define MUI_FINISHPAGE_RUN_TEXT "立即启动${APPDISPLAYNAME}"

!define MUI_UNCONFIRMPAGE_TEXT_TOP "安装向导将从你的电脑卸载${APPDISPLAYNAME}。"

!define MUI_UNCONFIRMPAGE_TEXT_LOCATION "将从以下位置卸载："



!insertmacro MUI_PAGE_WELCOME

!insertmacro MUI_PAGE_DIRECTORY

!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_PAGE_FINISH



!insertmacro MUI_UNPAGE_CONFIRM

!insertmacro MUI_UNPAGE_INSTFILES



!insertmacro MUI_LANGUAGE "SimpChinese"



; 强制中文系统字符串，避免语言包缺失时回落英文

LangString ^Name ${LANG_SIMPCHINESE} "${APPDISPLAYNAME}"

LangString ^SetupCaption ${LANG_SIMPCHINESE} "${APPDISPLAYNAME} ${APPVERSION} 安装向导"

LangString ^UninstallCaption ${LANG_SIMPCHINESE} "${APPDISPLAYNAME} ${APPVERSION} 卸载向导"

LangString ^ClickNext ${LANG_SIMPCHINESE} "点击「下一步」继续。"

LangString ^ClickInstall ${LANG_SIMPCHINESE} "点击「安装」开始安装。"

LangString ^ClickFinish ${LANG_SIMPCHINESE} "点击「完成」退出安装向导。"

LangString ^Next ${LANG_SIMPCHINESE} "下一步(&N) >"

LangString ^Back ${LANG_SIMPCHINESE} "上一步(&B)"

LangString ^Cancel ${LANG_SIMPCHINESE} "取消(&C)"

LangString ^Close ${LANG_SIMPCHINESE} "关闭(&C)"

LangString ^Finish ${LANG_SIMPCHINESE} "完成(&F)"

LangString ^Install ${LANG_SIMPCHINESE} "安装(&I)"

LangString ^Uninstall ${LANG_SIMPCHINESE} "卸载(&U)"

LangString ^Abort ${LANG_SIMPCHINESE} "中止"

LangString ^Retry ${LANG_SIMPCHINESE} "重试(&R)"

LangString ^Ignore ${LANG_SIMPCHINESE} "忽略(&I)"

LangString ^Yes ${LANG_SIMPCHINESE} "是(&Y)"

LangString ^No ${LANG_SIMPCHINESE} "否(&N)"

LangString ^AbortWarning ${LANG_SIMPCHINESE} "确定要退出${APPDISPLAYNAME}安装向导吗？"

LangString ^UninstallWarning ${LANG_SIMPCHINESE} "确定要从你的电脑卸载${APPDISPLAYNAME}吗？"

LangString ^UninstallText ${LANG_SIMPCHINESE} "安装向导将从你的电脑卸载${APPDISPLAYNAME}。$\r$\n$\r$\n点击「卸载」开始卸载。"



!macro KillPromptImageManagerProcesses
    nsExec::ExecToLog 'cmd /c taskkill /F /T /IM PromptImageManager.exe'
    Pop $0
    nsExec::ExecToLog 'cmd /c taskkill /F /T /IM PromptImageManager-Server.exe'
    Pop $0
    nsExec::ExecToLog 'cmd /c taskkill /F /T /IM PromptImageManager-Server'
    Pop $0
    nsExec::ExecToLog 'cmd /c powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq \"python.exe\" -or $_.Name -eq \"pythonw.exe\") -and ($_.CommandLine -like \"*PromptImageManager*\" -or $_.CommandLine -like \"*prompt-image-tool*\") } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"'
    Pop $0
    Sleep 400
!macroend


Function LaunchInstalledApp

    ; 静默安装（含应用内自动更新 /S）不拉起应用，避免与更新重启逻辑冲突

    IfSilent skip_launch

        Exec "$INSTDIR\${APPEXE}"

    skip_launch:

FunctionEnd



Section "Install"

    !insertmacro KillPromptImageManagerProcesses

    SetOutPath $INSTDIR



    File /r "dist\PromptImageManager\*.*"

    File "icon.ico"



    CreateDirectory "$SMPROGRAMS\${APPDISPLAYNAME}"

    CreateShortCut "$SMPROGRAMS\${APPDISPLAYNAME}\${APPDISPLAYNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\icon.ico" 0

    CreateShortCut "$SMPROGRAMS\${APPDISPLAYNAME}\卸载${APPDISPLAYNAME}.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\icon.ico" 0



    CreateShortCut "$DESKTOP\${APPDISPLAYNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\icon.ico" 0



    WriteUninstaller "$INSTDIR\uninstall.exe"



    WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" $INSTDIR

    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPDISPLAYNAME} ${APPVERSION}"

    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\uninstall.exe"

    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\icon.ico"

    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "PromptImageManager"

    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${APPVERSION}"

SectionEnd



Section "Uninstall"

    !insertmacro KillPromptImageManagerProcesses

    SetOutPath "$TEMP"

    IfFileExists "$INSTDIR\data\*" 0 uninstall_program_files

        CreateDirectory "$APPDATA\${APPNAME}"

        IfFileExists "${LEGACYDATA}\*" legacy_data_exists

        ClearErrors

        Rename "$INSTDIR\data" "${LEGACYDATA}"

        IfErrors legacy_data_move_failed

        Goto uninstall_program_files



    legacy_data_exists:

        MessageBox MB_ICONEXCLAMATION|MB_OK "检测到旧安装数据且归档目录已存在。为保护您的文件，本次卸载将保留 $INSTDIR\data。"

        Goto uninstall_program_files



    legacy_data_move_failed:

        MessageBox MB_ICONEXCLAMATION|MB_OK "旧安装数据无法迁移到用户数据目录。为保护您的文件，本次卸载将保留 $INSTDIR\data。"



    uninstall_program_files:

    !include "_uninstall_files.nsh"

    Delete "$INSTDIR\uninstall.exe"



    Delete "$SMPROGRAMS\${APPDISPLAYNAME}\${APPDISPLAYNAME}.lnk"

    Delete "$SMPROGRAMS\${APPDISPLAYNAME}\卸载${APPDISPLAYNAME}.lnk"

    RMDir "$SMPROGRAMS\${APPDISPLAYNAME}"



    Delete "$DESKTOP\${APPDISPLAYNAME}.lnk"



    ReadRegStr $0 HKCU "Software\${APPNAME}" "InstallDir"

    StrCmp $0 "$INSTDIR" 0 +2

        DeleteRegKey HKCU "Software\${APPNAME}"



    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString"

    StrCmp $0 "$INSTDIR\uninstall.exe" 0 +2

        DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"

SectionEnd
