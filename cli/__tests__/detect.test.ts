import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { detectComponentFolders, detectTokenFiles } from '../detect.ts';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');

test('detectComponentFolders finds PascalCase folders with an index and a matching file', () => {
  const found = detectComponentFolders(FIXTURE_ROOT, FIXTURE_ROOT);
  assert.deepEqual(found, [
    { name: 'Badge', relativePath: path.join('src', 'components', 'Badge'), indexExt: 'ts' },
    { name: 'Button', relativePath: path.join('src', 'components', 'Button'), indexExt: 'ts' },
  ]);
});

test('detectTokenFiles finds files that export a color/spacing/typography-like constant', () => {
  const found = detectTokenFiles(FIXTURE_ROOT, FIXTURE_ROOT, (file) => readFileSync(file, 'utf8'));
  assert.deepEqual(found, [{ relativePath: path.join('src', 'tokens', 'index.ts') }]);
});

test('detectComponentFolders and detectTokenFiles skip ios/android/build/web-build directories', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-detect-'));
  for (const skipped of ['ios', 'android', 'build', 'web-build']) {
    mkdirSync(path.join(dir, skipped, 'Widget'), { recursive: true });
    writeFileSync(path.join(dir, skipped, 'Widget', 'Widget.tsx'), 'export function Widget() { return null; }\n');
    writeFileSync(path.join(dir, skipped, 'Widget', 'index.ts'), "export { Widget } from './Widget';\n");
    writeFileSync(path.join(dir, skipped, 'tokens.ts'), "export const DUMMY_TOKEN = 1;\n");
  }
  assert.deepEqual(detectComponentFolders(dir, dir), []);
  assert.deepEqual(detectTokenFiles(dir, dir, (file) => readFileSync(file, 'utf8')), []);
  rmSync(dir, { recursive: true, force: true });
});

test('detectComponentFolders tolerates a broken symlink instead of crashing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-detect-'));
  mkdirSync(path.join(dir, 'Badge'), { recursive: true });
  writeFileSync(path.join(dir, 'Badge', 'Badge.tsx'), 'export function Badge() { return null; }\n');
  writeFileSync(path.join(dir, 'Badge', 'index.ts'), "export { Badge } from './Badge';\n");
  symlinkSync(path.join(dir, 'does-not-exist'), path.join(dir, 'BrokenLink'));
  assert.doesNotThrow(() => detectComponentFolders(dir, dir));
  assert.deepEqual(detectComponentFolders(dir, dir), [{ name: 'Badge', relativePath: 'Badge', indexExt: 'ts' }]);
  rmSync(dir, { recursive: true, force: true });
});

test('detectTokenFiles requires a token-like export for a name-hinted file outside a "tokens" folder', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-detect-'));
  mkdirSync(path.join(dir, 'auth'), { recursive: true });
  writeFileSync(path.join(dir, 'auth', 'authToken.ts'), "export function getAuthToken() { return 'x'; }\n");
  mkdirSync(path.join(dir, 'tokens'), { recursive: true });
  writeFileSync(path.join(dir, 'tokens', 'legacyTokenFile.ts'), "export const UNRELATED = 1;\n");
  const found = detectTokenFiles(dir, dir, (file) => readFileSync(file, 'utf8'));
  assert.deepEqual(found, [{ relativePath: path.join('tokens', 'legacyTokenFile.ts') }]);
  rmSync(dir, { recursive: true, force: true });
});
