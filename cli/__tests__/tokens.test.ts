import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readTokenModules } from '../tokens.ts';

const TOKENS_FILE = path.resolve(import.meta.dirname, '../../fixtures/existing-project/src/tokens/index.ts');

test('readTokenModules resolves literal values and keeps nested objects as objects', () => {
  const [record] = readTokenModules([TOKENS_FILE]);
  assert.equal(record.file, path.relative(process.cwd(), TOKENS_FILE));
  assert.deepEqual(record.exports, {
    DS_COLOR: { text: '#181818', surface: '#ffffff' },
    DS_SHADOW: { low: { shadowColor: '#000000', shadowOpacity: 0.08 } },
  });
});

test('readTokenModules reports a non-literal export as computed', () => {
  // A temp dir, not the committed fixture folder — a failing assertion below must not leave a
  // stray file behind in a tracked directory.
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-tokens-'));
  const computedFile = path.join(dir, 'computed.ts');
  writeFileSync(computedFile, 'export const RUNTIME_VALUE = Date.now();\n');
  const [record] = readTokenModules([computedFile]);
  assert.deepEqual(record.exports, { RUNTIME_VALUE: 'computed — see source' });
  rmSync(dir, { recursive: true, force: true });
});

test('readTokenModules resolves a same-file reference to an object-literal token', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-tokens-'));
  const file = path.join(dir, 'tokens.ts');
  writeFileSync(
    file,
    [
      "const palette = { blue: '#1111ff', red: '#ff1111' };",
      'export const BRAND_COLOR = palette.blue;',
    ].join('\n'),
  );
  const [record] = readTokenModules([file]);
  assert.deepEqual(record.exports, { BRAND_COLOR: '#1111ff' });
  rmSync(dir, { recursive: true, force: true });
});

test('readTokenModules resolves negative numbers and satisfies expressions to their value', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-tokens-'));
  const file = path.join(dir, 'tokens.ts');
  writeFileSync(
    file,
    [
      'export const OFFSET = -4;',
      "export const SIZES = { sm: 4, md: 8 } satisfies Record<string, number>;",
    ].join('\n'),
  );
  const [record] = readTokenModules([file]);
  assert.deepEqual(record.exports, { OFFSET: -4, SIZES: { sm: 4, md: 8 } });
  rmSync(dir, { recursive: true, force: true });
});

test('readTokenModules still reports arithmetic as computed — see source', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-tokens-'));
  const file = path.join(dir, 'tokens.ts');
  writeFileSync(file, 'export const DOUBLE_SPACE = 4 + 4;\n');
  const [record] = readTokenModules([file]);
  assert.deepEqual(record.exports, { DOUBLE_SPACE: 'computed — see source' });
  rmSync(dir, { recursive: true, force: true });
});
