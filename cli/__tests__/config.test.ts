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

test('resolveConfig warns and drops a logo path that does not exist, falling back to no logo', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-logo-'));
  writeFileSync(
    path.join(dir, 'ds-viewer.config.ts'),
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'X', logo: './missing.png', components: [], tokens: [] });\n",
  );
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const resolved = resolveConfig(dir);
    assert.equal(resolved.logo, undefined);
    // Exact wording from the controller's binding visual spec below, not an ad-hoc message —
    // `cli/init.ts`'s existing warnings follow the same "quote the controller's exact text" rule.
    assert.ok(warnings.some((w) => w === 'Logo not found: ./missing.png — showing the name instead.'));
  } finally {
    console.warn = originalWarn;
  }
  rmSync(dir, { recursive: true, force: true });
});

test('resolveConfig keeps a logo path that does exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-logo-'));
  writeFileSync(path.join(dir, 'logo.png'), '');
  writeFileSync(
    path.join(dir, 'ds-viewer.config.ts'),
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'X', logo: './logo.png', components: [], tokens: [] });\n",
  );
  const resolved = resolveConfig(dir);
  assert.equal(resolved.logo, './logo.png');
  rmSync(dir, { recursive: true, force: true });
});

test('resolveConfig resolves an absolute logo path the same way cli/workspace.ts does, not nested under the project root', () => {
  // `validateLogo` used `path.join` while `cli/workspace.ts` (which actually requires the file)
  // uses `path.resolve` — `path.join(projectRoot, absolutePath)` nests the absolute path *under*
  // `projectRoot` instead of using it directly, so a real file at an absolute, in-root path was
  // reported "not found" (Minor finding, Fable's implementation review, cli/config.ts:74 vs
  // cli/workspace.ts:134).
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-logo-abs-'));
  const logoPath = path.join(dir, 'logo.png');
  writeFileSync(logoPath, '');
  writeFileSync(
    path.join(dir, 'ds-viewer.config.ts'),
    `import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'X', logo: ${JSON.stringify(logoPath)}, components: [], tokens: [] });\n`,
  );
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const resolved = resolveConfig(dir);
    assert.equal(resolved.logo, logoPath);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
  rmSync(dir, { recursive: true, force: true });
});

test('resolveConfig warns and drops a logo path that resolves outside the project root', () => {
  // A logo outside `projectRoot` is not among Metro's watch folders (cli/workspace.ts), so letting
  // it through here would surface as an unclear Metro bundling error later instead of this clear,
  // upfront warning (Minor finding, Fable's implementation review).
  const outsideDir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-logo-outside-'));
  writeFileSync(path.join(outsideDir, 'logo.png'), '');
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-logo-project-'));
  writeFileSync(
    path.join(dir, 'ds-viewer.config.ts'),
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'X', logo: '../../etc-does-not-matter/logo.png', components: [], tokens: [] });\n",
  );
  // Replace the placeholder with a real relative path from `dir` to `outsideDir`'s logo, computed
  // here (not hardcoded) since `mkdtempSync`'s suffix makes every run's paths different.
  const relativeToOutside = path.relative(dir, path.join(outsideDir, 'logo.png')).split(path.sep).join('/');
  writeFileSync(
    path.join(dir, 'ds-viewer.config.ts'),
    `import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'X', logo: ${JSON.stringify(relativeToOutside)}, components: [], tokens: [] });\n`,
  );
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const resolved = resolveConfig(dir);
    assert.equal(resolved.logo, undefined);
    assert.ok(warnings.some((w) => w.includes('outside the project root')));
  } finally {
    console.warn = originalWarn;
  }
  rmSync(dir, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
});
