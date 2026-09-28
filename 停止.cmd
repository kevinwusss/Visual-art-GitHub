@echo off
chcp 65001 >nul
setlocal
set "PS_SCRIPT=%~dp0scripts\dev.ps1"
if not exist "%PS_SCRIPT%" (
  echo [X] scripts\dev.ps1 not found. Put this file in the project root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" stop %*
if errorlevel 1 (
  echo.
  echo [X] Stop failed. Press any key to close this window.
  pause >nul
)
endlocal
