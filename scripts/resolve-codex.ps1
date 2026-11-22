function Resolve-CodexExecutable {
    [CmdletBinding()]
    param()

    if (-not [string]::IsNullOrWhiteSpace($env:CODEX_BIN)) {
        $overridePath = $env:CODEX_BIN.Trim()
        if (Test-Path -LiteralPath $overridePath -PathType Leaf) {
            return @{
                Path   = (Resolve-Path -LiteralPath $overridePath).ProviderPath
                Source = 'CODEX_BIN'
            }
        }
        return @{
            Path   = $null
            Source = 'CODEX_BIN_INVALID'
            Error  = "CODEX_BIN points to a missing file: $overridePath"
        }
    }

    $cmd = Get-Command codex -ErrorAction SilentlyContinue
    if ($cmd -and -not [string]::IsNullOrWhiteSpace($cmd.Source)) {
        return @{
            Path   = $cmd.Source
            Source = 'PATH'
        }
    }

    if ($env:AGENT_DISABLE_CODEX_DISCOVERY -eq '1') {
        return $null
    }

    # 1. Windows Codex Desktop App (MSIX / Store package)
    if (Get-Command Get-AppxPackage -ErrorAction SilentlyContinue) {
        try {
            $appxPackages = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue |
                Sort-Object -Property Version -Descending
            foreach ($pkg in $appxPackages) {
                if (-not [string]::IsNullOrWhiteSpace($pkg.InstallLocation)) {
                    $candidate = Join-Path $pkg.InstallLocation 'app\resources\codex.exe'
                    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                        return @{
                            Path   = $candidate
                            Source = 'CodexApp'
                        }
                    }
                }
            }
        } catch {
            # Ignore package query errors on restricted systems and try extension paths.
        }
    }

    # 2. Antigravity / VS Code OpenAI Codex extension bundled CLI
    $extensionRoots = @(
        @{ Root = (Join-Path $env:USERPROFILE '.antigravity\extensions'); Source = 'AntigravityExtension' },
        @{ Root = (Join-Path $env:USERPROFILE '.vscode\extensions'); Source = 'VSCodeExtension' }
    )
    foreach ($entry in $extensionRoots) {
        if (-not [string]::IsNullOrWhiteSpace($entry.Root) -and (Test-Path -LiteralPath $entry.Root -PathType Container)) {
            $extDirs = Get-ChildItem -LiteralPath $entry.Root -Directory -Filter 'openai.chatgpt-*' -ErrorAction SilentlyContinue |
                Sort-Object -Property Name -Descending
            foreach ($dir in $extDirs) {
                $candidate = Join-Path $dir.FullName 'bin\windows-x86_64\codex.exe'
                if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                    return @{
                        Path   = $candidate
                        Source = $entry.Source
                    }
                }
            }
        }
    }

    return $null
}
