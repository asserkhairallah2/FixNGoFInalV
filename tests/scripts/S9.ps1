#requires -Version 5.1
<#
S9 - dummy generation failure injection:
FIXNGO_DUMMY_FAIL=1 makes the generator fail after the real backup was made;
the CLI must roll back automatically and exit 3.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S9' -Title 'dummy generation failure injection -> automatic rollback to real DB, exit 3'

$data = New-TempDataDir 's9'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

Assert-Equal 0 (Invoke-Cli @('setup', '--non-interactive')).Code 'CLI setup created the original admin'
$db = Join-Path $data 'fixngo.db'
$hashOriginal = Get-TestSha256 $db
$countOriginal = Get-DbUserCount
W ('Original DB SHA-256: ' + $hashOriginal)

$env:FIXNGO_DUMMY_FAIL = '1'
try {
    $run = Invoke-Bat -BatName 'dummy-db.bat' -Arguments @('--yes', '--no-pause')
    W ('dummy-db.bat with injected failure exit=' + $run.Code)
    W ($run.Out.Trim())
    Assert-Equal 3 $run.Code 'injected failure returns exit code 3'
    Assert-Bool ($run.Out -match 'Dummy generation failed') 'failure is reported clearly'
    Assert-Bool ($run.Out -match 'Automatic rollback') 'automatic rollback is reported'
}
finally {
    Remove-Item -Path 'env:FIXNGO_DUMMY_FAIL' -ErrorAction SilentlyContinue
}

Assert-Equal $hashOriginal (Get-TestSha256 $db) 'live DB rolled back byte-for-byte (SHA-256)'
Assert-Equal $countOriginal (Get-DbUserCount) 'original user count restored'
$status = Invoke-Cli @('db-status', '--json')
if ($status.Out -match '"mode"\s*:\s*"(\w+)"') { Assert-Equal 'real' $Matches[1] 'state mode remains real after rollback' }
Assert-Bool (-not (Test-Path (Join-Path $script:HarnessRoot 'dummy-db.md'))) 'no dummy-db.md left behind by failed run'
Assert-Equal 0 (Invoke-Cli @('check-setup', '--json')).Code 'original admin account is still present'
$pending = @(Get-ChildItem (Join-Path $data 'backups') -Directory -Filter 'real-*' -ErrorAction SilentlyContinue)
Assert-Equal 0 $pending.Count 'rolled-back backup moved out of the active real-* set'
Assert-Bool (Test-Path (Join-Path $data 'backups\archive')) 'rolled-back backup retained under backups\archive'
Assert-ScriptLog -ScriptName 'dummy-db' -Since $started

Complete-Harness -FileName 'S9-dummy-failure-rollback'
