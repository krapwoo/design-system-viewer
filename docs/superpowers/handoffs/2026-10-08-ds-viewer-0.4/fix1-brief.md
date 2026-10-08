# Fix pass — `@krapwoo/ds-viewer` 0.4 (one consolidated correction)

You are Claude Sonnet, the single writer for this pass. Work only in `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4` (branch `feat/ds-viewer-0.4`, HEAD `1d05dad`). Sources:
- Fable's implementation review: `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-impl-review/verdict.md`
- The controller's end-to-end findings below.
- Approved mockup (read only): `docs/design/2026-10-08-ds-viewer-update-panel-approved.html`
- Plan and design (read only): `docs/superpowers/plans/2026-10-08-ds-viewer-0.4.md`, `docs/superpowers/specs/2026-10-07-ds-viewer-npm-package-design.md`

## Rules
1. Fix exactly the items below, nothing else. Use TDD where an item names a test: write the failing test, run it and see it fail for the stated reason, then fix.
2. Do not commit, push, tag or publish. Do not edit `docs/` or any `node_modules/`. Do not write `.npmrc` files.
3. `npm test` must make no real network call; inject effects as the existing tests do.
4. Any `dev`/Expo/browser process you start must use ports 5190–5199 and be killed (whole process group) before you finish. Confirm with `pgrep -fl 'expo start'`.
5. Gates at the end: `npm test` (report the total), `npm run typecheck`, `npm run build`, `npm run check:types`, `npm run check:doctor`, `npm run check:catalog` (68 pages, zero console errors).
6. If an item turns out to be wrong or impossible, do not force it: report it under "Not applied" with the reason.

## Critical
**C1. One update at a time is racy** (Fable Critical, `cli/endpoint.ts:98-137`).
- Add a synchronous `starting` flag inside `createUpdateEndpoint`. In the `/update` branch, refuse with 409 when `starting` is set or the phase is `updating`/`restarting`. Set `starting = true` before `await deps.buildPlan()`; reset it on every path that does not hand the plan to `startUpdate` (502, dirty 409, thrown errors).
- RED test first: fire two concurrent `POST /update` requests against a `buildPlan` that resolves after a delay, and assert `startUpdate` ran exactly once and the other request got 409.
- In `UpdatePanel.tsx`, while the `POST /update` is pending, disable **Update now** (`disabled`, `accessibilityState={{ disabled: true }}`) and show a muted "Starting…" line in place of the "or run …" line.

## Important
**I1. Plan building blocks `dev` for minutes when offline** (controller e2e; Fable Minor on `execFileSync`).
- Observed: with the registry unreachable, the update page sat on "Checking…" for 140 s, and `/update/status` did not answer at all in that time (curl timed out). With a cached tarball it showed "ready" after more than 2 minutes. The mockup says "Usually 2–5 s".
- Fix: the production default `execImpl` in `cli/updatePlan.ts` becomes async (promisified `execFile`), and `buildUpdatePlan` awaits every call, so the endpoint keeps answering.
- Give the `npm view` and `npm pack` calls a 20 s `timeout` (kill), so offline reaches "Couldn't prepare" within about 20 s.
- Keep `buildUpdatePlan`'s signature `Promise<UpdatePlan | { error }>` and every existing caller (`update.ts`, `dev.ts`, the endpoint). Update the injected fakes in the tests to match.
- Add one test: an `execImpl` that rejects with a timeout error yields the offline `{ error }`.

**I2. A rejected plan or start request leaves the panel stuck on "Checking…"** (Fable Important, `UpdatePanel.tsx:225-236, 271-283`). Wrap `fetchPlan` and `startUpdate` in try/catch. On failure, set the same `{ error }` that produces the "Couldn’t prepare" state. Also re-enable the button from C1.

