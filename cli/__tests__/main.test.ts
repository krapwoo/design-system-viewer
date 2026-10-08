import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKitRoot, runDoctorCommand, runInit } from '../main.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mainPath = path.join(repoRoot, 'cli/main.ts');
const { version } = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };
const NEW_PROJECT_FIXTURE_ROOT = path.join(repoRoot, 'fixtures/new-project');
const EXISTING_PROJECT_FIXTURE_ROOT = path.join(repoRoot, 'fixtures/existing-project');

function copyFixture(fixtureRoot: string, prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  cpSync(fixtureRoot, dir, { recursive: true });
  return dir;
}

function run(...args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', mainPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

for (const flag of ['--help', '-h', 'help']) {
  test(`${flag} prints usage with every command and exits 0`, () => {
    const result = run(flag);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: ds-viewer <command>/);
    for (const command of ['init', 'sync', 'dev']) assert.match(result.stdout, new RegExp(`^  ${command} `, 'm'));
    assert.match(result.stdout, /--new/);
    assert.match(result.stdout, /--existing/);
    assert.match(result.stdout, /--kit-root/);
    assert.match(result.stdout, /--yes/);
    assert.equal(result.stderr, '');
  });
}

test('no command prints usage and exits 0', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ds-viewer <command>/);
});

for (const flag of ['--version', '-v']) {
  test(`${flag} prints the package version`, () => {
    const result = run(flag);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), version);
  });
}

test('an unknown command prints usage to stderr and exits 1', () => {
  const result = run('bogus');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command "bogus"/);
  assert.match(result.stderr, /Usage: ds-viewer <command>/);
});

test('parseKitRoot normalizes a trailing slash away', () => {
  const result = parseKitRoot('/project', 'src/ds/');
  assert.deepEqual(result, { value: 'src/ds' });
});

test('parseKitRoot rejects a value that escapes the project root', () => {
  const result = parseKitRoot('/project', '../../etc');
  assert.equal(result.value, undefined);
  assert.match(result.error ?? '', /must stay inside the project root/);
});

test('parseKitRoot rejects a value containing a quote', () => {
  const result = parseKitRoot('/project', "it's-ds");
  assert.equal(result.value, undefined);
  assert.match(result.error ?? '', /cannot contain a quote/);
});

test('parseKitRoot relocates an absolute value that is inside the project root to a relative path', () => {
  const result = parseKitRoot('/project', '/project/custom');
  assert.deepEqual(result, { value: 'custom' });
});

