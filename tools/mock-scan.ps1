<#
.SYNOPSIS
  Fails if forbidden prototype mock literals or code-smell markers remain in product code.
.DESCRIPTION
  Scans client/src, src/**, built wwwroot, and (optionally) a rendered-DOM text dump for the
  forbidden literal list from brief 06 section 6. Also scans non-simulator production code for
  TODO/FIXME/lorem/placeholder-data/fake. Writes a report to docs/evidence/test-output/mock-scan.txt.
  Usage: mock-scan.ps1 [-DomDump <path>] [-ReportPath <path>]
#>
param(
    [string]$DomDump,
    [string]$ReportPath = "docs/evidence/test-output/mock-scan.txt"
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

# Forbidden prototype persona / hard-coded literals (brief 06 section 6).
$forbidden = @(
    'Ahmed Mohamed', 'ahmed.mohamed', 'Karim Mostafa', 'Mahmoud Hassan', 'Nile Auto Care',
    'Nour El-Sayed', 'Omar Adel', 'Salma Nabil', 'Cairo Motor Clinic', 'Hany Samir',
    '@fixngo.eg', 'Password@123', 'Admin@123', 'FG-2606', 'MR-2611', 'BK-2048', 'KYC-1042',
    'SR-108', 'WO-3102', 'SUP-2041', 'WD-2606', 'INV-2026-2606', '12,482', '248.6k',
    'A B C 1234', 'C R T 9087', 'unsplash.com', '284106', 'NewPass@2026', 'MOCK_PRESETS',
    'switchRolePreview', 'Advance Trip Status', 'Simulate Declined Payment'
)

# Files that legitimately contain simulator vocabulary (fake providers / sim store).
$simPathRegex = '(Simulator|Simulat|SimMessage|SimPayment|SimPush|FakeOtpSender|FakePaymentGateway|FakeMap|FakePush|SimulatorDock|Providers)'

$scanDirs = @('client/src', 'src', 'app/web/wwwroot')
$extensions = @('.cs', '.cshtml', '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html')

$hits = [System.Collections.Generic.List[string]]::new()
$filesScanned = 0

function Test-File([string]$path, [bool]$checkSmells) {
    $script:filesScanned++
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
        foreach ($lit in $forbidden) {
            if ($line.IndexOf($lit, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $script:hits.Add("MOCK-LITERAL [$lit] ${path}: $($line.Trim())")
            }
        }
        if ($checkSmells) {
            foreach ($smell in @('TODO', 'FIXME', 'lorem ipsum', 'placeholder data')) {
                if ($line.IndexOf($smell, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    $script:hits.Add("CODE-SMELL [$smell] ${path}: $($line.Trim())")
                }
            }
        }
    }
}

foreach ($dir in $scanDirs) {
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Recurse -File -Path $dir | Where-Object {
        $ext = $_.Extension.ToLowerInvariant()
        $extensions -contains $ext -and $_.FullName -notmatch '\\(bin|obj|node_modules)\\' -and
        $_.Name -notmatch '\.min\.js$'
    } | ForEach-Object {
        $isSim = $_.FullName -match $simPathRegex
        Test-File -path $_.FullName -checkSmells (-not $isSim)
    }
}

if ($DomDump -and (Test-Path $DomDump)) {
    $domText = [System.IO.File]::ReadAllText($DomDump)
    foreach ($lit in $forbidden) {
        if ($domText.Contains($lit, [System.StringComparison]::OrdinalIgnoreCase)) {
            $hits.Add("DOM-LITERAL [$lit] in $DomDump")
        }
    }
    Write-Host "Scanned DOM dump: $DomDump"
}

$report = @(
    "Mock scan - $(Get-Date -Format o)",
    "Files scanned: $filesScanned",
    "DomDump: $(if ($DomDump) { $DomDump } else { '(not supplied)' })",
    "Forbidden literals checked: $($forbidden.Count)",
    "Hits: $($hits.Count)",
    ''
) + $hits

$reportPathFull = Join-Path $root $ReportPath
New-Item -ItemType Directory -Force -Path (Split-Path $reportPathFull) | Out-Null
$report | Set-Content -Path $reportPathFull -Encoding utf8

$report | ForEach-Object { Write-Host $_ }

if ($hits.Count -gt 0) {
    Write-Host "`n[FAIL] Mock scan found $($hits.Count) hit(s). Report: $ReportPath" -ForegroundColor Red
    exit 1
}
Write-Host "`n[OK] Mock scan clean (0 hits). Report: $ReportPath" -ForegroundColor Green
exit 0
