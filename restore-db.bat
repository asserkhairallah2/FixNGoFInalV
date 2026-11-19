@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title FixNGo Restore Database
cd /d "%~dp0"

rem Thin wrapper: all business logic lives in FixNGo.Cli (C#).
set "CLI=dotnet app\FixNGo.Cli.dll"

set "YES="
set "NOPAUSE="
for %%A in (%*) do (
  if /I "%%A"=="--yes" set "YES=--yes"
  if /I "%%A"=="--non-interactive" set "NOPAUSE=--no-pause"
  if /I "%%A"=="--no-pause" set "NOPAUSE=--no-pause"
)

if defined FIXNGO_LOG_DIR (set "LOGROOT=%FIXNGO_LOG_DIR%") else (set "LOGROOT=logs")
if not exist "%LOGROOT%\scripts" mkdir "%LOGROOT%\scripts"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "LOGFILE=%LOGROOT%\scripts\restore-db-%STAMP%.log"

echo ===================================================
echo   FixNGo - Restore real database
echo ===================================================
call :log "restore-db.bat started (args: %*)"

powershell -NoProfile -ExecutionPolicy Bypass -File "tools\build.ps1" -IfNeeded
if errorlevel 1 ( call :log "BUILD FAILED" & echo [ERR] Build failed. & goto :fail )

echo [WARN] Anything created while in dummy mode will be discarded.
if not defined YES (
  set "ANSWER="
  set /p "ANSWER=Restore real data? [y/N]: "
  if /I not "!ANSWER!"=="y" (
    echo [INFO] Aborted. Nothing was changed.
    call :log "confirmation failed -> abort 1"
    if not defined NOPAUSE call :askpause
    exit /b 1
  )
)

call :log "confirmation accepted -> calling db-restore"
%CLI% db-restore --yes
set "EC=!ERRORLEVEL!"
if "!EC!"=="0" (
  echo [OK] Real data restored. dummy-db.md removed.
  call :log "restore OK"
) else (
  echo [ERR] Restore failed with exit code !EC!.
  call :log "restore failed exit !EC!"
)
if not defined NOPAUSE call :askpause
exit /b %EC%

:fail
if not defined NOPAUSE call :askpause
exit /b 3

:log
echo %DATE% %TIME% %~1 >> "%LOGFILE%"
goto :eof

:askpause
echo %cmdcmdline% | find /i "/c" >nul && pause
goto :eof
