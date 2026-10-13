import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { globBaseFolder } from './glob.ts';
import { DEFAULT_WORKSPACE_DIR, type ResolvedConfig } from './types.ts';

function metroConfigJs(extraWatchFolders: string[]): string {
  return `const path = require('path');
const fs = require('fs');
const workspace = __dirname;
const projectRoot = path.resolve(workspace, '..');
const projectMetro = path.join(projectRoot, 'metro.config.js');
const { getDefaultConfig } = require('expo/metro-config');
// Start from the project's Metro config when it exists, otherwise Expo's default for the project root.
const config = fs.existsSync(projectMetro) ? require(projectMetro) : getDefaultConfig(projectRoot);
// Metro also accepts a function or a Promise from metro.config.js; mutating either here as if it
// were the config object would fail obscurely further down, so stop with a clear reason instead.
if (typeof config !== 'object') {
  throw new Error(projectMetro + ' must export a config object (a function or Promise is not supported here).');
}
config.projectRoot = workspace;
// Expo sets the server root to the folder the config was built for; bundle URLs must resolve from the workspace.
config.server = { ...(config.server || {}), unstable_serverRoot: workspace };
// Every configured components/tokens/pages glob's base folder — not just projectRoot itself — so a
// host whose kit lives in a sibling folder (e.g. kit-host/ds-viewer.config.ts reaching
// ../starter-kit/components) still gets its files watched and bundled. Resolved from projectRoot at
// runtime, not baked in as an absolute path, so the generated file stays portable across machines.
const EXTRA_WATCH_FOLDERS = ${JSON.stringify(extraWatchFolders)};
const extraWatchFolders = EXTRA_WATCH_FOLDERS;
// A configured components/tokens/pages glob can point at a folder that doesn't exist yet (e.g. a
// standalone-pages folder before its first file is added) — Metro refuses to watch a nonexistent
// folder, which otherwise makes every single bundle request fail with HTTP 500. Filtered here, at
// workspace-generation time, not above at config-resolution time, because a folder created after
// \`dev\` starts should start being watched on its own next run, same as every other glob folder.
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), projectRoot, ...extraWatchFolders.map((f) => path.resolve(projectRoot, f)).filter((f) => fs.existsSync(f))]));
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];
// A standalone page can read generated data with \`import { components, tokens } from '@krapwoo/ds-viewer/generated'\`
// (design §3) — redirect that one specifier to this workspace's own generated/index.ts.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@krapwoo/ds-viewer/generated') {
    return { type: 'sourceFile', filePath: path.join(workspace, 'generated', 'index.ts') };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
`;
}

/** Decided here, not inside the viewer: Metro resolves `react-native-safe-area-context` statically
 *  at bundle time, so a runtime try/catch `require` cannot skip it when the optional peer is
 *  missing. Importing and wrapping must instead be baked into the generated entry (design §1
 *  "Three parts", Viewer row). */
function entryTsx(
  name: string,
  hasSafeArea: boolean,
  groupOrder: string[],
  logoRequirePath: string | undefined,
  updateEndpoint: { baseUrl: string; secret: string } | undefined,
): string {
  const safeAreaImport = hasSafeArea ? "import { SafeAreaProvider } from 'react-native-safe-area-context';\n" : '';
  // A literal `require(...)` with a path computed at generation time: Metro resolves every import
  // statically, so the logo's actual (arbitrary, user-configured) location must already be baked
  // into this generated file, the same reasoning `hasSafeArea` above already follows for the
  // optional SafeAreaProvider import.
  // `JSON.stringify`, not a plain single-quoted template literal: `logoRequirePath` carries the
  // user's own logo file name, which may contain a `'` (e.g. `assets/it's.png`) — a bare
  // `'${logoRequirePath}'` breaks the generated file's syntax the moment it does (Minor finding,
  // Fable's implementation review, cli/workspace.ts:65).
  const logoImport = logoRequirePath ? `const logoSource = require(${JSON.stringify(logoRequirePath)});\n` : '';
  const logoProp = logoRequirePath ? ' logoImageSource={logoSource}' : '';
  // `JSON.stringify` of a plain `{ baseUrl, secret }` object is valid JS object-literal syntax too
  // (no reserved words in either key) — the same reasoning the existing `logoRequirePath` baking
  // already relies on, extended to a whole object instead of one string.
  const endpointConst = `const updateEndpoint = ${updateEndpoint ? JSON.stringify(updateEndpoint) : 'undefined'};\n`;
  const viewer = `<CatalogShell appName={${JSON.stringify(name)}} title="Component Catalog" groups={groups} sections={sections}${logoProp} update={updateNotice} versionStatus={versionStatus} updateEndpoint={updateEndpoint} />`;
  const root = hasSafeArea ? `<SafeAreaProvider>${viewer}</SafeAreaProvider>` : viewer;
  return `import { registerRootComponent } from 'expo';
import { CatalogShell, buildCatalogSections } from '@krapwoo/ds-viewer';
${safeAreaImport}${logoImport}import pages from './generated/pages';
import components from './generated/components.json';
import updateNotice from './update.json';
import versionStatus from './version.json';
${endpointConst}
function App() {
  const { sections, groups } = buildCatalogSections(pages, components, ${JSON.stringify(groupOrder)});
  return ${root};
}

registerRootComponent(App);
`;
}

