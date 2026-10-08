import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKitRoot, runDoctorCommand, runExplainCommand, runInit } from '../main.ts';

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

function runIn(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', mainPath, ...args], {
    cwd,
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

test('--help mentions explain and its flags', () => {
  const result = run('--help');
  assert.match(result.stdout, /^  explain <Page>/m);
  assert.match(result.stdout, /--heights/);
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

test('runDoctorCommand prints JSON and exits non-zero with --ci when there is an error', async () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'removed', name: 'Removed', props: { variant: 'removed' }, node: null }] },
    });
  `);
  const result = await runDoctorCommand(dir, ['--json', '--ci']);
  const json = JSON.parse(result.output);
  assert.equal(json.summary.errors, 1);
  assert.equal(result.exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctorCommand prints the human report and never sets an exit code without --ci', async () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  // No --ci here, so the update-check overlay would otherwise run against the real registry
  // (Global Constraints: "No network in npm test") — inject a stub that resolves "no update known",
  // the same uniform outcome `checkForUpdate` itself returns when offline.
  const checkForUpdate = async () => undefined;
  const result = await runDoctorCommand(dir, [], { checkForUpdate });
  assert.match(result.output, /error/);
  assert.equal(result.exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctorCommand never calls checkForUpdate with --ci, even when updateCheck is enabled', async () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const checkForUpdate = async () => { throw new Error('must not be called'); };
  const result = await runDoctorCommand(dir, ['--ci'], { checkForUpdate });
  assert.ok(result); // reaching this line without throwing is the assertion
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctorCommand overlays update into --json output when a check resolves', async () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const checkForUpdate = async () => ({ current: '0.3.0', latest: '0.4.0', breaking: false, summary: [], checkedAt: new Date().toISOString() });
  // `env: {}`: independent of the ambient DS_VIEWER_NO_UPDATE_CHECK, which CI sets for the whole job.
  const { output } = await runDoctorCommand(dir, ['--json'], { checkForUpdate, env: {} });
  assert.deepEqual(JSON.parse(output).update, { current: '0.3.0', latest: '0.4.0', breaking: false });
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctorCommand leaves update: null when checkForUpdate resolves undefined (offline)', async () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const checkForUpdate = async () => undefined;
  const { output } = await runDoctorCommand(dir, ['--json'], { checkForUpdate });
  assert.equal(JSON.parse(output).update, null);
  rmSync(dir, { recursive: true, force: true });
});

test('runDoctorCommand mentions the update in its human-readable output too, not only --json', async () => {
  const dir = makeDoctorFixture(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const checkForUpdate = async () => ({ current: '0.3.0', latest: '0.4.0', breaking: false, summary: [], checkedAt: new Date().toISOString() });
  const { output } = await runDoctorCommand(dir, [], { checkForUpdate, env: {} });
  assert.match(output, /0\.3\.0.*0\.4\.0/s);
  rmSync(dir, { recursive: true, force: true });
});

test('runExplainCommand prints "No page named" and exits 1 for an unknown page, with no project needed beyond a config', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-explain-cmd-'));
  mkdirSync(path.join(dir, 'components'), { recursive: true });
  writeFileSync(
    path.join(dir, 'ds-viewer.config.ts'),
    "import { defineConfig } from '@krapwoo/ds-viewer/config';\nexport default defineConfig({ name: 'Fixture', components: ['components/*/index.ts'], tokens: [] });\n",
  );
  const result = runExplainCommand(dir, 'NoSuchPage', []);
  assert.match(result.output, /No page named "NoSuchPage" was found\./);
  assert.equal(result.exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('runExplainCommand with a malformed --heights value exits 1 with a clear message', () => {
  const result = runExplainCommand('/irrelevant', 'Widget', ['--heights', 'nope']);
  assert.match(result.output, /--heights must be two comma-separated numbers/);
  assert.equal(result.exitCode, 1);
});

test('"kit diff" with no component name prints usage and exits 1', () => {
  const dir = copyFixture(EXISTING_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-kit-diff-usage-');
  const result = runIn(dir, 'kit', 'diff');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: ds-viewer kit diff <Component>/);
  rmSync(dir, { recursive: true, force: true });
});

test('"kit diff Button" dispatches to runKitDiffCommand', () => {
  // EXISTING_PROJECT_FIXTURE_ROOT's own ds-viewer.config.ts has no starterKit (fixtures/existing-project/ds-viewer.config.ts)
  // — a real, deterministic, network-free dispatch proof: reaching runKitDiffCommand's own
  // "no starter kit configured" message is only possible via main()'s "kit diff" branch.
  const dir = copyFixture(EXISTING_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-kit-diff-button-');
  const result = runIn(dir, 'kit', 'diff', 'Button');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /no starter kit configured/);
  rmSync(dir, { recursive: true, force: true });
});

test('"migrate" with no --from prints usage and exits 1', () => {
  const dir = copyFixture(EXISTING_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-migrate-usage-');
  const result = runIn(dir, 'migrate');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: ds-viewer migrate --from <version>/);
  rmSync(dir, { recursive: true, force: true });
});

test('"migrate --from 0.3.0 --json" prints valid JSON with from: "0.3.0"', () => {
  const dir = copyFixture(EXISTING_PROJECT_FIXTURE_ROOT, 'ds-viewer-run-migrate-json-');
  const result = runIn(dir, 'migrate', '--from', '0.3.0', '--json');
  assert.equal(result.status, 0);
  // MIGRATIONS is empty in 0.4, so this never touches any real file — changes: [] is the whole assertion.
  assert.deepEqual(JSON.parse(result.stdout), { version: 1, from: '0.3.0', changes: [], dryRun: false });
  rmSync(dir, { recursive: true, force: true });
});

test('"update --dry-run" dispatches through to resolveConfig and reports its error, never touching the network', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-run-update-'));
  const result = runIn(dir, 'update', '--dry-run');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No ds-viewer\.config\.ts found/);
  rmSync(dir, { recursive: true, force: true });
});
