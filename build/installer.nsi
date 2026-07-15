!define APPNAME "PromptImageManager"
!define APPVERSION "2.4.0"
!define APPEXE "PromptImageManager.exe"

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
    IfFileExists "$INSTDIR\data\*.*" 0 +4
        CreateDirectory "$APPDATA\${APPNAME}"
        RMDir /r "$APPDATA\${APPNAME}\legacy-install-data"
        Rename "$INSTDIR\data" "$APPDATA\${APPNAME}\legacy-install-data"

    RMDir /r "$INSTDIR"

    Delete "$SMPROGRAMS\生图提示词管理器\生图提示词管理器.lnk"
    Delete "$SMPROGRAMS\生图提示词管理器\卸载生图提示词管理器.lnk"
    RMDir "$SMPROGRAMS\生图提示词管理器"

    Delete "$DESKTOP\生图提示词管理器.lnk"

    DeleteRegKey HKCU "Software\${APPNAME}"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
SectionEnd
