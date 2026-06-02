param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
Set-Location -LiteralPath $root

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

$nodeExe = Resolve-NodeExe
$tscJs = Join-Path $root 'node_modules\typescript\lib\tsc.js'
$viteJs = Join-Path $root 'node_modules\vite\bin\vite.js'

if (-not (Test-Path -LiteralPath $tscJs)) {
    Write-Host "[ERROR] Missing $tscJs (run start.bat to install dependencies)"
    exit 1
}

Write-Host '[BUILD] typecheck...'
& $nodeExe $tscJs --noEmit
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if (-not (Test-Path -LiteralPath $viteJs)) {
    Write-Host "[ERROR] Missing $viteJs"
    exit 1
}

Write-Host '[BUILD] vite build...'
& $nodeExe $viteJs build
if ($null -ne $LASTEXITCODE) {
    exit $LASTEXITCODE
}
exit 0
