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

# Forbidden prototype persona / hard-coded literals (brief 06 section 6 + Round 3 A.1).
$forbidden = @(
    'Ahmed Mohamed', 'ahmed.mohamed', 'Karim Mostafa', 'Mahmoud Hassan', 'Nile Auto Care',
    'Nour El-Sayed', 'Omar Adel', 'Salma Nabil', 'Cairo Motor Clinic', 'Hany Samir',
    '@fixngo.eg', 'Password@123', 'Admin@123', 'FG-2606', 'MR-2611', 'BK-2048', 'KYC-1042',
    'SR-108', 'WO-3102', 'SUP-2041', 'WD-2606', 'INV-2026-2606', '12,482', '248.6k',
    'A B C 1234', 'C R T 9087', 'unsplash.com', '284106', 'NewPass@2026', 'MOCK_PRESETS',
    'switchRolePreview', 'Advance Trip Status', 'Simulate Declined Payment',
    'FG-1042', 'INV-2026-0104', 'BK-101', 'KYC-0001', 'SUP-1042', 'WD-1042', 'TOW-01',
    'Verified FixNGo Specialist', 'Your FixNGo Specialist', 'El-alamia', 'alternator'
)

# Forbidden fallback regexes in client/src (Round 3 A.1).
$forbiddenClientRegexes = @(
    "\|\|\s*'[A-Z]{1,4}-\d{2,4}'",
    "\|\|\s*\d",
    "\|\|\s*'\+2010",
    # Round 4 A.2: a translated sentence used as submitted DATA (e.g. `text: text || t('Great service')`).
    "^\s*\w+\s*:\s*[\w.?]+\s*\|\|\s*t\(\s*'[^']{12,}'"
)

# Round 4 A.2/A.3: product form state must not start pre-filled or pre-ticked.
# Only UI-state names (tabs, filters, periods, modes, selection *type* pickers) may have literal defaults.
$uiStateNameRx = '(?i)(tab|filter|period|mode|sort|sortBy|view|step|panel|section|range|scope|kind|type|unit|channel|lang|theme|direction|role|open|visible|expanded|loading|busy|ready|online|show\w*|is(Open|Visible|Loading|Busy|Ready))$'
$confirmNameRx = '(?i)(confirm\w*|understood|agree\w*|ack\w*|accept\w*|consent\w*|isDefault|useAsPayout|recommend\w*|checked|ticked)$'
$numericAllowRx = '(?i)(seconds\w*|timer|countdown|page|step|index|attempt\w*|retr\w*|zoom|limit|size|delay|interval|count|tick)$'

function Test-FormStateLine([string]$line, [string]$path) {
    if ($line -match 'mock-scan:allow') { return }
    $m = [regex]::Match($line, 'const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState\((.*?)\)\s*;')
    if (-not $m.Success) { return }
    $name = $m.Groups[1].Value; $init = $m.Groups[2].Value.Trim()
    if ($init -eq 'true' -and $name -match $confirmNameRx) {
        $script:hits.Add("PRETICKED-CONFIRM [$name] ${path}: $($line.Trim())"); return
    }
    if ($init -match "^'([^']{2,})'$" -and $name -notmatch $uiStateNameRx) {
        $script:hits.Add("PREFILLED-FORM [$name=$init] ${path}: $($line.Trim())"); return
    }
    if (($init -match "\|\|\s*'([^']{2,})'$" -or $init -match "\?\?\s*'([^']{2,})'$") -and $name -notmatch $uiStateNameRx) {
        $script:hits.Add("PREFILLED-FALLBACK [$name=$init] ${path}: $($line.Trim())"); return
    }
    if ($init -match '^\d+(\.\d+)?$' -and $init -notin @('0', '1') -and $name -notmatch $numericAllowRx) {
        $script:hits.Add("PREFILLED-NUMBER [$name=$init] ${path}: $($line.Trim())")
    }
}

# Files that legitimately contain simulator vocabulary (fake providers / sim store).
$simPathRegex = '(Simulator|Simulat|SimMessage|SimPayment|SimPush|FakeOtpSender|FakePaymentGateway|FakeMap|FakePush|SimulatorDock|Providers)'

$scanDirs = @('client/src', 'src', 'app/web/wwwroot')
$extensions = @('.cs', '.cshtml', '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html')

$hits = [System.Collections.Generic.List[string]]::new()
$filesScanned = 0

function Test-File([string]$path, [bool]$checkSmells) {
    $script:filesScanned++
    $isClientSrc = $path -match 'client[\\/]src'
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
        foreach ($lit in $forbidden) {
            if ($line.IndexOf($lit, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $script:hits.Add("MOCK-LITERAL [$lit] ${path}: $($line.Trim())")
            }
        }
        if ($isClientSrc) {
            foreach ($rx in $forbiddenClientRegexes) {
                if ($line -match $rx -and $line -notmatch 'mock-scan:allow') {
                    $script:hits.Add("FALLBACK-REGEX [$rx] ${path}: $($line.Trim())")
                }
            }
            if ($path -notmatch '[\\/](sim|tests)[\\/]') { Test-FormStateLine -line $line -path $path }
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
