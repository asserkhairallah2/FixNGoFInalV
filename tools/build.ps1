<#
.SYNOPSIS
Publishes the ASP.NET Core 8 MVC Web app + CLI to app/ and compiles UI assets into wwwroot/assets.
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
$webBundle = Join-Path $root 'app\web\wwwroot\assets\fixngo-app.js'

if ($IfNeeded) {
    $needsBuild = $false
    if (-not ((Test-Path $cliDll) -and (Test-Path $webDll) -and (Test-Path $webBundle))) {
        $needsBuild = $true
    }
    else {
        $outTimes = @((Get-Item $cliDll).LastWriteTimeUtc, (Get-Item $webDll).LastWriteTimeUtc, (Get-Item $webBundle).LastWriteTimeUtc)
        $oldestOut = ($outTimes | Measure-Object -Minimum).Minimum
        $srcFiles = @()
        $srcFiles += Get-ChildItem -Path (Join-Path $root 'src') -Recurse -File -Include '*.cs','*.cshtml','*.csproj','*.json' -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\(bin|obj|wwwroot)\\' }
        $srcFiles += Get-ChildItem -Path (Join-Path $root 'client\src') -Recurse -File -ErrorAction SilentlyContinue
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

# 1. Client asset bundle build (JS/CSS only; HTML is rendered by ASP.NET Core MVC Razor Views)
if (-not $SkipClient) {
    if (-not (Test-Path "$root\client\node_modules")) {
        Write-Step 'Installing client dependencies…'
        Push-Location "$root\client"
        npm install --no-audit --no-fund
        Pop-Location
    }
    Write-Step 'Compiling UI asset bundle into src/FixNGo.Web/wwwroot/assets…'
    Push-Location "$root\client"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Asset bundle build failed (exit $LASTEXITCODE)." }
    Pop-Location
}

# 2. Publish ASP.NET Core 8 MVC Web + CLI to app/
Write-Step 'Publishing ASP.NET Core 8 MVC Web + CLI to app/…'
dotnet publish "$root\src\FixNGo.Web\FixNGo.Web.csproj" -c Release -o "$root\app\web" --nologo
if ($LASTEXITCODE -ne 0) { throw "Web publish failed." }
dotnet publish "$root\src\FixNGo.Cli\FixNGo.Cli.csproj" -c Release -o "$root\app" --nologo
if ($LASTEXITCODE -ne 0) { throw "CLI publish failed." }

# Ensure built wwwroot/assets are synced into app/web/wwwroot (no index.html)
$srcWwwroot = Join-Path $root 'src\FixNGo.Web\wwwroot'
$appWwwroot = Join-Path $root 'app\web\wwwroot'
if (Test-Path (Join-Path $appWwwroot 'index.html')) {
    Remove-Item (Join-Path $appWwwroot 'index.html') -Force -ErrorAction SilentlyContinue
}
if (Test-Path $srcWwwroot) {
    New-Item -ItemType Directory -Force -Path $appWwwroot | Out-Null
    Copy-Item -Path (Join-Path $srcWwwroot '*') -Destination $appWwwroot -Recurse -Force
}
$now = (Get-Date).ToUniversalTime()
foreach ($f in @($cliDll, $webDll, $webBundle)) {
    if (Test-Path $f) { (Get-Item $f).LastWriteTimeUtc = $now }
}

Write-Step 'Build complete.'