**I3. Recovery output is missing the update result** (Fable Important, `cli/dev.ts:283-287`). When the restarted `dev` exits non-zero, print the same "result of the update" line the `catch` branch prints (doctor summary and changed files). Reword that line from "Last known good state" to `The update itself finished: <doctor summary>; changed: <files>.`

**I4. Banner links aren't keyboard-operable, and the banner role is wrong** (Fable Important plus controller visual comparison, `CatalogShell.tsx:52-67`).
- Render "Review update" with `href={hashForId(UPDATE_PAGE_ID)}` and "Migration guide" with `href={releaseUrl}` plus `hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}`, so both are real anchors. Keep `onPress` for Review update if needed for routing.
- Change the container role from `alert` to `status`.
- Match the mockup:
  - the banner sits **below** the breadcrumb (mockup `PAGE_BG`: crumb, then banner, then title);
  - it starts with "⚠ ";
  - both links are underlined.

**I5. The success page dumps the whole doctor report** (Fable Minor, raised to Important by the controller; the success screenshot shows dozens of lines). The mockup shows one line. Store only the summary line in `doctorSummary`: the last non-empty line of `doctor`'s human output, e.g. "0 errors, 15 warnings — 37 components (37 with examples), 130 unbound examples." The success page shows that line. Do the same in `cli/update.ts` if it prints the full report as a "summary".

## Minor (apply all)
- **M1 copy, `UpdatePanel.tsx`:**
  - "1 file have uncommitted changes" must agree in number ("1 file has" / "2 files have").
  - The failure step reads "Install with npm failed" (mockup), not "Installed with npm failed".
  - The **in-flight** install label reads "Installing with npm…" (it currently reads "Installed with npm…" while running). The done label stays "Installed with npm".
  - Check every step label that has distinct in-flight and done wording against the mockup, which shows done and now states.
- **M2 spacing:** the "Updating" `h3` sits flush against the "You’re on…" line. Give it the same top margin the other section headings in the panel use.
- **M3:** render `outsideGitRepo` in the `ready` state as a muted line: "Not a git repository, so uncommitted changes couldn’t be checked."
- **M4:** `kitFilesDiffering` must compare the project's kit against the **downloaded target version's** `starter-kit/` (extracted in the temp folder in `buildUpdatePlan`, before cleanup), as the copy "differ from <latest>'s kit" and design §5 say. Add or adjust a test.
- **M5:** wrap `checkForUpdate`'s body in try/catch returning `undefined` (never throws), with a test for a non-semver cached `latest`.
- **M6:** wrap the doctor step in `cli/update.ts` in try/catch, as `performUpdate` does ("Installed and migrated to X, but doctor failed to run. Recover with: npx ds-viewer doctor", exit 1), with a test.
- **M7:** add `.catch` to `void performUpdate(...)` in `dev.ts` that records a `failure` status. Add `uncaughtException`/`unhandledRejection` handlers in `dev()` that kill the Expo group before exiting.
- **M8:** in `performRestart`, if SIGINT/SIGTERM/SIGHUP arrives before `targetChild` exists, remember it, skip spawning the new `dev` once the old child is gone, and exit 0.
- **M9:** `defaultGitStatus` must fail closed. Return `undefined` only for "not a git repository" (or git missing, ENOENT). Any other git failure returns a plan `{ error }` naming git.
- **M10 tests:**
  - an endpoint test with a same-length wrong secret, so `timingSafeEqual` is reached;
  - a `dev.test.ts` assertion of the install → migrate → doctor order;
  - export `stripRepoPrefix` and unit-test it, including a rename line and a subfolder prefix.
- **M11 README** (the `## Updating` safeguards paragraph): one sentence saying the secret is in the generated viewer bundle, and that Host and exact-Origin checks are what stop other web pages from using it.

## Report only (do not change)
Windows `.cmd` shims for `execFile` (Windows is not a 0.4 target); nested supervisor processes after several updates.

## Final message
A table: item → files changed → test added (RED reason seen) → result. Then every gate with its counts, any deviations, and "Not applied" items with reasons.
