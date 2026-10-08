The plan is fully revised: 5,065 lines, 20 tasks (unchanged count), 353 test trajectory (from 238 baseline). Here's the summary.

| Finding | Change | Evidence |
|---|---|---|
| Crit: migrate on tarball w/o node_modules | New `cli/migrateEntry.ts` (dependency-free), `buildUpdatePlan` runs it instead of `main.js migrate`; doc constraint added to `migrations/types.ts` | Spike `spikes/migrate-entry/`: `node dist/migrateEntry.js` → exit 0 JSON with no `node_modules`; `main.js`-equivalent stub → `ERR_MODULE_NOT_FOUND` for `typescript` |
| Crit: update blocks event loop / exits before 202 | Endpoint sends 202 then `setImmediate(startUpdate)`; `performUpdate`'s `execImpl` now async (promisified `execFile`) | New endpoint test "replies 202 before startUpdate ever runs" |
| Crit: restart detached/silent/racy | `performRestart` rewritten: group-kill (`detached:true` + `process.kill(-pid)`), await exit + port-free probe, re-spawn non-detached, forward signals, print recovery+exit code | Task 18 Step 3; Task 20 Step 5.6 now checks `ps aux` for the old grandchild |
| Crit: shared cache carries current/breaking; no newer-than check | Cache now `{latest,summary,releasedAt,checkedAt}` only; `current`/`breaking` always computed fresh; resolves `undefined` when not newer | updateCheck.test.ts: 17→19 tests; `catalogNavigation.ts` gets `isNewerVersion` defense-in-depth |
| Crit: exec-key fakes never match (9 tests dead) | Fixed `fakeExec`/`recordingExec` key logic in Tasks 9, 10, 18 | Lines ~1944 (Task 9), ~2329 (Task 10), ~4142+ (Task 18) |
| Imp: e2e flow can't reach ready/dirty/checking | Task 20: seed `update-check.json` cache; commit fresh app before Step 5; `npm pkg set` instead of invalid-JSON edit | Task 20 Steps 2 & 4-5 rewritten |
| Imp: "no annotation changes" false; typecheck fails | `Pressable` import, `select`/`activeDef` widened, `CatalogSidebar.active` widened to `string` | Tasks 13 & 14 |
| Imp: `.tsx` has no real type gate | `npm run check:types` replaces `typecheck` in Tasks 13,14,16,19,20 | Controller decision 6 added to Global Constraints |
| Imp: no breadcrumb/heading on update page | `UpdatePanel` now always renders crumb + `role="heading"` title | Task 16 Step 1 |
| Imp: success/failure copy & step labels wrong | `status.files`, failure copy varies by `failedStep`, steps name detected package manager + "now" icon state | Tasks 12, 15, 16, 18 |
| Imp: check:catalog hits real network / count drift | `updateCheck:false` in kit-host config + `DS_VIEWER_NO_UPDATE_CHECK` in script & CI | Task 19 Step 1.5 |
| Imp: `update --dry-run`/kit-diff tests network-dependent | New `runIn(cwd,...)` helper; tests run against isolated temp/fixture dirs | Tasks 7, 8, 10 |
| Imp: dirty detection breaks in subfolder projects | `git status --porcelain -- <planned paths>` + prefix-stripping + rename parsing | Task 9, `defaultGitStatus`/`parseDirtyPaths` |
| Imp: config-change drops endpoint | `reloadWorkspace(projectRoot, updateEndpoint)` | Task 18 Step 5 |
| Imp: GitHub fetch no timeout | Exported `fetchWithTimeout`, reused in `updatePlan.ts` | Task 4 export, Task 9 usage |
| Imp: test counts/RED-GREEN order | All counts recounted from actual code; Task 6 tests now precede production code | See table below |
| 8 Minors | timingSafeEqual + Host check (required per controller), 409/502 retry in panel, temp-dir cleanup, offline-vs-up-to-date copy, doctor human output, `--port` NaN/usage, wording fixes, curly quotes/code chips | Tasks 1, 6, 9, 12, 15, 16, 18 |

**Line count:** 5,065 (was 4,447). **Task count:** 20 (unchanged). **Test trajectory:** 238 → 353 (was claimed 344; every count re-derived from the actual test code: Task 4 17→19, Task 11 7→6, Task 15 7→7 net via a new `isAlreadyUpToDateError` test, Task 18 5→6, plus new dispatch/migrateEntry/endpoint/updatePlan tests).

Nothing from the review was left unapplied. Spike evidence lives in `spikes/README.md` §3 and `spikes/migrate-entry/` (source files kept; build output cleaned up). No commits made, no servers left running, real npm registry untouched (not contacted this pass).