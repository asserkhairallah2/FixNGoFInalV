#requires -Version 5.1
<#
.SYNOPSIS
  Verifies that a fresh `git clone` of HEAD builds cleanly and serves the SPA via real setup.bat + start.bat.
.DESCRIPTION
  Catches untracked or git-ignored source files (such as Round 4 Blocker A.1) and real .bat startup bugs.
#>
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# 1. Fail if any source file under src/ or client/src/ is untracked or ignored by git
$untracked = @(git -C $root ls-files --others --exclude-standard -- src client/src)
if ($untracked.Count -gt 0) {
    Write-Host "[FAIL] Untracked source files found (must be committed):" -ForegroundColor Red
    $untracked | ForEach-Object { Write-Host "  $_" }
    exit 1
}

$cloneDir = Join-Path ([IO.Path]::GetTempPath()) ('fixngo-clone-gate-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$serverProc = $null
try {
    Write-Host "[CLONE-GATE] Cloning HEAD to $cloneDir ..."
    git clone --quiet $root $cloneDir
    if ($LASTEXITCODE -ne 0) { throw "git clone failed (exit $LASTEXITCODE)" }

    # Link node_modules from workspace to avoid redundant network install while still testing git-tracked sources only
    $wsModules = Join-Path $root 'client\node_modules'
    if (Test-Path $wsModules) {
        New-Item -ItemType Junction -Path (Join-Path $cloneDir 'client\node_modules') -Target $wsModules | Out-Null
    }

    # Find a free port in 5150..5189
    $port = 5155
    for ($p = 5150; $p -le 5189; $p++) {
        $inUse = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if (-not $inUse) { $port = $p; break }
    }

    $env:FIXNGO_DATA_DIR = Join-Path $cloneDir 'data'
    $env:FIXNGO_LOG_DIR = Join-Path $cloneDir 'logs'
    $env:FIXNGO_PORT = "$port"
    $env:FIXNGO_SETUP_NAME = 'Clone Gate Admin'
    $env:FIXNGO_SETUP_EMAIL = 'admin@clonegate.test'
    $env:FIXNGO_SETUP_PHONE = '01012345678'
    $env:FIXNGO_SETUP_PASSWORD = 'CloneGate@2026x'

    Write-Host "[CLONE-GATE] Running setup.bat --non-interactive --no-pause (triggers full build from cloned tree)..."
    Push-Location $cloneDir
    cmd.exe /d /s /c "setup.bat --non-interactive --no-pause"
    $setupExit = $LASTEXITCODE
    Pop-Location
    if ($setupExit -ne 0) { throw "setup.bat in fresh clone failed (exit $setupExit)" }

    Write-Host "[CLONE-GATE] Starting real start.bat on port $port ..."
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = '/d /s /c "start.bat --no-browser --no-pause"'
    $psi.WorkingDirectory = $cloneDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $serverProc = [System.Diagnostics.Process]::Start($psi)

    $healthy = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $h = Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 2
            if ($h.StatusCode -eq 200) { $healthy = $true; break }
        } catch { }
    }
    if (-not $healthy) { throw "Server started via start.bat did not become healthy on port $port" }

    $rootRes = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 5
    if ($rootRes.StatusCode -ne 200 -or $rootRes.Content -notmatch 'id="root"') {
        throw "GET / did not return SPA index.html (status $($rootRes.StatusCode))"
    }
    $assetMatch = [regex]::Match($rootRes.Content, '/assets/[^"'']+\.js')
    if (-not $assetMatch.Success) { throw "SPA index.html missing JS asset bundle tag" }
    $jsRes = Invoke-WebRequest -Uri ("http://127.0.0.1:$port" + $assetMatch.Value) -UseBasicParsing -TimeoutSec 5
    if ($jsRes.StatusCode -ne 200) { throw "JS bundle returned $($jsRes.StatusCode)" }

    Write-Host "[OK] Fresh clone built, set up, and served SPA + JS bundle cleanly on port $port." -ForegroundColor Green
    exit 0
}
finally {
    if ($serverProc -and -not $serverProc.HasExited) {
        try { & taskkill.exe /PID $serverProc.Id /T /F 2>$null | Out-Null } catch { }
    }
    Start-Sleep -Seconds 1
    if (Test-Path "$cloneDir\client\node_modules") {
        cmd.exe /c "rmdir `"$cloneDir\client\node_modules`"" 2>$null | Out-Null
    }
    Remove-Item -Path $cloneDir -Recurse -Force -ErrorAction SilentlyContinue
}
