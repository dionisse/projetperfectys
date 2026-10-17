Unicode True

!define PRODUCT_NAME "PERFECTO Nouvelle Génération"
!define PRODUCT_VERSION "0.2.0-preview.1"
!define PRODUCT_FILE_VERSION "0.2.0.0"
!define PRODUCT_PUBLISHER "PERFECTO"
!define PRODUCT_EXE "Perfecto.Windows.exe"

Name "${PRODUCT_NAME}"
OutFile "..\artifacts\installer\Perfecto-Next-${PRODUCT_VERSION}-win-x64-setup.exe"
InstallDir "$PROGRAMFILES64\PerfectoNext"
InstallDirRegKey HKLM "Software\PerfectoNext" "InstallDir"
RequestExecutionLevel admin
Icon "..\src\Perfecto.Windows\wwwroot\perfecto.ico"
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${PRODUCT_FILE_VERSION}"
VIAddVersionKey /LANG=1036 "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=1036 "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=1036 "LegalCopyright" "Copyright 2026 PERFECTO"
VIAddVersionKey /LANG=1036 "FileDescription" "Installateur PERFECTO Nouvelle Génération"
VIAddVersionKey /LANG=1036 "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=1036 "ProductVersion" "${PRODUCT_VERSION}"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Application" SEC_APP
  SetShellVarContext all
  SetOutPath "$INSTDIR"
  File /r "..\artifacts\windows-win-x64\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\PerfectoNext" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\PERFECTO"
  CreateShortcut "$SMPROGRAMS\PERFECTO\PERFECTO Nouvelle Génération.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
  CreateShortcut "$DESKTOP\PERFECTO Nouvelle Génération.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
SectionEnd

Section "Uninstall"
  SetShellVarContext all
  Delete "$DESKTOP\PERFECTO Nouvelle Génération.lnk"
  Delete "$SMPROGRAMS\PERFECTO\PERFECTO Nouvelle Génération.lnk"
  RMDir "$SMPROGRAMS\PERFECTO"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PerfectoNext"
  DeleteRegKey HKLM "Software\PerfectoNext"
  RMDir /r "$INSTDIR"
SectionEnd
