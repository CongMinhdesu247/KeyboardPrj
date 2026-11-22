[CmdletBinding()]
param([switch]$KeepArtifacts)

$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('agent-starter-check-' + [guid]::NewGuid().ToString('N'))
$project = Join-Path $testRoot 'parent/project with spaces'
$shim = Join-Path $testRoot 'fake-bin'
$altBin = Join-Path $testRoot 'alt-bin'
$shell = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $shell)) { $shell = Join-Path $PSHOME 'pwsh.exe' }
$git = (Get-Command git -ErrorAction Stop).Source
$node = (Get-Command node -ErrorAction Stop).Source
$originalPath = $env:PATH
$originalCapture = $env:AGENT_TEST_CAPTURE
$originalExit = $env:AGENT_TEST_EXIT
$originalNoReport = $env:AGENT_TEST_NO_REPORT
$originalAuth = $env:AGENT_TEST_AUTH_FAIL
$originalCodexBin = $env:CODEX_BIN
$originalDisableDiscovery = $env:AGENT_DISABLE_CODEX_DISCOVERY
$checks = 0
$passedAll = $false

function Assert-Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    $script:checks++
    Write-Host "[PASS] $Message"
}
function Run-ProjectScript([string]$Name, [string[]]$Arguments = @()) {
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & $shell -NoProfile -File (Join-Path $project "scripts/$Name") @Arguments 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    return @{ Code = $code; Text = ($output -join "`n") }
}

try {
    New-Item -ItemType Directory -Path `
        "$project/scripts", `
        "$project/.agents/tasks", `
        "$project/.agents/rules", `
        "$project/.agents/agents", `
        "$project/.agents/skills/project-team", `
        "$project/.agents/skills/codex-delegate", `
        "$project/.agents/skills/multi-agent-debate", `
        $shim, $altBin -Force | Out-Null

    Copy-Item -LiteralPath `
        (Join-Path $PSScriptRoot 'init-project.ps1'), `
        (Join-Path $PSScriptRoot 'invoke-codex.ps1'), `
        (Join-Path $PSScriptRoot 'resolve-codex.ps1') -Destination "$project/scripts"

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    # Minimal starter structure placeholders so preflight structure check passes.
    foreach ($placeholder in @(
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
    )) {
        [IO.File]::WriteAllText((Join-Path $project $placeholder), "# placeholder`n", $utf8)
    }

    # Construct Unicode without relying on the PowerShell 5 source-file encoding.
    $unicodePrompt = 'Check ' + [char]0x1EBF + ' ' + [char]0x2713 + ' $(do-not-execute) `literal`'
    [IO.File]::WriteAllText("$project/.agents/tasks/test.md", $unicodePrompt, $utf8)
    [IO.File]::WriteAllText("$testRoot/outside.md", 'outside', $utf8)
    [IO.File]::WriteAllText("$project/.agents/tasks/empty.md", '   ', $utf8)
    $fakeCodexJs = @'
