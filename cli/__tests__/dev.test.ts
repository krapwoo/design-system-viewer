import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertLocalInstall, isWatchedPath, LocalInstallMissingError, performUpdate, reloadWorkspace, refreshUpdateFile, watchTargetFolders } from '../dev.ts';
import type { UpdatePlan } from '../updatePlan.ts';
import type { UpdateStatus } from '../endpoint.ts';
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
  // `env: {}`: independent of the ambient DS_VIEWER_NO_UPDATE_CHECK, which CI sets for the whole job.
  await refreshUpdateFile(config, '0.4.0', { checkForUpdate, env: {} });
  assert.equal(JSON.parse(readFileSync(path.join(dir, '.ds-viewer', 'update.json'), 'utf8')).latest, '0.5.0');
  rmSync(dir, { recursive: true, force: true });
});

function samplePlan(overrides: Partial<UpdatePlan> = {}): UpdatePlan {
  return { current: '0.4.0', latest: '0.5.0', breaking: false, summary: [], files: [], dirtyFiles: [], kitFilesDiffering: 0, outsideGitRepo: false, ...overrides };
}

function recordingDeps() {
  const statuses: UpdateStatus[] = [];
  const restartCalls: { doctorSummary: string; files: string[]; latest: string }[] = [];
  return {
    onStatus: (s: UpdateStatus) => statuses.push(s),
    restart: async (result: { doctorSummary: string; files: string[]; latest: string }) => { restartCalls.push(result); },
    statuses,
    restartCalls,
  };
}

// Every `node` call here runs `installedMainJs(...)` as `args[0]` (a full path) followed by its
// subcommand as `args[1]` — keying/branching on `args[0]` alone (as every fake below originally
// did) can never see 'migrate'/'doctor' at all (Critical finding, Fable correction pass).
test('performUpdate: a full success runs install, migrate, doctor, then restart with the doctor summary and the plan\'s files', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  const calls: string[] = [];
  // The real `doctor` command's own multi-line human report (Minor finding, raised to Important by
  // the controller): only its last, non-empty summary line belongs in the success state.
  const DOCTOR_REPORT = 'Button\n  [warning] option-not-covered: "size" option "lg" has no bound or tagged example. (Button.catalog.tsx)\n    Fix: Bind a grid axis to "size", or add a tagged example.\n\n0 errors, 1 warning — 12 components (12 with examples), 3 unbound examples.';
  const execImpl = async (command: string, args: string[]) => {
    const key = command === 'node' ? `node ${args[1]}` : `${command} ${args[0]}`;
    calls.push(key);
    if (key === 'node doctor') return DOCTOR_REPORT;
    return '';
  };
  const deps = recordingDeps();
  const plan = samplePlan({ files: [{ path: 'package.json', reason: 'version', dirty: false }] });
  await performUpdate(config, '0.4.0', plan, { execImpl, onStatus: deps.onStatus, restart: deps.restart, delayMs: 0 });
  assert.ok(calls.some((c) => c.startsWith('npm') || c.startsWith('pnpm') || c.startsWith('yarn')));
  // M10 (Minor, Fable correction pass): install, migrate, then doctor, in that exact order.
  assert.deepEqual(calls, ['npm install', 'node migrate', 'node doctor']);
  // Errata 1b: `restart`'s result includes `latest: plan.latest`. `doctorSummary` is only the
  // report's own last summary line, not the whole multi-line report.
  assert.deepEqual(deps.restartCalls, [{ doctorSummary: '0 errors, 1 warning — 12 components (12 with examples), 3 unbound examples.', files: ['package.json'], latest: '0.5.0' }]);
  // Errata 4: the *last* recorded status is 'restarting' (not the second-to-last).
  assert.equal(deps.statuses[deps.statuses.length - 1].phase, 'restarting');
  rmSync(dir, { recursive: true, force: true });
});