/** Every configured components/tokens/pages glob's base folder, deduplicated and sorted — shared by
 *  `projectIncludeGlobs` (tsconfig `include`, below) and `metroConfigJs`'s extra watch folders
 *  (above). Kept as the raw relative folder (e.g. `"../starter-kit/components"`), not yet turned
 *  into either a tsconfig glob or an absolute path — each caller does that its own way. */
function configGlobFolders(config: ResolvedConfig): string[] {
  const folders = new Set<string>();
  for (const pattern of [...config.components, ...(config.tokens ?? []), ...(config.pages ?? [])]) {
    folders.add(globBaseFolder(pattern));
  }
  return [...folders].sort();
}

/** Folders the workspace's own `tsconfig.json` needs to type-check — derived from the config's own
 *  globs (the spike used `../src/**\/*`), instead of `../**\/*`, which would pull in the whole
 *  project, including `node_modules`. */
function projectIncludeGlobs(config: ResolvedConfig): string[] {
  return configGlobFolders(config).map((folder) => `../${folder}/**/*`);
}

/** This run's generated workspace directory. Every writer goes through here, so a run that owns a
 *  different directory (a render check's throwaway server) cannot touch another server's files. */
export function workspacePath(config: Pick<ResolvedConfig, 'projectRoot' | 'workspaceDir'>, ...segments: string[]): string {
  return path.join(config.projectRoot, config.workspaceDir ?? DEFAULT_WORKSPACE_DIR, ...segments);
}

/** Names the `dev` process that owns this workspace right now. */
export interface DevLock {
  pid: number;
  port: number;
}

const LOCK_FILE = 'dev-lock.json';

/** Records which `dev` owns this workspace, so a second one can refuse instead of writing over it.
 *  Two servers sharing one directory both rewrite `entry.tsx`, `package.json`, `app.json`,
 *  `metro.config.js` and `tsconfig.json`, and the loser is left serving a workspace that no longer
 *  describes it — reported by Expo as an unresolvable `main` field, which names neither cause. */
