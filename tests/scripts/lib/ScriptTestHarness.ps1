#requires -Version 5.1
<#
.SYNOPSIS
  Shared helpers for the S1-S10 script tests (brief 04 section 7).
.DESCRIPTION
  Every test uses an isolated FIXNGO_DATA_DIR / FIXNGO_LOG_DIR and a private port.
  The real project data\ folder is never used as a test target.
#>

$ErrorActionPreference = 'Stop'
$script:HarnessRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$script:HarnessEvidence = Join-Path $script:HarnessRoot 'docs\evidence\script-tests'

function W {
    param([string]$Line)
    $script:Transcript.Add($Line) | Out-Null
    Write-Host $Line
}

function Initialize-Harness {
    param([string]$Scenario, [string]$Title)
    $script:Scenario = $Scenario
    $script:Passed = 0
    $script:Failed = 0
    $script:Transcript = New-Object 'System.Collections.Generic.List[string]'
    New-Item -ItemType Directory -Force -Path $script:HarnessEvidence | Out-Null
    W "=== $Scenario : $Title ==="
    W ('Timestamp: ' + (Get-Date -Format o))
    W ('Project root: ' + $script:HarnessRoot)
    W 'Isolation: dedicated temp FIXNGO_DATA_DIR + FIXNGO_LOG_DIR + private port'
}

function Complete-Harness {
    param([string]$FileName)
    W ('--- ' + $script:Scenario + ' result: PASS=' + $script:Passed + ' FAIL=' + $script:Failed + ' ---')
    $path = Join-Path $script:HarnessEvidence ($FileName + '.txt')
    ($script:Transcript + '') | Set-Content -Path $path -Encoding UTF8
    W ('[SAVED] docs/evidence/script-tests/' + $FileName + '.txt')
    if ($script:Failed -gt 0) { exit 1 }
    exit 0
}

function Assert-Bool {
    param([bool]$Condition, [string]$Message)
    if ($Condition) { W ('[PASS] ' + $Message); $script:Passed++ }
    else { W ('[FAIL] ' + $Message); $script:Failed++ }
}

function Assert-Equal {
    param($Expected, $Actual, [string]$Message)
    $ok = ([string]$Expected -eq [string]$Actual)
    if ($ok) { W ('[PASS] ' + $Message + ' (value=' + $Actual + ')'); $script:Passed++ }
    else {
        W ('[FAIL] ' + $Message + ' (expected=' + $Expected + ' actual=' + $Actual + ')')
        $script:Failed++
    }
}

function New-TempDataDir {
    param([string]$Name, [switch]$WithSpaces)
    $leaf = if ($WithSpaces) { 'fixngo ' + $Name + ' path with spaces ' } else { 'fixngo-' + $Name + '-' }
    $leaf += [guid]::NewGuid().ToString('N').Substring(0, 8)
    $p = Join-Path ([IO.Path]::GetTempPath()) $leaf
    New-Item -ItemType Directory -Force -Path $p | Out-Null
    return $p
}

function New-Port {
    $rng = New-Object System.Random
    for ($i = 0; $i -lt 60; $i++) {
        $port = 5200 + $rng.Next(750)
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect('127.0.0.1', $port)
            $client.Close()
        }
        catch {
            $client.Close()
            return $port
        }
    }
    throw 'Could not allocate a free test port.'
}

function Set-TestEnv {
    param([string]$DataDir, [int]$Port)
    $env:FIXNGO_DATA_DIR = $DataDir
    $env:FIXNGO_LOG_DIR = Join-Path $DataDir 'logs'
    $env:FIXNGO_PORT = [string]$Port
    New-Item -ItemType Directory -Force -Path $env:FIXNGO_LOG_DIR | Out-Null
}

function Set-SetupEnv {
    $env:FIXNGO_SETUP_NAME = 'Script Test Administrator'
    $env:FIXNGO_SETUP_EMAIL = 'scriptadmin@fixngo.local'
    $env:FIXNGO_SETUP_PHONE = '01000000042'
    $env:FIXNGO_SETUP_PASSWORD = 'Setup@2026'
    $env:FIXNGO_SETUP_SUPPORT_EMAIL = 'support@fixngo.local'
    $env:FIXNGO_SETUP_SIMULATORS = 'Y'
}

function Clear-SetupEnv {
    foreach ($k in @('FIXNGO_SETUP_NAME', 'FIXNGO_SETUP_EMAIL', 'FIXNGO_SETUP_PHONE',
                     'FIXNGO_SETUP_PASSWORD', 'FIXNGO_DUMMY_FAIL')) {
        Remove-Item -Path ('env:' + $k) -ErrorAction SilentlyContinue
    }
}

function Invoke-Cli {
    param([string[]]$Arguments)
    $dll = Join-Path $script:HarnessRoot 'app\FixNGo.Cli.dll'
    $out = & dotnet $dll @Arguments 2>&1 | Out-String
    $code = $LASTEXITCODE
    return @{ Out = $out; Code = $code }
}

