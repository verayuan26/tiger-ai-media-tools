param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

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
    Write-Host "[INFO] npm $($NpmArguments -join ' ')"

    $process = Start-Process -FilePath $npmCmd -ArgumentList $NpmArguments -WorkingDirectory $root -Wait -PassThru -NoNewWindow
    return $process.ExitCode
}

$env:npm_config_build_from_source = 'false'
$env:npm_config_python = $null

Write-Host '[INFO] Phase 1: install packages without native build scripts...'
$code = Invoke-Npm -NpmArguments @('install', '--no-bin-links', '--ignore-scripts')
if ($code -ne 0) {
    Write-Host "[ERROR] npm install --ignore-scripts failed with exit code $code"
    exit $code
}

function Install-WindowsOptionalNatives {
    Write-Host '[INFO] Ensure Rollup/esbuild Windows optional natives...'
    & (Join-Path $here 'install-windows-optional-natives.ps1') -ProjectRoot $root | Out-Host
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
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
