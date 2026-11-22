[CmdletBinding()]
param([switch]$InitGit)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$failed = $false
Write-Host "Project: $projectRoot"

. (Join-Path $PSScriptRoot 'resolve-codex.ps1')

# 1. Verify starter structure (catches missing hidden .agents folder after manual copy)
$requiredPaths = @(
    'AGENTS.md',
    'GEMINI.md',
    '.agents/BOARD.md',
    '.agents/rules/01-model-routing.md',
    '.agents/rules/02-debate-protocol.md',
    '.agents/rules/03-quality-gates.md',
    '.agents/agents/scout-worker.md',
    '.agents/skills/project-team/SKILL.md',
    '.agents/skills/codex-delegate/SKILL.md',
    '.agents/skills/multi-agent-debate/SKILL.md'
)
$missingPaths = @()
foreach ($relPath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relPath))) {
        $missingPaths += $relPath
    }
}
if ($missingPaths.Count -eq 0) {
    Write-Host '[OK] Multi-agent starter structure (.agents, rules, agents, skills, board) is present.'
} else {
    $failed = $true
    Write-Host ("[WARN] Missing starter files: {0}" -f ($missingPaths -join ', '))
    Write-Host '[NEXT] Make sure hidden .agents files were copied into the project root.'
}

# 2. Verify dedicated Git root
if (Get-Command git -ErrorAction SilentlyContinue) {
    $ErrorActionPreference = 'Continue'
    $gitOutput = & git -C $projectRoot rev-parse --show-toplevel 2>&1
    $gitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $gitRoot = if ($gitCode -eq 0) { ([string]($gitOutput | Select-Object -Last 1)).Trim() } else { $null }
    $sameRoot = $gitRoot -and ([IO.Path]::GetFullPath($gitRoot).TrimEnd('\', '/') -eq $projectRoot.TrimEnd('\', '/'))
    if (-not $sameRoot -and $InitGit) {
        Write-Host "[INFO] Creating a repository ONLY in $projectRoot"
        & git -C $projectRoot init
        if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }
        $sameRoot = $true
    }
    if ($sameRoot) {
        Write-Host '[OK] Git root matches project (linked worktrees are supported).'
        $ErrorActionPreference = 'Continue'
        & git -C $projectRoot rev-parse --verify HEAD *> $null
        $hasHead = ($LASTEXITCODE -eq 0)
        $ErrorActionPreference = 'Stop'
        if (-not $hasHead) {
            Write-Host '[INFO] Repository has no commits yet. Sequential workspace edits work now; create an initial commit before using git worktree.'
        }
    } else {
        $failed = $true
        Write-Host "[WARN] Git root is '$gitRoot', not this project. No Git mutation was performed."
        Write-Host '[NEXT] Move/copy to a dedicated project location, or explicitly run this script with -InitGit.'
    }
} else {
    $failed = $true
    Write-Host '[WARN] Git is missing from PATH.'
}

# 3. Verify Codex CLI (PATH, CODEX_BIN, Codex Desktop App, or IDE extension)
$codexInfo = Resolve-CodexExecutable
if ($codexInfo -and $codexInfo.Path) {
    $codexExe = $codexInfo.Path
    Write-Host ("[OK] Codex resolved via {0}: {1}" -f $codexInfo.Source, $codexExe)
    $ErrorActionPreference = 'Continue'
    $version = & $codexExe --version 2>&1
    $versionCode = $LASTEXITCODE
    $login = & $codexExe login status 2>&1
    $loginCode = $LASTEXITCODE
    $helpText = (& $codexExe --help 2>&1) -join "`n"
    $helpCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($versionCode -eq 0) { Write-Host "[OK] $version" } else { $failed = $true; Write-Host '[WARN] codex --version failed.' }
    if ($loginCode -eq 0) {
        Write-Host '[OK] Codex reports an authenticated session.'
        if (($login -join ' ') -notmatch 'ChatGPT') {
            Write-Host '[INFO] Confirm the account/billing method before running tasks; authentication alone does not prove Plus usage.'
        }
    } else {
        $failed = $true
        Write-Host '[WARN] Codex authentication is unavailable; run codex login in a terminal.'
    }
    if ($helpCode -ne 0) {
        $failed = $true
        Write-Host '[WARN] codex --help failed.'
    } elseif ($helpText -match '(?m)^\s+mcp-server\s') {
        Write-Host '[INFO] This CLI lists mcp-server. MCP still requires a real handshake/tool check.'
    } else {
        Write-Host '[INFO] No mcp-server subcommand listed; use codex exec through invoke-codex.ps1.'
    }
} else {
    $failed = $true
    if ($codexInfo -and $codexInfo.Error) {
        Write-Host "[WARN] $($codexInfo.Error)"
    } else {
        Write-Host '[WARN] Codex is missing from PATH and known local installs. Set CODEX_BIN, install Codex CLI, or use manual handoff.'
    }
}

Write-Host '[INFO] Native Antigravity agents, model access and cross-model end-to-end execution must be checked in the IDE.'
if ($failed) { Write-Host '[RESULT] Preflight has unresolved items.'; exit 1 }
Write-Host '[RESULT] CLI preflight passed. This does not prove multi-agent end-to-end readiness.'
exit 0