const fs = require('fs');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('fake-codex'); process.exit(0); }
if (args[0] === '--help') { console.log('Commands:\n  exec  Run task\n  login  Manage login'); process.exit(0); }
if (args[0] === 'login') { console.log('Logged in using ChatGPT'); process.exit(process.env.AGENT_TEST_AUTH_FAIL ? 1 : 0); }
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', data => { input += data; });
process.stdin.on('end', () => {
  fs.writeFileSync(process.env.AGENT_TEST_CAPTURE, JSON.stringify({args, cwd: process.cwd(), input}));
  const output = args[args.indexOf('-o') + 1];
  if (!process.env.AGENT_TEST_NO_REPORT) fs.writeFileSync(output, 'Fake final response');
  process.exit(Number(process.env.AGENT_TEST_EXIT || 0));
});
'@
    [IO.File]::WriteAllText("$shim/codex.cmd", "@echo off`r`nnode `"%~dp0fake-codex.cjs`" %*`r`n", $utf8)
    [IO.File]::WriteAllText("$shim/fake-codex.cjs", $fakeCodexJs, $utf8)
    [IO.File]::WriteAllText("$altBin/codex-alt.cmd", "@echo off`r`nnode `"%~dp0fake-codex.cjs`" %*`r`n", $utf8)
    [IO.File]::WriteAllText("$altBin/fake-codex.cjs", $fakeCodexJs, $utf8)

    $toolPath = @((Split-Path $git), (Split-Path $node), "$env:SystemRoot/System32") -join ';'
    $env:PATH = "$shim;$toolPath"
    $env:CODEX_BIN = $null
    $env:AGENT_DISABLE_CODEX_DISCOVERY = '1'
    $env:AGENT_TEST_CAPTURE = "$testRoot/capture.json"
    $env:AGENT_TEST_EXIT = $null
    $env:AGENT_TEST_NO_REPORT = $null
    $env:AGENT_TEST_AUTH_FAIL = $null
    & $git -C (Join-Path $testRoot 'parent') init -q
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the temporary parent repository.' }

    $result = Run-ProjectScript 'init-project.ps1'
    Assert-Check ($result.Code -eq 1 -and -not (Test-Path "$project/.git")) 'Preflight detects parent Git and does not mutate it.'
    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', '.agents/tasks/test.md')
    Assert-Check ($result.Code -ne 0 -and -not (Test-Path $env:AGENT_TEST_CAPTURE)) 'Delegation refuses parent Git before invoking Codex.'
    $result = Run-ProjectScript 'init-project.ps1' @('-InitGit')
    Assert-Check ($result.Code -eq 0 -and (Test-Path "$project/.git")) 'Explicit initialization creates a dedicated project repository.'

    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', '.agents/tasks/test.md')
    Assert-Check ($result.Code -eq 0) ('Review succeeds from a different caller directory. ' + $result.Text)
    $capture = Get-Content -LiteralPath $env:AGENT_TEST_CAPTURE -Raw -Encoding UTF8 | ConvertFrom-Json
    $firstReport = $capture.args[[Array]::IndexOf($capture.args, '-o') + 1]
    Assert-Check ($capture.cwd -eq $project -and $capture.args[[Array]::IndexOf($capture.args, '-C') + 1] -eq $project) 'Both process cwd and Codex working root match the project.'
    Assert-Check ($capture.args[[Array]::IndexOf($capture.args, '-s') + 1] -eq 'read-only' -and $capture.args[-1] -eq '-') 'Review uses read-only sandbox and stdin.'
    Assert-Check (($capture.args -contains '--ephemeral') -and ($capture.args[[Array]::IndexOf($capture.args, '--color') + 1] -eq 'never')) 'Delegation defaults to --ephemeral and --color never.'
    Assert-Check ($capture.input.Contains($unicodePrompt)) 'Unicode prompt and shell metacharacters survive literally.'
    Assert-Check (Test-Path -LiteralPath $firstReport -PathType Leaf) 'Successful delegation produces a final response artifact.'

    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', '.agents/tasks/test.md', '-Mode', 'Implement', '-PersistSession')
    $capture = Get-Content -LiteralPath $env:AGENT_TEST_CAPTURE -Raw -Encoding UTF8 | ConvertFrom-Json
    $secondReport = $capture.args[[Array]::IndexOf($capture.args, '-o') + 1]
    Assert-Check ($result.Code -eq 0 -and $capture.args[[Array]::IndexOf($capture.args, '-s') + 1] -eq 'workspace-write' -and -not ($capture.args -contains '--ephemeral') -and $secondReport -ne $firstReport) 'Implementation uses workspace-write, unique report, and honors -PersistSession.'

    $env:AGENT_TEST_EXIT = '7'
    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', '.agents/tasks/test.md')
    Assert-Check ($result.Code -eq 7) 'Codex failure exit code is preserved.'
    $env:AGENT_TEST_EXIT = $null
    $env:AGENT_TEST_NO_REPORT = '1'
    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', '.agents/tasks/test.md')
    Assert-Check ($result.Code -ne 0) 'Success without a final artifact is rejected.'
    $env:AGENT_TEST_NO_REPORT = $null
    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', "$testRoot/outside.md")
    Assert-Check ($result.Code -ne 0) 'Prompt outside the project is rejected.'
    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', '.agents/tasks/empty.md')
    Assert-Check ($result.Code -ne 0) 'Empty prompt is rejected.'
    $env:AGENT_TEST_AUTH_FAIL = '1'
    $result = Run-ProjectScript 'init-project.ps1'
    Assert-Check ($result.Code -eq 1) 'Failed authentication prevents a passing preflight.'
    $env:AGENT_TEST_AUTH_FAIL = $null

    # Test missing Codex and CODEX_BIN override without PATH entry
    $env:PATH = $toolPath
    $result = Run-ProjectScript 'init-project.ps1'
    Assert-Check ($result.Code -eq 1 -and $result.Text.Contains('Codex is missing')) 'Missing Codex is reported without installing anything.'
    $env:CODEX_BIN = "$altBin/codex-alt.cmd"
    $result = Run-ProjectScript 'init-project.ps1'
    Assert-Check ($result.Code -eq 0 -and $result.Text.Contains('via CODEX_BIN')) 'CODEX_BIN resolves Codex even when not in PATH.'
    $result = Run-ProjectScript 'invoke-codex.ps1' @('-PromptFile', '.agents/tasks/test.md')
    Assert-Check ($result.Code -eq 0 -and $result.Text.Contains('(CODEX_BIN)')) 'Delegation works via CODEX_BIN when Codex is not in PATH.'
    $env:CODEX_BIN = $null
    $env:PATH = "$shim;$toolPath"

    # Test missing starter structure detection (board and rules)
    Remove-Item -LiteralPath "$project/.agents/BOARD.md" -Force
    $result = Run-ProjectScript 'init-project.ps1'
    Assert-Check ($result.Code -eq 1 -and $result.Text.Contains('Missing starter files')) 'Missing hidden .agents files are caught by preflight.'
    [IO.File]::WriteAllText("$project/.agents/BOARD.md", "# placeholder`n", $utf8)
    Remove-Item -LiteralPath "$project/.agents/rules/02-debate-protocol.md" -Force
    $result = Run-ProjectScript 'init-project.ps1'
    Assert-Check ($result.Code -eq 1 -and $result.Text.Contains('02-debate-protocol.md')) 'Missing required rule file is caught by preflight.'
    [IO.File]::WriteAllText("$project/.agents/rules/02-debate-protocol.md", "# placeholder`n", $utf8)

    & $git -C $project -c user.name=StarterTest -c user.email=starter@example.invalid add scripts .agents/BOARD.md .agents/tasks .agents/rules .agents/agents .agents/skills AGENTS.md GEMINI.md
    if ($LASTEXITCODE -ne 0) { throw 'Temporary staging failed.' }
    & $git -C $project -c user.name=StarterTest -c user.email=starter@example.invalid commit -qm 'Temporary test baseline'
    if ($LASTEXITCODE -ne 0) { throw 'Temporary commit failed.' }
    $worktree = Join-Path $testRoot 'linked-worktree'
    & $git -C $project worktree add -q -b smoke $worktree
    if ($LASTEXITCODE -ne 0) { throw 'Temporary worktree failed.' }
    $linkedOutput = & $shell -NoProfile -File "$worktree/scripts/init-project.ps1" 2>&1
    $linkedCode = $LASTEXITCODE
    Assert-Check ($linkedCode -eq 0 -and (Test-Path "$worktree/.git" -PathType Leaf)) 'Linked worktree with a .git file passes preflight.'
    New-Item -ItemType Junction -Path "$worktree/.agents/runs" -Target $shim | Out-Null
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $junctionOutput = & $shell -NoProfile -File "$worktree/scripts/invoke-codex.ps1" -PromptFile .agents/tasks/test.md 2>&1
    $junctionCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    Assert-Check ($junctionCode -ne 0 -and ($junctionOutput -join ' ').Contains('normal project directory')) 'Junction output directory is rejected.'
    $passedAll = $true
    if ($KeepArtifacts) {
        Write-Host "[RESULT] $checks checks passed. No real model was invoked. Test artifacts kept at: $testRoot"
    } else {
        Write-Host "[RESULT] $checks checks passed. No real model was invoked."
    }
} finally {
    $env:PATH = $originalPath
    $env:AGENT_TEST_CAPTURE = $originalCapture
    $env:AGENT_TEST_EXIT = $originalExit
    $env:AGENT_TEST_NO_REPORT = $originalNoReport
    $env:AGENT_TEST_AUTH_FAIL = $originalAuth
    $env:CODEX_BIN = $originalCodexBin
    $env:AGENT_DISABLE_CODEX_DISCOVERY = $originalDisableDiscovery
    if ($passedAll -and -not $KeepArtifacts -and (Test-Path -LiteralPath $testRoot)) {
        try {
            Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
        } catch {
            # Best-effort cleanup only.
        }
    }
}
