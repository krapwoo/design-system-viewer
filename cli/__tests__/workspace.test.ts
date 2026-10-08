import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeWorkspace } from '../workspace.ts';
import type { ResolvedConfig } from '../types.ts';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');

function copyFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-workspace-'));
  cpSync(FIXTURE_ROOT, dir, { recursive: true });
  return dir;
}

function baseConfig(projectRoot: string): ResolvedConfig {
  return {
    name: 'Fixture App',
    components: ['src/components/*/index.ts'],
    tokens: ['src/tokens/index.ts'],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot,
    configPath: path.join(projectRoot, 'ds-viewer.config.ts'),
  };
}

test('writeWorkspace writes package.json, app.json, tsconfig.json, metro.config.js, and entry.tsx', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot));
  assert.equal(workspace, path.join(projectRoot, '.ds-viewer'));

  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8')), {
    name: 'ds-viewer-workspace',
    private: true,
    main: 'entry.tsx',
  });
  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'app.json'), 'utf8')), {
    expo: { name: 'Fixture App', slug: 'ds-viewer-workspace', platforms: ['web'] },
  });

  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'tsconfig.json'), 'utf8')), {
    include: ['../src/components/**/*', '../src/tokens/**/*'],
  });

  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /config\.projectRoot = workspace;/);
  assert.match(metroConfig, /unstable_serverRoot: workspace/);
  assert.match(metroConfig, /@krapwoo\/ds-viewer\/generated/);
  // Minor: a project's metro.config.js exporting a function or Promise (both valid for Metro)
  // would otherwise make `config.projectRoot = workspace;` above mutate a non-object obscurely.
  assert.match(metroConfig, /typeof config !== 'object'/);

  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /appName=\{"Fixture App"\}/);
  assert.match(entry, /buildCatalogSections\(pages, components, \[\]\)/);
  assert.match(entry, /registerRootComponent\(App\)/);
  assert.doesNotMatch(entry, /SafeAreaProvider/, 'react-native-safe-area-context is not installed in the fixture — no import or wrapping');

  assert.ok(!existsSync(path.join(workspace, 'babel.config.js')), 'no project babel.config.js — none should be written');
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace extends the project\'s own tsconfig.json when one exists', () => {
  const projectRoot = copyFixture();
  writeFileSync(path.join(projectRoot, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
  const workspace = writeWorkspace(baseConfig(projectRoot));
  assert.deepEqual(JSON.parse(readFileSync(path.join(workspace, 'tsconfig.json'), 'utf8')), {
    extends: '../tsconfig.json',
    include: ['../src/components/**/*', '../src/tokens/**/*'],
  });
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace imports and wraps the viewer in SafeAreaProvider when react-native-safe-area-context is installed', () => {
  const projectRoot = copyFixture();
  const safeAreaDir = path.join(projectRoot, 'node_modules', 'react-native-safe-area-context');
  mkdirSync(safeAreaDir, { recursive: true });
  writeFileSync(path.join(safeAreaDir, 'package.json'), '{"name":"react-native-safe-area-context"}\n');

  const workspace = writeWorkspace(baseConfig(projectRoot));
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /import \{ SafeAreaProvider \} from 'react-native-safe-area-context';/);
  assert.match(entry, /<SafeAreaProvider><CatalogShell/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace re-exports the project\'s own babel.config.js when one exists', () => {
  const projectRoot = copyFixture();
  writeFileSync(path.join(projectRoot, 'babel.config.js'), "module.exports = { presets: ['babel-preset-expo'] };\n");
  const workspace = writeWorkspace(baseConfig(projectRoot));
  const babelConfig = readFileSync(path.join(workspace, 'babel.config.js'), 'utf8');
  assert.equal(babelConfig, "module.exports = require('../babel.config.js');\n");
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace watches every configured glob\'s base folder, including ones outside projectRoot', () => {
  const projectRoot = copyFixture();
  const config = {
    ...baseConfig(projectRoot),
    components: ['../starter-kit/components/*/index.ts'],
    tokens: ['../starter-kit/tokens/index.ts'],
    pages: ['viewer-pages/*.catalog.tsx'],
  };
  const workspace = writeWorkspace(config);
  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /EXTRA_WATCH_FOLDERS = \["\.\.\/starter-kit\/components","\.\.\/starter-kit\/tokens","viewer-pages"\]/);
  assert.match(metroConfig, /extraWatchFolders\.map/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace still watches a same-root project\'s own folders (0.1 behavior unchanged)', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot));
  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /EXTRA_WATCH_FOLDERS = \["src\/components","src\/tokens"\]/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace makes a validated logo available to the generated entry', () => {
  const projectRoot = copyFixture();
  mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  writeFileSync(path.join(projectRoot, 'assets', 'logo.png'), '');
  const workspace = writeWorkspace({ ...baseConfig(projectRoot), logo: './assets/logo.png' });
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.match(entry, /require\('\.\.\/assets\/logo\.png'\)/);
  assert.match(entry, /logoImageSource=\{logoSource\}/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace omits logoImageSource entirely when no logo is configured', () => {
  const projectRoot = copyFixture();
  const workspace = writeWorkspace(baseConfig(projectRoot));
  const entry = readFileSync(path.join(workspace, 'entry.tsx'), 'utf8');
  assert.doesNotMatch(entry, /logoImageSource/);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('writeWorkspace\'s generated metro config only watches extra folders that exist on disk, so a missing pages folder does not break every bundle', () => {
  const projectRoot = copyFixture();
  // `viewer-pages` is configured but never created — the real bug (a config's `pages`/`components`/
  // `tokens` glob pointing at a folder that doesn't exist yet) that made every Metro bundle request
  // return HTTP 500, because Metro refuses to watch a nonexistent folder.
  const config = { ...baseConfig(projectRoot), pages: ['viewer-pages/*.catalog.tsx'] };
  const workspace = writeWorkspace(config);
  const metroConfig = readFileSync(path.join(workspace, 'metro.config.js'), 'utf8');
  assert.match(metroConfig, /extraWatchFolders\.map\(\(f\) => path\.resolve\(projectRoot, f\)\)\.filter\(\(f\) => fs\.existsSync\(f\)\)/);
  rmSync(projectRoot, { recursive: true, force: true });
});
