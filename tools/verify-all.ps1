#requires -Version 5.1
<#
.SYNOPSIS
  Single entry point that runs every automated gate and writes an evidence transcript.
.DESCRIPTION
  Windows PowerShell 5.1 compatible (no &&, no pwsh-only syntax).
  Steps, in order: dotnet build Release, dotnet test Release, npm test (client),
  npm run build (client), mock-scan.ps1, script tests S1-S10, optional Playwright E2E.
  The script exits 0 only when every executed step passed. SKIP is not a failure.
  Full output (timestamp + summary table) goes to docs/evidence/test-output/verify-all.txt.
  Usage: .\tools\verify-all.ps1 [-SkipE2E]
#>
[CmdletBinding()]
param([switch]$SkipE2E)

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$lines = New-Object 'System.Collections.Generic.List[string]'
function Log {
    param([string]$Text)
    $lines.Add($Text) | Out-Null
    Write-Host $Text
}

function Invoke-CapturedProcess {
    param(
        [string]$FileName,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [int]$TimeoutSec
    )
    # Redirect to a file instead of an in-memory pipe. Child processes that inherit
    # the handle cannot make us block waiting for EOF; only the direct child is awaited.
    $outFile = Join-Path ([IO.Path]::GetTempPath()) ('fixngo-verify-' + [guid]::NewGuid().ToString('N').Substring(0, 10) + '.out')
    if ($FileName -ieq 'cmd.exe') {
        $inner = $Arguments -replace '^/d\s+/s\s+/c\s+"', ''
        if ($inner.EndsWith('"')) { $inner = $inner.Substring(0, $inner.Length - 1) }
    }
    else {
        $inner = '"' + $FileName + '" ' + $Arguments
    }
    $full = $inner + ' > "' + $outFile + '" 2>&1'

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = '/d /s /c "' + $full + '"'
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    if ($WorkingDirectory) { $psi.WorkingDirectory = $WorkingDirectory }

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $timedOut = -not $proc.WaitForExit($TimeoutSec * 1000)
    if ($timedOut) {
        try { $proc.Kill() } catch { }
    }
    $code = -1
    if (-not $timedOut) { $code = $proc.ExitCode }
    $text = ''
    if (Test-Path $outFile) {
        try { $text = [IO.File]::ReadAllText($outFile) } catch { $text = '' }
    }
    $proc.Dispose()
    Remove-Item -Path $outFile -Force -ErrorAction SilentlyContinue
    return @{ Code = $code; Text = $text; TimedOut = $timedOut }
}

$results = New-Object 'System.Collections.Generic.List[object]'

function Invoke-Step {
    param(
        [string]$Name,
        [string]$FileName,
        [string]$Arguments,
        [string]$WorkingDirectory = '',
        [int]$TimeoutSec = 1200,
        [string]$SkipReason = ''
    )
    if ($SkipReason) {
        Log ''
        Log ('==================== STEP: ' + $Name + ' ====================')
        Log ('SKIP: ' + $SkipReason)
        $results.Add([pscustomobject]@{ Name = $Name; Result = 'SKIP'; Code = '-'; Duration = '0s'; Detail = $SkipReason })
        return $true
    }

    Log ''
    Log ('==================== STEP: ' + $Name + ' ====================')
    Log ('Command: ' + $FileName + ' ' + $Arguments)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $r = $null
    try {
        $r = Invoke-CapturedProcess -FileName $FileName -Arguments $Arguments `
            -WorkingDirectory $WorkingDirectory -TimeoutSec $TimeoutSec
    }
    catch {
        $r = @{ Code = -1; Text = ('Step threw: ' + $_.Exception.Message); TimedOut = $false }
    }
    $sw.Stop()
    if ($r.Text) { Log $r.Text.TrimEnd() }

    $ok = ($r.Code -eq 0)
    $detail = 'exit ' + $r.Code
    if ($r.TimedOut) { $detail = 'TIMED OUT after ' + $TimeoutSec + 's' }
    $result = if ($ok) { 'PASS' } else { 'FAIL' }
    Log ('---- ' + $Name + ': ' + $result + ' (' + $detail + ', ' + $sw.Elapsed.TotalSeconds.ToString('0.0') + 's) ----')
    $results.Add([pscustomobject]@{
        Name = $Name; Result = $result; Code = [string]$r.Code
        Duration = $sw.Elapsed.TotalSeconds.ToString('0.0') + 's'; Detail = $detail
    })
    return $ok
}

Log 'FixNGo verify-all'
Log ('Started: ' + (Get-Date -Format o))
Log ('Project root: ' + $root)
Log ('PowerShell: ' + $PSVersionTable.PSVersion.ToString())
if ($SkipE2E) { Log 'Option -SkipE2E supplied: Playwright E2E step will be skipped.' }

$sln = Join-Path $root 'FixNGo.sln'
$client = Join-Path $root 'client'
$mockScan = Join-Path $root 'tools\mock-scan.ps1'
$scriptTests = Join-Path $root 'tests\scripts\run-all.ps1'

$allOk = $true

if (-not (Invoke-Step -Name '01 dotnet build (Release)' -FileName 'dotnet' `
        -Arguments ('build "' + $sln + '" -c Release --nologo') -TimeoutSec 1200)) { $allOk = $false }

