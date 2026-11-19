@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title FixNGo Setup
cd /d "%~dp0"

rem Thin wrapper: all business logic lives in FixNGo.Cli (C#). dotnet <dll> is used
rem because the machine's .NET SDK is user-local (apphost cannot resolve hostfxr).
set "CLI=dotnet app\FixNGo.Cli.dll"

set "NONINTERACTIVE="
set "FROMSTART="
set "NOPAUSE="
for %%A in (%*) do (
  if /I "%%A"=="--non-interactive" set "NONINTERACTIVE=--non-interactive"
  if /I "%%A"=="--from-start" set "FROMSTART=--from-start"
  if /I "%%A"=="--no-pause" set "NOPAUSE=--no-pause"
)

rem ---- Script event log (no secrets) ----
if not exist "logs\scripts" mkdir "logs\scripts"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "LOGFILE=logs\scripts\setup-%STAMP%.log"

echo ===================================================
echo   FixNGo - First-time setup
echo ===================================================
call :log "setup.bat started (args: %*)"

if not exist "app\FixNGo.Cli.dll" (
  call :log "build output missing -> building"
  echo [BUILD] Building application first...
  powershell -NoProfile -ExecutionPolicy Bypass -File "tools\build.ps1"
  if errorlevel 1 ( call :log "BUILD FAILED" & echo [ERR] Build failed. & goto :fail )
)

%CLI% check-setup >nul 2>&1
set "CHK=!ERRORLEVEL!"
if "!CHK!"=="0" (
  echo [WARN] System already has accounts. Use remove-db.bat to reset.
  call :log "already set up -> exit 2"
  if not defined NOPAUSE call :askpause
  exit /b 2
)
if not "!CHK!"=="10" (
  echo [ERR] Setup check failed - code !CHK!.
  call :log "check-setup unexpected code !CHK!"
  if not defined NOPAUSE call :askpause
  exit /b 3
)

echo [INFO] First run detected. Proceeding with setup.
call :log "first run -> launching CLI setup"
%CLI% setup %NONINTERACTIVE%
if errorlevel 1 (
  echo [ERR] Setup was cancelled or failed.
  call :log "CLI setup failed"
  if not defined NOPAUSE call :askpause
  exit /b 1
)
call :log "administrator created OK"

if defined NONINTERACTIVE (
  echo [OK] Setup complete - non-interactive. Start the system with start.bat.
  exit /b 0
)
if defined FROMSTART (
  echo [OK] Setup complete. Start.bat will continue.
  exit /b 0
)

echo.
echo [OK] Setup complete. Launching FixNGo...
start "FixNGo" "%~dp0start.bat" --after-setup
exit /b 0

:fail
if not defined NOPAUSE call :askpause
exit /b 3

:log
echo %DATE% %TIME% %~1 >> "%LOGFILE%"
goto :eof

:askpause
echo %cmdcmdline% | find /i "/c" >nul && pause
goto :eof
