#requires -Version 5.1
<#
S4 - dummy-db.bat:
verified backup + manifest, >= 200 users, dummy-db.md lists every user with a password,
every listed credential logs in, and /system/status reports dummy mode.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S4' -Title 'dummy-db.bat -> verified backup, >=200 users, all credentials log in, mode=dummy'

$data = New-TempDataDir 's4'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

$setup = Invoke-Cli @('setup', '--non-interactive')
Assert-Equal 0 $setup.Code 'CLI setup created the original admin'

$run = Invoke-Bat -BatName 'dummy-db.bat' -Arguments @('--yes', '--no-pause')
W ('dummy-db.bat exit=' + $run.Code)
W ($run.Out.Trim())
Assert-Equal 0 $run.Code 'dummy-db.bat succeeds with --yes'
Assert-ScriptLog -ScriptName 'dummy-db' -Since $started

$backupsRoot = Join-Path $data 'backups'
$backups = @(Get-ChildItem -Path $backupsRoot -Directory -Filter 'real-*' -ErrorAction SilentlyContinue)
Assert-Bool ($backups.Count -eq 1) 'exactly one data\backups\real-* backup folder exists'
$backup = $backups | Select-Object -First 1
if ($backup) {
    $manifestPath = Join-Path $backup.FullName 'manifest.json'
    Assert-Bool (Test-Path $manifestPath) 'backup contains manifest.json'
    Assert-Bool (Test-Path (Join-Path $backup.FullName 'fixngo.db')) 'backup contains the database copy'
    Assert-Bool (Test-Path (Join-Path $backup.FullName 'uploads')) 'backup contains the uploads folder'
    if (Test-Path $manifestPath) {
        $m = Get-Content $manifestPath -Raw | ConvertFrom-Json
        W ('manifest: users=' + $m.userCount + ' uploads=' + $m.uploadsFileCount + ' sha=' + $m.dbSha256)
        $actual = Get-TestSha256 (Join-Path $backup.FullName 'fixngo.db')
        Assert-Equal $m.dbSha256 $actual 'backup db SHA-256 matches manifest'
        Assert-Bool ($m.userCount -ge 1) 'manifest records the pre-dummy user count'
        Assert-Bool ($m.hadRealData -eq $true) 'manifest records hadRealData=true'
        Assert-Bool (-not [string]::IsNullOrWhiteSpace([string]$m.appVersion)) 'manifest records appVersion'
    }
}

$count = Get-DbUserCount
W ('dummy DB user count: ' + $count)
Assert-Bool ($count -ge 200) 'dummy database has at least 200 users'

$md = Join-Path $script:HarnessRoot 'dummy-db.md'
Assert-Bool (Test-Path $md) 'dummy-db.md generated at project root'
$accounts = @()
if (Test-Path $md) {
    $accounts = @(Get-DummyAccountsFromMarkdown -Path $md)
    Assert-Equal $count $accounts.Count 'dummy-db.md lists every user exactly once'
    Assert-Bool ((@($accounts | Where-Object { [string]::IsNullOrWhiteSpace($_.Password) })).Count -eq 0) `
        'every listed account has a password'
}

$proc = Start-WebServer -DataDir $data -Port $port
try {
    Assert-Bool (Wait-Health -Port $port -TimeoutSec 75) 'dummy server answers /health'
    $status = Get-EndpointJson -Port $port -Path '/api/v1/system/status'
    W ('system status: mode=' + $status.mode + ' setupComplete=' + $status.setupComplete)
    Assert-Equal 'dummy' $status.mode '/system/status reports mode=dummy (DUMMY DATA ribbon)'
    if ($accounts.Count -gt 0) { Assert-AllDummyCredentialsLogin -Port $port -Accounts $accounts }
}
finally {
    Stop-WebServer -Process $proc -DataDir $data -Port $port
}

Complete-Harness -FileName 'S4-dummy-db'