if (-not (Invoke-Step -Name '02 dotnet test (Release)' -FileName 'dotnet' `
        -Arguments ('test "' + $sln + '" -c Release --no-build --nologo') -TimeoutSec 1800)) { $allOk = $false }

if (-not (Invoke-Step -Name '03 npm test (client)' -FileName 'cmd.exe' `
        -Arguments ('/d /s /c "npm.cmd test"') -WorkingDirectory $client -TimeoutSec 900)) { $allOk = $false }

$buildScript = Join-Path $root 'tools\build.ps1'
if (-not (Invoke-Step -Name '04 npm run build + publish app/' -FileName 'powershell' `
        -Arguments ('-NoProfile -ExecutionPolicy Bypass -File "' + $buildScript + '"') -TimeoutSec 1200)) { $allOk = $false }

if (-not (Invoke-Step -Name '05 mock-scan.ps1' -FileName 'powershell' `
        -Arguments ('-NoProfile -ExecutionPolicy Bypass -File "' + $mockScan + '"') -TimeoutSec 600)) { $allOk = $false }

if (-not (Invoke-Step -Name '06 script tests S1-S10' -FileName 'powershell' `
        -Arguments ('-NoProfile -ExecutionPolicy Bypass -File "' + $scriptTests + '"') -TimeoutSec 2400)) { $allOk = $false }

# ---- Playwright E2E: only run when a config AND a package.json script exist ----
$e2eReason = ''
if ($SkipE2E) {
    $e2eReason = '-SkipE2E supplied'
}
else {
    $configFound = $false
    foreach ($candidate in @(
        (Join-Path $client 'playwright.config.js'), (Join-Path $client 'playwright.config.ts'),
        (Join-Path $client 'playwright.config.mjs'), (Join-Path $root 'playwright.config.js'),
        (Join-Path $root 'playwright.config.ts'), (Join-Path $root 'playwright.config.mjs')
    )) { if (Test-Path $candidate) { $configFound = $true; break } }

    $e2eScript = ''
    $pkgPath = Join-Path $client 'package.json'
    if (Test-Path $pkgPath) {
        try {
            $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
            if ($pkg.scripts) {
                foreach ($prop in $pkg.scripts.PSObject.Properties) {
                    if ($prop.Name -match 'e2e|playwright') { $e2eScript = $prop.Name; break }
                }
            }
        }
        catch { $e2eReason = 'client/package.json could not be parsed' }
    }
    else { $e2eReason = 'client/package.json missing' }

    if (-not $e2eReason -and -not $configFound) {
        $e2eReason = 'no Playwright config found (client/playwright.config.* or root playwright.config.*)'
    }
    if (-not $e2eReason -and -not $e2eScript) {
        $e2eReason = 'no e2e/playwright script found in client/package.json'
    }
    if (-not $e2eReason) {
        $e2eWorkDir = if (Test-Path (Join-Path $root 'e2e')) { $root } else { $client }
        if (-not (Invoke-Step -Name '07 Playwright E2E' -FileName 'cmd.exe' `
                -Arguments ('/d /s /c "npm.cmd run ' + $e2eScript + '"') `
                -WorkingDirectory $e2eWorkDir -TimeoutSec 2400)) { $allOk = $false }
        $e2eReason = 'executed: npm run ' + $e2eScript
    }
}
if ($e2eReason -and -not ($results | Where-Object { $_.Name -like '07*' })) {
    if (-not (Invoke-Step -Name '07 Playwright E2E' -FileName '' -Arguments '' -SkipReason $e2eReason)) { $allOk = $false }
}

$cloneGate = Join-Path $root 'tools\clone-gate.ps1'
if (-not (Invoke-Step -Name '08 fresh-clone build & start.bat gate' -FileName 'powershell' `
        -Arguments ('-NoProfile -ExecutionPolicy Bypass -File "' + $cloneGate + '"') -TimeoutSec 900)) { $allOk = $false }

Log ''
Log '==================== SUMMARY ===================='
Log '| # | Step | Result | Exit | Duration | Detail |'
Log '|---:|---|---|---:|---:|---|'
for ($i = 0; $i -lt $results.Count; $i++) {
    $r = $results[$i]
    Log ('| ' + ($i + 1) + ' | ' + $r.Name + ' | ' + $r.Result + ' | ' + $r.Code + ' | ' + $r.Duration + ' | ' + $r.Detail + ' |')
}
$fails = @($results | Where-Object { $_.Result -eq 'FAIL' }).Count
$passes = @($results | Where-Object { $_.Result -eq 'PASS' }).Count
$skips = @($results | Where-Object { $_.Result -eq 'SKIP' }).Count
Log ''
Log ('Steps: PASS=' + $passes + ' FAIL=' + $fails + ' SKIP=' + $skips)
Log ('Finished: ' + (Get-Date -Format o))
if ($allOk -and $fails -eq 0) { Log 'OVERALL: PASS' } else { Log 'OVERALL: FAIL'; $allOk = $false }

$report = Join-Path $root 'docs\evidence\test-output\verify-all.txt'
New-Item -ItemType Directory -Force -Path (Split-Path $report) | Out-Null
($lines + '') | Set-Content -Path $report -Encoding UTF8

if ($allOk) { exit 0 }
exit 1
