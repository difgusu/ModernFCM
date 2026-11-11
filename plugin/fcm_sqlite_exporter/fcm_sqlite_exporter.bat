@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
title FCM SQLite Exporter

echo Avvio FCM SQLite Exporter...

set "SCRIPT_PATH=%~dp0fcm_sqlite_exporter.ps1"

if not exist "%SCRIPT_PATH%" goto :no_script
goto :found_script

:no_script
echo [ERRORE] File fcm_sqlite_exporter.ps1 non trovato!
pause
exit /b 1

:found_script
set "PS_EXE=powershell.exe"
if exist "%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXE=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"

"%PS_EXE%" -ExecutionPolicy Bypass -NoProfile -Sta -File "%SCRIPT_PATH%" %*
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%
