@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title FixNGo Dummy Database
cd /d "%~dp0"

rem Thin wrapper: all business logic lives in FixNGo.Cli (C#).
set "CLI=dotnet app\FixNGo.Cli.dll"

set "YES="
set "NOPAUSE="
set "SEEDARG="
for %%A in (%*) do (
  if /I "%%A"=="--yes" set "YES=--yes"
  if /I "%%A"=="--non-interactive" set "NOPAUSE=--no-pause"
  if /I "%%A"=="--no-pause" set "NOPAUSE=--no-pause"
)
rem Forward --seed <N> verbatim when provided.
:parseargs
if "%~1"=="" goto :parsed
if /I "%~1"=="--seed" (
  set "SEEDARG=--seed %~2"
  shift
  shift
  goto :parseargs
)
shift
goto :parseargs
:parsed

if defined FIXNGO_LOG_DIR (set "LOGROOT=%FIXNGO_LOG_DIR%") else (set "LOGROOT=logs")
if not exist "%LOGROOT%\scripts" mkdir "%LOGROOT%\scripts"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "LOGFILE=%LOGROOT%\scripts\dummy-db-%STAMP%.log"

echo ===================================================
echo   FixNGo - Switch to dummy database
echo ===================================================
call :log "dummy-db.bat started (args: %*)"

if not exist "app\FixNGo.Cli.dll" (
  call :log "build output missing -> building"
  echo [BUILD] Building application first...
  powershell -NoProfile -ExecutionPolicy Bypass -File "tools\build.ps1"
  if errorlevel 1 ( call :log "BUILD FAILED" & echo [ERR] Build failed. & goto :fail )
)

echo [WARN] Your current data will be set aside in data\backups\real-*.
echo [WARN] Run restore-db.bat to return to it.
if not defined YES (
  set "ANSWER="
  set /p "ANSWER=Continue? [y/N]: "
  if /I not "!ANSWER!"=="y" (
    echo [INFO] Aborted. Nothing was changed.
    call :log "confirmation failed -> abort 1"
    if not defined NOPAUSE call :askpause
    exit /b 1
  )
)

call :log "confirmation accepted -> calling db-dummy"
%CLI% db-dummy --yes %SEEDARG%
set "EC=!ERRORLEVEL!"
if "!EC!"=="0" (
  echo [OK] Dummy database ready. See dummy-db.md for every credential.
  call :log "dummy database created OK"
) else (
  echo [ERR] Dummy database failed with exit code !EC!.
  call :log "dummy database failed exit !EC!"
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
