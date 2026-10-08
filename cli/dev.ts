import { existsSync, readFileSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { sync } from './sync.ts';
import { writeWorkspace } from './workspace.ts';
import { findFreePort } from './port.ts';
import { globBaseFolder } from './glob.ts';
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

/** Design §2 "`dev`": checks the local install, runs `sync`, writes the workspace, starts Expo
 *  web on the first free port from 5181 bound to localhost only, and watches the project for
 *  component/token/page changes to re-run `sync`. Metro's own HMR updates the rendered component
 *  when its source changes, but not the generated props table or page list (Task 17 Step 4 relies
 *  on this: editing `Button.tsx` must update its props table, not just hot-reload the component). */
export async function dev(config: ResolvedConfig): Promise<void> {
  assertLocalInstall(config.projectRoot);
  sync(config);
  const workspace = writeWorkspace(config);
  const port = await findFreePort(5181, 5199);
  console.log(`Starting the catalog at http://localhost:${port}`);

  let debounceTimer: NodeJS.Timeout | undefined;
  const onChange = (_eventType: string, relativePath: string | null) => {
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

  const watchers: FSWatcher[] = [
    ...watchTargetFolders(config).map((folder) => watch(folder, { recursive: true }, onChange)),
    ...(existsSync(config.configPath) ? [watch(config.configPath, onChange)] : []),
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
