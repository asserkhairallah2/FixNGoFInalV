@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title FixNGo Remove Database
cd /d "%~dp0"

rem Thin wrapper: all business logic lives in FixNGo.Cli (C#).
set "CLI=dotnet app\FixNGo.Cli.dll"

set "YES="
set "NOPAUSE="
set "FORCE="
set "SEEDARG="
for %%A in (%*) do (
  if /I "%%A"=="--yes" set "YES=--yes"
  if /I "%%A"=="--non-interactive" set "NOPAUSE=--no-pause"
  if /I "%%A"=="--no-pause" set "NOPAUSE=--no-pause"
  if /I "%%A"=="--force-dummy" set "FORCE=--force-dummy"
)

if defined FIXNGO_LOG_DIR (set "LOGROOT=%FIXNGO_LOG_DIR%") else (set "LOGROOT=logs")
if not exist "%LOGROOT%\scripts" mkdir "%LOGROOT%\scripts"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "LOGFILE=%LOGROOT%\scripts\remove-db-%STAMP%.log"

echo ===================================================
echo   FixNGo - Remove database (reset to first run)
echo ===================================================
call :log "remove-db.bat started (args: %*)"

powershell -NoProfile -ExecutionPolicy Bypass -File "tools\build.ps1" -IfNeeded
if errorlevel 1 ( call :log "BUILD FAILED" & echo [ERR] Build failed. & goto :fail )

echo [WARN] This permanently deletes the live database, uploads, secrets and state.
echo [WARN] A safety snapshot is created in data\backups\ first.
echo [WARN] Type RESET to confirm (nothing is deleted on any other input).

if not defined YES (
  set "ANSWER="
  set /p "ANSWER=Type RESET to confirm: "
  if /I not "!ANSWER!"=="RESET" (
    echo [INFO] Aborted. Nothing was changed.
    call :log "confirmation failed -> abort 1"
    if not defined NOPAUSE call :askpause
    exit /b 1
  )
)

call :log "confirmation accepted -> calling db-reset"
%CLI% db-reset --yes %FORCE%
set "EC=!ERRORLEVEL!"
if "!EC!"=="0" (
  echo [OK] System reset. Run start.bat to begin first-time setup.
  call :log "reset OK"
) else (
  echo [ERR] Reset failed with exit code !EC!.
  call :log "reset failed exit !EC!"
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
