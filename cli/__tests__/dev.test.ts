import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertLocalInstall, isWatchedPath, LocalInstallMissingError, reloadWorkspace, refreshUpdateFile, watchTargetFolders } from '../dev.ts';
import type { ResolvedConfig } from '../types.ts';

test('isWatchedPath ignores .ds-viewer/, node_modules/, and .git/', () => {
  assert.equal(isWatchedPath(path.join('.ds-viewer', 'generated', 'components.json')), false);
  assert.equal(isWatchedPath(path.join('node_modules', 'react', 'index.js')), false);
  assert.equal(isWatchedPath(path.join('.git', 'HEAD')), false);
});

test('isWatchedPath allows a project source file', () => {
  assert.equal(isWatchedPath(path.join('src', 'components', 'Button', 'Button.tsx')), true);
});

test('watchTargetFolders returns only the glob base folders of components/tokens/pages that exist, deduplicated', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  mkdirSync(path.join(dir, 'src', 'components'), { recursive: true });
  mkdirSync(path.join(dir, 'src', 'tokens'), { recursive: true });
  const config: ResolvedConfig = {
    name: 'X',
    components: ['src/components/*/index.ts'],
    tokens: ['src/tokens/index.ts'],
    pages: ['src/components/*/*.catalog.tsx', 'src/missing-pages/*.catalog.tsx'],
    updateCheck: true,
    doctor: { strict: false },
    projectRoot: dir,
    configPath: path.join(dir, 'ds-viewer.config.ts'),
  };
  assert.deepEqual(
    watchTargetFolders(config).sort(),
    [path.join(dir, 'src', 'components'), path.join(dir, 'src', 'tokens')].sort(),
  );
  rmSync(dir, { recursive: true, force: true });
});

test('assertLocalInstall throws when there is no package.json', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  assert.throws(() => assertLocalInstall(dir), LocalInstallMissingError);
  rmSync(dir, { recursive: true, force: true });
});

test('assertLocalInstall throws when @krapwoo/ds-viewer is not a dependency', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }));
  assert.throws(() => assertLocalInstall(dir), /must be installed as a local devDependency/);
  rmSync(dir, { recursive: true, force: true });
});

test('assertLocalInstall throws when @krapwoo/ds-viewer is declared but not actually installed', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', devDependencies: { '@krapwoo/ds-viewer': '^0.1.0' } }));
  assert.throws(() => assertLocalInstall(dir), LocalInstallMissingError);
  rmSync(dir, { recursive: true, force: true });
});

test('assertLocalInstall passes when @krapwoo/ds-viewer is a devDependency and installed in node_modules', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', devDependencies: { '@krapwoo/ds-viewer': '^0.1.0' } }));
  mkdirSync(path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer'), { recursive: true });
  writeFileSync(path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'package.json'), JSON.stringify({ name: '@krapwoo/ds-viewer', version: '0.1.0' }));
  assert.doesNotThrow(() => assertLocalInstall(dir));
  rmSync(dir, { recursive: true, force: true });
});

test('reloadWorkspace re-resolves the config and rewrites entry.tsx from the new values', () => {
  // Controller end-to-end finding E1: `dev` watched `config.configPath` but only re-ran `sync`
  // with the *same*, already-captured `ResolvedConfig` object on a change — a changed `name` (or
  // `logo`) never reached the generated workspace (entry.tsx/metro.config.js) until `dev` was
  // restarted.
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-reload-'));
  const configPath = path.join(projectRoot, 'ds-viewer.config.ts');
  writeFileSync(
    configPath,
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'First', components: [], tokens: [] });\n",
  );

  const first = reloadWorkspace(projectRoot);
  assert.equal(first.name, 'First');
  const entryPath = path.join(projectRoot, '.ds-viewer', 'entry.tsx');
  assert.match(readFileSync(entryPath, 'utf8'), /appName=\{"First"\}/);

  writeFileSync(
    configPath,
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'Second', components: [], tokens: [] });\n",
  );
  const second = reloadWorkspace(projectRoot);
  assert.equal(second.name, 'Second');
  assert.match(readFileSync(entryPath, 'utf8'), /appName=\{"Second"\}/);

  rmSync(projectRoot, { recursive: true, force: true });
});

test('refreshUpdateFile writes null when updateCheck is disabled, without calling checkForUpdate', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  const config: ResolvedConfig = {
    name: 'X', components: [], tokens: [], updateCheck: false, doctor: { strict: false },
    projectRoot: dir, configPath: path.join(dir, 'ds-viewer.config.ts'),
  };
  const checkForUpdate = async () => { throw new Error('must not be called'); };
  await refreshUpdateFile(config, '0.4.0', { checkForUpdate });
  assert.equal(readFileSync(path.join(dir, '.ds-viewer', 'update.json'), 'utf8').trim(), 'null');
  rmSync(dir, { recursive: true, force: true });
});

test('refreshUpdateFile writes the real result when enabled', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  const config: ResolvedConfig = {
    name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false },
    projectRoot: dir, configPath: path.join(dir, 'ds-viewer.config.ts'),
  };
  const checkForUpdate = async () => ({ current: '0.4.0', latest: '0.5.0', breaking: false, summary: [], checkedAt: new Date().toISOString() });
  await refreshUpdateFile(config, '0.4.0', { checkForUpdate });
  assert.equal(JSON.parse(readFileSync(path.join(dir, '.ds-viewer', 'update.json'), 'utf8')).latest, '0.5.0');
  rmSync(dir, { recursive: true, force: true });
});
