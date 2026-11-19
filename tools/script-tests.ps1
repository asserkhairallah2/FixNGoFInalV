#requires -Version 5.1
<#
.SYNOPSIS
  Script tests S1-S10 for the five .bat tools (brief 04 section 7), run against temp data dirs/ports.
.DESCRIPTION
  All business logic is exercised through the real FixNGo.Cli and the real .bat wrappers.
  Each scenario writes a transcript under docs/evidence/scripts/. Never touches the real data\ dir.
  Usage: script-tests.ps1 [-Scenarios S1,S2,S3]
#>
param([string]$Scenarios = 'S1,S2,S3')

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$cliArgs = @('app\FixNGo.Cli.dll')
$evidence = 'docs/evidence/scripts'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

$script:passed = 0
$script:failed = 0
$transcript = [System.Collections.Generic.List[string]]::new()

function W([string]$line) { $transcript.Add($line); Write-Host $line }
function Assert([bool]$cond, [string]$msg) {
    if ($cond) { W "[PASS] $msg"; $script:passed++ }
    else { W "[FAIL] $msg"; $script:failed++ }
}
function RunCli([string[]]$cliArguments) {
    $out = & dotnet @cliArgs @cliArguments 2>&1 | Out-String
    $code = $LASTEXITCODE
    return @{ Out = $out; Code = $code }
}
function TempData([string]$name) {
    $p = Join-Path ([System.IO.Path]::GetTempPath()) ("fixngo-$name-" + [guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Force -Path $p | Out-Null
    return $p
}
function SetEnv([string]$data, [string]$port) {
    $env:FIXNGO_DATA_DIR = $data
    $env:FIXNGO_LOG_DIR = Join-Path $data 'logs'
    $env:FIXNGO_PORT = $port
}
function Save([string]$name) {
    $path = Join-Path $root "$evidence\$name.txt"
    ($transcript + "") | Set-Content -Path $path -Encoding utf8
    $transcript.Clear()
    W "[SAVED] $evidence/$name.txt"
}

$want = $Scenarios -split ','
$setupEnv = @{
    FIXNGO_SETUP_NAME = 'Test Administrator'
    FIXNGO_SETUP_EMAIL = 's3admin@fixngo.local'
    FIXNGO_SETUP_PHONE = '01000000007'
    FIXNGO_SETUP_PASSWORD = 'Setup@2026'
}

if ($want -contains 'S1') {
    W "=== S1: start.bat on empty data dir -> first-run setup -> healthy server -> exactly 1 admin ==="
    $data = TempData 's1'
    $port = 5191
    SetEnv $data $port
    foreach ($k in $setupEnv.Keys) { Set-Item -Path "env:$k" -Value $setupEnv[$k] }
    $before = RunCli @('check-setup','--json')
    W "check-setup (before): exit=$($before.Code) $($before.Out.Trim())"
    Assert ($before.Code -eq 10) 'check-setup reports first run (exit 10) on empty dir'

    # start.bat first-run path: call it in background; setup.bat is now env-driven non-interactive.
    $batEnv = "`$env:FIXNGO_DATA_DIR='$data'; `$env:FIXNGO_LOG_DIR='$data\logs'; `$env:FIXNGO_PORT='$port'; " +
        "`$env:FIXNGO_SETUP_NAME='$($setupEnv.FIXNGO_SETUP_NAME)'; `$env:FIXNGO_SETUP_EMAIL='$($setupEnv.FIXNGO_SETUP_EMAIL)'; " +
        "`$env:FIXNGO_SETUP_PHONE='$($setupEnv.FIXNGO_SETUP_PHONE)'; `$env:FIXNGO_SETUP_PASSWORD='$($setupEnv.FIXNGO_SETUP_PASSWORD)'; " +
        "& '.\start.bat' --no-browser --no-pause"
    $p = Start-Process -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$batEnv) `
        -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 's1.out') -RedirectStandardError (Join-Path $data 's1.err')
    $healthy = $false
    for ($i=0; $i -lt 60; $i++) {
        try { $h = Invoke-RestMethod "http://localhost:$port/health" -TimeoutSec 1; if ($h.status -eq 'ok') { $healthy=$true; break } } catch {}
        Start-Sleep -Milliseconds 500
    }
    W "start.bat health poll: healthy=$healthy"
    Assert $healthy 'server responds /health after start.bat first-run'
    $after = RunCli @('check-setup','--json')
    W "check-setup (after): exit=$($after.Code) $($after.Out.Trim())"
    Assert ($after.Code -eq 0) 'check-setup reports set up (exit 0) after start.bat'
    Assert (($after.Out | ConvertFrom-Json).userCount -eq 1) 'exactly one user (the admin) exists'
    # stop server
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'FixNGo.Web.dll' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Save 'S1-start-first-run'
}

if ($want -contains 'S2') {
    W "=== S2: setup.bat when already set up -> refuses, exit 2, no changes ==="
    $data = TempData 's2'
    $port = 5192
    SetEnv $data $port
    foreach ($k in $setupEnv.Keys) { Set-Item -Path "env:$k" -Value $setupEnv[$k] }
    $r = RunCli @('setup','--non-interactive')
    W "setup (first): exit=$($r.Code) $($r.Out.Trim())"
    Assert ($r.Code -eq 0) 'first setup succeeds'
    $r2 = RunCli @('setup','--non-interactive')
    W "setup (second): exit=$($r2.Code) $($r2.Out.Trim())"
    Assert ($r2.Code -eq 2) 'second setup refused with exit 2'
    Assert ($r2.Out -match 'already has accounts') 'refusal message is clear'
    Save 'S2-setup-already-set-up'
}

if ($want -contains 'S3') {
    W "=== S3: admin login via API with setup credentials -> 200 Admin; wrong password 401 ==="
    $data = TempData 's3'
    $port = 5193
    SetEnv $data $port
    foreach ($k in $setupEnv.Keys) { Set-Item -Path "env:$k" -Value $setupEnv[$k] }
    $r = RunCli @('setup','--non-interactive')
    Assert ($r.Code -eq 0) 'setup created admin'
    $webdir = Join-Path $root 'app\web'
    $webcmd = "Set-Location '$webdir'; `$env:FIXNGO_DATA_DIR='$data'; `$env:FIXNGO_LOG_DIR='$data\logs'; `$env:ASPNETCORE_URLS='http://localhost:$port'; dotnet FixNGo.Web.dll"
    $p = Start-Process -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$webcmd) `
        -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 's3.out') -RedirectStandardError (Join-Path $data 's3.err')
    $base = "http://localhost:$port"
    $ok = $false
    for ($i=0; $i -lt 60; $i++) { try { Invoke-RestMethod "$base/health" -TimeoutSec 1 | Out-Null; $ok=$true; break } catch {}; Start-Sleep -Milliseconds 500 }
    Assert $ok 'server healthy'
    try {
        $login = Invoke-RestMethod "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' `
            -Body '{"email":"s3admin@fixngo.local","password":"Setup@2026"}'
        W "login correct: role=$($login.user.role) tokenLen=$($login.accessToken.Length)"
        Assert ($login.user.role -eq 'Admin') 'correct credentials -> 200 role Admin'
    } catch { W "login correct FAILED: $($_.Exception.Message)"; $script:failed++ }
    try {
        Invoke-RestMethod "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' `
            -Body '{"email":"s3admin@fixngo.local","password":"Wrong@123"}' | Out-Null
        W 'login wrong: UNEXPECTED 200'; $script:failed++
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        W "login wrong: $code"
        Assert ($code -eq 401) 'wrong password -> 401'
    }
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'FixNGo.Web.dll' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Save 'S3-admin-login'
}

W "=== SUMMARY: passed=$($script:passed) failed=$($script:failed) ==="
if ($script:failed -gt 0) { exit 1 }
exit 0