test('performUpdate: an install failure reports it as the failed step and never restarts', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  const execImpl = async () => { throw new Error('npm ERR! ERESOLVE'); };
  const deps = recordingDeps();
  await performUpdate(config, '0.4.0', samplePlan(), { execImpl, onStatus: deps.onStatus, restart: deps.restart, delayMs: 0 });
  const last = deps.statuses[deps.statuses.length - 1];
  assert.equal(last.phase, 'failure');
  // Minor finding, Fable correction pass: the mockup's own failure state reads "Install with npm
  // failed" (present tense), not "Installed with npm failed" — a distinct `failLabel` from the
  // step list's own past-tense "Installed with npm" (done) or "Installing with npm…" (in flight).
  if (last.phase === 'failure') assert.equal(last.failedStep, 'Install with npm');
  assert.deepEqual(deps.restartCalls, []);
  rmSync(dir, { recursive: true, force: true });
});

test('performUpdate: a migrate failure happens after a successful install, and never restarts', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  const execImpl = async (command: string, args: string[]) => {
    if (command === 'node' && args[1] === 'migrate') throw new Error('migration threw');
    return '';
  };
  const deps = recordingDeps();
  await performUpdate(config, '0.4.0', samplePlan(), { execImpl, onStatus: deps.onStatus, restart: deps.restart, delayMs: 0 });
  const last = deps.statuses[deps.statuses.length - 1];
  assert.equal(last.phase, 'failure');
  if (last.phase === 'failure') assert.match(last.failedStep, /migration/i);
  rmSync(dir, { recursive: true, force: true });
});

test('performUpdate: a doctor failure is reported, with install and migrate already recorded as done', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  const execImpl = async (command: string, args: string[]) => {
    if (command === 'node' && args[1] === 'doctor') throw new Error('doctor crashed');
    return '';
  };
  const deps = recordingDeps();
  await performUpdate(config, '0.4.0', samplePlan(), { execImpl, onStatus: deps.onStatus, restart: deps.restart, delayMs: 0 });
  const last = deps.statuses[deps.statuses.length - 1];
  assert.equal(last.phase, 'failure');
  if (last.phase === 'failure') assert.match(last.failedStep, /doctor/i);
  rmSync(dir, { recursive: true, force: true });
});

test('performUpdate: a plan with zero migrations reports "No migrations to apply" instead of "Applying 0 migrations"', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  const execImpl = async (command: string, args: string[]) => (command === 'node' && args[1] === 'doctor' ? '0 errors, 0 warnings' : '');
  const deps = recordingDeps();
  await performUpdate(config, '0.4.0', samplePlan(), { execImpl, onStatus: deps.onStatus, restart: deps.restart, delayMs: 0 });
  const firstReport = deps.statuses[0];
  assert.equal(firstReport.phase, 'updating');
  if (firstReport.phase === 'updating') assert.ok(firstReport.steps.some((s) => s.label === 'No migrations to apply'));
  rmSync(dir, { recursive: true, force: true });
});

test('performUpdate: step labels name the detected package manager and the real migration count', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-dev-'));
  writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  const config: ResolvedConfig = { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
  const execImpl = async (command: string, args: string[]) => (command === 'node' && args[1] === 'doctor' ? '0 errors, 0 warnings' : '');
  const deps = recordingDeps();
  const plan = samplePlan({ files: [{ path: 'package.json', reason: 'version', dirty: false }, { path: 'src/ds/Button.catalog.tsx', reason: 'migration: Renamed prop.', dirty: false }] });
  await performUpdate(config, '0.4.0', plan, { execImpl, onStatus: deps.onStatus, restart: deps.restart, delayMs: 0 });
  const firstReport = deps.statuses[0];
  if (firstReport.phase !== 'updating') throw new Error('unreachable');
  // The install step is still in flight at this first report — its own present-tense
  // `progressLabel` (Minor finding, Fable correction pass: it previously read "Installed with
  // npm…", already past tense, while still running).
  assert.ok(firstReport.steps.some((s) => s.label === 'Installing with npm'));
  assert.ok(firstReport.steps.some((s) => s.label === 'Applying 1 migration'));
  const secondReport = deps.statuses[1];
  if (secondReport.phase !== 'updating') throw new Error('unreachable');
  assert.ok(secondReport.steps.some((s) => s.label === 'Installed with npm' && s.state === 'done'));
  rmSync(dir, { recursive: true, force: true });
});
