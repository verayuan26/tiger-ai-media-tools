param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'

$root = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')
$modules = Join-Path $root 'node_modules'

if (-not (Test-Path -LiteralPath $modules)) {
    exit 0
}

Write-Host '[INFO] Stopping node processes that may lock node_modules...'
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[INFO] Removing node_modules at $modules ..."

function Remove-Tree {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return $true
    }
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        return -not (Test-Path -LiteralPath $Path)
    }
    catch {
        return $false
    }
}

if (Remove-Tree -Path $modules) {
    Write-Host '[INFO] node_modules removed.'
    exit 0
}

$trash = Join-Path $root ("node_modules.trash.{0}" -f [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
Write-Host "[WARN] Retrying via rename to $trash ..."
try {
    Rename-Item -LiteralPath $modules -NewName (Split-Path -Leaf $trash) -ErrorAction Stop
}
catch {
    cmd /c "rmdir /s /q `"$modules`"" | Out-Null
}

if (Test-Path -LiteralPath $modules) {
    Write-Host '[ERROR] Still cannot delete node_modules.'
    Write-Host '        Close Cursor/VS Code, end all node.exe tasks, then retry.'
    Write-Host '        Or run from local workspace: set AI_MEDIA_LOCAL_WORKSPACE=1 and start.bat'
    exit 1
}

if (Test-Path -LiteralPath $trash) {
    Remove-Tree -Path $trash | Out-Null
}

Write-Host '[INFO] node_modules removed.'
exit 0
