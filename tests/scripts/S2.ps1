#requires -Version 5.1
<#
S2 - setup.bat when the system is already set up:
must refuse with exit code 2 and change nothing.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S2' -Title 'setup.bat when already set up -> exit 2, no changes'

$data = New-TempDataDir 's2'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

$first = Invoke-Bat -BatName 'setup.bat' -Arguments @('--non-interactive', '--no-pause')
W ('setup.bat (first run) exit=' + $first.Code)
W ($first.Out.Trim())
Assert-Equal 0 $first.Code 'first setup.bat succeeds'
$db = Join-Path $data 'fixngo.db'
$hashBefore = Get-TestSha256 $db
$countBefore = Get-DbUserCount
Assert-Equal 1 $countBefore 'one admin exists after first setup'

$second = Invoke-Bat -BatName 'setup.bat' -Arguments @('--non-interactive', '--no-pause')
W ('setup.bat (second run) exit=' + $second.Code)
W ($second.Out.Trim())
Assert-Equal 2 $second.Code 'second setup.bat refuses with exit 2'
Assert-Bool ($second.Out -match 'already has accounts') 'refusal message is clear'

Assert-Equal $hashBefore (Get-TestSha256 $db) 'database bytes unchanged by refused setup'
Assert-Equal $countBefore (Get-DbUserCount) 'user count unchanged by refused setup'
Assert-ScriptLog -ScriptName 'setup' -Since $started

Complete-Harness -FileName 'S2-setup-already-set-up'
