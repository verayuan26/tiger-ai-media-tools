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
    if (Test-Path -LiteralPath $portable) { return $portable }

    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $fallback = Get-Command npm -ErrorAction SilentlyContinue
    if ($fallback) { return $fallback.Source }

    throw 'npm.cmd not found in PATH'
}

function Resolve-NodeExe {
    $portable = Join-Path $env:LOCALAPPDATA 'ai-media-tools\node-x64\node.exe'
    if (Test-Path -LiteralPath $portable) { return $portable }

    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    throw 'node.exe not found in PATH'
}

function Get-NodeArch {
    return Get-NodeProcessArch -NodeExe (Resolve-NodeExe)
}

function Invoke-NpmCommand {
    param([string[]]$NpmArguments)

    $npmCmd = Resolve-NpmCmd
    $allArguments = @(Get-NpmRegistryArguments) + $NpmArguments
    Write-Host "[INFO] npm $($allArguments -join ' ')"

    $process = Start-Process -FilePath $npmCmd -ArgumentList $allArguments -WorkingDirectory $root -Wait -PassThru -NoNewWindow
    return $process.ExitCode
}

function Get-PackageVersion {
    param([string]$PkgJsonPath)

    if (-not (Test-Path -LiteralPath $PkgJsonPath)) { return $null }

    $json = Get-Content -LiteralPath $PkgJsonPath -Raw | ConvertFrom-Json
    return $json.version
}

function Get-RollupVersion {
    return Get-PackageVersion -PkgJsonPath (Join-Path $root 'node_modules\rollup\package.json')
}

function Discover-AllNativeModules {
    $arch = Get-NodeArch
    $modules = @()

    # --- Rollup (single top-level only) ---
    $rollupVersion = Get-RollupVersion
    if ($rollupVersion) {
        $rollupNative = switch ($arch) {
            'arm64' { 'rollup-win32-arm64-msvc' }
            'ia32'  { 'rollup-win32-ia32-msvc' }
            default { 'rollup-win32-x64-msvc' }
        }
        $modules += @{
            Module    = "@rollup/$rollupNative"
            Spec      = "@rollup/$rollupNative@$rollupVersion"
            CheckType = 'require'
            DestDir   = Join-Path $root "node_modules\@rollup\$rollupNative"
        }
    }

    # --- esbuild (top-level + all nested) ---
    $esbuildBin    = if ($arch -eq 'arm64') { 'esbuild' } else { 'esbuild.exe' }
    $esbuildNative = if ($arch -eq 'arm64') { 'win32-arm64' } else { 'win32-x64' }

    $esbuildSearchRoots = @(
        @{ PkgJson = Join-Path $root 'node_modules\esbuild\package.json';
           NativeDir = Join-Path $root "node_modules\@esbuild\$esbuildNative" }
    )

    $nodeModulesDir = Join-Path $root 'node_modules'
    if (Test-Path -LiteralPath $nodeModulesDir) {
        Get-ChildItem -LiteralPath $nodeModulesDir -Directory | ForEach-Object {
            $nestedPkg = Join-Path $_.FullName "node_modules\esbuild\package.json"
            if (Test-Path -LiteralPath $nestedPkg) {
                $esbuildSearchRoots += @{
                    PkgJson   = $nestedPkg
                    NativeDir = Join-Path $_.FullName "node_modules\@esbuild\$esbuildNative"
                }
            }
        }
    }

    $seen = @{}
    foreach ($entry in $esbuildSearchRoots) {
        $version = Get-PackageVersion -PkgJsonPath $entry.PkgJson
        if (-not $version) { continue }

        $key = "$($entry.NativeDir)|$version"
        if ($seen.ContainsKey($key)) { continue }
        $seen[$key] = $true

        $modules += @{
            Module    = "@esbuild/$esbuildNative"
            Spec      = "@esbuild/$esbuildNative@$version"
            CheckType = 'file'
            CheckFile = $esbuildBin
            DestDir   = $entry.NativeDir
        }
    }

    return $modules
}

function Test-NativeModulePresent {
    param($Entry)

    if ($Entry.CheckType -eq 'file') {
        return Test-Path -LiteralPath (Join-Path $Entry.DestDir $Entry.CheckFile)
    }

    # require check for rollup .node addon
    $nodeExe = Resolve-NodeExe
    return Test-NodeCanRequire -ModuleName $Entry.Module -NodeExe $nodeExe -WorkingDirectory $root
}

function Install-PackageWithNpmPack {
    param($Entry)

    $spec = $Entry.Spec
    $dest = $Entry.DestDir

    $packDir = Join-Path $env:TEMP ("ai-media-pack-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $packDir | Out-Null

    try {
        $code = Invoke-NpmCommand -NpmArguments @('pack', $spec, '--pack-destination', $packDir)
        if ($code -ne 0) { return $code }

        $archive = Get-ChildItem -LiteralPath $packDir -Filter '*.tgz' | Select-Object -First 1
        if (-not $archive) {
            Write-Host "[ERROR] npm pack produced no archive for $spec"
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

        Write-Host "[INFO] Installed $($Entry.Module)@$((Get-PackageVersion -PkgJsonPath (Join-Path $dest 'package.json'))) into $dest"
        return 0
    }
    finally {
        Remove-Item -LiteralPath $packDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ---- main ----

if ($env:OS -notmatch 'Windows') { exit 0 }

$nativeModules = @(Discover-AllNativeModules)
if ($nativeModules.Count -eq 0) {
    Write-Host '[INFO] No Windows native optional packages to install.'
    exit 0
}

$missing = @()
foreach ($entry in $nativeModules) {
    if (Test-NativeModulePresent -Entry $entry) {
        Write-Host "[INFO] Optional native OK: $($entry.Module) -> $($entry.DestDir)"
        continue
    }
    $missing += $entry
}

if ($missing.Count -eq 0) {
    Write-Host '[INFO] Windows optional natives ready.'
    exit 0
}

Write-Host "[INFO] Installing missing Windows optional natives via npm pack ($($missing.Count) package(s))..."

$exitCode = 0
foreach ($entry in $missing) {
    Write-Host "[INFO] Installing $($entry.Spec) -> $($entry.DestDir)"
    $code = Install-PackageWithNpmPack -Entry $entry
    if ($code -ne 0) {
        Write-Host "[ERROR] Failed to install $($entry.Spec)"
        $exitCode = $code
    }
}

$stillMissing = @()
foreach ($entry in $nativeModules) {
    if (-not (Test-NativeModulePresent -Entry $entry)) {
        $stillMissing += $entry.Module + ' -> ' + $entry.DestDir
    }
}

if ($stillMissing.Count -gt 0) {
    Write-Host "[ERROR] Still missing after install:"
    $stillMissing | ForEach-Object { Write-Host "  $_" }
    exit 1
}

Write-Host '[INFO] Windows optional natives ready.'
exit $exitCode
