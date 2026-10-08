```
VERDICT: NOT_READY
CRITICAL: 2
IMPORTANT: 6
MINOR: 8
```

Counts are the open errata below (new defects plus the unresolved residue of prior findings), not a re-tally of the original 25.

## Prior findings

| # | Prior finding | Status | Where now |
|---|---|---|---|
| C1 | Tarball `main.js` cannot run | RESOLVED | `cli/migrateEntry.ts` 1849-1872; `buildUpdatePlan` runs it 2203-2207; Task 20 Step 2 re-check 4829-4840 |
| C2 | Update blocks loop, 202 never sent | PARTIAL | 202 then `setImmediate` 3072-3080 and async `execImpl` 4266-4272 are in. The `restarting` delay and the panel's failed-poll handling were not applied: 4346-4349, 3786-3790, 3806-3828. See Critical B |
| C3 | Restart detached, silent, racy | PARTIAL | 4380-4425, 4544-4569. Group kill, exit wait, port wait, inherited stdio, signal forwarding and the recovery line are in. Residue: Important E, F and Minor 6, 7, 8. The required real-`dev` spike was not run |
| C4 | Shared cache carries `current`; no newer-than check | RESOLVED | 670-737, 2704-2745, tests 634-652. New prerelease defect in the duplicate comparator: Important C |
| C5 | Exec-key fakes never match | RESOLVED | 1944-1960, 2322-2335, 4147-4160; all nine tests now reach their branches. New index defect in Task 18 test 1: Important B |
| I1 | Task 20 cannot reach ready/dirty | RESOLVED | Seed 4911-4919, commit 4851-4854, `npm pkg set` 4936 |
| I2 | Typecheck breaks in Shell/Sidebar | RESOLVED | 3218, 3264-3276, 3326-3340 |
| I3 | No effective `.tsx` type gate | PARTIAL | 3220, 3459, 3986, 4814. Task 19 (4625-4800) has no `check:types` step; 3123, 3245, 3654 still say `typecheck` is the gate. Minor 1 |
| I4 | No breadcrumb or heading | RESOLVED | 3887-3897. Heading focus target still unwired: Minor 2 |
| I5 | Result incomplete, failure copy wrong | RESOLVED | `files` 2978, 4349; `failureCopy` 3972; labels 4302-4308. Copy nits: Minor 3 |
| I6 | `check:catalog` hits the network | RESOLVED | 4654-4675 |
| I7 | Dispatch tests hit the network | RESOLVED | `runIn` 1517-1522; 1526-1543, 1882-1897, 2564-2570 |
| I8 | Dirty detection misses sub-folder projects | PARTIAL | Output stripping and rename parsing 2119-2151 are right; the pathspec is double-prefixed 2156. Important D |
| I9 | Config edit drops the endpoint | RESOLVED | 4514-4539 |
| I10 | GitHub fetch has no timeout | RESOLVED | 756-769, 2238-2242 |
| I11 | Test counts and RED order | RESOLVED | Recounted from the test code: 5+4+2+19+6+7+10+12+7+9+6+13+7+2+6 = 115, 238 to 353, every running total matches. Task 6 tests now precede the change (1129-1207) |
| I12 | Metro watcher half-paused | RESOLVED | 4437, 5052, 4939 |
| M1 | `!==` secret; Host check | RESOLVED | `secretMatches` 2962-2972, Host 3003-3011, tests 2915-2932 |
| M2 | 409/502 ignored | RESOLVED | 3830-3842 |
| M3 | Temp dir leak | RESOLVED | 2211-2215 |
| M4 | Up-to-date reads as offline | RESOLVED | 3583-3599, 3968 |
| M5 | Doctor human line; `--port` usage and NaN | RESOLVED | 1198-1204, 4572-4592 |
| M6 | Wording, missing imports, no-op refactor | RESOLVED | 4249-4252, 4439, 238 |
| M7 | `status.phase` narrowing | RESOLVED | 3969-3972 |
| M8 | Curly apostrophes, code chips | PARTIAL | `Code` chip 3768-3773 is in. Line 3962 claims curly quotes but the plan's own copy in 3968, 3970 and 3972 uses straight ones. Minor 3 |

## New findings

**[Critical] Task 14, Step 4 (3375) with Task 4 (735) and Task 16, Step 2 (3971) — the success state can never render.** After a successful update the new `dev` runs `refreshUpdateFile`; `latest` now equals `current`, so `toResultOrUndefined` writes `null` and `update` is null in the shell. The shell renders `UpdatePanel` only when `active === UPDATE_PAGE_ID && update`, so the reloaded page shows "No catalog pages are available." The success branch also reads `update.latest`, which no longer exists. This is the mockup's `success` frame (footer gone, panel shown) and Task 20 Step 5.6 cannot pass. Smallest fix: render `UpdatePanel` whenever `active === UPDATE_PAGE_ID`, type its `update` prop as `UpdateNotice | null`; add `latest: string` to the `success` variant in Task 12 and Task 15 and write it from `plan.latest` in Task 18's `restart` result; the success branch reads `status.latest`; when `update` is null and status is idle, render the "You're already up to date." note.

