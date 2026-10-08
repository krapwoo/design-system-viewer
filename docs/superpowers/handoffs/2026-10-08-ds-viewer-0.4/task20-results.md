# Task 20: controller verification results (2026-10-08)

Branch `feat/ds-viewer-0.4`, verified against the build after the fix pass (`86dc50e` plus `a118429` and the log-height commit). macOS host, Node 22.23.1, headless Chrome (repo puppeteer) at 1280 × 800. A fresh `create-expo-app` (blank-typescript) project installs the packed tarball. A local Verdaccio holds throwaway versions `0.4.1/0.4.2-verify`, `1.0.0/1.0.1-verify` and `0.4.3-fail`; the `@krapwoo/*` scope has no proxy to npmjs.

## Results
| Check | Result |
|---|---|
| `npm test` (non-loopback fetch blocked) | 363 of 363 pass, no external fetch |
| typecheck, build, `check:types`, `check:doctor`, `check:catalog` | clean; doctor 0 errors, 15 warnings; catalog 68 pages, 0 console errors |
| `migrateEntry.js` from the real tarball, no `node_modules` | exit 0, `{"version":1,"from":"0.3.0","changes":[],"dryRun":true}`; `main.js` fails with ERR_MODULE_NOT_FOUND as expected |
| Fresh app: `init --new`, `npx tsc --noEmit` | `starterKit: { version: '0.3.0', root: 'src/ds' }`; tsc exit 0 |
| Major notice | banner below the crumb, "⚠", `role="status"`, real anchors (underlined), Tab then Enter on "Review update" opens the page and focuses the heading; dismissal persists across a reload; the footer line stays |
| Ready, Dirty | dirty reads "1 file has uncommitted changes."; Update now has `aria-disabled`; refused server-side (409); no override |
| Double click | second click hits a disabled button; "Starting…" shown; only one `POST /update` (202) |
| Updating → Restarting → Success | 202 immediately; `/update/status` answers throughout (2–36 ms); in-flight labels "Installing with npm…" and "Checking pages (doctor)…"; Restarting visible about 4 s; reload at about 9 s; success shows changed files and the one-line doctor summary; footer gone; `update-status.json` consumed; `update.json` null |
| Restart processes | old Expo group gone; same port re-bound; SIGTERM to the supervisor and pty close (SIGHUP) after a restart both leave no process and port 5192 free; Ctrl-C (group SIGINT) clean |
| Offline (registry down) | "Couldn’t prepare" after 20.4 s (was 140 s before the fix); `/update/status` answered every 2 s throughout (was unresponsive) |
| Failure (`0.4.3-fail`, unsatisfiable peer) | "The update stopped while installing… Recover with `npx ds-viewer update`"; "Install with npm failed"; real ERESOLVE log in a 240 px scroll region; Copy log visible; neither app's files changed |
| Endpoint `curl` checks | bad preflight Origin 403 (no CORS header); no Origin 400; no secret 401; bad Host 400; `localhost` Host 400; same-length wrong secret 401; GET `/update` 404; valid 200 echoing only the exact origin; bound to 127.0.0.1 |
| CLI | `update --dry-run` prints the plan with no install; `migrate --dry-run --json` is valid with no changes; `kit diff Button` matches |
| Secret in the bundle | a cross-origin bundle fetch is refused by Expo ("Unauthorized request from http://evil.example") |
| Real registry | `latest` 0.3.0, versions unchanged before and after |

## Known, not fixed (Report only)
- During `npm install`, Metro's HMR reports "Unable to resolve module @krapwoo/ds-viewer" while the package is swapped. The panel recovers, the restart and reload complete, and success renders. This is already in the plan's Report only list.
- `r01-major-notice.png` predates the link-underline fix; the underline was then confirmed by computed style (`text-decoration-line: underline` on both links).
- Offline with a cached tarball now also stops at about 20 s ("Couldn’t prepare") instead of falling back to npm's cache after more than 2 minutes.
- Windows is not exercised (not a 0.4 target).

## Screenshots (`task20-shots/`, sha256)
```
3be845aba260e052d67eb204191133729ae95543fd6c8389a88fe8562c0a6bab  r01-major-notice.png
37b49b45d1145b1bdf1021399d7c2d6c595ddea88e33454327ea94b1dabbb9c2  r03-ready.png
55e29d7f15b5e31e93769beae690dce2d5e0dcee7cc07363681d27f6947dee10  r04-dirty.png
6e1f80bda63cf2ccb1042822c143af50aa023e2384c32b3ff2c32001856b6d17  r05-starting.png
d1e0b3dbfa4ddeace21232756b69ed82c5b47bb3b2b59583402ccb605d9084b4  r06-updating.png
9c86bda5885a7e0dc728893f2640b21bc65a8b07c4a55ccef30f97495b5923ef  r06-restarting.png
90cc0ccbcd99349adccdd9d420b954a5fc4cd38bea5843f3fe5ad66694d919cb  r08-success.png
fcc8835d356bd0d6c667833c941aa1a1162729b6ccdd3d2aa6a94ddf403f9817  r09-offline.png
1b6835605e67ab6821882a87c07eb493ac21783256b004c8d637e97a782c9b40  r10-failure.png
```
