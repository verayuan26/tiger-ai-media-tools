param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

. (Join-Path $PSScriptRoot 'windows-node-helpers.ps1')
. (Join-Path $PSScriptRoot 'npm-registry.ps1')

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

function Invoke-NpmCommand {
    param([string[]]$NpmArguments)

    $npmCmd = Resolve-NpmCmd
    $allArguments = @(Get-NpmRegistryArguments) + $NpmArguments
    Write-Host "[INFO] npm $($allArguments -join ' ')"

    $process = Start-Process -FilePath $npmCmd -ArgumentList $allArguments -WorkingDirectory $root -Wait -PassThru -NoNewWindow
    return $process.ExitCode
}

function Test-NodeModuleResolvable {
    param([string]$ModuleName)

    $nodeExe = Resolve-NodeExe
    return Test-NodeCanRequire -ModuleName $ModuleName -NodeExe $nodeExe -WorkingDirectory $root
}

function Get-NodeArch {
    return Get-NodeProcessArch -NodeExe (Resolve-NodeExe)
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

function Get-ScopedPackageDestination {
    param([string]$ScopedPackage)

    $relative = $ScopedPackage.TrimStart('@') -replace '/', '\'
    return Join-Path $root "node_modules\$relative"
}

function Install-ScopedPackageWithNpmPack {
    param([string]$PackageSpec)

    if ($PackageSpec -notmatch '^(@[^/]+/[^@]+)@(.+)$') {
        Write-Host "[WARN] Invalid package spec for npm pack: $PackageSpec"
        return 1
    }

    $scoped = $Matches[1]
    $dest = Get-ScopedPackageDestination -ScopedPackage $scoped
    $packDir = Join-Path $env:TEMP ("ai-media-pack-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $packDir | Out-Null

    try {
        $code = Invoke-NpmCommand -NpmArguments @('pack', $PackageSpec, '--pack-destination', $packDir)
        if ($code -ne 0) {
            return $code
        }

        $archive = Get-ChildItem -LiteralPath $packDir -Filter '*.tgz' | Select-Object -First 1
        if (-not $archive) {
            Write-Host "[ERROR] npm pack produced no archive for $PackageSpec"
            return 1
        }

        if (Test-Path -LiteralPath $dest) {
            Remove-Item -LiteralPath $dest -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $dest | Out-Null

        & tar -xzf $archive.FullName -C $dest --strip-components=1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to extract $($archive.Name) into $dest"
            return 1
        }

        Write-Host "[INFO] Installed $scoped via npm pack into $dest"
        return 0
    }
    finally {
        Remove-Item -LiteralPath $packDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-MissingNativeModules {
    param($NativeModules)

    $missing = @()
    foreach ($entry in $NativeModules) {
        if (Test-NodeModuleResolvable -ModuleName $entry.Module) {
            Write-Host "[INFO] Optional native loadable: $($entry.Module)"
            continue
        }

        $missing += $entry
    }

    return $missing
}

if ($env:OS -notmatch 'Windows') {
    exit 0
}

$nativeModules = Get-WindowsNativeModules
if ($nativeModules.Count -eq 0) {
    Write-Host '[INFO] No Windows native optional packages to install.'
    exit 0
}

$missing = @(Get-MissingNativeModules -NativeModules $nativeModules)
if ($missing.Count -eq 0) {
    exit 0
}

Write-Host "[INFO] Installing optional dependencies from package-lock (missing: $($missing.Module -join ', '))..."
$code = Invoke-NpmCommand -NpmArguments @(
    'install',
    '--include=optional',
    '--no-bin-links',
    '--legacy-peer-deps'
)
if ($code -ne 0) {
    Write-Host "[ERROR] npm install --include=optional failed (exit $code)"
    exit $code
}

$missing = @(Get-MissingNativeModules -NativeModules $nativeModules)
if ($missing.Count -eq 0) {
    Write-Host '[INFO] Windows optional natives ready.'
    exit 0
}

Write-Host '[INFO] Lockfile optional install did not restore platform binaries; using npm pack fallback...'
$exitCode = 0
foreach ($entry in $missing) {
    $code = Install-ScopedPackageWithNpmPack -PackageSpec $entry.Spec
    if ($code -ne 0) {
        $exitCode = $code
    }
}

$missing = @(Get-MissingNativeModules -NativeModules $nativeModules)
if ($missing.Count -gt 0) {
    Write-Host "[ERROR] Still cannot load: $($missing.Module -join ', ')"
    exit 1
}

Write-Host '[INFO] Windows optional natives ready.'
exit $exitCode
