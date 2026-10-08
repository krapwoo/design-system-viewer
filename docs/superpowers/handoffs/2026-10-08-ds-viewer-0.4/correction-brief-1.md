# Correction pass — apply the Fable review to the `@krapwoo/ds-viewer` 0.4 plan

You are Claude Sonnet, the plan author. Edit ONLY `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4/docs/superpowers/plans/2026-10-08-ds-viewer-0.4.md` (and add spike evidence under `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/spikes/`). Fable returned NOT_READY (5 Critical, 12 Important, 8 Minor): `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan-fable-review/verdict.md`. Apply **every** finding in one pass, using Fable's suggested smallest fix unless a decision below says otherwise. Same rules as your original brief (`/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/brief.md`): Bash only for read-only inspection and spikes inside `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/spikes/`, no repository changes, no servers left running, no commits, never publish to the real npm registry.

## Controller decisions
1. **Security Minors become required:** compare the secret with `crypto.timingSafeEqual` on equal-length buffers, and reject requests whose `Host` header is not `127.0.0.1:<port>` (DNS-rebinding defence), with tests.
2. **Running the downloaded version's `migrate` (Critical):** prove the fix with a spike (for example, install the target into a temporary folder with its dependencies via the project's package manager, or `npm pack` + `npm install --prefix <tmp>`), then write it. Keep network use within design §5 ("fetches the package from npm, like any install").
3. **Non-blocking update and restart (Criticals):** the update runs as an async child process so `POST /update` answers 202 before work starts and `/update/status` keeps answering; the restart kills the whole process group (detached + negative pid, as `scripts/checkCatalogConsole.mjs` does) and waits for the port to free before re-binding. Spike the restart on a real `dev` in `kit-host` (ports 5190–5199) and record the evidence.
4. **Shared cache:** cache only `{ latest, checkedAt, summary }`; compute `current` and `breaking` per project; show nothing when latest is not newer.
5. **No network in `npm test` or `check:catalog`:** honour `DS_VIEWER_NO_UPDATE_CHECK=1` in those scripts and in CI, and make tests inject fetch/exec.
6. **Type gate for `.tsx` work:** every task that changes `native/catalog/*.tsx` runs `npm run check:types` (the strict consumer check) as its type gate.
7. **Mockup fidelity:** the Update page renders the breadcrumb "<app name> / DS Viewer" and the title "Update DS Viewer" above the 512px column, and every state's copy matches the approved mockup, including the three distinct failure cases.
8. Re-count every expected test count from the actual files after your edits.

## Final message
A table: finding → change (new line numbers) → evidence (spike command and output where applicable). Then the new line count, task count and test trajectory. Flag anything you could not apply.
