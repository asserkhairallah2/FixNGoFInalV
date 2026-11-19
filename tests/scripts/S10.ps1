#requires -Version 5.1
<#
S10 - paths containing spaces and execution from another working directory:
all five tools still work; the real project data\ folder is untouched.
#>
. (Join-Path $PSScriptRoot 'lib\ScriptTestHarness.ps1')

Initialize-Harness -Scenario 'S10' -Title 'paths with spaces / run from another cwd -> all tools work'

$data = New-TempDataDir 's10' -WithSpaces
$otherCwd = New-TempDataDir 's10-cwd' -WithSpaces
$port = New-Port
$started = Get-Date
Set-TestEnv -DataDir $data -Port $port
Set-SetupEnv
W "Temp data dir (with spaces): $data"
W "Alternate cwd (with spaces): $otherCwd"
W "Private port: $port"

$realDb = Join-Path $script:HarnessRoot 'data\fixngo.db'
$realHashBefore = Get-TestSha256 $realDb
$realFilesBefore = if (Test-Path (Join-Path $script:HarnessRoot 'data')) {
    (Get-ChildItem (Join-Path $script:HarnessRoot 'data') -Recurse -File | Select-Object -ExpandProperty FullName) -join '|'
} else { '' }

$setup = Invoke-Bat -BatName 'setup.bat' -Arguments @('--non-interactive', '--no-pause') -WorkingDirectory $otherCwd
W ('setup.bat from other cwd exit=' + $setup.Code)
Assert-Equal 0 $setup.Code 'setup.bat works from another cwd with spaces'
Assert-Bool ($data -like '* *') 'test data path actually contains spaces'

$dll = Join-Path $script:HarnessRoot 'app\FixNGo.Cli.dll'
Push-Location $otherCwd
try { $cliOut = & dotnet $dll db-status --json 2>&1 | Out-String; $cliCode = $LASTEXITCODE }
finally { Pop-Location }
W ('CLI db-status from other cwd: exit=' + $cliCode + ' ' + $cliOut.Trim())
Assert-Equal 0 $cliCode 'CLI works from another cwd'
$pathMatch = [regex]::Match($cliOut, '"dbPath"\s*:\s*"([^"]+)"')
$reportedPath = ''
if ($pathMatch.Success) { $reportedPath = $pathMatch.Groups[1].Value -replace '\\\\', '\' }
Assert-Bool ($reportedPath -eq (Join-Path $data 'fixngo.db')) 'CLI reports the spaced temp data dir'
Assert-Equal 1 (Get-DbUserCount) 'one admin created in the spaced data dir'

foreach ($pair in @(
    @{ Bat = 'dummy-db.bat'; Args = @('--yes', '--no-pause'); Expected = 0; Name = 'dummy-db.bat' },
    @{ Bat = 'restore-db.bat'; Args = @('--yes', '--no-pause'); Expected = 0; Name = 'restore-db.bat' },
    @{ Bat = 'remove-db.bat'; Args = @('--yes', '--no-pause'); Expected = 0; Name = 'remove-db.bat' }
)) {
    $r = Invoke-Bat -BatName $pair.Bat -Arguments $pair.Args -WorkingDirectory $otherCwd
    W ($pair.Name + ' from other cwd exit=' + $r.Code)
    Assert-Equal $pair.Expected ($r.Code) ($pair.Name + ' works from another cwd with spaces')
}
Assert-Equal 10 (Invoke-Cli @('check-setup', '--json')).Code 'final state is first run'

foreach ($name in @('setup', 'dummy-db', 'restore-db', 'remove-db')) {
    Assert-ScriptLog -ScriptName $name -Since $started
}

$realFilesAfter = if (Test-Path (Join-Path $script:HarnessRoot 'data')) {
    (Get-ChildItem (Join-Path $script:HarnessRoot 'data') -Recurse -File | Select-Object -ExpandProperty FullName) -join '|'
} else { '' }
Assert-Equal $realFilesBefore $realFilesAfter 'real project data\ folder file list unchanged'
Assert-Equal $realHashBefore (Get-TestSha256 $realDb) 'real project database hash unchanged'

Complete-Harness -FileName 'S10-paths-with-spaces'
