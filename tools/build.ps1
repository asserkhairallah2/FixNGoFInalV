<#
.SYNOPSIS
Publishes the Web API + CLI to app/ and builds the React client into wwwroot.
#>
[CmdletBinding()]
param(
    [switch]$SkipClient,
    [switch]$Configuration
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($msg) { Write-Host "[BUILD] $msg" -ForegroundColor Cyan }

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

Write-Step 'Build complete.'
