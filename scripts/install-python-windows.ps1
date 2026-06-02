$ErrorActionPreference = 'Stop'

function Test-WorkingPython {
    $candidates = @(
        'py -3 -c "import sys; print(sys.version)"',
        'python -c "import sys; print(sys.version)"',
        'python3 -c "import sys; print(sys.version)"'
    )
    foreach ($cmd in $candidates) {
        try {
            $out = cmd /c $cmd 2>$null
            if ($LASTEXITCODE -eq 0 -and $out -match '^\d+\.\d+') {
                return $true
            }
        }
        catch {
            continue
        }
    }
    return $false
}

if (Test-WorkingPython) {
    Write-Host '[INFO] Python is available for node-gyp.'
    exit 0
}

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
    Write-Host '[ERROR] winget not found. Install Python 3.12 manually:'
    Write-Host '        https://www.python.org/downloads/'
    exit 1
}

Write-Host '[INFO] Installing Python 3.12 via winget (UAC may appear)...'
& winget install -e --id Python.Python.3.12 `
    --accept-package-agreements `
    --accept-source-agreements `
    --disable-interactivity `
    --silent

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] winget Python install exit code: $LASTEXITCODE"
}

$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$user = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machine;$user"

if (Test-WorkingPython) {
    Write-Host '[INFO] Python ready for node-gyp.'
    exit 0
}

Write-Host '[ERROR] Python still not usable. Install Python 3.12 and enable "Add to PATH".'
exit 1
