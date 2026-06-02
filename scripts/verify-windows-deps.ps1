param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

function Test-PackagePresent {
    param([string]$Name)
    return Test-Path -LiteralPath (Join-Path $root "node_modules\$Name\package.json")
}

function Test-TypeScriptReady {
    if (-not (Test-PackagePresent 'typescript')) {
        return $false
    }

    $bins = @(
        'node_modules\typescript\lib\tsc.js',
        'node_modules\.bin\tsc.cmd',
        'node_modules\.bin\tsc',
        'node_modules\.bin\tsc.ps1',
        'node_modules\typescript\bin\tsc'
    )
    foreach ($rel in $bins) {
        if (Test-Path -LiteralPath (Join-Path $root $rel)) {
            return $true
        }
    }

    return $false
}

function Test-ViteReady {
    return Test-PackagePresent 'vite'
}

function Test-WindowsRollupNative {
    if ($env:OS -notmatch 'Windows') {
        return $true
    }

    if (-not (Test-PackagePresent 'rollup')) {
        return $true
    }

    $nodeExe = $env:NODE_X64_EXE
    if (-not $nodeExe -or -not (Test-Path -LiteralPath $nodeExe)) {
        $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    }
    if (-not $nodeExe) {
        return $false
    }

    $arch = (& $nodeExe -p 'process.arch' 2>$null | Select-Object -First 1).Trim()
    $nativeName = switch ($arch) {
        'arm64' { '@rollup/rollup-win32-arm64-msvc' }
        'ia32' { '@rollup/rollup-win32-ia32-msvc' }
        default { '@rollup/rollup-win32-x64-msvc' }
    }

    & $nodeExe -e "require('$nativeName');" 2>$null
    return $LASTEXITCODE -eq 0
}

function Test-BetterSqlite3 {
    if (-not (Test-PackagePresent 'better-sqlite3')) {
        return $false
    }

    $nodeExe = $env:NODE_X64_EXE
    if (-not $nodeExe -or -not (Test-Path -LiteralPath $nodeExe)) {
        $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    }
    if (-not $nodeExe) {
        return $false
    }

    & $nodeExe -e "require('better-sqlite3');" 2>$null
    return $LASTEXITCODE -eq 0
}

if (-not (Test-TypeScriptReady)) {
    Write-Host '[VERIFY] typescript package missing'
    exit 2
}

if (-not (Test-ViteReady)) {
    Write-Host '[VERIFY] vite package missing'
    exit 2
}

if (-not (Test-WindowsRollupNative)) {
    Write-Host '[VERIFY] rollup Windows native binary missing (@rollup/rollup-win32-x64-msvc)'
    exit 2
}

if (-not (Test-BetterSqlite3)) {
    Write-Host '[VERIFY] better-sqlite3 native module not loadable'
    exit 3
}

Write-Host '[VERIFY] Dependencies OK'
exit 0
