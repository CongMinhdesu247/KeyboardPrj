#!/usr/bin/env bash
set -euo pipefail

# Preflight only by default. No installs, login changes or parent-repo mutations.
case "${1:-}" in
  "") init_git=false ;;
  --init-git) init_git=true ;;
  *) echo "Usage: bash scripts/init-project.sh [--init-git]" >&2; exit 2 ;;
esac
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
failed=0
echo "Project: $project_root"

missing_files=()
for rel in \
  "AGENTS.md" \
  "GEMINI.md" \
  ".agents/BOARD.md" \
  ".agents/rules/01-model-routing.md" \
  ".agents/rules/02-debate-protocol.md" \
  ".agents/rules/03-quality-gates.md" \
  ".agents/agents/scout-worker.md" \
  ".agents/skills/project-team/SKILL.md" \
  ".agents/skills/codex-delegate/SKILL.md" \
  ".agents/skills/multi-agent-debate/SKILL.md"; do
  if [[ ! -e "$project_root/$rel" ]]; then
    missing_files+=("$rel")
  fi
done
if [[ "${#missing_files[@]}" -eq 0 ]]; then
  echo "[OK] Multi-agent starter structure (.agents, rules, agents, skills, board) is present."
else
  echo "[WARN] Missing starter files: ${missing_files[*]}"
  echo "[NEXT] Make sure hidden .agents files were copied into the project root."
  failed=1
fi

if command -v git >/dev/null 2>&1; then
  git_root="$(git -C "$project_root" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$git_root" ]]; then git_root="$(cd -- "$git_root" && pwd -P)"; fi
  if [[ "$git_root" != "$project_root" && "$init_git" == true ]]; then
    git -C "$project_root" init
    git_root="$project_root"
  fi
  if [[ "$git_root" == "$project_root" ]]; then
    echo "[OK] Git root matches project."
    if ! git -C "$project_root" rev-parse --verify HEAD >/dev/null 2>&1; then
      echo "[INFO] Repository has no commits yet. Sequential edits work now; create an initial commit before using git worktree."
    fi
  else
    echo "[WARN] Git root '$git_root' is not this project. No Git mutation was performed."
    echo "[NEXT] Use a dedicated project location or explicitly pass --init-git."
    failed=1
  fi
else
  echo "[WARN] Git is missing from PATH."
  failed=1
fi

codex_bin=""
codex_source=""
if [[ -n "${CODEX_BIN:-}" ]]; then
  if [[ -f "$CODEX_BIN" ]]; then
    codex_bin="$CODEX_BIN"
    codex_source="CODEX_BIN"
  else
    echo "[WARN] CODEX_BIN points to a missing file: $CODEX_BIN"
    failed=1
  fi
elif command -v codex >/dev/null 2>&1; then
  codex_bin="$(command -v codex)"
  codex_source="PATH"
elif [[ "${AGENT_DISABLE_CODEX_DISCOVERY:-}" != "1" ]]; then
  for candidate in \
    "$HOME"/.antigravity/extensions/openai.chatgpt-*/bin/windows-x86_64/codex.exe \
    "$HOME"/.vscode/extensions/openai.chatgpt-*/bin/windows-x86_64/codex.exe; do
    if [[ -f "$candidate" ]]; then
      codex_bin="$candidate"
      codex_source="IDEExtension"
    fi
  done
fi

if [[ -n "$codex_bin" ]]; then
  echo "[OK] Codex resolved via $codex_source: $codex_bin"
  if ! "$codex_bin" --version; then failed=1; fi
  if "$codex_bin" login status >/dev/null 2>&1; then
    echo "[OK] Codex reports authentication; confirm the account/billing method separately."
  else
    echo "[WARN] Codex authentication is unavailable; run codex login."
    failed=1
  fi
  if help_text="$("$codex_bin" --help 2>/dev/null)"; then
    if [[ "$help_text" =~ mcp-server ]]; then
      echo "[INFO] CLI mentions mcp-server; verify the actual command and handshake before enabling MCP."
    else
      echo "[INFO] No mcp-server advertised; use codex exec or manual handoff."
    fi
  else
    echo "[WARN] codex --help failed."
    failed=1
  fi
elif [[ -z "${CODEX_BIN:-}" ]]; then
  echo "[WARN] Codex is missing; set CODEX_BIN, use a terminal with Codex, or use manual handoff."
  failed=1
fi
echo "[INFO] Check Antigravity model access and a real cross-model task in the IDE."
if [[ "$failed" -ne 0 ]]; then echo "[RESULT] Preflight has unresolved items."; exit 1; fi
echo "[RESULT] CLI preflight passed; multi-agent end-to-end readiness is not yet proven."
