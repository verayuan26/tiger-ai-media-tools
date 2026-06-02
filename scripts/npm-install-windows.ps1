param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-Npm {
    param([string[]]$Args)
    Write-Host "[INFO] npm $($Args -join ' ')"
    & npm @Args
    return $LASTEXITCODE
}

# Prefer prebuilt binaries when available.
$env:npm_config_build_from_source = 'false'
$env:npm_config_python = $null

Write-Host '[INFO] Phase 1: install packages without native build scripts...'
$code = Invoke-Npm -Args @('install', '--no-bin-links', '--ignore-scripts')
if ($code -ne 0) {
    Write-Host "[ERROR] npm install --ignore-scripts failed with exit code $code"
    exit $code
}

Write-Host '[INFO] Phase 2: rebuild native modules including better-sqlite3...'
$code = Invoke-Npm -Args @('rebuild')
if ($code -eq 0) {
    exit 0
}

Write-Host '[WARN] npm rebuild failed. Installing Python and VS Build Tools...'
& (Join-Path $here 'install-native-build-tools.ps1') | Out-Host

$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$user = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machine;$user"

try {
    $pyExe = (& py -3 -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1).Trim()
    if ($pyExe -and (Test-Path -LiteralPath $pyExe)) {
        $env:npm_config_python = $pyExe
    }
}
catch {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        $env:npm_config_python = $python.Source
    }
}

Write-Host '[INFO] Phase 3: retry npm rebuild...'
$code = Invoke-Npm -Args @('rebuild')
exit $code
