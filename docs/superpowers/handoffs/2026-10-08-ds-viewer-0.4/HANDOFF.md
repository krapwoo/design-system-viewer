# Handoff: `@krapwoo/ds-viewer` 0.4 (start here in a new session)

Written 2026-10-08 by the App Design controller, session `20261007_205910_31e7a4`. Everything below was checked when it was written; re-check mutable facts (`git status`, npm, CI) before acting.

## 1. Where things stand

| Release | State |
|---|---|
| 0.1.0, 0.1.1, 0.2.0, 0.3.0 | Published on npm (`latest` = 0.3.0), each with an SLSA provenance attestation, published by `release.yml` through trusted publishing |
| `@krapwoo/catalog` | All versions deprecated: "Replaced by @krapwoo/ds-viewer" |
| **0.4** | **Plan final: corrected once, Fable follow-up NOT_READY with small fixes, which were written as a binding `## Errata` at the top of the plan (commit `2087311`). Restart spike done. Nothing built.** |

- Repository: `/Users/woohopark/HermesProject/Projects/design-system-viewer` (`main` at `43c58d9`, the v0.3.0 release commit)
- 0.4 worktree: `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4`, branch `feat/ds-viewer-0.4` (local only, not pushed). Commits: `e00cb2e` (mockups), `40435f5` (plan), `3b0bf77` (corrected plan), and the commit adding this handoff.
- Dependencies are installed in that worktree (root and `kit-host`).

## 2. Approved inputs (binding)

