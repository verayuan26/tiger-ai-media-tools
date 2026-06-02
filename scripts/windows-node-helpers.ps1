function Test-NodeCanRequire {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ModuleName,

        [Parameter(Mandatory = $true)]
        [string]$NodeExe,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    $sq = [char]39
    $expr = 'require(' + $sq + $ModuleName + $sq + ')'

    $stdout = [System.IO.Path]::GetTempFileName()
    $stderr = [System.IO.Path]::GetTempFileName()

    try {
        $process = Start-Process -FilePath $NodeExe -ArgumentList @('-e', $expr) -WorkingDirectory $WorkingDirectory -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        return ($process.ExitCode -eq 0)
    }
    finally {
        Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
    }
}

function Get-NodeProcessArch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NodeExe
    )

    $stdout = [System.IO.Path]::GetTempFileName()
    $stderr = [System.IO.Path]::GetTempFileName()

    try {
        $process = Start-Process -FilePath $NodeExe -ArgumentList @('-p', 'process.arch') -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        if ($process.ExitCode -ne 0) {
            return 'x64'
        }

        $value = (Get-Content -LiteralPath $stdout -Raw).Trim()
        if ($value) {
            return $value
        }
    }
    finally {
        Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
    }

    return 'x64'
}
