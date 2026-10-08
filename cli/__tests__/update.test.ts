// cli/__tests__/update.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runUpdate } from '../update.ts';
import type { ResolvedConfig } from '../types.ts';
import type { UpdatePlan } from '../updatePlan.ts';

function baseConfig(dir: string): ResolvedConfig {
  return { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts') };
}

function samplePlan(overrides: Partial<UpdatePlan> = {}): UpdatePlan {
  return {
    current: '0.4.0', latest: '0.5.0', breaking: false, summary: ['Faster sync'], releasedAt: undefined,
    files: [{ path: 'package.json', reason: 'version', dirty: false }], dirtyFiles: [], kitFilesDiffering: 0, outsideGitRepo: false,
    ...overrides,
  };
}

function recordingExec(script: Record<string, string>) {
  const calls: string[] = [];
  const execImpl = (command: string, args: string[]) => {
    // Every `node` call here runs `installedMainJs(...)` as `args[0]` (a full path) followed by its
    // subcommand as `args[1]` ('migrate'/'doctor') — keying by `args[0]` alone (as a naive
    // `${command} ${args[0]}` would) can never produce the literal `'node migrate'`/`'node
    // doctor'` this script's own callers write below (Critical finding, Fable correction pass).
    const key = command === 'node' ? `node ${args[1]}` : `${command} ${args[0]}`;
    calls.push(key);
    if (key in script) return script[key];
    throw new Error(`Unexpected exec: ${key} ${args.join(' ')}`);
  };
  return { execImpl, calls };
}

test('--dry-run stops after the plan, never calling exec', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl, calls } = recordingExec({});
  const buildPlan = async () => samplePlan();
  const result = await runUpdate(baseConfig(dir), { dryRun: true, buildPlan, execImpl, currentVersion: '0.4.0' });
  assert.match(result.output, /0\.4\.0.*0\.5\.0/s);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls, []);
  rmSync(dir, { recursive: true, force: true });
});

test('a plan error (e.g. offline) is printed with exit 1', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const buildPlan = async () => ({ error: "Couldn't prepare the update." });
  const result = await runUpdate(baseConfig(dir), { buildPlan, currentVersion: '0.4.0' });
  assert.equal(result.output, "Couldn't prepare the update.");
  assert.equal(result.exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('dirty files without --force refuse, listing every dirty path, and never call exec', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl, calls } = recordingExec({});
  const buildPlan = async () => samplePlan({ dirtyFiles: ['package.json'] });
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, currentVersion: '0.4.0' });
  assert.match(result.output, /package\.json/);
  assert.match(result.output, /--force/);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(calls, []);
  rmSync(dir, { recursive: true, force: true });
});

test('a declined confirmation aborts with exit 0 and never calls exec', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl, calls } = recordingExec({});
  const buildPlan = async () => samplePlan();
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, confirm: () => false, currentVersion: '0.4.0' });
  assert.match(result.output, /Aborted/);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls, []);
  rmSync(dir, { recursive: true, force: true });
});

test('--force proceeds past a dirty-file refusal', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl } = recordingExec({ 'npm install': '', 'node migrate': '', 'node doctor': '0 errors, 0 warnings' });
  const buildPlan = async () => samplePlan({ dirtyFiles: ['package.json'] });
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, force: true, yes: true, currentVersion: '0.4.0' });
  assert.equal(result.exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('--yes installs, migrates, and runs doctor, in that order, and reports success', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl, calls } = recordingExec({ 'npm install': '', 'node migrate': '', 'node doctor': '0 errors, 0 warnings' });
  const buildPlan = async () => samplePlan();
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, yes: true, currentVersion: '0.4.0' });
  assert.deepEqual(calls, ['npm install', 'node migrate', 'node doctor']);
  assert.match(result.output, /Updated to 0\.5\.0/);
  assert.match(result.output, /not committed/);
  assert.equal(result.exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('a failed install reports the recovery command and exits 1, without attempting migrate', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl, calls } = recordingExec({});
  const buildPlan = async () => samplePlan();
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, yes: true, currentVersion: '0.4.0' });
  assert.match(result.output, /npx ds-viewer update/);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(calls, ['npm install']);
  rmSync(dir, { recursive: true, force: true });
});

test('a failed migrate step names the exact recovery command, including --from', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl } = recordingExec({ 'npm install': '' });
  const buildPlan = async () => samplePlan();
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, yes: true, currentVersion: '0.4.0' });
  assert.match(result.output, /migrate --from 0\.4\.0/);
  assert.equal(result.exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

// M6 (Minor, Fable correction pass): mirrors `performUpdate`'s own identical guard — a doctor
// crash must not lose the "installed and migrated successfully" context.
test('a doctor crash after a successful install and migrate reports it without losing the success context, exit 1', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const { execImpl } = recordingExec({ 'npm install': '', 'node migrate': '' }); // no 'node doctor' entry — throws "Unexpected exec", simulating a crash.
  const buildPlan = async () => samplePlan();
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, yes: true, currentVersion: '0.4.0' });
  assert.match(result.output, /Installed and migrated to 0\.5\.0/);
  assert.match(result.output, /doctor failed to run/);
  assert.match(result.output, /npx ds-viewer doctor/);
  assert.equal(result.exitCode, 1);
  rmSync(dir, { recursive: true, force: true });
});

// I5 (Important, raised from Minor by the controller): the success output carries only doctor's
// own last summary line, never the whole multi-line human report.
test('a successful update\'s output carries only doctor\'s last summary line, not the whole report', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-'));
  const DOCTOR_REPORT = 'Button\n  [warning] option-not-covered: "size" option "lg" has no bound or tagged example.\n    Fix: Bind a grid axis to "size".\n\n0 errors, 1 warning — 12 components (12 with examples), 3 unbound examples.';
  const { execImpl } = recordingExec({ 'npm install': '', 'node migrate': '', 'node doctor': DOCTOR_REPORT });
  const buildPlan = async () => samplePlan();
  const result = await runUpdate(baseConfig(dir), { buildPlan, execImpl, yes: true, currentVersion: '0.4.0' });
  assert.match(result.output, /Updated to 0\.5\.0/);
  assert.ok(result.output.endsWith('0 errors, 1 warning — 12 components (12 with examples), 3 unbound examples.'));
  assert.ok(!result.output.includes('option-not-covered'));
  assert.equal(result.exitCode, 0);
  rmSync(dir, { recursive: true, force: true });
});