**[Critical] Task 18, Step 3 (4346-4349) and Task 16, Step 1 (3786-3790, 3815-3828) — `restarting` is unobservable and a failed poll stalls the panel.** `onStatus({ phase: 'restarting' })` is followed in the same tick by `performRestart`, which closes the endpoint. The panel's next poll rejects; `fetchStatus` has no catch, so the rejection is unhandled and `status` stays `updating`. The Metro probe effect only runs when `phase === 'restarting'`, so the page never reloads. This is the second half of the original Critical 2, listed in its smallest fix and not applied. Smallest fix: in `fetchStatus`, catch and `setStatus(prev => prev.phase === 'updating' || prev.phase === 'restarting' ? { phase: 'restarting' } : prev)`; in the restarting effect, reload only after at least one probe has failed (otherwise the still-alive old Metro answers and the page reload-loops); optionally `await` a `delayMs` dep (default 1500, tests pass 0) before `deps.restart` so the Restarting copy is visible.

**[Important] Task 12, Step 1 (2934-2943) and Step 3 (3079) — endpoint test 13 fails as written.** `startUpdate` throws inside the `setImmediate` callback. That is an uncaught exception; the test harness attributes it to the running test and fails the file, and in production it would crash `dev`. The `EndpointDeps` doc at 2986 says `startUpdate` must never throw, and the test violates it. Smallest fix: `setImmediate(() => { try { deps.startUpdate(plan); } catch (error) { console.warn(...); } })`; keep the test, which then proves 202 is sent and the server survives.

**[Important] Task 18, Step 1 (4165) — test 1 asserts the wrong index.** `statuses` is four `updating` reports then `restarting`; `restart` does not push a status. `statuses[length - 2]` is the fourth `updating` report, so the assertion fails. Smallest fix: `statuses[statuses.length - 1].phase === 'restarting'`.

**[Important] Task 11, Step 4 (2704-2711) — `isNewerVersion` returns false for a prerelease patch.** `'0.4.1-verify'.split('.')` yields `'1-verify'`, `Number` gives NaN, and the function returns `NaN > 0`, false. `footerLabel` then returns undefined, so Task 20 Steps 5.2 to 5.6 lose the footer line after re-seeding to `0.4.1-verify`, and the Ready screenshot will not match the mockup. The major case passes only because the first component differs. Smallest fix: parse with `/^(\d+)\.(\d+)\.(\d+)/` and compare the three captured numbers, matching `cli/semver.ts`.

**[Important] Task 9, Step 3 (2153-2162) — `defaultGitStatus` prefixes the pathspec.** Git pathspecs are relative to the cwd, and the cwd is `projectRoot`. From `apps/mobile/` the command asks for `apps/mobile/apps/mobile/package.json`, matches nothing, and reports clean. Porcelain output paths are repo-root relative, so the output stripping is correct; only the input is wrong. The injected-fake tests cannot catch this. Smallest fix: pass `...plannedPaths` unprefixed; keep `stripRepoPrefix` on the output.

**[Important] Task 18, Step 3 (4416-4418) with Step 5 (4556-4569) — the old `dev` signal handlers survive into the supervisor.** They are registered first, so on SIGTERM to the supervisor pid they close the already-closed server, fail to kill the dead old group, and `process.exit(0)` before `forward` runs. The new `dev` is orphaned and keeps running. Terminal Ctrl-C still works only because the new child shares the foreground group. Smallest fix: at the top of `performRestart`, `process.removeAllListeners('SIGINT'); process.removeAllListeners('SIGTERM');` before registering `forward`.

**[Important] Task 18, Step 5 (4544-4549, 4556) — `detached: true` makes Expo survive a closed terminal.** Expo now sits in its own session, so the shell's hangup SIGHUP never reaches it, and `dev` dies on SIGHUP with no handler and forwards nothing. Closing the terminal tab leaves Metro bound to the port; the next `dev` silently takes the next one. Today's non-detached spawn does not have this problem. The same applies to the supervisor and the restarted `dev`. Smallest fix: add `'SIGHUP'` to the forwarded-signal loop in `dev()` and to `forward` in `performRestart`.

**[Minor] Task 19 (4625-4800) and Tasks 13, 14, 16 prose (3123, 3245, 3654)** — Task 19 adds a `kit-host` page with no `check:types` step, which the correction report claims it has; the three intro lines still name `npm run typecheck` as the gate. Fix: add `npm run check:types` before Task 19 Step 2 and reword the three lines.

**[Minor] Task 16, Step 1 (3892) and Task 14, Step 4 (3376)** — the heading renders but `headingRef` and `tabIndex={-1}` are not on it, so `focusElement(headingRef.current)` after navigating to the update page focuses nothing. Fix: pass `headingRef` to `UpdatePanel` and put `ref={headingRef} tabIndex={-1}` on the heading `View`, as `SectionBlock` does.

