#requires -Version 5.1
<#
S5 - dummy-db.bat twice: the second invocation is refused with exit code 2
and neither data nor backups change.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S5' -Title 'dummy-db.bat twice -> second run refused (exit 2)'

$data = New-TempDataDir 's5'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

Assert-Equal 0 (Invoke-Cli @('setup', '--non-interactive')).Code 'CLI setup created the original admin'

$first = Invoke-Bat -BatName 'dummy-db.bat' -Arguments @('--yes', '--no-pause')
W ('dummy-db.bat (first) exit=' + $first.Code)
Assert-Equal 0 $first.Code 'first dummy-db.bat succeeds'
$hashBefore = Get-TestSha256 (Join-Path $data 'fixngo.db')
$countBefore = Get-DbUserCount
$backupCountBefore = @(Get-ChildItem (Join-Path $data 'backups') -Directory -Filter 'real-*' -ErrorAction SilentlyContinue).Count

$second = Invoke-Bat -BatName 'dummy-db.bat' -Arguments @('--yes', '--no-pause')
W ('dummy-db.bat (second) exit=' + $second.Code)
W ($second.Out.Trim())
Assert-Equal 2 $second.Code 'second dummy-db.bat refuses with exit 2'
Assert-Bool ($second.Out -match 'Already in dummy mode') 'refusal explains that restore-db.bat is needed'

Assert-Equal $hashBefore (Get-TestSha256 (Join-Path $data 'fixngo.db')) 'database bytes unchanged by refused second run'
Assert-Equal $countBefore (Get-DbUserCount) 'user count unchanged by refused second run'
Assert-Equal $backupCountBefore (@(Get-ChildItem (Join-Path $data 'backups') -Directory -Filter 'real-*' -ErrorAction SilentlyContinue).Count) `
    'no additional backup created by refused second run'
Assert-ScriptLog -ScriptName 'dummy-db' -Since $started

Complete-Harness -FileName 'S5-dummy-twice'
