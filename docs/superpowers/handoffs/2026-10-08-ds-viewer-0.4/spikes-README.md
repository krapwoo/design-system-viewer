# 0.4 plan spikes

## 1. Local endpoint: CORS preflight, secret header, exact-Origin match

**Command:** `node spikes/cors-endpoint/server.mjs` (a minimal `http.createServer`, no package
code) on port 5190, `ALLOWED_ORIGIN = http://localhost:5191`, secret header
`x-ds-viewer-secret`. Exercised with `curl` for every case the design's "Local endpoint
safeguards" and "Testing" sections name:

| Case | Result |
|---|---|
| `OPTIONS /plan`, `Origin: http://localhost:5191` (correct) | `204`, `Access-Control-Allow-Origin`/`-Methods`/`-Headers` echoed back |
| `OPTIONS /plan`, `Origin: http://evil.example` | `403`, no CORS headers — preflight itself must check Origin, not just the real request |
| `POST /plan`, correct Origin + correct secret header | `200` |
| `POST /plan`, correct Origin, wrong secret | `401` |
| `POST /plan`, no `Origin` header at all | `400` |
| `POST /plan`, wrong Origin (correct secret) | `403` |

**Decision:** the exact sequence the plan's endpoint task uses is **Origin check (reject both
missing and mismatched before anything else, including on `OPTIONS`) → secret-header check → verb
routing**. `OPTIONS` never reaches the secret check — the browser's own preflight never attaches
the app's custom header to its *own* probe request, so requiring the secret on `OPTIONS` would
make every state-changing request fail cross-origin. `Access-Control-Allow-Origin` is always the
literal `ALLOWED_ORIGIN` string (computed once per `dev` run from the real Metro URL), never `*`
and never a value echoed from the request's own `Origin` header.

## 2. End-to-end **Update now** proof without publishing

**Tried in order:**

1. **Packed tarball (`npm pack` + a `file:` dependency).** Rejected: design §5 "Update plan" step 1
   is explicitly "fetches the package from npm, like any install" — proving the real `update`/panel
   flow means its download step must stay an ordinary registry request. A `file:` path would only
   prove a different code path (`npm install <path>`), not the one that ships.
2. **A local npm registry (Verdaccio).** Chosen. Spiked for real, not just read about:
   - `npx --yes verdaccio@6.10.5 --config config.yaml --listen 5191` (storage in
     `spikes/verdaccio-e2e/storage`, deleted after the spike — config kept). Reachable at
     `http://localhost:5191/` (not `127.0.0.1` — Verdaccio's own `listen` binds the hostname it was
     given; `curl` against the IP got connection-refused until `localhost` was used).
   - Created a throwaway publish user directly via the registry's user endpoint (`PUT
     /-/user/org.couchdb.user:<name>`, since `npm adduser`'s interactive prompt can't be driven by
     piped stdin against this npm version) and wrote the returned token into a scratch `.npmrc`.
   - Copied this worktree, bumped its own `package.json` version to `0.3.1-e2e-spike` (a throwaway
     prerelease tag, never a real version this plan or `main` uses), ran the real `npm run build`,
     and `npm publish --registry http://localhost:5191/ --access public` — published clean.
   - From a **separate, fresh** scratch project with only a project-root `.npmrc` containing
     `registry=http://localhost:5191/`, `npm view @krapwoo/ds-viewer version` and a real `npm
     install @krapwoo/ds-viewer@latest` both resolved **`0.3.1-e2e-spike`** — confirmed against the
     *real* `registry.npmjs.org` in the same terminal session that it still answers `0.3.0`,
     untouched.

**Decision:** the controller's Task 13 (verification) runs a real local Verdaccio instance,
publishes a throwaway next-version tarball of this same worktree to it, and writes
`registry=http://localhost:5191/` into the fresh Expo app's own project-root `.npmrc` before
driving the viewer's **Update now** button. This needs **zero production code changes** — every
call `update`/the plan step already makes (`npm view`, the package manager's install command) is
an ordinary, unmodified registry request; only the registry URL changes, via npm's own documented
`.npmrc` precedence. This satisfies the brief's "prefer no production test hooks" directly: there
is no test hook at all, env-gated or otherwise. The GitHub-release-summary half of the update
check has no local-registry equivalent — the fake version's "What's new" summary is expected to
come back empty/missing in this verification (no real GitHub release exists for
`0.3.1-e2e-spike`), which the design already treats as an unreachable/not-found case (silent,
non-fatal) — noted in the plan's Report-only list, not treated as a bug to fix.

**Cleanup done:** the spike's Verdaccio process was killed and its `storage`/`htpasswd`/log files
deleted; `spikes/verdaccio-e2e/config.yaml` is kept only as a template for Task 13 to reuse
verbatim. No tarball, port, or process was left running.

## 3. Running the downloaded tarball's `migrate` without `node_modules` (Fable Critical #1)

The spike above proves `npm view`/`npm install` work against a local registry — but
`buildUpdatePlan`'s own step 2 never runs `npm install` for the downloaded version; it `npm pack`s
the target into a **temporary folder** and runs that extracted copy's `migrate` directly, with no
`node_modules` of its own. `cli/main.ts` statically imports `config.ts`/`doctor.ts`/`init.ts`/
`explain.ts`, each of which imports the `typescript` npm package at module load — absent from that
temp folder, so `node <tmp>/package/dist/cli/main.js migrate …` was always going to fail with
`ERR_MODULE_NOT_FOUND`.

**Command:** built a standalone reproduction in `spikes/migrate-entry/src/` — exact copies of the
planned `semver.ts`, `migrations/types.ts`, `migrations/index.ts`, `migrate.ts`, plus a new,
dependency-free `migrateEntry.ts` (imports only `migrate.ts`, nothing else). Compiled with this
worktree's own `node_modules/.bin/tsc`, using the repo's real `tsconfig.json` compiler options
(`module`/`moduleResolution: NodeNext`, `rewriteRelativeImportExtensions: true`) into
`spikes/migrate-entry/dist/`, then deleted every `node_modules` folder under
`spikes/migrate-entry/` and ran the compiled output directly — exactly the state a `npm pack` +
`tar -xzf` extraction produces (no install step). Contrasted against a `mainStub.mjs` that only
does `import ts from 'typescript'`, standing in for what `main.js`'s own import chain actually
does.

**Result:**
```
$ node dist/migrateEntry.js --from 0.3.0 --dry-run --json
{"version":1,"from":"0.3.0","changes":[],"dryRun":true}
exit code: 0

$ node dist/mainStub.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'typescript' imported from .../dist/mainStub.mjs
exit code: 1
```

**Decision:** Task 8 adds a standalone, dependency-free `cli/migrateEntry.ts` (imports only
`migrate.ts`/`migrations/`/`semver.ts` — no file in that chain may import `typescript`, enforced by
a comment in `migrations/types.ts`) that `tsc` compiles to `dist/cli/migrateEntry.js` alongside
`main.js`. Task 9's `buildUpdatePlan` runs `node <tmp>/package/dist/cli/migrateEntry.js --from
<installed> --dry-run --json` against the extracted tarball instead of `main.js migrate`. Task 20's
verification re-runs this exact standalone-extraction check against the real packed 0.4.0 tarball
(not just the mini reproduction above) before trusting the end-to-end Verdaccio flow.