**[Minor] Task 16, Step 2 (3962, 3968-3972) and Task 18, Step 3 (4305)** — three copy deviations from the mockup: the in-flight label is "Applying 1 migration…" with an ellipsis; the failure step reads "Install with npm failed", not the done-label with a fail icon; and the plan's own copy uses straight apostrophes while claiming curly. Fix: append `…` to the `now` label in the panel, map `failedStep` to "<step> failed" in the failure `Steps` list, and write U+2019 into the table copy.

**[Minor] Task 8, Step 9 (1847)** — the RED expectation is wrong. Node exits with status 1 and "Cannot find module" on a missing script, not `status: null`; test 1 fails on `status`, test 2 fails on the `stderr` match. Fix: state that.

**[Minor] Task 20, Step 2 (4843-4848)** — after `cd "$SCRATCH"` then `cd fresh-app`, `$OLDPWD` is `$SCRATCH`, so the install path does not exist. Fix: `TARBALL_PATH="$PWD/$TARBALL"` right after `npm pack`.

**[Minor] Task 18, Step 3 (4405-4425)** — `performRestart` failure paths: the child-exit wait has no timeout or SIGKILL escalation; `newChild` has no `'error'` listener, so a spawn failure throws; any throw rejects a `void` promise and crashes `dev` with a stack trace; design §5 step 5's "and the result of the update" is not printed. Fix: race the exit wait against a 10 s timer then `process.kill(-pid, 'SIGKILL')`; add `newChild.on('error', ...)`; wrap the body in try/catch printing `npx ds-viewer dev` plus the `doctorSummary` and `files` passed in via `RestartHandoff`.

**[Minor] Task 18, Step 3 (4363-4371) and Step 5 (4544-4569)** — the port probe connects to `127.0.0.1` while every listen in this codebase binds `localhost`, so a Metro bound on `::1` only would read as free; and `process.kill(-pid)` throws on win32, where the catch leaves Expo running on Ctrl-C (a regression from today's `child.kill`). Fix: probe with `findFreePort(port, port)` resolved to boolean; on `win32` fall back to `child.kill(signal)`.

**[Minor] Task 9, Step 3 (2183-2185)** — `buildUpdatePlan` treats only exact equality as up to date, so a `current` newer than the registry (this repo's `kit-host` before publish) still downloads and plans a downgrade from the CLI. Fix: `if (compareVersions(parseVersion(targetVersion), parseVersion(currentVersion)) <= 0) return { error: ... }`.

## Specific checks

**`migrateEntry`.** The import graph is `migrateEntry.ts` to `migrate.ts` to `migrations/index.ts` plus `migrations/types.ts` and `semver.ts`, none of which import `typescript` or anything outside `cli/`. The root `tsconfig.json` includes `cli/**/*.ts`, so it emits to `dist/cli/migrateEntry.js`, which `files` already covers via `dist/cli`. `buildUpdatePlan` runs the tarball's copy at 2205 with `cwd: projectRoot`, which the entry reads as `process.cwd()`. The spike compiled exact copies with the repo's compiler options and ran with no `node_modules`; it is representative.

**Non-blocking update.** 202 is written before `setImmediate`, and `performUpdate` awaits a promisified `execFile`, so status polls are answered during install, migrate and doctor. `buildUpdatePlan` itself is still synchronous `execFileSync`, which blocks the loop for the download during `checking` and again inside `POST /update` before the 202; that was accepted before and is not reopened. The restart delay and failed-poll handling are missing, which is the second Critical above.

**`performRestart` on macOS and Linux.** `detached: true` calls `setsid`, so Expo is a group leader and `-pid` reaches `npx`, its `sh`, and Expo. Expo exits on SIGTERM, `once('exit')` plus the port probe gate the re-spawn, and `process.argv[1]` resolves through `node_modules/.bin` or the package symlink to the newly installed `main.js` under npm, yarn and pnpm. Inherited stdio keeps output in the terminal. The parent sits in `await` on the child's exit and exits with its code. What breaks is the leftover signal handlers and SIGHUP (Important E, F), and the missing timeouts (Minor 6). Given these, the real-`dev` spike the controller required should still be run before Task 18 is implemented.

**Security additions.** `secretMatches` rejects non-strings and unequal lengths before `timingSafeEqual`, and the wrong-secret test covers the unequal-length path. The Host check compares against `req.socket.localPort`, so `localhost:<port>`, `[::1]:<port>` and a missing header all get 400; the baked base URL is `127.0.0.1`, so the real panel passes. Order is Host, then Origin for `OPTIONS` without the secret, then Origin, secret, route. Host ahead of Origin differs from the brief but changes nothing: both are pre-route rejections, and a rebound preflight gets 400 with no CORS headers. All thirteen tests are coherent except test 13 (Important A).

**Test counts.** Recounted from the planned test code, every per-task count and running total is right and ends at 353. Two of those tests fail as written (Important A, B), so the suite would report 351 passing until fixed.