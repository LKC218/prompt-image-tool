!define APPNAME "PromptImageManager"
!define APPVERSION "2.4.2"
!define APPEXE "PromptImageManager.exe"
!define LEGACYDATA "$APPDATA\${APPNAME}\legacy-install-data"

Name "生图提示词管理器 ${APPVERSION}"
InstallDir "$LOCALAPPDATA\${APPNAME}"
OutFile "PromptImageManager-Setup-${APPVERSION}.exe"
RequestExecutionLevel user
Unicode true
Icon "icon.ico"
UninstallIcon "icon.ico"

!include "MUI2.nsh"

!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install"
    SetOutPath $INSTDIR

    File /r "dist\PromptImageManager\*.*"
    File "icon.ico"

    CreateDirectory "$SMPROGRAMS\生图提示词管理器"
    CreateShortCut "$SMPROGRAMS\生图提示词管理器\生图提示词管理器.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\icon.ico" 0
    CreateShortCut "$SMPROGRAMS\生图提示词管理器\卸载生图提示词管理器.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\icon.ico" 0

    CreateShortCut "$DESKTOP\生图提示词管理器.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\icon.ico" 0

    WriteUninstaller "$INSTDIR\uninstall.exe"

    WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" $INSTDIR
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "生图提示词管理器 ${APPVERSION}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\icon.ico"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "PromptImageManager"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${APPVERSION}"
SectionEnd

Section "Uninstall"
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

    Delete "$SMPROGRAMS\生图提示词管理器\生图提示词管理器.lnk"
    Delete "$SMPROGRAMS\生图提示词管理器\卸载生图提示词管理器.lnk"
    RMDir "$SMPROGRAMS\生图提示词管理器"

    Delete "$DESKTOP\生图提示词管理器.lnk"

    ReadRegStr $0 HKCU "Software\${APPNAME}" "InstallDir"
    StrCmp $0 "$INSTDIR" 0 +2
        DeleteRegKey HKCU "Software\${APPNAME}"

    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString"
    StrCmp $0 "$INSTDIR\uninstall.exe" 0 +2
        DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
SectionEnd
