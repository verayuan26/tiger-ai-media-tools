param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

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
    param(
        [string]$PackageSpec
    )

    $npmCmd = Resolve-NpmCmd
    Write-Host "[INFO] npm install --no-save $PackageSpec"

    $process = Start-Process -FilePath $npmCmd -ArgumentList @(
        'install',
        '--no-save',
        '--no-bin-links',
        '--ignore-scripts',
        $PackageSpec
    ) -WorkingDirectory $root -Wait -PassThru -NoNewWindow

    return $process.ExitCode
}

function Test-ScopedPackagePresent {
    param([string]$ScopedPackage)

    $relative = 'node_modules\' + ($ScopedPackage.TrimStart('@') -replace '/', '\')
    return Test-Path -LiteralPath (Join-Path $root "$relative\package.json")
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

function Get-WindowsNativePackageSpecs {
    $arch = Get-NodeArch
    $specs = @()

    $rollupVersion = Get-RollupVersion
    if ($rollupVersion) {
        $rollupNative = switch ($arch) {
            'arm64' { 'rollup-win32-arm64-msvc' }
            'ia32' { 'rollup-win32-ia32-msvc' }
            default { 'rollup-win32-x64-msvc' }
        }
        $specs += "@rollup/$rollupNative@$rollupVersion"
    }

    $esbuildVersion = Get-EsbuildVersion
    if ($esbuildVersion) {
        $esbuildNative = switch ($arch) {
            'arm64' { 'win32-arm64' }
            default { 'win32-x64' }
        }
        $specs += "@esbuild/$esbuildNative@$esbuildVersion"
    }

    return $specs
}

if ($env:OS -notmatch 'Windows') {
    exit 0
}

$specs = Get-WindowsNativePackageSpecs
if ($specs.Count -eq 0) {
    Write-Host '[INFO] No Windows native optional packages to install.'
    exit 0
}

$exitCode = 0
foreach ($spec in $specs) {
    if ($spec -notmatch '^(@[^/]+/[^@]+)@(.+)$') {
        Write-Host "[WARN] Skipping invalid package spec: $spec"
        continue
    }

    $scoped = $Matches[1]

    if (Test-ScopedPackagePresent -ScopedPackage $scoped) {
        Write-Host "[INFO] Optional native present: $scoped"
        continue
    }

    Write-Host "[INFO] Installing missing optional native: $spec"
    $code = Invoke-NpmInstall -PackageSpec $spec
    if ($code -ne 0) {
        Write-Host "[ERROR] Failed to install $spec (exit $code)"
        $exitCode = $code
    }
}

exit $exitCode
