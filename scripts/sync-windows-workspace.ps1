param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,
    [Parameter(Mandatory = $true)]
    [string]$LocalRoot
)

$ErrorActionPreference = 'Stop'

function Normalize-Dir {
    param([string]$Path)
    $p = $Path.Trim().Trim('"').TrimEnd('\', '/')
    if ([string]::IsNullOrWhiteSpace($p)) {
        throw 'Directory path is empty.'
    }
    return $p
}

$source = Normalize-Dir $SourceRoot
$local = Normalize-Dir $LocalRoot

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source not found: $source"
}

New-Item -ItemType Directory -Force -Path $local | Out-Null

$excludeDirs = @(
    'node_modules',
    'dist',
    '.git',
    '.tools',
    'playwright-report',
    'test-results',
    'coverage'
)

$robocopy = Get-Command robocopy -ErrorAction SilentlyContinue
if (-not $robocopy) {
    throw 'robocopy.exe not found. Run from Windows (not WSL).'
}

Write-Host "[INFO] Syncing project to local workspace..."
Write-Host "       From: $source"
Write-Host "       To:   $local"

$args = @(
    $source,
    $local,
    '/E',
    '/R:2',
    '/W:2',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/XD'
) + $excludeDirs

& robocopy @args | Out-Host
$code = $LASTEXITCODE
if ($code -ge 8) {
    throw "robocopy failed with exit code $code"
}

$marker = Join-Path $local '.workspace-source.txt'
Set-Content -LiteralPath $marker -Value $source -Encoding ascii -NoNewline
Write-Host '[INFO] Sync done.'
exit 0
