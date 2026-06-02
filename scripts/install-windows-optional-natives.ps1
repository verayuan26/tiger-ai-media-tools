param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

. (Join-Path $PSScriptRoot 'windows-node-helpers.ps1')

function Resolve-NpmCmd {
    $portable = Join-Path $env:LOCALAPPDATA 'ai-media-tools\node-x64\npm.cmd'
    if (Test-Path -LiteralPath $portable) {
        return $portable
    }

    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $fallback = Get-Command npm -ErrorAction SilentlyContinue
    if ($fallback) {
        return $fallback.Source
    }

    throw 'npm.cmd not found in PATH'
}

function Resolve-NodeExe {
    $portable = Join-Path $env:LOCALAPPDATA 'ai-media-tools\node-x64\node.exe'
    if (Test-Path -LiteralPath $portable) {
        return $portable
    }

    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    throw 'node.exe not found in PATH'
}

function Invoke-NpmInstall {
    param([string[]]$PackageSpecs)

    if ($PackageSpecs.Count -eq 0) {
        return 0
    }

    $npmCmd = Resolve-NpmCmd
    $display = ($PackageSpecs -join ' ')
    Write-Host "[INFO] npm install --no-save $display"

    $arguments = @(
        'install',
        '--no-save',
        '--no-bin-links',
        '--ignore-scripts',
        '--legacy-peer-deps'
    ) + $PackageSpecs

    $process = Start-Process -FilePath $npmCmd -ArgumentList $arguments -WorkingDirectory $root -Wait -PassThru -NoNewWindow
    return $process.ExitCode
}

function Test-NodeModuleResolvable {
    param([string]$ModuleName)

    $nodeExe = Resolve-NodeExe
    & $nodeExe -e "require('$ModuleName');" 2>$null
    return $LASTEXITCODE -eq 0
}

function Get-NodeArch {
    $nodeExe = Resolve-NodeExe
    return (& $nodeExe -p 'process.arch' 2>$null | Select-Object -First 1).Trim()
}

function Get-RollupVersion {
    $rollupPkg = Join-Path $root 'node_modules\rollup\package.json'
    if (-not (Test-Path -LiteralPath $rollupPkg)) {
        return $null
    }

    $json = Get-Content -LiteralPath $rollupPkg -Raw | ConvertFrom-Json
    return $json.version
}

function Get-EsbuildVersion {
    $esbuildPkg = Join-Path $root 'node_modules\esbuild\package.json'
    if (-not (Test-Path -LiteralPath $esbuildPkg)) {
        return $null
    }

    $json = Get-Content -LiteralPath $esbuildPkg -Raw | ConvertFrom-Json
    return $json.version
}

function Get-WindowsNativeModules {
    $arch = Get-NodeArch
    $modules = @()

    if (Get-RollupVersion) {
        $rollupNative = switch ($arch) {
            'arm64' { 'rollup-win32-arm64-msvc' }
            'ia32' { 'rollup-win32-ia32-msvc' }
            default { 'rollup-win32-x64-msvc' }
        }
        $modules += @{
            Module = "@rollup/$rollupNative"
            Spec   = "@rollup/$rollupNative@$(Get-RollupVersion)"
        }
    }

    if (Get-EsbuildVersion) {
        $esbuildNative = switch ($arch) {
            'arm64' { 'win32-arm64' }
            default { 'win32-x64' }
        }
        $modules += @{
            Module = "@esbuild/$esbuildNative"
            Spec   = "@esbuild/$esbuildNative@$(Get-EsbuildVersion)"
        }
    }

    return $modules
}

if ($env:OS -notmatch 'Windows') {
    exit 0
}

$nativeModules = Get-WindowsNativeModules
if ($nativeModules.Count -eq 0) {
    Write-Host '[INFO] No Windows native optional packages to install.'
    exit 0
}

$missingSpecs = @()
foreach ($entry in $nativeModules) {
    if (Test-NodeModuleResolvable -ModuleName $entry.Module) {
        Write-Host "[INFO] Optional native loadable: $($entry.Module)"
        continue
    }

    $missingSpecs += $entry.Spec
}

if ($missingSpecs.Count -eq 0) {
    exit 0
}

Write-Host '[INFO] Installing missing optional natives in one npm command...'
$code = Invoke-NpmInstall -PackageSpecs $missingSpecs
if ($code -ne 0) {
    Write-Host "[ERROR] Optional native install failed (exit $code)"
    exit $code
}

$stillMissing = @()
foreach ($entry in $nativeModules) {
    if (Test-NodeModuleResolvable -ModuleName $entry.Module) {
        continue
    }

    $stillMissing += $entry.Module
}

if ($stillMissing.Count -gt 0) {
    Write-Host '[INFO] Retrying with npm install --include=optional ...'
    $npmCmd = Resolve-NpmCmd
    $process = Start-Process -FilePath $npmCmd -ArgumentList @(
        'install',
        '--include=optional',
        '--no-bin-links',
        '--ignore-scripts',
        '--legacy-peer-deps'
    ) -WorkingDirectory $root -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ne 0) {
        exit $process.ExitCode
    }

    $stillMissing = @()
    foreach ($entry in $nativeModules) {
        if (-not (Test-NodeModuleResolvable -ModuleName $entry.Module)) {
            $stillMissing += $entry.Module
        }
    }
}

if ($stillMissing.Count -gt 0) {
    Write-Host "[ERROR] Still cannot load: $($stillMissing -join ', ')"
    exit 1
}

Write-Host '[INFO] Windows optional natives ready.'
exit 0