function Invoke-Bat {
    param(
        [string]$BatName,
        [string[]]$Arguments = @(),
        [string]$StdinFile = '',
        [string]$WorkingDirectory = '',
        [int]$TimeoutSec = 180
    )
    $bat = Join-Path $script:HarnessRoot $BatName
    $inner = '"' + $bat + '"'
    foreach ($a in $Arguments) { $inner += ' ' + $a }
    $argLine = '/d /s /c "' + $inner + '"'

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = $argLine
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    if ($WorkingDirectory) { $psi.WorkingDirectory = $WorkingDirectory }

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    if ($StdinFile -and (Test-Path $StdinFile)) {
        $proc.StandardInput.Write([IO.File]::ReadAllText($StdinFile))
    }
    $proc.StandardInput.Close()
    $outTask = $proc.StandardOutput.ReadToEndAsync()
    $errTask = $proc.StandardError.ReadToEndAsync()
    if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
        try { $proc.Kill() } catch { }
        throw ('Timed out after ' + $TimeoutSec + 's: ' + $BatName)
    }
    $out = $outTask.Result
    $err = $errTask.Result
    $code = $proc.ExitCode
    $proc.Dispose()
    return @{ Out = ($out + $err); Code = $code }
}

function Start-BatBackground {
    param([string]$BatName, [string[]]$Arguments = @(), [string]$DataDir)
    $bat = Join-Path $script:HarnessRoot $BatName
    $inner = '"' + $bat + '"'
    foreach ($a in $Arguments) { $inner += ' ' + $a }
    $argLine = '/d /s /c "' + $inner + '"'
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = $argLine
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $null = $proc.StandardOutput.ReadToEndAsync()
    $null = $proc.StandardError.ReadToEndAsync()
    return $proc
}

function Stop-BatBackground {
    param($Process, [string]$DataDir, [int]$Port = 0)
    Stop-ProcessTree -Process $Process
    if ($Port -gt 0) { Stop-PortListener -Port $Port }
    if ($Process) { $Process.Dispose() }
}

function Start-WebServer {
    param([string]$DataDir, [int]$Port)
    $webDir = Join-Path $script:HarnessRoot 'app\web'
    $webDll = Join-Path $webDir 'FixNGo.Web.dll'

    # Launch dotnet directly so the harness owns the exact PID to stop. A PowerShell
    # launcher process would leave an orphaned web server holding inherited pipes.
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'dotnet'
    $psi.Arguments = '"' + $webDll + '"'
    $psi.WorkingDirectory = $webDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.EnvironmentVariables['FIXNGO_DATA_DIR'] = $DataDir
    $psi.EnvironmentVariables['FIXNGO_LOG_DIR'] = (Join-Path $DataDir 'logs')
    $psi.EnvironmentVariables['FIXNGO_PORT'] = [string]$Port
    $psi.EnvironmentVariables['ASPNETCORE_URLS'] = ('http://localhost:' + $Port)
    $psi.EnvironmentVariables['ASPNETCORE_ENVIRONMENT'] = 'Production'

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    # Drain streams so the child never blocks on a full pipe.
    $nullTask = $proc.StandardOutput.ReadToEndAsync()
    $errTask = $proc.StandardError.ReadToEndAsync()
    return $proc
}

function Stop-PortListener {
    param([int]$Port)
    # Kill only the process listening on our private test port. This avoids touching
    # web servers started by other agents in the same workspace.
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
    catch {
        $lines = netstat -ano 2>$null | Select-String (':' + $Port + '\s+.*LISTENING')
        foreach ($line in $lines) {
            $id = [regex]::Match($line.ToString(), '(\d+)\s*$').Groups[1].Value
            if ($id) { Stop-Process -Id ([int]$id) -Force -ErrorAction SilentlyContinue }
        }
    }
}

function Stop-ProcessTree {
    param($Process)
    if (-not $Process) { return }
    try {
        $children = Get-CimInstance Win32_Process -Filter ('ParentProcessId=' + $Process.Id) -ErrorAction SilentlyContinue
        foreach ($child in $children) { Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue }
    }
    catch { }
    if (-not $Process.HasExited) { try { $Process.Kill() } catch { } }
}

function Stop-WebServer {
    param($Process, [string]$DataDir, [int]$Port = 0)
    Stop-ProcessTree -Process $Process
    if ($Port -gt 0) { Stop-PortListener -Port $Port }
    if ($Process) { $Process.Dispose() }
}

