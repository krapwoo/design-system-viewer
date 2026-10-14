import { existsSync, readFileSync, rmSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AddressInfo } from 'node:net';
import { resolveConfig } from './config.ts';
import { sync } from './sync.ts';
import { clearDevLock, liveDevLock, missingWorkspaceFiles, workspacePath, writeDevLock, writeWorkspace } from './workspace.ts';
import { findFreePort } from './port.ts';
import { globBaseFolder } from './glob.ts';
import {
  buildVersionStatus, checkForUpdate, createVersionController, defaultPreferencesDir, readPersonalAutoCheck, resolveAutoCheck, runUpdateCheck,
  statusFromCheck, writeUpdateFile, writeVersionFile,
} from './updateCheck.ts';
import type { VersionStatus } from '../native/catalog/types.ts';
import { readOwnVersion } from './packageVersion.ts';
import { createUpdateEndpoint, type EndpointDeps, type UpdateStatus } from './endpoint.ts';
import { buildUpdatePlan, type UpdatePlan } from './updatePlan.ts';
import { lastSummaryLine } from './doctor.ts';
import { declaredDependency, detectPackageManager, installUpgradeCommand, isLocalSpec, platformCommand, type PackageManager } from './packageManager.ts';
import { localInstallRefusal } from './update.ts';
import { DEFAULT_WORKSPACE_DIR, RENDER_WORKSPACE_DIR, type ResolvedConfig } from './types.ts';

export class LocalInstallMissingError extends Error {}

/** Another `dev` already owns this project's generated workspace. Its own class so `main` can
 *  print the message plainly, the way it already does for a missing local install, instead of a
 *  stack trace. */
export class DevWorkspaceBusyError extends Error {}

const IGNORED_WATCH_SEGMENTS = new Set([DEFAULT_WORKSPACE_DIR, RENDER_WORKSPACE_DIR, 'node_modules', '.git']);

/** False for a changed path under `.ds-viewer/` (package-owned output — reacting to it would make
 *  `dev`'s own `sync` retrigger itself), `node_modules/`, or `.git/`; true for everything else, so
 *  `dev`'s watcher (below) only re-syncs on a project source change. */
export function isWatchedPath(relativePath: string): boolean {
  return !relativePath.split(path.sep).some((segment) => IGNORED_WATCH_SEGMENTS.has(segment));
}

/** Design §1 "Host requirements": `dev` refuses to run unless the package is a local
 *  devDependency, because pages import from it and a second copy of React would load otherwise.
 *  Checks both that `package.json` *declares* it and that `npm install` has actually fetched it
 *  (Minor: `init` without a following `npm install` passed this check before and failed later,
 *  obscurely, inside Metro). */
export function assertLocalInstall(projectRoot: string): void {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) throw new LocalInstallMissingError('No package.json found in this project.');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const installed = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (!installed['@krapwoo/ds-viewer']) {
    throw new LocalInstallMissingError('@krapwoo/ds-viewer must be installed as a local devDependency. Run: npm install --save-dev @krapwoo/ds-viewer');
  }
  if (!existsSync(path.join(projectRoot, 'node_modules', '@krapwoo', 'ds-viewer', 'package.json'))) {
    throw new LocalInstallMissingError('@krapwoo/ds-viewer is declared but not installed yet. Run: npm install');
  }
}

/** The folders `dev`'s watcher needs to cover: the glob base folder of every `components`,
 *  `tokens`, and `pages` pattern — not the whole project (Minor: a large `node_modules` under a
 *  recursively-watched project root can exhaust inotify watches on Linux; design §2 only promises
 *  watching "components, tokens, and page files"). */
export function watchTargetFolders(config: ResolvedConfig): string[] {
  const patterns = [...config.components, ...(config.tokens ?? []), ...(config.pages ?? [])];
  return [...new Set(patterns.map((pattern) => path.join(config.projectRoot, globBaseFolder(pattern))))].filter((folder) => existsSync(folder));
}

/** Re-resolves `<projectRoot>/ds-viewer.config.ts` from disk, syncs from it, and rewrites the
 *  generated workspace (entry.tsx, metro.config.js, …) from the freshly-resolved values — unlike
 *  plain `sync(config)`, which only ever regenerates `.ds-viewer/generated/` from whatever
 *  `ResolvedConfig` it was already given. `dev`'s config-file watcher (below) calls this instead
 *  of `sync` directly: without it, a changed `name` or `logo` never reached the generated
 *  workspace until `dev` was restarted, because `writeWorkspace` was never called again with the
 *  new value (controller end-to-end finding E1). Returns the freshly-resolved config so `dev` can
 *  keep watching with it. */
export function reloadWorkspace(
  projectRoot: string,
  updateEndpoint?: { baseUrl: string; secret: string },
  // `resolveConfig` reads the user's file, which never names a workspace directory, so a run that
  // owns a non-default one has to put it back — otherwise a config change moves every generated
  // file into `.ds-viewer`, which is the collision this parameter exists to prevent.
  workspaceDir?: string,
): ResolvedConfig {
  const resolved = resolveConfig(projectRoot);
  const config: ResolvedConfig = workspaceDir ? { ...resolved, workspaceDir } : resolved;
  sync(config);
  writeWorkspace(config, updateEndpoint);
  return config;
}

