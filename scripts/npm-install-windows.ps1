param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

. (Join-Path $here 'npm-registry.ps1')

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

function Invoke-Npm {
    param([string[]]$NpmArguments)

    $npmCmd = Resolve-NpmCmd
    $allArguments = @(Get-NpmRegistryArguments) + $NpmArguments
    Write-Host "[INFO] npm $($allArguments -join ' ')"
    $process = Start-Process -FilePath $npmCmd -ArgumentList $allArguments -WorkingDirectory $root -Wait -PassThru -NoNewWindow
    return $process.ExitCode
}

$env:npm_config_build_from_source = 'false'
$env:npm_config_python = $null

Write-Host '[INFO] Phase 1: install packages without native build scripts...'
$code = Invoke-Npm -NpmArguments @('install', '--no-bin-links', '--ignore-scripts', '--omit=optional')
if ($code -ne 0) {
    Write-Host "[ERROR] npm install --ignore-scripts failed with exit code $code"
    exit $code
}

function Resolve-NodeExe {
    $portable = Join-Path $env:LOCALAPPDATA 'ai-media-tools\node-x64\node.exe'
    if (Test-Path -LiteralPath $portable) { return $portable }

    $fromEnv = $env:NODE_X64_EXE
    if ($fromEnv -and (Test-Path -LiteralPath $fromEnv)) { return $fromEnv }

    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    throw 'node.exe not found in PATH'
}

function Install-WindowsOptionalNatives {
    Write-Host '[INFO] Ensure Windows optional natives (rollup/esbuild/tailwindcss/lightningcss)...'
    & (Join-Path $here 'install-windows-optional-natives.ps1') -ProjectRoot $root | Out-Host
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

# Phase 1.5: Download better-sqlite3 prebuilt binary via prebuild-install.
# better-sqlite3's install script is "prebuild-install || node-gyp rebuild".
# Because Phase 1 used --ignore-scripts, that script never ran.  Calling
# prebuild-install here downloads a prebuilt .node for the current
# Node ABI directly from GitHub releases — no VS Build Tools required.
# If no prebuilt exists for this Node version, we fall through to
# Phase 2/3 which compile from source.
Write-Host '[INFO] Phase 1.5: Download better-sqlite3 prebuilt binary...'
$bsqlDir      = Join-Path $root 'node_modules\better-sqlite3'
$prebuildBinJs = Join-Path $root 'node_modules\prebuild-install\bin.js'
$prebuildOk   = $false

if ((Test-Path -LiteralPath $bsqlDir) -and (Test-Path -LiteralPath $prebuildBinJs)) {
    try {
        $nodeExe = Resolve-NodeExe
        $proc = Start-Process -FilePath $nodeExe `
            -ArgumentList @($prebuildBinJs) `
            -WorkingDirectory $bsqlDir `
            -Wait -PassThru -NoNewWindow
        if ($proc.ExitCode -eq 0) {
            Write-Host '[INFO] better-sqlite3 prebuilt binary downloaded successfully.'
            $prebuildOk = $true
        } else {
            Write-Host "[WARN] prebuild-install exited $($proc.ExitCode) — no prebuilt for this Node version. Will compile from source."
        }
    } catch {
        Write-Host "[WARN] prebuild-install could not run: $($_.Exception.Message)"
    }
} else {
    Write-Host '[WARN] prebuild-install or better-sqlite3 not found in node_modules — skipping Phase 1.5.'
}

if ($prebuildOk) {
    Install-WindowsOptionalNatives
    exit 0
}

Write-Host '[INFO] Phase 2: rebuild native modules including better-sqlite3...'
$code = Invoke-Npm -NpmArguments @('rebuild')
if ($code -eq 0) {
    Install-WindowsOptionalNatives
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
$code = Invoke-Npm -NpmArguments @('rebuild')
if ($code -ne 0) {
    exit $code
}

Install-WindowsOptionalNatives
exit 0
