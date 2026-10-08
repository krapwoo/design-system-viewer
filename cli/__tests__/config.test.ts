import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig, resolveConfig } from '../config.ts';

const FIXTURE_CONFIG = path.resolve(import.meta.dirname, '../../fixtures/existing-project/ds-viewer.config.ts');
const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../../fixtures/existing-project');

test('loadConfig loads the default export and fills in every optional field', () => {
  const { config, warnings } = loadConfig(FIXTURE_CONFIG);
  assert.equal(config.name, 'Fixture App');
  assert.deepEqual(config.components, ['src/components/*/index.ts']);
  assert.deepEqual(config.groupOrder, ['Components', 'Tokens']);
  assert.equal(config.updateCheck, true);
  assert.deepEqual(warnings, []);
});

test('loadConfig warns on unknown fields instead of failing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-config-'));
  const configPath = path.join(dir, 'ds-viewer.config.ts');
  writeFileSync(
    configPath,
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default { ...defineConfig({ name: 'X', components: [], tokens: [] }), madeUpField: true };\n",
  );
  const { warnings } = loadConfig(configPath);
  assert.deepEqual(warnings, ['Unknown config field "madeUpField" is ignored.']);
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig rejects an import other than @krapwoo/ds-viewer/config', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-config-'));
  const configPath = path.join(dir, 'ds-viewer.config.ts');
  writeFileSync(configPath, "import { readFileSync } from 'node:fs';\nexport default { name: readFileSync };\n");
  assert.throws(() => loadConfig(configPath), /may only import from '@krapwoo\/ds-viewer\/config'/);
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig reports a missing config file with a run-init hint instead of a raw ENOENT', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-config-'));
  const configPath = path.join(dir, 'ds-viewer.config.ts');
  assert.throws(() => loadConfig(configPath), /No ds-viewer\.config\.ts found — run npx @krapwoo\/ds-viewer init/);
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig wraps an error thrown while evaluating the config with the config\'s own path', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-config-'));
  const configPath = path.join(dir, 'ds-viewer.config.ts');
  writeFileSync(
    configPath,
    "export default { name: (() => { throw new Error('boom'); })(), components: [], tokens: [] };\n",
  );
  assert.throws(() => loadConfig(configPath), (error: Error) => error.message.includes(configPath) && error.message.includes('boom'));
  rmSync(dir, { recursive: true, force: true });
});

test('resolveConfig attaches the project root and config path', () => {
  const resolved = resolveConfig(FIXTURE_ROOT);
  assert.equal(resolved.projectRoot, FIXTURE_ROOT);
  assert.equal(resolved.configPath, FIXTURE_CONFIG);
  assert.equal(resolved.name, 'Fixture App');
});
