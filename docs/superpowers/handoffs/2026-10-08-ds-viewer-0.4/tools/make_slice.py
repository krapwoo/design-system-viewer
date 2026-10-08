#!/usr/bin/env python3
"""Generate a guarded Sonnet build-slice brief + manifest for ds-viewer 0.2 and preflight it.
Usage: make_slice.py <slice_id> <worktree> "<tasks label>" "<prior-state sentence>" [extra rule ...]
Prints the manifest path."""
import hashlib, json, subprocess, sys, os

B = '/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-03-build'
os.makedirs(B, exist_ok=True)
open(f'{B}/empty-mcp.json', 'w').write('{"mcpServers":{}}')
sid, W, tasks, prior = sys.argv[1:5]
extra = sys.argv[5:]
P = f'{W}/docs/superpowers/plans/2026-10-08-ds-viewer-0.3.md'
D = f'{W}/docs/superpowers/specs/2026-10-07-ds-viewer-npm-package-design.md'
rules = [
    f'Execute **{tasks}** of the plan exactly, step by step, including every RED step (run the test, confirm it fails for the stated reason) before the implementation. The plan\'s **Errata** section (top of the plan) is binding and wins over the task text.',
    'Where the plan says `/Users/woohopark/HermesProject/Projects/design-system-viewer`, use this worktree path instead.',
    '**Do not commit, push, tag, or publish.** Skip every "Commit (only with commit authority)" step. Leave changes uncommitted (`git mv` and `git rm` are allowed because the plan uses them to keep history; they only stage).',
    'Do not edit anything under `docs/`. Do not edit any `node_modules/`.',
    'If the plan\'s code fails in a way the plan did not predict, fix it with the smallest change that keeps the plan\'s intent and interfaces, and record it under "Deviations". Never weaken or delete a test; never change a later task\'s interface.',
    'Any Expo/Metro/browser process you start must run with a timeout and be killed before your next step; leave no processes running. Use ports 5190-5199 only.',
    f'Stop after {tasks}. Do not start later tasks.',
    'Report honestly. Do not end your turn while tests are running in the background.',
    prior,
] + list(extra)
brief = f"""# Build slice {sid} — `@krapwoo/ds-viewer` 0.3, {tasks}

You are Claude Sonnet implementing an approved, independently reviewed plan. Work only in the worktree `{W}` (its own branch).

## Source of truth
- Plan: `{P}`
- Design (intent; the plan wins on details): `{D}`

## Rules
""" + '\n'.join(f'{i}. {r}' for i, r in enumerate(rules, 1)) + """

## Final message (required)
- Tasks/steps completed.
- RED results: each test command and the failure seen.
- GREEN results: each test command and its pass/fail counts.
- Other commands run (install, typecheck, build, browser checks) and their results.
- Deviations from the plan: file, what changed, why.
- Unfinished items, if any.
"""
bp = f'{B}/{sid}-brief.md'
open(bp, 'w').write(brief)
m = {"manifest_version": 1, "task_id": "ds-viewer-03-build", "slice_id": sid, "attempt": 1, "role": "mutating", "model": "sonnet",
     "workdir": W, "add_dirs": [B], "required_read_paths": [bp, P, D],
     "tools": ["Read", "Grep", "Glob", "Edit", "Write", "Bash"], "allowed_tools": ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
     "disallowed_tools": ["WebSearch", "WebFetch", "NotebookEdit", "Task"], "required_tools": ["Read", "Edit", "Bash"],
     "prompt_path": bp, "prompt_sha256": hashlib.sha256(brief.encode()).hexdigest(),
     "write_paths": [W], "deny_write_paths": [f'{W}/.git', f'{W}/docs', '/Users/woohopark/HermesProject/Projects', '/Users/woohopark/HermesProject/WooVault', B],
     "max_turns": 200, "hard_timeout_seconds": 10800, "stall_seconds": 1200, "restricted": True, "safe_mode": True,
     "permission_mode": "dontAsk", "permission_prompts": "none", "strict_mcp_config": True, "mcp_config_path": f'{B}/empty-mcp.json'}
mp = f'{B}/{sid}.manifest.json'
json.dump(m, open(mp, 'w'), indent=2)
env = dict(os.environ, HERMES_HOME='/Users/woohopark/.hermes/profiles/app-design')
r = subprocess.run(['python3', '/Users/woohopark/.hermes/scripts/claude_guarded_run.py', 'preflight', '--manifest', mp], capture_output=True, text=True, env=env)
print(r.stdout.strip()[-200:], r.stderr.strip()[-300:])
print(mp)
