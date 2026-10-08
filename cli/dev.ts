import { existsSync, readFileSync, rmSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AddressInfo } from 'node:net';
import { resolveConfig } from './config.ts';
import { sync } from './sync.ts';
import { writeWorkspace } from './workspace.ts';
import { findFreePort } from './port.ts';
import { globBaseFolder } from './glob.ts';
import { checkForUpdate, isUpdateCheckEnabled, writeUpdateFile, type UpdateCheckResult } from './updateCheck.ts';
import { readOwnVersion } from './packageVersion.ts';
import { createUpdateEndpoint, type EndpointDeps, type UpdateStatus } from './endpoint.ts';
import { buildUpdatePlan, type UpdatePlan } from './updatePlan.ts';
import { lastSummaryLine } from './doctor.ts';
import { detectPackageManager, installUpgradeCommand, type PackageManager } from './packageManager.ts';
import type { ResolvedConfig } from './types.ts';

export class LocalInstallMissingError extends Error {}

const IGNORED_WATCH_SEGMENTS = new Set(['.ds-viewer', 'node_modules', '.git']);

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
export function reloadWorkspace(projectRoot: string, updateEndpoint?: { baseUrl: string; secret: string }): ResolvedConfig {
  const config = resolveConfig(projectRoot);
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
  options: { checkForUpdate?: typeof checkForUpdate } = {},
): Promise<void> {
  const result: UpdateCheckResult | undefined = isUpdateCheckEnabled(config, process.env)
    ? await (options.checkForUpdate ?? checkForUpdate)(ownVersion)
    : undefined;
  writeUpdateFile(config.projectRoot, result);
}

