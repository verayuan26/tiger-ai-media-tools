param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
$modules = Join-Path $root 'node_modules'

if (-not (Test-Path -LiteralPath $modules)) {
    exit 0
}

Write-Host "[INFO] Removing node_modules (may take a minute)..."
try {
    Remove-Item -LiteralPath $modules -Recurse -Force
}
catch {
    Write-Host "[WARN] Remove-Item failed, retrying after unlock..."
    Start-Sleep -Seconds 2
    cmd /c "rmdir /s /q `"$modules`"" | Out-Null
}

if (Test-Path -LiteralPath $modules) {
    Write-Host "[ERROR] Still cannot delete node_modules at $modules"
    Write-Host "        Close Cursor, stop node.exe, then retry."
    exit 1
}

Write-Host '[INFO] node_modules removed.'
exit 0