- Design: `docs/superpowers/specs/2026-10-07-ds-viewer-npm-package-design.md` (revision 3). 0.4 is the "0.4" row of §6, plus all of §5.
- **Owner-approved mockup:** `docs/design/2026-10-08-ds-viewer-update-panel-approved.html`, sha256 `c334ed7aea59213681aa790767e9bfedd06749276d739f75e3045778ae35fe83`. Direction **C · Update page** at `#ds-viewer-update`, opened from the sidebar footer line or the major banner's "Review update". **Content max width 512px** (the owner asked for about two-thirds of the first draft). Ten states with their copy, plus new warning/danger/success tokens.
- Plan: `docs/superpowers/plans/2026-10-08-ds-viewer-0.4.md`, 20 tasks, sha256 `e98f08b9a884d92f738f79332f60eb3bbc0fd58fdb1e9c7b1afd9826d40e5a2f` at `2087311` (the Errata section was added on top of `3b0bf77`'s text). Task 20 is controller-only verification. **Every slice brief must say: the Errata section wins over the task text.**
- Owner decisions this cycle: build 0.4 after the mockup approval; plans that pass Fable review go ahead without owner approval; stop only for mockups and blockers.

## 3. Review history (files in this folder)

- `plan-brief.md`: the controller's brief and binding decisions for the plan.
- `fable-plan-review-1.md`: Fable's review, **NOT_READY** (5 Critical, 12 Important, 8 Minor). The endpoint's security order (Origin, then secret, then route, with preflight before auth) was rated a strength.
- `correction-brief-1.md` and `correction-report-1.md`: one correction pass that applied all 25 findings, with tests now 238 → 353. The controller also made two security Minors required: `timingSafeEqual` for the secret, and a `Host` header check against DNS rebinding.
- `spikes-README.md`: worker-reported spikes (CORS/endpoint with `curl`, Verdaccio end-to-end without publishing, running the downloaded version's `migrate`).

## 3a. Update (2026-10-08, later in the same session `20261007_205910_31e7a4`)

- Steps 1 and 2 below are **done**. `fable-plan-review-2.md` is the follow-up verdict: NOT_READY, 2 Critical, 6 Important, 8 Minor. 21 of the 25 earlier findings were RESOLVED and 4 were PARTIAL. The brief is `fable-plan-followup-brief.md`. Everything was applied as plan Errata 1–14.
- `restart-spike/README.md` holds the controller's restart spike on a real Expo/Metro in `kit-host`. The restart works: group kill, same port, Metro back in about 1 s, no orphan. It reproduced two orphaned-Metro defects (SIGTERM to the supervisor; closing the terminal, i.e. SIGHUP) and confirmed the fixes (Errata 7a and 7b). Metro binds `[::1]` only (Errata 7c).
- **Resume at step 3 (build).**

## 3b. Update (build complete, same session)

- Steps 3–6 are **done**. Tasks 1–19 were built in guarded Sonnet slices (a1, n1, n2, a2, c1, d1; the native slices ran in a separate worktree and were merged). Fable's implementation review (`fable-impl-review.md`) returned SHIP_WITH_FIXES (1 Critical, 3 Important, 12 Minor). One consolidated fix pass (`fix1-brief.md`) applied everything along with the controller's end-to-end findings, and the controller added three small follow-ups (a rejected-plan reset with a test, banner link underline, a capped log height).
- Task 20 results and screenshots with hashes: `task20-results.md`, `task20-shots/`. `npm test` 363 of 363.
- **Resume at step 7 (PR → CI → merge → release).** Pushing, opening the PR, merging, tagging and publishing each need the owner's authorization.

## 4. Next steps, in order

1. ~~**Fable follow-up review**~~ (done, see §3a) of the corrected plan. Reuse `fable-plan-review-brief.md` in the style of the 0.3 follow-up: per-finding RESOLVED/PARTIAL/OPEN plus new defects in changed regions only. **Policy:** if it is NOT_READY again with small, precise fixes, write them as a binding `## Errata` section at the top of the plan (as 0.3 did) instead of a third review round.
2. ~~**Open check the correction did not prove:**~~ (done, see §3a) the controller asked for a spike of the **restart on a real `dev` in `kit-host`** (process-group kill, port freed, re-bind on the same port, Metro not orphaned). The worker rewrote `performRestart` but did not spike it; only Task 20 Step 5.6 checks it. Spike it before building Task 18, or make it an early slice gate.
3. **Build in waves** with guarded Sonnet slices (see §5). Group tasks into slices that touch separate files and run independent slices in parallel worktrees, as 0.3 did. Respect the plan's hard order: Task 17 before Task 18.
4. After each slice: run `npm test`, `typecheck`, `build`, `check:types`, `check:doctor` and `check:catalog` yourself; verify worker claims; commit a local checkpoint.
5. **Fable implementation review** of the whole branch; one consolidated fix pass with the controller's end-to-end findings.
6. **Task 20 (controller):** includes Verdaccio and the full Update now flow. **Screenshot every state at 1280 × 800 and compare with the approved mockup.** Also run a fresh `create-expo-app` with `init --new`, `npx tsc --noEmit` (must pass), and the endpoint rejection checks with `curl`.
7. PR → CI (all checks) → squash-merge → on `main`: `npm run release minor` → `git push origin main v0.4.0` → watch `release.yml` → verify on npm with a fresh install and `npm audit signatures`.

## 5. How delegation was run

- Guarded runner: `HERMES_HOME=/Users/woohopark/.hermes/profiles/app-design python3 /Users/woohopark/.hermes/scripts/claude_guarded_run.py preflight|run --manifest <file>`. Manifest limits: `max_turns` ≤ 200. Results are in the JSON printed at the end of `run` output (`result_path`).
- `tools/make_slice.py` generates a slice brief and manifest and preflights it. It was adapted per release; for 0.4, change the scratch folder and plan file name inside it. Arguments: `<slice_id> <worktree> "<Tasks N–M>" "<prior-state sentence>" [extra rules…]`.
- `tools/slice.manifest.example.json` and `tools/review.manifest.example.json` are working examples (Sonnet mutating slice; Fable read-only review).
- **Worker limits:** workers cannot write `.npmrc` files (the controller creates them), must use ports 5190–5199, and must leave no servers running.

## 6. Lessons to apply (from 0.2 and 0.3)

- **From 0.5, follow `docs/superpowers/release-workflow.md`** (owner-approved 2026-10-08): runtime spikes and flow-state analysis before the plan review, a controller coverage check before any re-review, and a one-plan-review trial. For 0.4, write the build-review counts from step 5 into that file as the baseline.
- Count expected test totals from the actual files; RED steps must fail for the stated reason.
- Native files imported by the CLI: type-only `.ts` imports only; never a value re-export with a `.ts` extension (consumer `tsc` TS5097). Any `.tsx` change must pass `npm run check:types` (strict consumer check through `kit-host/tsconfig.json`).
- Never trust "renders the same" without a rendered comparison: `tools/capture.mjs <port> <out.json>` captures every page's heading, body text, props text, console errors and overflow in headless Chrome. Capture `main` (via `npm run kit:dev`) before and after, then diff.
- Measure animations only in a foreground or headless page; a background browser tab pauses animation frames. A false spinner bug cost one worker run.
- CI on `ubuntu-latest` needs `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` before headless Chrome (already in `ci.yml`).
- Release flow: `npm run release <type>` on `main` commits, tags and updates `CHANGELOG.md` from `.changes/`; pushing the tag publishes through OIDC. npm's trusted publisher has "Allow npm publish" enabled.

## 7. Open items for the owner

- **`0.0.0-stage` on npm:** a 2-file placeholder npm created at 2026-10-08T01:39:47Z during the first browser-approved publish. Not `latest`, and ranges skip it. Unpublishing is allowed within 72 hours (until about **2026-10-11 01:39 UTC**) and needs the owner's npm login plus 2FA: `npx npm@11 unpublish @krapwoo/ds-viewer@0.0.0-stage --auth-type=web`. Alternatively deprecate it. Log out afterwards.
- No other owner decisions are pending for 0.4 until a blocker appears.
