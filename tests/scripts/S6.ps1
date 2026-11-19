#requires -Version 5.1
<#
S6 - restore-db.bat: DB byte-identical (SHA-256) to the pre-dummy DB, original user count,
dummy-db.md removed, original admin logs in, used backup archived.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S6' -Title 'restore-db.bat -> byte-identical restore, original admin login, backup archived'

$data = New-TempDataDir 's6'
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

Assert-Equal 0 (Invoke-Bat -BatName 'dummy-db.bat' -Arguments @('--yes', '--no-pause')).Code 'dummy-db.bat created the sandbox'
$md = Join-Path $script:HarnessRoot 'dummy-db.md'
Assert-Bool (Test-Path $md) 'dummy-db.md exists while in dummy mode'

$restore = Invoke-Bat -BatName 'restore-db.bat' -Arguments @('--yes', '--no-pause')
W ('restore-db.bat exit=' + $restore.Code)
W ($restore.Out.Trim())
Assert-Equal 0 $restore.Code 'restore-db.bat succeeds with --yes'
Assert-ScriptLog -ScriptName 'restore-db' -Since $started

Assert-Equal $hashOriginal (Get-TestSha256 $db) 'restored DB is byte-identical (SHA-256) to the pre-dummy DB'
Assert-Equal $countOriginal (Get-DbUserCount) 'restored user count equals the original'
Assert-Bool (-not (Test-Path $md)) 'dummy-db.md deleted by restore'
$status = Invoke-Cli @('db-status', '--json')
if ($status.Out -match '"mode"\s*:\s*"(\w+)"') { Assert-Equal 'real' $Matches[1] 'state mode is real after restore' }

$archive = Join-Path $data 'backups\archive'
$archived = @(Get-ChildItem -Path $archive -Directory -Filter 'restored-*' -ErrorAction SilentlyContinue)
Assert-Bool ($archived.Count -ge 1) 'used backup moved to backups\archive\restored-*'

$proc = Start-WebServer -DataDir $data -Port $port
try {
    Assert-Bool (Wait-Health -Port $port -TimeoutSec 75) 'restored server answers /health'
    $login = Invoke-Login -Port $port -Email $env:FIXNGO_SETUP_EMAIL -Password $env:FIXNGO_SETUP_PASSWORD
    W ('original admin login: HTTP ' + $login.Code)
    Assert-Equal 200 $login.Code 'original admin still logs in after restore'
    $sys = Get-EndpointJson -Port $port -Path '/api/v1/system/status'
    if ($sys) { Assert-Equal 'real' $sys.mode '/system/status reports mode=real after restore' }
}
finally {
    Stop-WebServer -Process $proc -DataDir $data -Port $port
}

Complete-Harness -FileName 'S6-restore-db'
