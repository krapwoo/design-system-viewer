import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ResolvedConfig } from './types.ts';

const METRO_CONFIG = `const path = require('path');
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
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), projectRoot]));
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

/** Decided here, not inside the viewer: Metro resolves `react-native-safe-area-context` statically
 *  at bundle time, so a runtime try/catch `require` cannot skip it when the optional peer is
 *  missing. Importing and wrapping must instead be baked into the generated entry (design §1
 *  "Three parts", Viewer row). */
function entryTsx(name: string, hasSafeArea: boolean, groupOrder: string[]): string {
  const safeAreaImport = hasSafeArea ? "import { SafeAreaProvider } from 'react-native-safe-area-context';\n" : '';
  const viewer = `<CatalogShell appName={${JSON.stringify(name)}} title="Component Catalog" groups={groups} sections={sections} />`;
  const root = hasSafeArea ? `<SafeAreaProvider>${viewer}</SafeAreaProvider>` : viewer;
  return `import { registerRootComponent } from 'expo';
import { CatalogShell, buildCatalogSections } from '@krapwoo/ds-viewer';
${safeAreaImport}import pages from './generated/pages';
import components from './generated/components.json';

function App() {
  const { sections, groups } = buildCatalogSections(pages, components, ${JSON.stringify(groupOrder)});
  return ${root};
}

registerRootComponent(App);
`;
}

/** The folder a glob pattern varies under — the part of the pattern before its first wildcard
 *  segment (or, for a pattern with no wildcard, its own containing folder). Same logic as
 *  `cli/sync.ts`'s `globBaseFolder` (Task 10), kept local here since it's one line and this module
 *  has no other reason to depend on `sync.ts`. */
function globBaseFolder(pattern: string): string {
  const segments = pattern.split('/');
  const wildcardIndex = segments.findIndex((segment) => segment.includes('*'));
  const baseSegments = wildcardIndex === -1 ? segments.slice(0, -1) : segments.slice(0, wildcardIndex);
  return baseSegments.join('/') || '.';
}

/** Folders the workspace's own `tsconfig.json` needs to type-check — derived from the config's own
 *  globs (the spike used `../src/**\/*`), instead of `../**\/*`, which would pull in the whole
 *  project, including `node_modules`. */
function projectIncludeGlobs(config: ResolvedConfig): string[] {
  const folders = new Set<string>();
  for (const pattern of [...config.components, ...(config.tokens ?? []), ...(config.pages ?? [])]) {
    folders.add(globBaseFolder(pattern));
  }
  return [...folders].sort().map((folder) => `../${folder}/**/*`);
}

/** Writes the self-contained Expo web workspace at `.ds-viewer/` (design §2 "The preview
 *  workspace and `npx ds-viewer dev`"). Rewritten freely on every `dev` run — nothing here is
 *  user-owned. */
export function writeWorkspace(config: ResolvedConfig): string {
  const workspace = path.join(config.projectRoot, '.ds-viewer');
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
  writeFileSync(path.join(workspace, 'metro.config.js'), METRO_CONFIG);

  const projectBabelConfig = path.join(config.projectRoot, 'babel.config.js');
  if (existsSync(projectBabelConfig)) {
    writeFileSync(path.join(workspace, 'babel.config.js'), "module.exports = require('../babel.config.js');\n");
  }

  const hasSafeArea = existsSync(path.join(config.projectRoot, 'node_modules', 'react-native-safe-area-context', 'package.json'));
  writeFileSync(path.join(workspace, 'entry.tsx'), entryTsx(config.name, hasSafeArea, config.groupOrder ?? []));
  return workspace;
}