function Wait-Health {
    param([int]$Port, [int]$TimeoutSec = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $req = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:' + $Port + '/health')
            $req.Timeout = 1500
            $req.ReadWriteTimeout = 1500
            $req.Proxy = $null
            $req.Method = 'GET'
            $resp = $req.GetResponse()
            $ok = ([int]$resp.StatusCode -eq 200)
            $resp.Close()
            if ($ok) { return $true }
        }
        catch { }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

function Invoke-Login {
    param([int]$Port, [string]$Email, [string]$Password)
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($body)
    try {
        $req = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:' + $Port + '/api/v1/auth/login')
        $req.Method = 'POST'
        $req.ContentType = 'application/json'
        $req.ContentLength = $bytes.Length
        $req.Timeout = 10000
        $req.ReadWriteTimeout = 10000
        $req.Proxy = $null
        $stream = $req.GetRequestStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Close()
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        $reader = New-Object IO.StreamReader($resp.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Close()
        $resp.Close()
        return @{ Code = $code; Json = ($content | ConvertFrom-Json) }
    }
    catch [System.Net.WebException] {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return @{ Code = $code; Json = $null; Error = $_.Exception.Message }
    }
    catch {
        return @{ Code = 0; Json = $null; Error = $_.Exception.Message }
    }
}

function Get-DbUserCount {
    $r = Invoke-Cli @('db-status', '--json')
    if ($r.Code -eq 0) {
        try { return [int](($r.Out | ConvertFrom-Json).userCount) } catch { return -1 }
    }
    return -1
}

function Get-TestSha256 {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return '' }
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
}

function Get-ScriptLog {
    param([string]$ScriptName, [datetime]$Since, [string]$LogDir = '')
    if (-not $LogDir) { $LogDir = $env:FIXNGO_LOG_DIR }
    $dir = Join-Path $LogDir 'scripts'
    if (-not (Test-Path $dir)) { return $null }
    return Get-ChildItem -Path $dir -Filter ($ScriptName + '-*.log') |
        Where-Object { $_.LastWriteTime -ge $Since.AddSeconds(-3) } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

function Assert-ScriptLog {
    param([string]$ScriptName, [datetime]$Since, [string]$LogDir = '')
    $f = Get-ScriptLog -ScriptName $ScriptName -Since $Since -LogDir $LogDir
    $found = ($null -ne $f)
    Assert-Bool $found ($ScriptName + '.log created in isolated log dir')
    if ($found) {
        $text = [IO.File]::ReadAllText($f.FullName)
        Assert-Bool ($text.Trim().Length -gt 0) ($ScriptName + '.log is non-empty')
        Assert-Bool ($text -notmatch 'Setup@2026|Owner@\d|Admin@\d|Mech@\d|Tow@\d|Center@\d') `
            ($ScriptName + '.log contains no plaintext passwords')
    }
}

function Get-DummyAccountsFromMarkdown {
    param([string]$Path)
    $accounts = New-Object 'System.Collections.Generic.List[object]'
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        if ($line -notmatch '^\|\s*\d+\s*\|') { continue }
        $parts = $line -split '\|'
        if ($parts.Count -lt 10) { continue }
        $email = $parts[3].Trim()
        if ($email -notlike '*@dummy.fixngo.test') { continue }
        $password = $parts[8].Trim().Trim('`')
        $accounts.Add([pscustomobject]@{
            Email = $email
            Password = $password
            Role = $parts[5].Trim()
            Status = $parts[6].Trim()
        })
    }
    return $accounts
}

function Assert-AllDummyCredentialsLogin {
    param([int]$Port, $Accounts)
    $failed = @()
    $byRole = @{}
    foreach ($a in $Accounts) {
        if (-not $byRole.ContainsKey($a.Role)) { $byRole[$a.Role] = 0 }
        $r = Invoke-Login -Port $Port -Email $a.Email -Password $a.Password
        if ($r.Code -eq 200) { $byRole[$a.Role]++ }
        else { $failed += ($a.Email + ' -> HTTP ' + $r.Code) }
    }
    $roleSummary = ($byRole.GetEnumerator() | Sort-Object Name | ForEach-Object { $_.Name + '=' + $_.Value }) -join ', '
    W ('Login sweep: ' + $Accounts.Count + ' credentials; per-role successes: ' + $roleSummary)
    if ($failed.Count -gt 0) { W ('First failures: ' + (($failed | Select-Object -First 5) -join '; ')) }
    Assert-Bool ($Accounts.Count -ge 200) 'dummy-db.md lists at least 200 credentials'
    Assert-Bool ($failed.Count -eq 0) ('every listed dummy credential logged in (' + ($Accounts.Count - $failed.Count) + '/' + $Accounts.Count + ')')
    Assert-Bool ($byRole.Count -eq 5) 'all five roles are represented in the credential login sweep'
}

function Get-EndpointJson {
    param([int]$Port, [string]$Path)
    try {
        $req = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:' + $Port + $Path)
        $req.Timeout = 5000
        $req.ReadWriteTimeout = 5000
        $req.Proxy = $null
        $req.Method = 'GET'
        $resp = $req.GetResponse()
        $reader = New-Object IO.StreamReader($resp.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Close()
        $resp.Close()
        return ($content | ConvertFrom-Json)
    }
    catch { return $null }
}
