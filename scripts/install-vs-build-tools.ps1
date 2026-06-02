$ErrorActionPreference = 'Stop'

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
    Write-Host '[ERROR] winget not found. Install Visual Studio Build Tools manually:'
    Write-Host '        https://visualstudio.microsoft.com/visual-cpp-build-tools/'
    exit 1
}

Write-Host '[INFO] Installing Visual Studio 2022 Build Tools (C++ workload)...'
Write-Host '        This is large (~2GB) and may need UAC approval.'
Write-Host '        Required to compile better-sqlite3 when prebuilt binaries are unavailable.'
Write-Host ''

$override = @(
    '--quiet',
    '--wait',
    '--add', 'Microsoft.VisualStudio.Workload.VCTools',
    '--includeRecommended'
) -join ' '

& winget install -e --id Microsoft.VisualStudio.2022.BuildTools `
    --accept-package-agreements `
    --accept-source-agreements `
    --disable-interactivity `
    --override $override

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] winget exit code: $LASTEXITCODE"
    Write-Host '        You may need to install "Desktop development with C++" manually.'
    exit 1
}

Write-Host '[INFO] Build Tools install finished. If npm still fails, open a new terminal.'
exit 0