/** Design §5: `dev` writes `.ds-viewer/update.json` every run, from a fresh check (respecting the
 *  24h cache inside `checkForUpdate`) or `null` when checks are disabled — never left unwritten,
 *  since the generated entry file (Task 17) always imports it. Exported and test-only-injectable
 *  the same way `reloadWorkspace` already is, so this plan never needs to test `dev()` itself
 *  (which spawns a real Expo process) to prove this one behavior. */
export async function refreshUpdateFile(
  config: ResolvedConfig,
  ownVersion: string,
  options: { checkForUpdate?: typeof checkForUpdate; env?: NodeJS.ProcessEnv; prefsDir?: string } = {},
): Promise<VersionStatus> {
  const env = options.env ?? process.env;
  const personal = readPersonalAutoCheck(options.prefsDir ?? defaultPreferencesDir(), config.projectRoot);
  const autoCheck = resolveAutoCheck(config, env, personal);
  // An injected `checkForUpdate` (tests) stands in for the real check; it can't report "couldn't
  // reach npm", so it always counts as answered.
  const injected = options.checkForUpdate;
  const status = injected
    ? autoCheck.enabled
      ? statusFromCheck(ownVersion, autoCheck, { result: await injected(ownVersion), reached: true })
      : { current: ownVersion, autoCheck, lastOutcome: 'not-run' as const, update: null }
    : await buildVersionStatus(ownVersion, autoCheck);
  writeUpdateFile(config.projectRoot, status.update ? { ...status.update, checkedAt: status.lastCheckedAt ?? new Date().toISOString() } : undefined, config.workspaceDir);
  writeVersionFile(config.projectRoot, status, config.workspaceDir);
  return status;
}

// Promisified, not `execFileSync` — install/migrate/doctor each take real seconds, and this now
// runs from inside the endpoint's own request-handling process, which must keep answering
// `/update/status` polls throughout (Critical finding, Fable correction pass: the synchronous
// version blocked the entire event loop until the whole update finished).
const execFileAsync = promisify(execFile);
type ExecImpl = (command: string, args: string[], options: { cwd: string; encoding: 'utf8' }) => Promise<string>;
const defaultExecImpl: ExecImpl = async (command, args, options) => {
  const run = platformCommand(command, args);
  return (await execFileAsync(run.command, run.args, { ...options, shell: run.shell })).stdout;
};

function installedMainJs(projectRoot: string): string {
  return path.join(projectRoot, 'node_modules', '@krapwoo', 'ds-viewer', 'dist', 'cli', 'main.js');
}

function packageManagerLabel(pm: PackageManager): string {
  return pm === 'npm' ? 'npm' : pm === 'pnpm' ? 'pnpm' : 'yarn';
}

/** Design §5 "`npx ds-viewer update`" steps 3-5, run from inside `dev` instead of a one-shot CLI
 *  invocation — every external effect injected (Global Constraints), exactly like `cli/update.ts`'s
 *  `runUpdate`. The plan's own dirty-file refusal already happened before this was ever called
 *  (the endpoint, Task 12, refuses `POST /update` itself); this function only ever runs a plan it
 *  has already been told is safe to apply. */
