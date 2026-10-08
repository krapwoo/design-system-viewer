import { existsSync, readFileSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveConfig } from './config.ts';
import { sync } from './sync.ts';
import { writeWorkspace } from './workspace.ts';
import { findFreePort } from './port.ts';
import { globBaseFolder } from './glob.ts';
import { checkForUpdate, isUpdateCheckEnabled, writeUpdateFile, type UpdateCheckResult } from './updateCheck.ts';
import { readOwnVersion } from './packageVersion.ts';
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
export function reloadWorkspace(projectRoot: string): ResolvedConfig {
  const config = resolveConfig(projectRoot);
  sync(config);
  writeWorkspace(config);
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

/** Design §2 "`dev`": checks the local install, runs `sync`, writes the workspace, starts Expo
 *  web on the first free port from 5181 bound to localhost only, and watches the project for
 *  component/token/page changes to re-run `sync`. Metro's own HMR updates the rendered component
 *  when its source changes, but not the generated props table or page list (Task 17 Step 4 relies
 *  on this: editing `Button.tsx` must update its props table, not just hot-reload the component). */
export async function dev(initialConfig: ResolvedConfig): Promise<void> {
  assertLocalInstall(initialConfig.projectRoot);
  await refreshUpdateFile(initialConfig, readOwnVersion(import.meta.dirname));
  let config = initialConfig;
  sync(config);
  const workspace = writeWorkspace(config);
  const port = await findFreePort(5181, 5199);
  console.log(`Starting the catalog at http://localhost:${port}`);

  let debounceTimer: NodeJS.Timeout | undefined;
  const onSourceChange = (_eventType: string, relativePath: string | null) => {
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
    clearTimeout(configDebounceTimer);
    configDebounceTimer = setTimeout(() => {
      try {
        config = reloadWorkspace(config.projectRoot);
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

  const child = spawn('npx', ['expo', 'start', '--web', '--host', 'localhost', '--port', String(port)], {
    cwd: workspace,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('error', (error) => console.warn(`Could not start Expo: ${error.message}`));
  child.on('exit', (code) => {
    for (const watcher of watchers) watcher.close();
    process.exitCode = code ?? 0;
  });
  // Node's default SIGTERM/SIGINT behavior exits this process without touching its children —
  // left alone, a signal sent only to `dev`'s own pid (not its process group) would leave the
  // spawned `expo start` running, still bound to its port (Important finding, Fable correction
  // pass: this is exactly what would hang `check:catalog`'s driving script, Task 11, if `dev`
  // didn't clean up on its own).
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      for (const watcher of watchers) watcher.close();
      child.kill(signal);
      process.exit(0);
    });
  }
}
