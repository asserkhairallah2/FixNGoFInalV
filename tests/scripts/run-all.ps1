#requires -Version 5.1
<#
.SYNOPSIS
  Runs script scenarios S1-S10 for the five FixNGo .bat tools.
.DESCRIPTION
  Each scenario runs in its own PowerShell process with an isolated FIXNGO_DATA_DIR,
  FIXNGO_LOG_DIR and private port. Full output is saved to
  docs/evidence/test-output/script-tests.txt together with a PASS/FAIL summary table.
  Usage: run-all.ps1 [-Scenarios S1,S2,S3]
#>
param([string]$Scenarios = 'S1,S2,S3,S4,S5,S6,S7,S8,S9,S10')

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root

$output = New-Object 'System.Collections.Generic.List[string]'
function L { param([string]$Line) $output.Add($Line) | Out-Null; Write-Host $Line }

L 'FixNGo script tests S1-S10 (brief 04 section 7)'
L ('Started: ' + (Get-Date -Format o))
L ('Project root: ' + $root)
L 'Isolation: every scenario uses a temporary FIXNGO_DATA_DIR / FIXNGO_LOG_DIR and a private port.'
L 'Safety: the real project data\ folder is never used as a test target.'

$results = New-Object 'System.Collections.Generic.List[object]'
foreach ($scenario in ($Scenarios -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
    $file = Join-Path $PSScriptRoot ($scenario + '.ps1')
    L ''
    L ('==================== ' + $scenario + ' ====================')
    if (-not (Test-Path $file)) {
        L ('[FAIL] Scenario file missing: ' + $file)
        $results.Add([pscustomobject]@{ Scenario = $scenario; ExitCode = 1; Pass = 0; Fail = 1 })
        continue
    }
    # Redirect to files rather than a PowerShell pipe: a scenario can leave a child
    # web process holding the pipe open, which would make Out-String wait forever.
    $outFile = Join-Path ([IO.Path]::GetTempPath()) ('fixngo-scenario-' + $scenario + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.out')
    $inner = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $file + '" > "' + $outFile + '" 2>&1'
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = '/d /s /c "' + $inner + '"'
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $text = ''
    $code = 1
    try {
        [void]$proc.Start()
        if (-not $proc.WaitForExit(600000)) {
            try { $proc.Kill() } catch { }
            $text = '[FAIL] Scenario timed out after 600s: ' + $scenario
        }
        else {
            $code = $proc.ExitCode
            if (Test-Path $outFile) { $text = [IO.File]::ReadAllText($outFile) }
        }
    }
    catch {
        $text = 'Scenario threw: ' + $_.Exception.Message
        $code = 1
    }
    finally {
        $proc.Dispose()
        Remove-Item -Path $outFile -Force -ErrorAction SilentlyContinue
    }
    L $text.TrimEnd()
    $pass = [regex]::Matches($text, '\[PASS\]').Count
    $fail = [regex]::Matches($text, '\[FAIL\]').Count
    L ('---- ' + $scenario + ': exit=' + $code + ' pass=' + $pass + ' fail=' + $fail + ' ----')
    $results.Add([pscustomobject]@{ Scenario = $scenario; ExitCode = $code; Pass = $pass; Fail = $fail })
}

# Test artefacts must not leak into the project root.
$md = Join-Path $root 'dummy-db.md'
if (Test-Path $md) {
    Remove-Item $md -Force
    L '[CLEANUP] Removed test-generated dummy-db.md from project root.'
}

$totalPass = ($results | Measure-Object -Property Pass -Sum).Sum
$totalFail = ($results | Measure-Object -Property Fail -Sum).Sum
$failedScenarios = @($results | Where-Object { $_.ExitCode -ne 0 }).Count

L ''
L '==================== SUMMARY ===================='
L '| Scenario | Exit code | Asserts PASS | Asserts FAIL | Result |'
L '|---|---:|---:|---:|---|'
foreach ($r in $results) {
    L ('| ' + $r.Scenario + ' | ' + $r.ExitCode + ' | ' + $r.Pass + ' | ' + $r.Fail + ' | ' + $(if ($r.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }) + ' |')
}
L ''
L ('Scenarios: ' + $results.Count + ' passed=' + ($results.Count - $failedScenarios) + ' failed=' + $failedScenarios)
L ('Assertions: pass=' + $totalPass + ' fail=' + $totalFail)
L ('Finished: ' + (Get-Date -Format o))
L ('Transcripts: docs/evidence/script-tests/')
if ($failedScenarios -eq 0 -and $totalFail -eq 0) { L 'OVERALL: PASS' } else { L 'OVERALL: FAIL' }

$report = Join-Path $root 'docs\evidence\test-output\script-tests.txt'
New-Item -ItemType Directory -Force -Path (Split-Path $report) | Out-Null
($output + '') | Set-Content -Path $report -Encoding UTF8

if ($failedScenarios -gt 0 -or $totalFail -gt 0) { exit 1 }
exit 0