test('runInit --yes with neither --new nor --existing defaults to the existing-project path', async () => {
  const projectRoot = copyFixture(EXISTING_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-init-yes-');
  const result = await runInit(projectRoot, ['--yes']);
  assert.ok(result.messages.some((message) => message.includes('with catalog pages')));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('runInit dispatches --kit-root to the new-project path with the normalized value', async () => {
  const projectRoot = copyFixture(NEW_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-init-kit-root-');
  const installed: string[] = [];
  const result = await runInit(projectRoot, ['--new', '--kit-root', 'custom/ds/'], {
    installer: (_root, missing) => {
      installed.push(...missing);
    },
  });
  assert.ok(existsSync(path.join(projectRoot, 'custom/ds/components/Button/index.ts')));
  assert.match(readFileSync(path.join(projectRoot, 'ds-viewer.config.ts'), 'utf8'), /custom\/ds\/components/);
  assert.ok(installed.length > 0);
  assert.equal(result.exitCode, undefined);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('runInit rejects an escaping --kit-root before dispatching, installing, or writing anything', async () => {
  const projectRoot = copyFixture(NEW_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-init-bad-kit-root-');
  let installerCalled = false;
  const result = await runInit(projectRoot, ['--new', '--kit-root', '../../escape'], {
    installer: () => {
      installerCalled = true;
    },
  });
  assert.equal(installerCalled, false);
  assert.deepEqual(result.written, []);
  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some((message) => message.includes('must stay inside the project root')));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('runInit --new dispatches to the new-project path via the injected installer, never a real "expo install"', async () => {
  const projectRoot = copyFixture(NEW_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-init-new-');
  const installed: string[] = [];
  const result = await runInit(projectRoot, ['--new'], {
    installer: (_root, missing) => {
      installed.push(...missing);
    },
  });
  assert.deepEqual(installed.sort(), ['react-native-safe-area-context', 'react-native-svg']);
  assert.ok(existsSync(path.join(projectRoot, 'src/ds/components/Button/index.ts')));
  assert.equal(result.exitCode, undefined);
  rmSync(projectRoot, { recursive: true, force: true });
});

test('runInit gives the interactive (TTY) case its own message when the answer could not be parsed', async () => {
  const projectRoot = copyFixture(EXISTING_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-init-tty-');
  const result = await runInit(projectRoot, [], { isTTY: true, promptMode: async () => undefined });
  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some((message) => message.includes('Could not parse that answer')));
  assert.ok(!result.messages.some((message) => message.includes('non-interactive stdin')));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('runInit keeps the non-interactive message when stdin is not a TTY', async () => {
  const projectRoot = copyFixture(EXISTING_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-init-non-tty-');
  const result = await runInit(projectRoot, [], { isTTY: false, promptMode: async () => undefined });
  assert.equal(result.exitCode, 1);
  assert.ok(result.messages.some((message) => message.includes('non-interactive stdin cannot be asked')));
  rmSync(projectRoot, { recursive: true, force: true });
});

test('--help mentions doctor and its flags', () => {
  const result = run('--help');
  assert.match(result.stdout, /^  doctor /m);
  assert.match(result.stdout, /--json/);
  assert.match(result.stdout, /--ci/);
});

// A real React-component-shaped return type, not `{ return null; }` — `isComponentType`
// (`cli/props.ts`) matches a call signature's *return type string* against `Element|ReactNode`;
// an untyped `null` return never matches, so `Widget` would silently never appear in
// `components.json` at all, and a test asserting only `summary.errors === 1` would then "pass"
// for the wrong reason (`component-export-removed`, not whatever the test actually names).
// Mirrors `doctor.test.ts`'s own `WIDGET_SOURCE` fixture, in this file's own scope.
const WIDGET_SOURCE = `
import type React from 'react';
export type WidgetVariant = 'primary' | 'secondary';
export function Widget({ variant }: { variant: WidgetVariant }): React.ReactElement {
  return null as never;
}
`;

function makeDoctorFixture(pageSource: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-doctor-cmd-'));
  mkdirSync(path.join(dir, 'components', 'Widget'), { recursive: true });
  writeFileSync(path.join(dir, 'components', 'Widget', 'index.ts'), WIDGET_SOURCE);
  writeFileSync(path.join(dir, 'components', 'Widget', 'Widget.catalog.tsx'), pageSource);
  writeFileSync(
    path.join(dir, 'ds-viewer.config.ts'),
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'Fixture', components: ['components/*/index.ts'], tokens: [] });\n",
  );
  // Errata (controller, binding): a stub `node_modules/@krapwoo/ds-viewer` so `checkPageTypeErrors`'s
  // real `ts.Program` never reports TS2307 on this fixture's own `import ... from '@krapwoo/ds-viewer'`.
  mkdirSync(path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer'), { recursive: true });
  writeFileSync(
    path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'package.json'),
    JSON.stringify({ name: '@krapwoo/ds-viewer', types: 'index.d.ts' }),
  );
  writeFileSync(
    path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'index.d.ts'),
    'export const defineCatalogPage: any;\nexport const grid: any;\n',
  );
  return dir;
}

test('runDoctorCommand prints JSON and exits non-zero with --ci when there is an error', () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'removed', name: 'Removed', props: { variant: 'removed' }, node: null }] },
    });
  `);
  const result = runDoctorCommand(dir, ['--json', '--ci']);
  const json = JSON.parse(result.output);
  assert.equal(json.summary.errors, 1);
  assert.equal(result.exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctorCommand prints the human report and never sets an exit code without --ci', () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const result = runDoctorCommand(dir, []);
  assert.match(result.output, /error/);
  assert.equal(result.exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});
