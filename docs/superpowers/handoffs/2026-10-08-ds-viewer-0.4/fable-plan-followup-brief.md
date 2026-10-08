# Follow-up review — corrected `@krapwoo/ds-viewer` 0.4 plan

You are Claude Fable, read-only (Read, Grep, Glob). You reviewed this plan before and returned NOT_READY (5 Critical, 12 Important, 8 Minor): `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan-fable-review/verdict.md`. The author applied one correction pass covering all 25 findings. The controller also made two of your security Minors required: `crypto.timingSafeEqual` for the secret, and a `Host` header check (`127.0.0.1:<port>`) against DNS rebinding.

- Corrected plan (frozen, SHA-256 1912e61e288d17fe849183b0511aa60dc3219bfa231202a3cb9807fb39caa07b): `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4/docs/superpowers/plans/2026-10-08-ds-viewer-0.4.md`
- The author's correction table: `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/correction-report.md`
- Controller decisions for the correction: `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/correction-brief.md`
- Spike evidence (worker-reported): `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/spikes/README.md` and `spikes/migrate-entry/`
- Repository: `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4`; design: `docs/superpowers/specs/2026-10-07-ds-viewer-npm-package-design.md`; approved mockup (binding): `docs/design/2026-10-08-ds-viewer-update-panel-approved.html`

## Scope
1. For each of your 25 prior findings: RESOLVED, PARTIAL or OPEN, with the new line reference.
2. New defects the correction introduced, in the changed regions only. Do not reopen areas you already passed unless a change broke them.
3. Check specifically:
   - **`migrateEntry`:** it really is dependency-free through its whole import graph (`migrate.ts`, `migrations/`, `semver.ts` and anything they import), it is in the build output and `files`, and `buildUpdatePlan` runs the tarball's copy.
   - **Non-blocking update:** 202 is sent before any work; `/update/status` keeps answering during the async install, migrate and doctor; the delay before `restart()` lets the panel observe `restarting`; the panel's handling of a failed poll.
   - **`performRestart`:** process-group kill of Expo/Metro, waiting for exit and a free port, re-spawn on the same port with inherited stdio, signal forwarding, and the recovery message on failure. The author did NOT spike this on a real `dev`; judge whether the code as written would work on macOS and Linux (negative-pid kill when the child is not a group leader, `npx` wrappers, timeouts, what the parent does while the child runs, exit codes).
   - **Security additions:** `timingSafeEqual` with unequal lengths, the `Host` check (including `localhost`, IPv6 and a missing Host), and that the new checks keep the order Origin → Host/secret → route with preflight handled correctly, all with tests.
   - **Test counts:** the 238 → 353 trajectory, recounted from the planned test code.

## Output
```
VERDICT: READY | READY_WITH_CHANGES | NOT_READY
CRITICAL: <n>
IMPORTANT: <n>
MINOR: <n>
```
then the per-finding status table, then any new findings as `[Severity] Task N, Step M (line) — finding. Why. Smallest fix.` Classify honestly; do not inflate. Make every fix small and precise enough to be written as a plan erratum.
