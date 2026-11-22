[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PromptFile,
    [ValidateSet('Review', 'Implement')][string]$Mode = 'Review',
    [switch]$PersistSession
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required.' }

. (Join-Path $PSScriptRoot 'resolve-codex.ps1')
$codexInfo = Resolve-CodexExecutable
if (-not $codexInfo -or -not $codexInfo.Path) {
    if ($codexInfo -and $codexInfo.Error) { throw $codexInfo.Error }
    throw 'Codex is not available in PATH or known local installs. Set CODEX_BIN or use manual handoff.'
}
$codexExe = $codexInfo.Path

$ErrorActionPreference = 'Continue'
$gitOutput = & git -C $projectRoot rev-parse --show-toplevel 2>&1
$gitCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($gitCode -ne 0) { throw 'Create a dedicated project Git repository before delegating.' }
$gitRoot = [IO.Path]::GetFullPath(([string]($gitOutput | Select-Object -Last 1)).Trim()).TrimEnd('\', '/')
if ($gitRoot -ne $projectRoot) { throw "Refusing parent repository '$gitRoot'. Run preflight and choose a dedicated repository." }

$promptPath = if ([IO.Path]::IsPathRooted($PromptFile)) { [IO.Path]::GetFullPath($PromptFile) } else { [IO.Path]::GetFullPath((Join-Path $projectRoot $PromptFile)) }
if (-not $promptPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'PromptFile must be inside this project.'
}
if (-not (Test-Path -LiteralPath $promptPath -PathType Leaf)) { throw "Prompt file not found: $promptPath" }

function Test-IsRedirectLink([IO.FileSystemInfo]$Item) {
    if ($null -eq $Item) { return $false }
    if (-not ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $false }
    # Distinguish symlinks/junctions from benign cloud reparse points (e.g. OneDrive Files On-Demand).
    $linkTypeProp = $Item.PSObject.Properties['LinkType']
    if ($linkTypeProp -and $linkTypeProp.Value -in @('SymbolicLink', 'Junction')) { return $true }
    $targetProp = $Item.PSObject.Properties['Target']
    if ($targetProp -and $null -ne $targetProp.Value -and @($targetProp.Value).Count -gt 0) { return $true }
    return $false
}

# Reject symlinks/junctions inside the project path (without breaking OneDrive Files On-Demand).
$pathItem = Get-Item -LiteralPath $promptPath -Force
if (Test-IsRedirectLink $pathItem) { throw 'Symlink/junction paths are not supported for delegation.' }
$directory = $pathItem.Directory
while ($null -ne $directory) {
    $dirFull = $directory.FullName.TrimEnd('\', '/')
    if ($dirFull.Equals($projectRoot, [StringComparison]::OrdinalIgnoreCase)) {
        break
    }
    if (Test-IsRedirectLink $directory) { throw 'Symlink/junction paths are not supported for delegation.' }
    $directory = $directory.Parent
}

$prompt = Get-Content -LiteralPath $promptPath -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($prompt)) { throw 'Prompt file is empty.' }

$runDirectory = Join-Path $projectRoot '.agents/runs'
if (Test-Path -LiteralPath $runDirectory) {
    $runItem = Get-Item -LiteralPath $runDirectory -Force
    if (-not $runItem.PSIsContainer -or (Test-IsRedirectLink $runItem)) { throw 'Run output must be a normal project directory.' }
}
$agentsDirectory = Get-Item -LiteralPath (Join-Path $projectRoot '.agents') -Force
if (Test-IsRedirectLink $agentsDirectory) { throw '.agents must not be a symlink or junction.' }
[IO.Directory]::CreateDirectory($runDirectory) | Out-Null

$report = Join-Path $runDirectory ("{0}-{1}-{2}.md" -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Mode.ToLowerInvariant(), [guid]::NewGuid().ToString('N'))
$sandbox = if ($Mode -eq 'Review') { 'read-only' } else { 'workspace-write' }
$instruction = if ($Mode -eq 'Review') {
    'Review source files read-only. Do not edit project files or invoke other agents. Return findings with evidence and the reviewed snapshot; do not claim cross-model review without identifying the actual maker model.'
} else {
    'Implement only the assigned task and owned files. Preserve existing changes. Do not invoke other agents. Report checks and hand off for independent review; do not approve your own work.'
}
$inputText = "Read AGENTS.md and the assigned task. This is a single delegated worker task.`n$instruction`n`n$prompt"

$codexArgs = @('-a', 'never', 'exec', '-C', $projectRoot, '-s', $sandbox, '--color', 'never')
if (-not $PersistSession) {
    $codexArgs += '--ephemeral'
}
$codexArgs += @('-o', $report, '-')

# PowerShell 5 otherwise encodes piped text as ASCII.
$previousEncoding = $OutputEncoding
$previousLocation = Get-Location
try {
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    Set-Location -LiteralPath $projectRoot
    $ErrorActionPreference = 'Continue'
    $inputText | & $codexExe @codexArgs
    $codexCode = $LASTEXITCODE
} finally {
    $OutputEncoding = $previousEncoding
    Set-Location -LiteralPath $previousLocation.Path
}
if ($codexCode -eq 0 -and (-not (Test-Path -LiteralPath $report -PathType Leaf) -or (Get-Item -LiteralPath $report).Length -eq 0)) {
    Write-Host '[ERROR] Codex returned success without a final response artifact.'
    exit 1
}
Write-Host ("Codex ({0}) exit code: {1}; final response path: {2}" -f $codexInfo.Source, $codexCode, $report)
if ($codexCode -ne 0) {
    Write-Host '[ERROR] Delegation failed; do not retry blindly (avoid wasting quota). Check auth/quota/error output or fall back to manual handoff.'
}
exit $codexCode
