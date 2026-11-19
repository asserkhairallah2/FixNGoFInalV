#requires -Version 5.1
<#
S1 - start.bat on an empty data dir:
first run detected -> non-interactive setup -> server healthy -> exactly one admin.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S1' -Title 'start.bat on empty data dir -> first-run setup -> healthy server -> exactly 1 admin'

$data = New-TempDataDir 's1'
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir: $data"
W "Private port: $port"

$before = Invoke-Cli @('check-setup', '--json')
W ('check-setup before: exit=' + $before.Code + ' ' + $before.Out.Trim())
Assert-Equal 10 $before.Code 'check-setup reports first run (exit 10) before start.bat'

$proc = Start-BatBackground -BatName 'start.bat' -Arguments @('--no-browser', '--no-pause') -DataDir $data
try {
    $healthy = Wait-Health -Port $port -TimeoutSec 75
    Assert-Bool $healthy 'server answers /health after start.bat triggered first-run setup'

    # Verify B1 fix: start.bat serves the SPA HTML on GET / (never 404)
    $spaOk = $false
    try {
        $req = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:' + $port + '/')
        $req.Timeout = 5000
        $req.Proxy = $null
        $resp = $req.GetResponse()
        $reader = New-Object IO.StreamReader($resp.GetResponseStream())
        $html = $reader.ReadToEnd()
        $reader.Close()
        $code = [int]$resp.StatusCode
        $resp.Close()
        $spaOk = ($code -eq 200 -and $html -match 'id="root"')
    }
    catch { $spaOk = $false }
    Assert-Bool $spaOk 'start.bat serves the SPA index.html (HTTP 200 with #root) on GET /'

    $after = Invoke-Cli @('check-setup', '--json')
    W ('check-setup after: exit=' + $after.Code + ' ' + $after.Out.Trim())
    Assert-Equal 0 $after.Code 'check-setup reports set up (exit 0) after start.bat'
    $count = Get-DbUserCount
    Assert-Equal 1 $count 'exactly one user (the first admin) exists'

    $portFile = Join-Path $data 'server.port'
    Assert-Bool (Test-Path $portFile) 'server.port written to the temp FIXNGO_DATA_DIR (not the real data folder)'
    if (Test-Path $portFile) { Assert-Equal $port ((Get-Content $portFile -Raw).Trim()) 'server.port contains the private test port' }

    $pidFile = Join-Path $data 'server.pid'
    $pidOk = $false
    for ($i = 0; $i -lt 40; $i++) {
        if (Test-Path $pidFile) { $pidOk = $true; break }
        Start-Sleep -Milliseconds 250
    }
    Assert-Bool $pidOk 'server.pid written to the temp FIXNGO_DATA_DIR'

    Assert-ScriptLog -ScriptName 'start' -Since $started
    Assert-ScriptLog -ScriptName 'setup' -Since $started
}
finally {
    Stop-BatBackground -Process $proc -DataDir $data -Port $port
}

Complete-Harness -FileName 'S1-start-first-run'
