import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertLocalInstall, isWatchedPath, LocalInstallMissingError, watchTargetFolders } from '../dev.ts';
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
