# Independent review — `@krapwoo/ds-viewer` 0.4 implementation plan

You are a fresh, read-only reviewer (Claude Fable). Tools: Read, Grep, Glob only. Do not edit or run commands.

## Review target
`/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4/docs/superpowers/plans/2026-10-08-ds-viewer-0.4.md` (frozen, SHA-256 f70494be90f358d8622746fb2dc9c8794273a05e980262bc4db63808397a20d8), written by a Sonnet worker. Nothing is implemented. The repository at `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4` is `main` = 0.3.0 (published) plus the approved mockups and this plan.

## Authority
- Design, revision 3: `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4/docs/superpowers/specs/2026-10-07-ds-viewer-npm-package-design.md` — the 0.4 row of §6 and all of §5 (update check, viewer notice and Update now, local endpoint safeguards, restart handoff, update plan, `update`, starter-kit changes), §4's `update` field, §6 Testing, and the Prohibited list.
- Approved visual design (binding): `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4/docs/design/2026-10-08-ds-viewer-update-panel-approved.html` — direction C (an Update page at `#ds-viewer-update`), content max 512px, ten states with their copy, the NEW tokens.
- Controller brief with binding decisions: `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/brief.md`.
- Author's spike notes (worker-reported; check against code): `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-plan/spikes/README.md`.
- The 0.3 plan and its Errata, for lessons: `/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4/docs/superpowers/plans/2026-10-08-ds-viewer-0.3.md`.

## Focus
1. **Security of the local endpoint (highest priority):** every §5 safeguard is implemented and tested: 127.0.0.1 only, random port, per-`dev` secret, exact Origin (with port) on every request including preflight, missing Origin rejected, POST for state changes, one update at a time, dirty-file refusal with no viewer override. Look for DNS-rebinding exposure (Host header), secret leakage (logs, generated files served to other origins, update.json), CORS headers that are too broad, timing-safe comparison, and request-body size limits. The Prohibited list forbids accepting requests from anything other than the local viewer page.
2. **Executability:** would each task compile and its tests pass as written? Imports, signatures across tasks, expected test counts (count from the current files), RED reasons, `--experimental-strip-types`, and the 0.3 lessons (type-only `.ts` imports in native files; new native code must pass strict consumer `check:types`; no `.bin` exec assumptions).
3. **Design and mockup conformance:** the ten states and copy, 512px width, the footer line and banner, Back behaviour, the result shown after the reload; update check rules (24 h cache shared across projects, timeouts, silent offline, opt-outs, never with `--ci`); `update`, `migrate` and `kit diff` exactly as §5 describes. Judge the author's seven resolved ambiguities.
4. **Restart handoff robustness:** pausing the watcher and hot reload, recording the result before restart, restart on the same port, the viewer polling and reloading, and recovery when the restart fails. Child process handling, signals, and port reuse races.
5. **User-file safety:** only the plan's files change, dirty detection (git and non-git), the package-manager upgrade command per lockfile, `migrate` idempotence, and the kit never changed.
6. **The controller verification task:** the Verdaccio-based end-to-end update must not risk publishing to the real registry (registry scoping, `.npmrc` placement, cleanup).

## Output
```
VERDICT: READY | READY_WITH_CHANGES | NOT_READY
CRITICAL: <n>
IMPORTANT: <n>
MINOR: <n>

[Severity] Task N, Step M (line) — finding. Why it matters. Smallest fix.
```
Critical = the plan would fail to build or pass its own tests, violate the design, the mockup or a prohibition, open a security hole, or damage a user project. Important = should change before execution. Minor = optional. Classify honestly; do not inflate. End with the strongest parts to preserve.
