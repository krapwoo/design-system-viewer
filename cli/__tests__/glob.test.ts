import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveGlob } from '../glob.ts';

function makeFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'ds-viewer-glob-'));
  mkdirSync(path.join(root, 'src/components/Button'), { recursive: true });
  mkdirSync(path.join(root, 'src/components/Badge'), { recursive: true });
  writeFileSync(path.join(root, 'src/components/Button/index.ts'), '');
  writeFileSync(path.join(root, 'src/components/Badge/index.ts'), '');
  writeFileSync(path.join(root, 'src/components/Button/Button.tsx'), '');
  mkdirSync(path.join(root, 'src/tokens'), { recursive: true });
  writeFileSync(path.join(root, 'src/tokens/index.ts'), '');
  return root;
}

test('resolveGlob matches a single "*" wildcard against one path segment', () => {
  const root = makeFixture();
  const matches = resolveGlob(root, 'src/components/*/index.ts').sort();
  assert.deepEqual(matches, [
    path.join(root, 'src/components/Badge/index.ts'),
    path.join(root, 'src/components/Button/index.ts'),
  ]);
  rmSync(root, { recursive: true, force: true });
});

test('resolveGlob matches "**" across zero or more directories', () => {
  const root = makeFixture();
  const matches = resolveGlob(root, 'src/**/index.ts').sort();
  assert.deepEqual(matches, [
    path.join(root, 'src/components/Badge/index.ts'),
    path.join(root, 'src/components/Button/index.ts'),
    path.join(root, 'src/tokens/index.ts'),
  ]);
  rmSync(root, { recursive: true, force: true });
});

test('resolveGlob with no wildcards returns the single file when it exists', () => {
  const root = makeFixture();
  assert.deepEqual(resolveGlob(root, 'src/tokens/index.ts'), [path.join(root, 'src/tokens/index.ts')]);
  assert.deepEqual(resolveGlob(root, 'src/tokens/missing.ts'), []);
  rmSync(root, { recursive: true, force: true });
});
