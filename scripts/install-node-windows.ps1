param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

function Normalize-ProjectRoot {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw 'ProjectRoot is empty.'
    }
    $normalized = $Path.Trim().Trim('"').Trim("'")
    $normalized = $normalized -replace '[\r\n\u0000]', ''
    return $normalized.TrimEnd('\', '/')
}

function Test-NodeReady {
    param([string]$NodeHome)
    if (-not $NodeHome) {
        return $false
    }
    $nodeExe = Join-Path $NodeHome 'node.exe'
    return (Test-Path -LiteralPath $nodeExe)
}

function Get-NodeArch {
    param([string]$NodeHome)
    $nodeExe = Join-Path $NodeHome 'node.exe'
    $arch = & $nodeExe -p "process.arch" 2>$null
    return [string]$arch
}

function Write-NodePathFile {
    param([string]$NodeHome, [string]$ToolsRoot)
    if (-not $ToolsRoot) {
        return
    }
    New-Item -ItemType Directory -Force -Path $ToolsRoot | Out-Null
    Set-Content -LiteralPath (Join-Path $ToolsRoot 'node-path.txt') -Value $NodeHome -Encoding ascii -NoNewline
}

function Install-PortableNodeX64 {
    param([string]$NodeHome)

    Write-Host '[INFO] Downloading portable Node.js 22 LTS win-x64 (for native npm modules)...'

    $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
    $release = $index |
        Where-Object { $_.lts -and $_.version -match '^v22\.' } |
        Select-Object -First 1

    if (-not $release) {
        $release = $index | Where-Object { $_.lts } | Select-Object -First 1
    }

    if (-not $release) {
        throw 'Could not resolve Node.js LTS version from nodejs.org.'
    }

    $version = $release.version
    $zipName = "node-$version-win-x64.zip"
    $url = "https://nodejs.org/dist/$version/$zipName"
    $toolsRoot = Split-Path -Parent $NodeHome
    $zipPath = Join-Path $toolsRoot $zipName
    $extractRoot = Join-Path $toolsRoot '_extract'

    New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
    if (Test-Path -LiteralPath $NodeHome) {
        Remove-Item -LiteralPath $NodeHome -Recurse -Force
    }

    Write-Host "[INFO] $url"
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force
    $folder = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
    if (-not $folder) {
        throw "Unexpected zip layout for $zipName"
    }

    Move-Item -LiteralPath $folder.FullName -Destination $NodeHome
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue

    return $NodeHome
}

$root = Normalize-ProjectRoot $ProjectRoot
$projectTools = Join-Path $root '.tools'
$nodeHome = Join-Path $env:LOCALAPPDATA 'ai-media-tools\node-x64'

if (Test-NodeReady -NodeHome $nodeHome) {
    $arch = Get-NodeArch -NodeHome $nodeHome
    if ($arch -eq 'x64') {
        Write-NodePathFile -NodeHome $nodeHome -ToolsRoot $projectTools
        Write-Host "[INFO] Using Node x64 at $nodeHome ($(& (Join-Path $nodeHome 'node.exe') -v))"
        exit 0
    }
    Write-Host "[WARN] Portable Node is $arch, reinstalling win-x64..."
    Remove-Item -LiteralPath $nodeHome -Recurse -Force -ErrorAction SilentlyContinue
}

$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) {
    $arch = & node -p "process.arch" 2>$null
    if ($arch -eq 'x64') {
        $nodeDir = Split-Path -Parent $cmd.Source
        Write-NodePathFile -NodeHome $nodeDir -ToolsRoot $projectTools
        Write-Host "[INFO] Using system Node x64: $($cmd.Source)"
        exit 0
    }
    Write-Host "[WARN] System Node is $arch (e.g. ARM). Installing portable win-x64 Node 22..."
}

try {
    $nodeDir = Install-PortableNodeX64 -NodeHome $nodeHome
    if (-not (Test-NodeReady -NodeHome $nodeDir)) {
        throw "Portable install failed at $nodeDir"
    }
    $arch = Get-NodeArch -NodeHome $nodeDir
    if ($arch -ne 'x64') {
        throw "Expected x64 Node, got $arch"
    }
    Write-NodePathFile -NodeHome $nodeDir -ToolsRoot $projectTools
    Write-Host "[INFO] Portable Node x64 ready: $nodeDir"
    exit 0
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)"
    exit 1
}
