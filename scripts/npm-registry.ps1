$script:NpmRegistryMirror = 'https://registry.npmmirror.com'

function Get-NpmRegistryArguments {
    return @('--registry', $script:NpmRegistryMirror)
}
