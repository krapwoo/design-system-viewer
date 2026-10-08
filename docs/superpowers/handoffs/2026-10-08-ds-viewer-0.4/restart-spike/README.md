# Restart spike — 0.4 plan Task 18 (`performRestart` + detached Expo)

Run by the controller on 2026-10-08, macOS 26.6.2, Node v22.23.1, real Expo/Metro on `kit-host/.ds-viewer` (Expo ~57), ports 5191–5196, inside a real pty (`script -q`), `CI` unset.
Files: `restart-spike.mjs` reproduces Task 18 Step 5's `dev()` spawn and signal loop and Step 3's `performRestart` line for line (gen 0 = original `dev`, gen 1 = restarted `dev`); `--fixed` applies the two fixes below. `drive.sh` runs it, waits for the restarted Metro, sends a signal, then lists leftover processes and listeners. Logs: `*.log`.

## Verified (all runs)
- `process.kill(-pid, 'SIGTERM')` on the detached `npx expo start` stops the whole group: Expo exits code 0 in 15–25 ms, and the port is free right after.
- The restarted `dev` binds the **same port**, and Metro answers HTTP 200 within about 1.0–1.1 s. No orphan from the first generation.
- Detached Expo still prints its interactive key list (`› Press w │ open web`, …) in the pty. Keypresses were not tested.

## Defects in the plan as written
| Run | Stop | Result |
|---|---|---|
| A (as planned) | `SIGTERM` to the supervisor pid | **Orphan.** `dev()`'s original handler runs first (it was registered first) and calls `process.exit(0)` before `forward` runs. The restarted `dev` dies, and its Metro stays on the port with ppid 1. |
| C (as planned) | `SIGINT` to the foreground group (Ctrl-C) | OK. Both generations get SIGINT directly, and everything exits. |
| D (as planned) | pty closed (terminal window closed) | **Orphan.** Detached Expo is in its own session, so it gets no SIGHUP, and `dev` has no SIGHUP handler. Metro stays on the port. The same mechanism applies to a `dev` that never restarted (inferred, not run separately). |
| E (fix 1 only) | `SIGHUP` to the group | **Orphan** (same as D). |
| B (fix 1) | `SIGTERM` to the supervisor pid | OK: forwarded, then clean exit. |
| F (fix 1 + 2) | `SIGHUP` to the group | OK: forwarded, then clean exit. |
| G (fix 1 + 2) | `SIGTERM` to the supervisor pid | OK. |

**Fix 1:** in `performRestart`, before adding the forwarders, call `process.removeAllListeners(s)` for SIGINT, SIGTERM and SIGHUP.
**Fix 2:** add `'SIGHUP'` to `dev()`'s signal loop (Task 18 Step 5), and forward it in `performRestart`.

## Correction (controller, after Fable's follow-up review)
In every run, `lsof` shows Metro listening on `[::1]:<port>` only. The planned probe connects to `127.0.0.1`, so the logged "port free=true" proves nothing. It was the wait for the child to exit that actually gated the re-bind. Fix: probe with `findFreePort(port, port)`, which binds `localhost` (Errata 7).

## Not covered
Linux; the real `dev`/endpoint/status-file handoff (the code isn't built yet; Task 20 Step 5.6 still covers it); Windows (`detached` there means something different, and negative pids don't exist).