export function writeDevLock(config: Pick<ResolvedConfig, 'projectRoot' | 'workspaceDir'>, lock: DevLock): void {
  mkdirSync(workspacePath(config), { recursive: true });
  writeFileSync(workspacePath(config, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`);
}

export function clearDevLock(config: Pick<ResolvedConfig, 'projectRoot' | 'workspaceDir'>): void {
  rmSync(workspacePath(config, LOCK_FILE), { force: true });
}

/** True when `pid` is a process this user can signal. Signal 0 performs the permission and
 *  existence checks without delivering anything. EPERM means it exists but belongs to someone
 *  else, which still counts as alive. */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** The live `dev` already serving this workspace, or undefined when there isn't one.
 *
 *  A lock left behind by a crashed process is not live, so it never blocks a restart: the pid is
 *  gone and the file is ignored. `ownPid` is excluded so a process cannot find itself — `dev`'s own
 *  restart path re-enters this with the lock it just wrote. */
export function liveDevLock(
  config: Pick<ResolvedConfig, 'projectRoot' | 'workspaceDir'>,
  ownPid: number = process.pid,
): DevLock | undefined {
  const lockPath = workspacePath(config, LOCK_FILE);
  if (!existsSync(lockPath)) return undefined;
  let lock: DevLock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as DevLock;
  } catch {
    return undefined; // A partial write from a process that died mid-write owns nothing.
  }
  if (typeof lock.pid !== 'number' || typeof lock.port !== 'number') return undefined;
  if (lock.pid === ownPid || !processAlive(lock.pid)) return undefined;
  return lock;
}

/** The files `writeWorkspace` always writes: the ones that define the workspace to Expo and Metro.
 *  `babel.config.js` is conditional and the update files are written separately, so neither counts
 *  as missing here. */
export const WORKSPACE_DEFINING_FILES = ['package.json', 'app.json', 'tsconfig.json', 'metro.config.js', 'entry.tsx'] as const;

/** Which of those a workspace has lost. A running `dev` owns these files and nothing else should
 *  remove them, so a non-empty answer means something outside this process deleted them — see
 *  issue #41, where the cause is still unidentified. Reported rather than diagnosed: the point is
 *  that the server can say what happened instead of leaving Expo to blame the project's own
 *  `package.json` with `Cannot resolve entry file`. */
export function missingWorkspaceFiles(config: Pick<ResolvedConfig, 'projectRoot' | 'workspaceDir'>): string[] {
  return WORKSPACE_DEFINING_FILES.filter((name) => !existsSync(workspacePath(config, name)));
}

/** Writes the self-contained Expo web workspace at `.ds-viewer/` (design §2 "The preview
 *  workspace and `npx ds-viewer dev`"). Rewritten freely on every `dev` run — nothing here is
 *  user-owned.
 *
 *  `updateEndpoint` is the caller's own, inlined into `entry.tsx`. Without one (a render check's
 *  throwaway server, `--no-update-endpoint`) the catalog is served with no endpoint at all, so it
 *  makes no calls: the shell polls `/version` from every page, so inlining a *different* server's
 *  endpoint here would have every page call it from the wrong origin. Each `dev` owns its own
 *  workspace directory (`dev-lock.json`), so a render check beside an open catalog writes to
 *  `.ds-viewer-render/` rather than this one — see the README. */
export function writeWorkspace(config: ResolvedConfig, updateEndpoint?: { baseUrl: string; secret: string }): string {
  const workspace = workspacePath(config);
  mkdirSync(workspace, { recursive: true });

  writeFileSync(path.join(workspace, 'package.json'), `${JSON.stringify({ name: 'ds-viewer-workspace', private: true, main: 'entry.tsx' }, null, 2)}\n`);
  writeFileSync(
    path.join(workspace, 'app.json'),
    `${JSON.stringify({ expo: { name: config.name, slug: 'ds-viewer-workspace', platforms: ['web'] } }, null, 2)}\n`,
  );
  // TypeScript is only a recommended peer (design §1 "Host requirements") — a project with no
  // tsconfig.json of its own gets no `extends` here, and `include` is scoped to the config's own
  // globs rather than `../**/*`, which would also walk `node_modules`.
  const projectTsconfig = path.join(config.projectRoot, 'tsconfig.json');
  const workspaceTsconfig: { extends?: string; include: string[] } = { include: projectIncludeGlobs(config) };
  if (existsSync(projectTsconfig)) workspaceTsconfig.extends = '../tsconfig.json';
  writeFileSync(path.join(workspace, 'tsconfig.json'), `${JSON.stringify(workspaceTsconfig, null, 2)}\n`);
  writeFileSync(path.join(workspace, 'metro.config.js'), metroConfigJs(configGlobFolders(config)));

  const projectBabelConfig = path.join(config.projectRoot, 'babel.config.js');
  if (existsSync(projectBabelConfig)) {
    writeFileSync(path.join(workspace, 'babel.config.js'), "module.exports = require('../babel.config.js');\n");
  }

  const hasSafeArea = existsSync(path.join(config.projectRoot, 'node_modules', 'react-native-safe-area-context', 'package.json'));
  // `config.logo` is already validated by `cli/config.ts`'s `resolveConfig` (Step 3 above) — by the
  // time `writeWorkspace` sees it, it's either a real, existing file or undefined. Computed relative
  // to `workspace` (one level deeper than `projectRoot`), with forward slashes so the generated
  // `require()` string is portable across machines.
  const logoRequirePath = config.logo
    ? path.relative(workspace, path.resolve(config.projectRoot, config.logo)).split(path.sep).join('/')
    : undefined;
  writeFileSync(path.join(workspace, 'entry.tsx'), entryTsx(config.name, hasSafeArea, config.groupOrder ?? [], logoRequirePath, updateEndpoint));
  return workspace;
}
