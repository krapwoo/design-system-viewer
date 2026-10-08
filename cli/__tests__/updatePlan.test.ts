// cli/__tests__/updatePlan.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildUpdatePlan } from '../updatePlan.ts';
import type { ResolvedConfig } from '../types.ts';

function baseConfig(dir: string, overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return { name: 'X', components: [], tokens: [], updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'x.ts'), ...overrides };
}

const MIGRATE_JSON = JSON.stringify({ version: 1, from: '0.4.0', dryRun: true, changes: [{ file: 'src/ds/Button.catalog.tsx', change: 'Renamed prop fill to itemsFill.' }] });

function fakeExec(overrides: Partial<Record<string, string>> = {}): (command: string, args: string[]) => string {
  return (command: string, args: string[]) => {
    // `node <full path to migrateEntry.js> --from ...` has no subcommand word the way `node
    // <main.js> migrate` does, so every `node` invocation here is keyed simply as `'node'`
    // (Critical finding, Fable correction pass: the original `${command} ${args[0]}` key compared
    // `'node ' + args[0]` — the full script path — against the literal string `'node'`, which can
    // never match; every test exercising the migrate step silently fell through to the `'node'`
    // branch's dead code and never actually ran it).
    const key = command === 'node' ? 'node' : `${command} ${args[0]}`;
    if (key in overrides) return overrides[key] as string;
    if (key === 'npm view') return '0.5.0';
    if (key === 'npm pack') return '';
    if (key === 'tar -xzf') return '';
    if (key === 'node') return MIGRATE_JSON;
    throw new Error(`Unexpected exec: ${key}`);
  };
}

const fakeFetchWithRelease = (async () => ({
  ok: true,
  json: async () => ({ body: '- Faster sync\n- New Tabs component', published_at: '2026-10-06T00:00:00Z' }),
})) as unknown as typeof fetch;

test('buildUpdatePlan assembles version.json/lockfile/migration files, a release summary, and a clean git status', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease, gitStatusImpl: () => '',
  });
  assert.ok(!('error' in plan));
  if ('error' in plan) throw new Error('unreachable');
  assert.equal(plan.current, '0.4.0');
  assert.equal(plan.latest, '0.5.0');
  assert.equal(plan.breaking, false);
  assert.deepEqual(plan.summary, ['Faster sync', 'New Tabs component']);
  assert.deepEqual(plan.files.map((f) => f.path), ['package.json', 'package-lock.json', 'src/ds/Button.catalog.tsx']);
  assert.deepEqual(plan.dirtyFiles, []);
  assert.equal(plan.outsideGitRepo, false);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan marks a planned file dirty when git status reports it', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease, gitStatusImpl: () => ' M package.json\n?? other.txt\n',
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package.json']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan returns { error } when npm itself is unreachable', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: () => { throw new Error('offline'); }, gitStatusImpl: () => '',
  });
  assert.ok('error' in plan);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan returns { error } when already on the latest version', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const plan = await buildUpdatePlan(baseConfig(dir), '0.5.0', {
    execImpl: fakeExec({ 'npm view': '0.5.0' }), gitStatusImpl: () => '',
  });
  assert.deepEqual(plan, { error: 'Already on the latest version (0.5.0).' });
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: outside a git repository, every file is treated as not dirty and outsideGitRepo is true', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease, gitStatusImpl: () => undefined,
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.equal(plan.outsideGitRepo, true);
  assert.deepEqual(plan.dirtyFiles, []);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan counts differing kit files via listKitFileDiffs', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const userKit = path.join(dir, 'src', 'ds', 'components', 'Button');
  const installedKit = path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'starter-kit', 'components', 'Button');
  mkdirSync(userKit, { recursive: true });
  mkdirSync(installedKit, { recursive: true });
  writeFileSync(path.join(userKit, 'index.ts'), 'export const a = 1;\n');
  writeFileSync(path.join(installedKit, 'index.ts'), 'export const a = 2;\n');
  const config = baseConfig(dir, { starterKit: { version: '0.4.0', root: 'src/ds' }, components: ['src/ds/components/*/index.ts'] });
  const plan = await buildUpdatePlan(config, '0.4.0', { execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease, gitStatusImpl: () => '' });
  if ('error' in plan) throw new Error('unreachable');
  assert.equal(plan.kitFilesDiffering, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan treats a renamed planned file as dirty by its new path, not the old one (git status --porcelain\'s "R  old -> new" form)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease, gitStatusImpl: () => 'R  old-name.json -> package.json\n',
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package.json']);
  rmSync(dir, { recursive: true, force: true });
});
