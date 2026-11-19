@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title FixNGo Server
cd /d "%~dp0"

rem Thin wrapper: dotnet <dll> is used because the machine's .NET SDK is user-local
rem (apphost cannot resolve hostfxr). Business logic lives in C#.
set "CLI=dotnet app\FixNGo.Cli.dll"
set "WEB=dotnet app\web\FixNGo.Web.dll"

set "NOPAUSE="
set "NOBROWSER="
set "AFTERSETUP="
for %%A in (%*) do (
  if /I "%%A"=="--no-pause" set "NOPAUSE=--no-pause"
  if /I "%%A"=="--no-browser" set "NOBROWSER=--no-browser"
  if /I "%%A"=="--after-setup" set "AFTERSETUP=--after-setup"
)

if defined FIXNGO_LOG_DIR (set "LOGROOT=%FIXNGO_LOG_DIR%") else (set "LOGROOT=logs")
if not exist "%LOGROOT%\scripts" mkdir "%LOGROOT%\scripts"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "LOGFILE=%LOGROOT%\scripts\start-%STAMP%.log"

echo ===================================================
echo   FixNGo - Start
echo ===================================================
call :log "start.bat started (args: %*)"

if not exist "app\FixNGo.Cli.dll" (
  call :log "build output missing -> building"
  echo [BUILD] Building application first...
  powershell -NoProfile -ExecutionPolicy Bypass -File "tools\build.ps1"
  if errorlevel 1 ( call :log "BUILD FAILED" & echo [ERR] Build failed. & goto :fail )
)

rem ---- First-run detection: if no accounts, run setup ----
%CLI% check-setup >nul 2>&1
set "CHK=!ERRORLEVEL!"
if "!CHK!"=="10" (
  echo [INFO] No accounts found. Starting first-time setup...
  call :log "no accounts -> launching setup"
  call "%~dp0setup.bat" --from-start
  if errorlevel 1 (
    echo [ERR] Setup was cancelled or failed. Stopping.
    call :log "setup failed"
    if not defined NOPAUSE call :askpause
    exit /b 1
  )
  %CLI% check-setup >nul 2>&1
  if errorlevel 10 (
    echo [ERR] Setup did not create an account. Stopping.
    call :log "setup did not create account"
    if not defined NOPAUSE call :askpause
    exit /b 2
  )
)

rem ---- Choose port ----
if defined FIXNGO_PORT (
  set "PORT=!FIXNGO_PORT!"
) else (
  set "PORT=5080"
)
if defined FIXNGO_DATA_DIR (set "DATADIR=%FIXNGO_DATA_DIR%") else (set "DATADIR=data")
if not exist "%DATADIR%" mkdir "%DATADIR%"
echo !PORT!> "%DATADIR%\server.port"
call :log "selected port !PORT!"

set "ASPNETCORE_URLS=http://localhost:!PORT!"
set "ASPNETCORE_ENVIRONMENT=Production"
set "FIXNGO_DATA_DIR=%FIXNGO_DATA_DIR%"
set "FIXNGO_LOG_DIR=%FIXNGO_LOG_DIR%"

echo [OK] Starting FixNGo at http://localhost:!PORT!
echo [INFO] Press Ctrl+C to stop the server.
call :log "starting web on port !PORT!"

%WEB%
set "EXITCODE=%ERRORLEVEL%"

if exist "%DATADIR%\server.pid" del "%DATADIR%\server.pid"
call :log "web exited with code %EXITCODE%"
exit /b %EXITCODE%

:fail
if not defined NOPAUSE call :askpause
exit /b 3

:log
echo %DATE% %TIME% %~1 >> "%LOGFILE%"
goto :eof

:askpause
echo %cmdcmdline% | find /i "/c" >nul && pause
goto :eof
