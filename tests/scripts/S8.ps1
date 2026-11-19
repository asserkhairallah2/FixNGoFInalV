#requires -Version 5.1
<#
S8 - remove-db.bat while in dummy mode:
refused unless --force-dummy; the real-data backup is preserved either way.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S8' -Title 'remove-db.bat in dummy mode -> refused without --force-dummy; real backup preserved'

$data = New-TempDataDir 's8'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

Assert-Equal 0 (Invoke-Cli @('setup', '--non-interactive')).Code 'CLI setup created the original admin'
Assert-Equal 0 (Invoke-Bat -BatName 'dummy-db.bat' -Arguments @('--yes', '--no-pause')).Code 'dummy mode enabled'

$realBackup = Get-ChildItem (Join-Path $data 'backups') -Directory -Filter 'real-*' | Select-Object -First 1
Assert-Bool ($null -ne $realBackup) 'real-data backup exists before reset attempt'
$backupHash = ''
if ($realBackup) { $backupHash = Get-TestSha256 (Join-Path $realBackup.FullName 'fixngo.db') }
$db = Join-Path $data 'fixngo.db'
$hashDummy = Get-TestSha256 $db

$refused = Invoke-Bat -BatName 'remove-db.bat' -Arguments @('--yes', '--no-pause')
W ('remove-db.bat in dummy mode exit=' + $refused.Code)
W ($refused.Out.Trim())
Assert-Equal 2 $refused.Code 'remove-db.bat refuses in dummy mode with exit 2'
Assert-Bool ($refused.Out -match 'restore-db.bat') 'refusal gives restore-db.bat guidance'
Assert-Equal $hashDummy (Get-TestSha256 $db) 'dummy DB unchanged after refusal'
Assert-Equal 201 (Get-DbUserCount) 'dummy users still present after refusal'
Assert-Bool (Test-Path (Join-Path $script:HarnessRoot 'dummy-db.md')) 'dummy-db.md still present after refusal'
if ($realBackup) {
    Assert-Bool (Test-Path $realBackup.FullName) 'real backup directory still present after refusal'
    Assert-Equal $backupHash (Get-TestSha256 (Join-Path $realBackup.FullName 'fixngo.db')) 'real backup bytes unchanged after refusal'
}

$forced = Invoke-Bat -BatName 'remove-db.bat' -Arguments @('--yes', '--force-dummy', '--no-pause')
W ('remove-db.bat --force-dummy exit=' + $forced.Code)
Assert-Equal 0 $forced.Code '--force-dummy allows reset from dummy mode'
Assert-Equal 10 (Invoke-Cli @('check-setup', '--json')).Code 'forced reset returns to first run'
Assert-Bool (-not (Test-Path $db)) 'dummy DB deleted by forced reset'
Assert-Bool (-not (Test-Path (Join-Path $script:HarnessRoot 'dummy-db.md'))) 'orphaned dummy-db.md deleted by forced reset'
if ($realBackup) {
    Assert-Bool (Test-Path $realBackup.FullName) 'forced reset preserves data\backups\real-*'
    Assert-Equal $backupHash (Get-TestSha256 (Join-Path $realBackup.FullName 'fixngo.db')) 'preserved real backup bytes unchanged'
}
Assert-ScriptLog -ScriptName 'remove-db' -Since $started

Complete-Harness -FileName 'S8-remove-dummy-mode'