// Promisified, not `execFileSync` — install/migrate/doctor each take real seconds, and this now
// runs from inside the endpoint's own request-handling process, which must keep answering
// `/update/status` polls throughout (Critical finding, Fable correction pass: the synchronous
// version blocked the entire event loop until the whole update finished).
const execFileAsync = promisify(execFile);
type ExecImpl = (command: string, args: string[], options: { cwd: string; encoding: 'utf8' }) => Promise<string>;
const defaultExecImpl: ExecImpl = async (command, args, options) => (await execFileAsync(command, args, options)).stdout;

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
  },
): Promise<void> {
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
  report(1);

  const { command, args } = installUpgradeCommand(pm, '@krapwoo/ds-viewer', plan.latest);
  try {
    await deps.execImpl(command, args, { cwd: config.projectRoot, encoding: 'utf8' });
  } catch (error) {
    deps.onStatus({ phase: 'failure', log: (error as Error).message, failedStep: stepDefs[1].failLabel ?? stepDefs[1].label });
    return;
  }
  report(2);

  try {
    await deps.execImpl('node', [installedMainJs(config.projectRoot), 'migrate', '--from', currentVersion], { cwd: config.projectRoot, encoding: 'utf8' });
  } catch (error) {
    deps.onStatus({ phase: 'failure', log: (error as Error).message, failedStep: stepDefs[2].label });
    return;
  }
  report(3);

  let doctorOutput: string;
  try {
    doctorOutput = await deps.execImpl('node', [installedMainJs(config.projectRoot), 'doctor'], { cwd: config.projectRoot, encoding: 'utf8' });
  } catch (error) {
    deps.onStatus({ phase: 'failure', log: (error as Error).message, failedStep: stepDefs[3].label });
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
  port: number;
  child: ReturnType<typeof spawn>;
  watchers: FSWatcher[];
  endpointServer: import('node:http').Server;
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
    handoff.endpointServer.close();
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
export async function dev(initialConfig: ResolvedConfig, devOptions: { pinnedPort?: number } = {}): Promise<void> {
  assertLocalInstall(initialConfig.projectRoot);
  const ownVersion = readOwnVersion(import.meta.dirname);
  await refreshUpdateFile(initialConfig, ownVersion);
  let config = initialConfig;
  sync(config);

  // Restart handoff step 2/4: a status file left by the *previous* `dev` process (right before it
  // exited to restart) is read once, then deleted — a plain refresh afterward shows "idle"/"no
  // update known" instead of replaying a stale success/failure forever.
  const statusFile = path.join(config.projectRoot, '.ds-viewer', 'update-status.json');
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
  console.log(`Starting the catalog at http://localhost:${port}`);

  let watchersPaused = false;
  // Metro's own child process doesn't exist yet — assigned below, well before this is ever read
  // (performUpdate's `restart` callback, which is the only reader, can only run after a real
  // browser has already loaded the page and clicked "Update now").
  let child!: ReturnType<typeof spawn>;
  const secret = randomBytes(24).toString('hex');
  const allowedOrigin = `http://localhost:${port}`;
  const endpointDeps: EndpointDeps = {
    secret,
    allowedOrigin,
    buildPlan: () => buildUpdatePlan(config, ownVersion),
    startUpdate: (plan) => {
      watchersPaused = true;
      void performUpdate(config, ownVersion, plan, {
        execImpl: defaultExecImpl,
        onStatus: (status) => {
          updateStatus = status;
          if (status.phase === 'failure') watchersPaused = false; // the update stopped — keep developing on the old version.
        },
        restart: async (result) => {
          writeFileSync(statusFile, JSON.stringify({ phase: 'success', ...result }));
          await performRestart({ projectRoot: config.projectRoot, port, child, watchers, endpointServer, doctorSummary: result.doctorSummary, files: result.files });
        },
      }).catch((error) => {
        // Minor finding, Fable correction pass: `performUpdate` only ever reports `'failure'` from
        // its own guarded steps — a throw outside them (e.g. `writeFileSync(statusFile)` itself
        // failing) previously became an unhandled rejection with nothing watching for it.
        updateStatus = { phase: 'failure', log: (error as Error).message, failedStep: 'Updating' };
        watchersPaused = false;
      });
    },
    getStatus: () => updateStatus,
  };
  const endpointServer = createUpdateEndpoint(endpointDeps);
  await new Promise<void>((resolve) => endpointServer.listen(0, '127.0.0.1', resolve));
  const endpointPort = (endpointServer.address() as AddressInfo).port;
  // Printed for the same reason the Metro port above is printed: a developer (or Task 20's own
  // verification) checking the endpoint directly (e.g. with curl) needs its port — the secret
  // itself is never printed; the endpoint rejects anything that doesn't already have it.
  console.log(`Update endpoint listening on 127.0.0.1:${endpointPort}`);
  const updateEndpoint = { baseUrl: `http://127.0.0.1:${endpointPort}`, secret };

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
        config = reloadWorkspace(config.projectRoot, updateEndpoint);
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

  child = spawn('npx', ['expo', 'start', '--web', '--host', 'localhost', '--port', String(port)], {
    cwd: workspace,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    detached: true,
  });
  child.on('error', (error) => console.warn(`Could not start Expo: ${error.message}`));
  child.on('exit', (code) => {
    for (const watcher of watchers) watcher.close();
    endpointServer.close();
    process.exitCode = code ?? 0;
  });
  // Node's default SIGTERM/SIGINT/SIGHUP behavior exits this process without touching its
  // children — left alone, a signal sent only to `dev`'s own pid (not its process group) would
  // leave the spawned `expo start` running, still bound to its port (Important finding, Fable
  // correction pass: this is exactly what would hang `check:catalog`'s driving script, Task 11, if
  // `dev` didn't clean up on its own). SIGHUP (Errata 7b) matters here too: detached Expo is in
  // its own session, so closing the terminal otherwise leaves Metro bound to the port.
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    process.on(signal, () => {
      for (const watcher of watchers) watcher.close();
      endpointServer.close();
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
    endpointServer.close();
    killGroup(child, 'SIGTERM');
    process.exit(1);
  };
  process.on('uncaughtException', killExpoAndExit);
  process.on('unhandledRejection', killExpoAndExit);
}
