#requires -Version 5.1
<#
S7 - remove-db.bat with typed confirmation:
wrong word aborts (exit 1, no changes), RESET resets to first run with a safety snapshot,
check-setup = 10 and start.bat triggers setup again.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S7' -Title 'remove-db.bat typed RESET -> first run + safety snapshot + start.bat triggers setup again'

$data = New-TempDataDir 's7'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

Assert-Equal 0 (Invoke-Cli @('setup', '--non-interactive')).Code 'CLI setup created the original admin'
$db = Join-Path $data 'fixngo.db'
$hashBefore = Get-TestSha256 $db
$countBefore = Get-DbUserCount

# Wrong confirmation -> abort 1, no changes.
$abortInput = Join-Path $data 'abort-input.txt'
'NO' | Set-Content -Path $abortInput -Encoding ASCII
$abort = Invoke-Bat -BatName 'remove-db.bat' -Arguments @('--no-pause') -StdinFile $abortInput
W ('remove-db.bat wrong confirmation exit=' + $abort.Code)
Assert-Equal 1 $abort.Code 'wrong typed confirmation aborts with exit 1'
Assert-Bool ($abort.Out -match 'Aborted') 'abort message is clear'
Assert-Equal $hashBefore (Get-TestSha256 $db) 'database unchanged after abort'
Assert-Equal $countBefore (Get-DbUserCount) 'user count unchanged after abort'

# Correct confirmation -> reset.
$confirmInput = Join-Path $data 'reset-input.txt'
'RESET' | Set-Content -Path $confirmInput -Encoding ASCII
$reset = Invoke-Bat -BatName 'remove-db.bat' -Arguments @('--no-pause') -StdinFile $confirmInput
W ('remove-db.bat RESET exit=' + $reset.Code)
W ($reset.Out.Trim())
Assert-Equal 0 $reset.Code 'typed RESET resets the system'
Assert-ScriptLog -ScriptName 'remove-db' -Since $started

$snapshots = @(Get-ChildItem (Join-Path $data 'backups') -Directory -Filter 'pre-reset-*' -ErrorAction SilentlyContinue)
Assert-Bool ($snapshots.Count -ge 1) 'safety snapshot data\backups\pre-reset-* created'
if ($snapshots.Count -ge 1) {
    Assert-Bool (Test-Path (Join-Path $snapshots[0].FullName 'fixngo.db')) 'safety snapshot contains a DB copy'
    Assert-Bool (Test-Path (Join-Path $snapshots[0].FullName 'manifest.json')) 'safety snapshot contains manifest.json'
}
$check = Invoke-Cli @('check-setup', '--json')
W ('check-setup after reset: exit=' + $check.Code)
Assert-Equal 10 $check.Code 'check-setup reports first run (exit 10) after reset'
Assert-Bool (-not (Test-Path $db)) 'live DB deleted'
Assert-Bool (-not (Test-Path (Join-Path $data 'state.json'))) 'state.json deleted'
Assert-Bool (-not (Test-Path (Join-Path $data 'secrets.json'))) 'secrets.json deleted'
Assert-Bool (Test-Path (Join-Path $data 'backups')) 'data\backups preserved'

# start.bat after reset must trigger first-run setup again.
$proc = Start-BatBackground -BatName 'start.bat' -Arguments @('--no-browser', '--no-pause') -DataDir $data
try {
    Assert-Bool (Wait-Health -Port $port -TimeoutSec 75) 'start.bat after reset reaches /health (setup re-triggered)'
    Assert-Equal 1 (Get-DbUserCount) 'exactly one admin exists after re-setup'
    Assert-Equal 0 (Invoke-Cli @('check-setup', '--json')).Code 'check-setup reports set up after re-setup'
}
finally {
    Stop-BatBackground -Process $proc -DataDir $data -Port $port
}

Complete-Harness -FileName 'S7-remove-db-typed'