export async function performUpdate(
  config: ResolvedConfig,
  currentVersion: string,
  plan: UpdatePlan,
  deps: {
    execImpl: ExecImpl;
    onStatus: (status: UpdateStatus) => void;
    restart: (result: { doctorSummary: string; files: string[]; latest: string }) => void | Promise<void>;
    /** Errata 2c: how long to wait after reporting `'restarting'` before actually calling
     *  `restart` — gives the browser a moment to start polling `/update/status` and see the
     *  `'restarting'` phase before the old Metro process goes away. Tests pass `0`. */
    delayMs?: number;
    /** Resume a failed update from this step; the steps before it already succeeded. */
    from?: 'migrate' | 'doctor';
  },
): Promise<void> {
  const startAt = deps.from === 'doctor' ? 3 : deps.from === 'migrate' ? 2 : 1;
  const migrationCount = plan.files.filter((f) => f.reason.startsWith('migration:')).length;
  const pm = detectPackageManager(config.projectRoot);
  // Names the detected package manager and the real migration count (Important finding, Fable
  // correction pass: the approved mockup's own `updating` state reads "Installed with npm" and
  // "Applying 1 migration…", never a generic placeholder). The install step carries its own
  // present-tense `progressLabel` (Minor finding, Fable correction pass: the in-flight step
  // previously read "Installed with npm…" — already past tense — while still running) and its own
  // `failLabel` (the mockup's failure state reads "Install with npm failed", not "Installed with
  // npm failed" — a different, plain-present phrasing from either the done or in-flight label).
  const stepDefs = [
    { label: `Downloaded ${plan.latest}` },
    { label: `Installed with ${packageManagerLabel(pm)}`, progressLabel: `Installing with ${packageManagerLabel(pm)}`, failLabel: `Install with ${packageManagerLabel(pm)}` },
    { label: migrationCount > 0 ? `Applying ${migrationCount} migration${migrationCount === 1 ? '' : 's'}` : 'No migrations to apply' },
    { label: 'Checking pages (doctor)' },
    { label: 'Restarting the viewer' },
  ];
  // `completedCount` steps are 'done', the next one is 'now' (in flight), the rest 'todo' — a
  // three-way state, not a boolean (Important finding, Fable correction pass; Task 12/15 share
  // this exact shape). Step 0 (download) is already done — `buildUpdatePlan` already downloaded
  // the tarball while building the plan this function was handed.
  const report = (completedCount: number) =>
    deps.onStatus({
      phase: 'updating',
      steps: stepDefs.map((def, i) => ({
        label: i === completedCount && def.progressLabel ? def.progressLabel : def.label,
        state: i < completedCount ? 'done' : i === completedCount ? 'now' : 'todo',
      })),
    });
  report(startAt);

  if (startAt <= 1) {
    // The same refusal the CLI gives: installing a registry version over a `file:`/`link:`/
    // `workspace:` spec would replace the local checkout the project points at, and the catalog
    // would keep serving while no longer reflecting the source being edited. Reported as a
    // failure of the install step, so the page offers its normal recovery rather than appearing
    // to succeed.
    const declared = declaredDependency(config.projectRoot, '@krapwoo/ds-viewer');
    if (declared && isLocalSpec(declared.spec)) {
      deps.onStatus({
        phase: 'failure',
        log: localInstallRefusal(declared.spec, plan.latest),
        failedStep: stepDefs[1].failLabel ?? stepDefs[1].label,
        step: 'install',
      });
      return;
    }
    const { command, args } = installUpgradeCommand(pm, '@krapwoo/ds-viewer', plan.latest, declared?.section);
    try {
      await deps.execImpl(command, args, { cwd: config.projectRoot, encoding: 'utf8' });
    } catch (error) {
      deps.onStatus({ phase: 'failure', log: (error as Error).message, failedStep: stepDefs[1].failLabel ?? stepDefs[1].label, step: 'install' });
      return;
    }
    report(2);
  }

  if (startAt <= 2) {
    try {
      await deps.execImpl('node', [installedMainJs(config.projectRoot), 'migrate', '--from', currentVersion], { cwd: config.projectRoot, encoding: 'utf8' });
    } catch (error) {
      deps.onStatus({ phase: 'failure', log: (error as Error).message, failedStep: stepDefs[2].label, step: 'migrate' });
      return;
    }
    report(3);
  }

  let doctorOutput: string;
  try {
    doctorOutput = await deps.execImpl('node', [installedMainJs(config.projectRoot), 'doctor'], { cwd: config.projectRoot, encoding: 'utf8' });
  } catch (error) {
    deps.onStatus({ phase: 'failure', log: (error as Error).message, failedStep: stepDefs[3].label, step: 'doctor' });
    return;
  }
  report(4);
  // Fable Minor finding, raised to Important by the controller: the success page showed the whole
  // doctor report (30+ lines for a real project) — the mockup's own success state shows one line.
  const doctorSummary = lastSummaryLine(doctorOutput);

  deps.onStatus({ phase: 'restarting' });
  // Errata 2c: wait before actually restarting, so the browser's next `/update/status` poll can
  // observe the `'restarting'` phase instead of the connection just dropping.
  await new Promise((resolve) => setTimeout(resolve, deps.delayMs ?? 1500));
  // `files` lets the `success` status (Task 12/15/16) show what changed after the reload, once
  // `plan` itself is gone (Important finding, Fable correction pass). `latest` (Errata 1b) lets
  // the panel render the success state once `update.json` has gone back to `null`.
  await deps.restart({ doctorSummary, files: plan.files.map((f) => f.path), latest: plan.latest });
}

export interface RestartHandoff {
  projectRoot: string;
  /** The generated directory this run owns, so the restart releases that run's own lock. */
  workspaceDir?: string;
  port: number;
  child: ReturnType<typeof spawn>;
  watchers: FSWatcher[];
  /** Undefined for a run started with `--no-update-endpoint`, which owns no endpoint to close. */
  endpointServer: import('node:http').Server | undefined;
  /** Errata 7d: printed alongside the recovery command if the restart itself fails, so a failed
   *  restart never loses the result of an otherwise-successful install/migrate/doctor run. */
  doctorSummary: string;
  files: string[];
}

/** Errata 7c: Metro listens on `[::1]` only, so a plain `127.0.0.1` connect probe always reports
 *  the port as free even while Metro is still bound to it (observed with `lsof`) — `findFreePort`
 *  itself already tries to bind the port, which fails correctly either way. */
