A running `dev` notices when something deletes its workspace, and writes it back. The server owns the generated files under `.ds-viewer/` and nothing else should remove them — but something does, rarely, and the symptom was badly misleading:

    ConfigError: Cannot resolve entry file: The `main` field defined in your package.json
    points to an unresolvable or non-existent path.

That names the *project's* `package.json` — a file the developer never touched and which is perfectly fine. The catalog would sit there broken, blaming the wrong file, until someone thought to restart it.

The server now checks its own workspace every few seconds, and when the defining files are gone it says what happened and rewrites them:

    Something outside this server deleted package.json, app.json, tsconfig.json,
    metro.config.js, entry.tsx from .ds-viewer/. Rewriting them — your project is fine,
    this is the catalog's own generated workspace. If the catalog looks broken, reload
    the page.

Metro picks the files back up without a restart; the catalog keeps serving.

The repair is capped at five per run. If something is deleting continuously, rewriting forever would hide it behind a repair loop, so past the cap the server stops repairing and keeps reporting, with a link to issue #41.

This is a mitigation, not a fix. **The cause is still unidentified** — see #41, where four theories have been eliminated (duplicate `dev` servers, render-workspace clobbering, directory replacement, and the viewer's own deletion code), and filesystem instrumentation showed every observed removal correctly scoped to the workspace that owned it. What this change does is make the failure name itself and recover, instead of pointing at an innocent file.
