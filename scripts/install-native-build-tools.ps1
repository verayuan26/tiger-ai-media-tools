$ErrorActionPreference = 'Continue'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '[INFO] Setting up native build tools for better-sqlite3...'

& (Join-Path $here 'install-python-windows.ps1')
$pythonOk = $LASTEXITCODE -eq 0

& (Join-Path $here 'install-vs-build-tools.ps1')
$vsOk = $LASTEXITCODE -eq 0

if ($pythonOk -and $vsOk) {
    exit 0
}

if (-not $pythonOk) {
    Write-Host '[WARN] Python setup incomplete.'
}
if (-not $vsOk) {
    Write-Host '[WARN] Visual Studio Build Tools setup incomplete.'
}

exit 1
