<#
.SYNOPSIS
Publishes the Web API + CLI to app/ and builds the React client into wwwroot.
#>
[CmdletBinding()]
param(
    [switch]$SkipClient,
    [switch]$Configuration,
    [switch]$IfNeeded
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($msg) { Write-Host "[BUILD] $msg" -ForegroundColor Cyan }

$cliDll = Join-Path $root 'app\FixNGo.Cli.dll'
$webDll = Join-Path $root 'app\web\FixNGo.Web.dll'
$webIndex = Join-Path $root 'app\web\wwwroot\index.html'

if ($IfNeeded) {
    $needsBuild = $false
    if (-not ((Test-Path $cliDll) -and (Test-Path $webDll) -and (Test-Path $webIndex))) {
        $needsBuild = $true
    }
    else {
        $outTimes = @((Get-Item $cliDll).LastWriteTimeUtc, (Get-Item $webDll).LastWriteTimeUtc, (Get-Item $webIndex).LastWriteTimeUtc)
        $oldestOut = ($outTimes | Measure-Object -Minimum).Minimum
        $srcFiles = @()
        $srcFiles += Get-ChildItem -Path (Join-Path $root 'src') -Recurse -File -Include '*.cs','*.csproj','*.json' -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\(bin|obj|wwwroot)\\' }
        $srcFiles += Get-ChildItem -Path (Join-Path $root 'client\src') -Recurse -File -ErrorAction SilentlyContinue
        if (Test-Path (Join-Path $root 'client\index.html')) {
            $srcFiles += Get-Item (Join-Path $root 'client\index.html')
        }
        if ($srcFiles.Count -gt 0) {
            $newestSrc = ($srcFiles | Measure-Object -Property LastWriteTimeUtc -Maximum).Maximum
            if ($newestSrc -gt $oldestOut) {
                $needsBuild = $true
            }
        }
    }
    if (-not $needsBuild) {
        exit 0
    }
    Write-Step 'Sources are newer than app/ (or app/ is missing) -> rebuilding...'
}

# 1. Client build
if (-not $SkipClient) {
    if (-not (Test-Path "$root\client\node_modules")) {
        Write-Step 'Installing client dependencies (npm ci)…'
        Push-Location "$root\client"
        npm install --no-audit --no-fund
        Pop-Location
    }
    Write-Step 'Building React client…'
    Push-Location "$root\client"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Client build failed (exit $LASTEXITCODE)." }
    Pop-Location
}

# 2. Publish Web + CLI to app/
Write-Step 'Publishing Web API + CLI to app/…'
dotnet publish "$root\src\FixNGo.Web\FixNGo.Web.csproj" -c Release -o "$root\app\web" --nologo
if ($LASTEXITCODE -ne 0) { throw "Web publish failed." }
dotnet publish "$root\src\FixNGo.Cli\FixNGo.Cli.csproj" -c Release -o "$root\app" --nologo
if ($LASTEXITCODE -ne 0) { throw "CLI publish failed." }

# Ensure built SPA assets are synced into app/web/wwwroot and touch timestamps
$srcWwwroot = Join-Path $root 'src\FixNGo.Web\wwwroot'
$appWwwroot = Join-Path $root 'app\web\wwwroot'
if (Test-Path $srcWwwroot) {
    New-Item -ItemType Directory -Force -Path $appWwwroot | Out-Null
    Copy-Item -Path (Join-Path $srcWwwroot '*') -Destination $appWwwroot -Recurse -Force
}
$now = (Get-Date).ToUniversalTime()
foreach ($f in @($cliDll, $webDll, $webIndex)) {
    if (Test-Path $f) { (Get-Item $f).LastWriteTimeUtc = $now }
}

Write-Step 'Build complete.'
