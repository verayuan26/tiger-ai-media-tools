param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

. (Join-Path $PSScriptRoot 'windows-node-helpers.ps1')

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

# Registry of simple Windows native packages (mirrors install-windows-optional-natives.ps1).
# Add new packages here to include them in dependency verification.
$script:NATIVE_VERIFY_REGISTRY = @(
    @{ MainPkg = 'rollup';             x64 = '@rollup/rollup-win32-x64-msvc';          arm64 = '@rollup/rollup-win32-arm64-msvc';          ia32 = '@rollup/rollup-win32-ia32-msvc' }
    @{ MainPkg = '@tailwindcss/oxide'; x64 = '@tailwindcss/oxide-win32-x64-msvc';      arm64 = '@tailwindcss/oxide-win32-arm64-msvc' }
    @{ MainPkg = 'lightningcss';       x64 = 'lightningcss-win32-x64-msvc';            arm64 = 'lightningcss-win32-arm64-msvc' }
)

function Test-WindowsNatives {
    if ($env:OS -notmatch 'Windows') {
        return $true
    }

    $nodeExe = $env:NODE_X64_EXE
    if (-not $nodeExe -or -not (Test-Path -LiteralPath $nodeExe)) {
        $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    }
    if (-not $nodeExe) {
        return $false
    }

    $arch = Get-NodeProcessArch -NodeExe $nodeExe

    foreach ($entry in $script:NATIVE_VERIFY_REGISTRY) {
        if (-not (Test-PackagePresent $entry.MainPkg)) { continue }

        $nativeName = switch ($arch) {
            'arm64' { if ($entry.ContainsKey('arm64')) { $entry.arm64 } else { $entry.x64 } }
            'ia32'  { if ($entry.ContainsKey('ia32'))  { $entry.ia32  } else { $entry.x64 } }
            default { $entry.x64 }
        }

        if (-not (Test-NodeCanRequire -ModuleName $nativeName -NodeExe $nodeExe -WorkingDirectory $root)) {
            Write-Host "[VERIFY] Windows native binary missing: $nativeName (required by $($entry.MainPkg))"
            return $false
        }
    }

    return $true
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

    return Test-NodeCanRequire -ModuleName 'better-sqlite3' -NodeExe $nodeExe -WorkingDirectory $root
}

if (-not (Test-TypeScriptReady)) {
    Write-Host '[VERIFY] typescript package missing'
    exit 2
}

if (-not (Test-ViteReady)) {
    Write-Host '[VERIFY] vite package missing'
    exit 2
}

if (-not (Test-WindowsNatives)) {
    exit 2
}

if (-not (Test-BetterSqlite3)) {
    Write-Host '[VERIFY] better-sqlite3 native module not loadable'
    exit 3
}

Write-Host '[VERIFY] Dependencies OK'
exit 0
