#requires -Version 5.1
<#
S3 - admin login through the real API using the setup credentials:
correct password -> 200 Admin; wrong password -> 401.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S3' -Title 'admin login via API with setup credentials -> 200 Admin; wrong password -> 401'

$data = New-TempDataDir 's3'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

$setup = Invoke-Cli @('setup', '--non-interactive')
W ('CLI setup exit=' + $setup.Code + ' ' + $setup.Out.Trim())
Assert-Equal 0 $setup.Code 'CLI setup created the admin'

$proc = Start-WebServer -DataDir $data -Port $port
try {
    Assert-Bool (Wait-Health -Port $port -TimeoutSec 75) 'server answers /health'

    $ok = Invoke-Login -Port $port -Email $env:FIXNGO_SETUP_EMAIL -Password $env:FIXNGO_SETUP_PASSWORD
    if ($ok.Json) {
        W ('correct login: HTTP ' + $ok.Code + ', role=' + $ok.Json.user.role + ', tokenLen=' + $ok.Json.accessToken.Length)
    }
    Assert-Equal 200 $ok.Code 'correct credentials return HTTP 200'
    if ($ok.Json) {
        Assert-Equal 'Admin' $ok.Json.user.role 'logged-in user has role Admin'
        Assert-Bool ($ok.Json.accessToken.Length -gt 20) 'access token issued'
    }

    $bad = Invoke-Login -Port $port -Email $env:FIXNGO_SETUP_EMAIL -Password 'Wrong@123'
    W ('wrong-password login: HTTP ' + $bad.Code)
    Assert-Equal 401 $bad.Code 'wrong password returns HTTP 401'

    $serverLog = Get-ChildItem -Path $env:FIXNGO_LOG_DIR -Filter 'server-*.log' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-3) } | Select-Object -First 1
    Assert-Bool ($null -ne $serverLog) 'Serilog server log created in temp FIXNGO_LOG_DIR'
}
finally {
    Stop-WebServer -Process $proc -DataDir $data -Port $port
}

Complete-Harness -FileName 'S3-admin-login'