function defaultProbePortFree(port: number): Promise<boolean> {
  return findFreePort(port, port).then(() => true, () => false);
}

async function waitForPortFree(port: number, probe: (port: number) => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await probe(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Kills `pid`'s whole process group with `signal` — a negative pid, except on `win32` (Errata
 *  7e), where there is no process-group concept and `child.kill(signal)` is the only option. */
function killGroup(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch {
    // Already exited.
  }
}

/** Design §5 "Restart handoff" steps 3-5, rewritten in full (Critical finding, Fable correction
 *  pass — the original version was detached-but-unrefed-and-immediately-exited, which this
 *  repository's own `scripts/checkCatalogConsole.mjs` already documents as leaving the Expo
 *  grandchild running on the port): closes everything this `dev` process owns; kills the *whole
 *  process group* Expo/Metro spawned into (`dev()`, below, now spawns it with `detached: true`,
 *  the same convention `checkCatalogConsole.mjs`'s own `killDevGroup` already established — a
 *  negative pid targets the group, not just the one pid `child.kill()` alone would reach); waits
 *  for the old child to actually exit (or 10s, whichever comes first — Errata 7d) and the port to
 *  actually free before re-spawning `dev --port <same port>` — this time *not* detached, with
 *  inherited stdio, so this very process becomes a thin supervisor that forwards
 *  `SIGINT`/`SIGTERM`/`SIGHUP` to the new child and exits with its code, printing a recovery
 *  command (and the result this update already recorded) if it exits non-zero, or if anything in
 *  this function itself throws. Has no unit test (see this task's own note) — proven end-to-end
 *  in Task 20. */
export async function performRestart(
  handoff: RestartHandoff,
  deps: { probePortFree?: (port: number) => Promise<boolean> } = {},
): Promise<void> {
  // Errata 7a: remove `dev()`'s own SIGINT/SIGTERM/SIGHUP listeners (Step 5, below) first, before
  // anything else — otherwise a signal sent to this supervisor mid-restart exits through that old
  // handler (which tries to kill the already-exiting old child and calls `process.exit(0)`),
  // orphaning the restarted `dev` and its Metro. `targetChild` starts `undefined`; a signal
  // delivered before `newChild` exists below used to be silently swallowed instead of cancelling
  // the restart (Minor finding, Fable correction pass: Ctrl-C in that up-to-15s window brought the
  // viewer back up instead of stopping it) — `cancelledBeforeSpawn` remembers it instead, so the
  // new `dev` is never spawned once the old child is gone.
  let targetChild: ReturnType<typeof spawn> | undefined;
  let cancelledBeforeSpawn = false;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.removeAllListeners(signal);
  const forward = (signal: NodeJS.Signals) => {
    if (targetChild) targetChild.kill(signal);
    else cancelledBeforeSpawn = true;
  };
  process.on('SIGINT', forward);
  process.on('SIGTERM', forward);
  process.on('SIGHUP', forward);

  try {
    for (const watcher of handoff.watchers) watcher.close();
    handoff.endpointServer?.close();
    killGroup(handoff.child, 'SIGTERM');

    // Errata 7d: race the old child's exit against a 10s timer, then SIGKILL the group — a wedged
    // Expo/Metro process must never block the restart forever.
    const exited = await Promise.race([
      new Promise<boolean>((resolve) => {
        if (handoff.child.exitCode !== null) { resolve(true); return; }
        handoff.child.once('exit', () => resolve(true));
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]);
    if (!exited) killGroup(handoff.child, 'SIGKILL');

    await waitForPortFree(handoff.port, deps.probePortFree ?? defaultProbePortFree);

    // Released before the replacement starts. This process stays alive as the new `dev`'s
    // supervisor, so a lock still naming it would make its own replacement refuse the workspace.
    clearDevLock({ projectRoot: handoff.projectRoot, workspaceDir: handoff.workspaceDir });

    // The old child is gone and the port is free — if a signal arrived in the window above (before
    // there was anything to forward it to), this restart is itself cancelled: the user asked to
    // stop, not to come back up on the new version.
    if (cancelledBeforeSpawn) {
      process.exit(0);
      return;
    }

    const newChild = spawn(
      process.execPath,
      [...process.execArgv, process.argv[1], 'dev', '--port', String(handoff.port)],
      { cwd: handoff.projectRoot, stdio: 'inherit' },
    );
    newChild.on('error', (error) => console.error(`Could not restart the viewer: ${error.message}`));
    targetChild = newChild;
    const exitCode = await new Promise<number>((resolve) => newChild.on('exit', (code) => resolve(code ?? 0)));
    if (exitCode !== 0) {
      console.error(`The restarted viewer exited unexpectedly (code ${exitCode}).`);
      console.error('Recover with: npx ds-viewer dev');
      // Important finding, Fable correction pass: design §5 restart step 5 asks for "the recovery
      // command and the result of the update" — previously only the recovery command printed here,
      // losing the install/migrate/doctor result (never shown anywhere else; it ran in-process).
      console.error(`The update itself finished: ${handoff.doctorSummary}; changed: ${handoff.files.join(', ') || '(none)'}.`);
    }
    process.exit(exitCode);
  } catch (error) {
    console.error(`Restart failed: ${(error as Error).message}`);
    console.error('Recover with: npx ds-viewer dev');
    console.error(`The update itself finished: ${handoff.doctorSummary}; changed: ${handoff.files.join(', ') || '(none)'}.`);
    process.exit(1);
  }
}

/** Design §2 "`dev`": checks the local install, runs `sync`, writes the workspace, starts Expo
 *  web on the first free port from 5181 bound to localhost only, and watches the project for
 *  component/token/page changes to re-run `sync`. Metro's own HMR updates the rendered component
 *  when its source changes, but not the generated props table or page list (Task 17 Step 4 relies
 *  on this: editing `Button.tsx` must update its props table, not just hot-reload the component). */
/** How often a running `dev` checks that its own workspace still exists. Cheap (five `existsSync`
 *  calls), and slow enough to be invisible: the failure it covers is rare, and noticing within a
 *  few seconds is soon enough to repair before the next page load. */
const WORKSPACE_WATCH_INTERVAL_MS = 4000;

/** How many times one `dev` run will rewrite a workspace that keeps losing files. Past this,
 *  something is deleting continuously and repairing again would only hide it. */
const WORKSPACE_REPAIR_LIMIT = 5;

/** Everything the generated `entry.tsx` needs beside it. The update files are listed too because
 *  `entry.tsx` imports them unconditionally (`./update.json`, `./version.json`), so restoring the
 *  entry without them leaves Metro unable to resolve its imports — a repair that reports success
 *  over a catalog that is still broken. */
export type WorkspaceRepairDeps = {
  config: ResolvedConfig;
  updateEndpoint: { baseUrl: string; secret: string } | undefined;
  versionStatus: () => VersionStatus;
  sync: (config: ResolvedConfig) => void;
  /** Re-asserts this server's ownership of the directory. The observed failure removes
   *  `dev-lock.json` along with everything else, and without it a second `dev` is no longer
   *  refused — so a repair that skipped it would quietly give up the protection in #39. */
  reclaimLock: () => void;
  log?: (message: string) => void;
};

/** One pass of the workspace integrity check. Returns what it did, so the caller owns the repair
 *  budget and the tests can drive it without a timer.
 *
 *  `updateEndpoint` is the caller's own, passed through unchanged: rebuilding it here from the
 *  Metro port would point the repaired catalog at the wrong server, silently breaking the update
 *  panel while telling the developer everything is fine. */
export function repairWorkspaceIfMissing(deps: WorkspaceRepairDeps): { missing: string[]; repaired: boolean } {
  const { config, updateEndpoint, versionStatus, sync, reclaimLock, log = console.warn } = deps;
  const missing = missingWorkspaceFiles(config);
  if (missing.length === 0) return { missing, repaired: false };

  log(
    `Something outside this server deleted ${missing.join(', ')} from ${config.workspaceDir ?? DEFAULT_WORKSPACE_DIR}/. ` +
      "Rewriting them — your project is fine, this is the catalog's own generated workspace. " +
      'If the catalog looks broken, reload the page.',
  );
  writeWorkspace(config, updateEndpoint);
  // `entry.tsx` imports both of these, so a rewrite that skips them resolves nothing. Both come
  // from one status, the way `refreshUpdateFile` writes them, so a repair cannot leave
  // `version.json` announcing an update that `update.json` denies.
  const status = versionStatus();
  if (!existsSync(workspacePath(config, 'update.json'))) {
    const update = status.update ? { ...status.update, checkedAt: status.lastCheckedAt ?? new Date().toISOString() } : undefined;
    writeUpdateFile(config.projectRoot, update, config.workspaceDir);
  }
  if (!existsSync(workspacePath(config, 'version.json'))) writeVersionFile(config.projectRoot, status, config.workspaceDir);
  reclaimLock();
  sync(config);
  return { missing, repaired: true };
}

export async function dev(initialConfig: ResolvedConfig, devOptions: { pinnedPort?: number; noUpdateEndpoint?: boolean; workspaceDir?: string } = {}): Promise<void> {
  assertLocalInstall(initialConfig.projectRoot);
  const ownVersion = readOwnVersion(import.meta.dirname);
  // Carried on the config so every writer (sync, writeWorkspace, the update files) lands in this
  // run's own directory, and so a config reload cannot silently drop it.
  let config: ResolvedConfig = devOptions.workspaceDir ? { ...initialConfig, workspaceDir: devOptions.workspaceDir } : initialConfig;
  const version = createVersionController({
    ownVersion,
    projectRoot: initialConfig.projectRoot,
    prefsDir: defaultPreferencesDir(),
    env: process.env,
    initial: await refreshUpdateFile(config, ownVersion),
    getConfig: () => config,
    // **Check now** always asks npm, even with automatic checks off: you asked for this one check.
    // The result lives only in this process; `update.json` and `version.json` are rewritten at
    // the next start (rewriting them now would reload the page).
    runCheck: () => runUpdateCheck(ownVersion, { force: true, timeoutMs: 5000 }),
  });
  sync(config);

  // Restart handoff step 2/4: a status file left by the *previous* `dev` process (right before it
  // exited to restart) is read once, then deleted — a plain refresh afterward shows "idle"/"no
  // update known" instead of replaying a stale success/failure forever.
  const statusFile = workspacePath(config, 'update-status.json');
  let updateStatus: UpdateStatus = { phase: 'idle' };
  if (existsSync(statusFile)) {
    try {
      updateStatus = JSON.parse(readFileSync(statusFile, 'utf8')) as UpdateStatus;
    } catch {
      // A partial/corrupt write from a process that crashed mid-write — stay idle.
    }
    rmSync(statusFile, { force: true });
  }

  const port = await findFreePort(devOptions.pinnedPort ?? 5181, devOptions.pinnedPort ?? 5199);

  // Refused before anything is written: a second `dev` on the same workspace rewrites entry.tsx,
  // package.json, app.json, metro.config.js and tsconfig.json underneath the first, and the loser
  // ends up serving a workspace that no longer describes it — Expo reports that as an unresolvable
  // `main` field, which names neither the other server nor the shared directory.
  const existing = liveDevLock(config);
  if (existing) {
    throw new DevWorkspaceBusyError(
      [
        `Another ds-viewer dev (pid ${existing.pid}) is already serving this project at http://localhost:${existing.port}.`,
        '',
        `Both would generate into ${config.workspaceDir ?? DEFAULT_WORKSPACE_DIR}/ and overwrite each other's files.`,
        '',
        'Stop that one first, or give this run its own directory:',
        `  npx ds-viewer dev --workspace-dir .ds-viewer-second`,
      ].join('\n'),
    );
  }
  writeDevLock(config, { pid: process.pid, port });

  console.log(`Starting the catalog at http://localhost:${port}`);

  let watchersPaused = false;
  // Metro's own child process doesn't exist yet — assigned below, well before this is ever read
  // (performUpdate's `restart` callback, which is the only reader, can only run after a real
  // browser has already loaded the page and clicked "Update now").
  let child!: ReturnType<typeof spawn>;
  const secret = randomBytes(24).toString('hex');
  const allowedOrigin = `http://localhost:${port}`;
  // The plan the last update ran with, so a failed migrate or doctor step can be resumed.
  let lastPlan: UpdatePlan | undefined;
  const runUpdate = (plan: UpdatePlan, from?: 'migrate' | 'doctor') => {
    lastPlan = plan;
    watchersPaused = true;
    void performUpdate(config, ownVersion, plan, {
      execImpl: defaultExecImpl,
      from,
      onStatus: (status) => {
        updateStatus = status;
        if (status.phase === 'failure') watchersPaused = false; // the update stopped — keep developing on the old version.
      },
      restart: async (result) => {
        writeFileSync(statusFile, JSON.stringify({ phase: 'success', ...result }));
        await performRestart({ projectRoot: config.projectRoot, workspaceDir: config.workspaceDir, port, child, watchers, endpointServer, doctorSummary: result.doctorSummary, files: result.files });
      },
    }).catch((error) => {
      // `performUpdate` only reports 'failure' from its own guarded steps; anything thrown outside
      // them (e.g. writing the status file) lands here instead of as an unhandled rejection.
      updateStatus = { phase: 'failure', log: (error as Error).message, failedStep: 'Updating', step: 'other' };
      watchersPaused = false;
    });
  };
  const endpointDeps: EndpointDeps = {
    secret,
    allowedOrigin,
    buildPlan: () => buildUpdatePlan(config, ownVersion),
    // Install, migrate, doctor, restart; `from` resumes after a failed migrate or doctor step.
    startUpdate: (plan) => runUpdate(plan),
    getStatus: () => updateStatus,
    dismissStatus: () => {
      updateStatus = { phase: 'idle' };
    },
    resumeUpdate: (step) => {
      if (lastPlan) {
        runUpdate(lastPlan, step);
        return;
      }
      // No plan in memory (this process didn't run the failed update): rebuild it first.
      updateStatus = { phase: 'updating', steps: [{ label: 'Preparing', state: 'now' }] };
      void buildUpdatePlan(config, ownVersion).then(
        (plan) => {
          if ('error' in plan) updateStatus = { phase: 'failure', log: plan.error, failedStep: 'Preparing', step: 'other' };
          else runUpdate(plan, step);
        },
        (error: Error) => {
          updateStatus = { phase: 'failure', log: error.message, failedStep: 'Preparing', step: 'other' };
        },
      );
    },
    getVersionStatus: version.getVersionStatus,
    checkNow: version.checkNow,
    setAutoCheck: version.setAutoCheck,
  };
  // A throwaway server (a render check's own `dev`) takes no update actions, and creating an
  // endpoint would bake its short-lived port into the shared workspace — pointing an already-open
  // catalog at a port that dies with this process. See `writeWorkspace`.
  let updateEndpoint: { baseUrl: string; secret: string } | undefined;
  let endpointServer: ReturnType<typeof createUpdateEndpoint> | undefined;
  if (!devOptions.noUpdateEndpoint) {
    endpointServer = createUpdateEndpoint(endpointDeps);
    await new Promise<void>((resolve) => endpointServer!.listen(0, '127.0.0.1', resolve));
    const endpointPort = (endpointServer.address() as AddressInfo).port;
    // Printed for the same reason the Metro port above is printed: a developer (or Task 20's own
    // verification) checking the endpoint directly (e.g. with curl) needs its port — the secret
    // itself is never printed; the endpoint rejects anything that doesn't already have it.
    console.log(`Update endpoint listening on 127.0.0.1:${endpointPort}`);
    updateEndpoint = { baseUrl: `http://127.0.0.1:${endpointPort}`, secret };
  } else {
    console.log('Update endpoint disabled for this run (--no-update-endpoint).');
  }

  const workspace = writeWorkspace(config, updateEndpoint);

  let debounceTimer: NodeJS.Timeout | undefined;
  const onSourceChange = (_eventType: string, relativePath: string | null) => {
    if (watchersPaused) return;
    if (relativePath && !isWatchedPath(relativePath)) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        sync(config);
      } catch (error) {
        console.warn(`sync failed after a file change: ${(error as Error).message}`);
      }
    }, 200);
  };

  // A distinct debounce/handler from `onSourceChange` above: a config change needs
  // `reloadWorkspace` (re-resolve, then rewrite the generated workspace too), not just `sync` with
  // the config this closure already captured — otherwise a changed `name`/`logo` never reaches
  // `entry.tsx`/`metro.config.js` until `dev` is restarted (controller end-to-end finding E1).
  let configDebounceTimer: NodeJS.Timeout | undefined;
  const onConfigChange = () => {
    if (watchersPaused) return;
    clearTimeout(configDebounceTimer);
    configDebounceTimer = setTimeout(() => {
      try {
        config = reloadWorkspace(config.projectRoot, updateEndpoint, config.workspaceDir);
        version.refreshAutoCheck();
      } catch (error) {
        console.warn(`Could not reload ds-viewer.config.ts after a change: ${(error as Error).message}`);
      }
    }, 200);
  };

  const watchers: FSWatcher[] = [
    ...watchTargetFolders(config).map((folder) => watch(folder, { recursive: true }, onSourceChange)),
    ...(existsSync(config.configPath) ? [watch(config.configPath, onConfigChange)] : []),
  ];
  for (const watcher of watchers) {
    watcher.on('error', (error) => console.warn(`File watcher error: ${(error as Error).message}`));
  }

  const spawnMetro = () =>
    spawn('npx', ['expo', 'start', '--web', '--host', 'localhost', '--port', String(port)], {
      cwd: workspace,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      detached: true,
    });

  // Set while this process is deliberately replacing Metro, so the exit handler below respawns it
  // instead of running the shutdown path. Restoring the files is not enough on its own: Metro has
  // already cached a module map that no longer matches the directory, and it answers every request
  // with `Unable to resolve "expo" from "entry.tsx"` until it is restarted. Observed four times —
  // the files came back and the catalog stayed blank.
  let restartingMetro = false;
  child = spawnMetro();

  // This process owns its workspace: nothing else should remove the files that define it. When
  // they vanish anyway, Metro reports it as `Cannot resolve entry file: the 'main' field defined
  // in your package.json points to an unresolvable or non-existent path` — which names the
  // *project's* package.json, a file that is fine and that the developer did not touch. The cause
  // is still unidentified (issue #41), so this does not pretend to prevent it; it notices, says
  // plainly what happened, and writes the files back, because `writeWorkspace` is idempotent and
  // already knows how.
  //
  // Capped rather than endless: if something is deleting continuously, rewriting forever would
  // hide it behind a repair loop. After the cap this stops repairing and keeps saying so, which
  // leaves the evidence visible.
  let repairs = 0;
  const workspaceWatch = setInterval(() => {
    if (watchersPaused) return; // an update is rewriting the workspace on purpose.
    if (repairs >= WORKSPACE_REPAIR_LIMIT) {
      const missing = missingWorkspaceFiles(config);
      if (missing.length > 0) {
        console.warn(
          `The catalog workspace is still losing files (missing ${missing.join(', ')}). Not rewriting them again — ` +
            'something outside this server is deleting them. Please report what else was running at https://github.com/krapwoo/design-system-viewer/issues/41',
        );
      }
      return;
    }
    // Counted as an attempt, not a success: a workspace that cannot be rewritten (a permission
    // error, a sync failure) would otherwise retry every four seconds forever.
    if (missingWorkspaceFiles(config).length > 0) repairs += 1;
    try {
      // `updateEndpoint` is passed through, never rebuilt: the endpoint listens on its own
      // ephemeral port, so deriving one from Metro's port here would repair the files and break
      // the update panel in the same breath.
      const { repaired } = repairWorkspaceIfMissing({
        config, updateEndpoint, versionStatus: version.getVersionStatus, sync,
        // Only if no one else took it meanwhile: between losing the lock and this tick, a second
        // `dev` can legitimately have started and be serving the directory. Overwriting its lock
        // would leave two servers each believing they own it.
        reclaimLock: () => {
          const other = liveDevLock(config);
          if (other && other.pid !== process.pid) {
            console.warn(`Not reclaiming ${config.workspaceDir ?? DEFAULT_WORKSPACE_DIR}/: pid ${other.pid} owns it now.`);
            return;
          }
          writeDevLock(config, { pid: process.pid, port });
        },
      });
      // Rewritten files are not enough: Metro keeps serving the module map it cached before they
      // went missing. Restarting it is the only thing that gets the catalog back, and the repair
      // cap bounds how often this can happen.
      if (repaired && !restartingMetro) {
        console.warn('Restarting Metro so the catalog picks the files back up — the page reloads itself in a few seconds.');
        restartingMetro = true;
        killGroup(child, 'SIGTERM');
      }
    } catch (error) {
      console.warn(`Could not rewrite the workspace: ${(error as Error).message}`);
    }
  }, WORKSPACE_WATCH_INTERVAL_MS);
  workspaceWatch.unref?.();

  const bindChild = () => {
    child.on('error', (error) => console.warn(`Could not start Expo: ${error.message}`));
    child.on('exit', (code) => {
      // A Metro we killed on purpose: respawn it on the same port rather than tearing the server
      // down, once the port it held is actually free again.
      if (restartingMetro) {
        // The flag stays set for the whole restart, not just until this handler returns. Clearing
        // it before the wait left a window where the repair timer could ask for another restart,
        // find no live child to kill, and leave the flag set with nothing pending — after which
        // the next genuine Metro crash would be mistaken for a deliberate restart and silently
        // respawn, skipping the shutdown path that releases the watchers and the dev lock.
        // `repairWorkspaceIfMissing`'s caller already checks this flag, so holding it also stops a
        // second repair stacking a restart on top of this one.
        //
        // The port is not free the instant this child exits: `performRestart` waits for the same
        // reason, and Errata 7c records that Metro listens on `[::1]`, so a naive probe reports
        // free while it is still bound. Respawning early lets Expo find its own port taken and
        // either prompt — giving up with "Skipping dev server" in a non-interactive shell — or move
        // to another port, leaving the catalog where the dev lock does not name.
        void waitForPortFree(port, defaultProbePortFree)
          .catch(() => {
            // Still spawn: a catalog that tried and failed to come back is recoverable, one that
            // silently never tries is not. Expo reports the port conflict itself if there is one.
            console.warn(`Port ${port} was still held after the wait; starting Metro anyway.`);
          })
          .then(() => {
            child = spawnMetro();
            bindChild();
            restartingMetro = false;
          });
        return;
      }
      clearInterval(workspaceWatch);
      for (const watcher of watchers) watcher.close();
      endpointServer?.close();
      // Released so the next `dev` is not refused by a lock naming a process that has gone.
      // `liveDevLock` already ignores a dead pid, so this is tidiness, not correctness — it keeps a
      // stale file out of a directory a developer may well read.
      clearDevLock(config);
      process.exitCode = code ?? 0;
    });
  };
  bindChild();
  // Node's default SIGTERM/SIGINT/SIGHUP behavior exits this process without touching its
  // children — left alone, a signal sent only to `dev`'s own pid (not its process group) would
  // leave the spawned `expo start` running, still bound to its port (Important finding, Fable
  // correction pass: this is exactly what would hang `check:catalog`'s driving script, Task 11, if
  // `dev` didn't clean up on its own). SIGHUP (Errata 7b) matters here too: detached Expo is in
  // its own session, so closing the terminal otherwise leaves Metro bound to the port.
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    process.on(signal, () => {
      for (const watcher of watchers) watcher.close();
      endpointServer?.close();
      clearDevLock(config);
      killGroup(child, signal);
      process.exit(0);
    });
  }

  // Minor finding, Fable correction pass: with Expo now spawned `detached: true`, any uncaught
  // throw or unhandled rejection in this process (outside the guarded steps above) would otherwise
  // crash `dev` with no terminal left to send Metro a signal, leaving it bound to the port.
  const killExpoAndExit = (error: unknown) => {
    console.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    for (const watcher of watchers) watcher.close();
    endpointServer?.close();
    killGroup(child, 'SIGTERM');
    process.exit(1);
  };
  process.on('uncaughtException', killExpoAndExit);
  process.on('unhandledRejection', killExpoAndExit);
}
