// cli/__tests__/updatePlan.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildUpdatePlan, defaultGitShow, defaultReadWorkingFile, stripRepoPrefix } from '../updatePlan.ts';
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

test('buildUpdatePlan counts kit files differing from the downloaded target version\'s kit, not the installed one (M4)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const tmp = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-tmp-'));
  const userKit = path.join(dir, 'src', 'ds', 'components', 'Button');
  // The installed kit (currently on disk) matches the user's file exactly — if `kitFilesDiffering`
  // were still comparing against this (the pre-M4 bug), it would read 0.
  const installedKit = path.join(dir, 'node_modules', '@krapwoo', 'ds-viewer', 'starter-kit', 'components', 'Button');
  // The *downloaded* target version's kit (what `npm pack` + `tar` would have extracted into `tmp`
  // before this function's own `finally` cleans it up) differs from the user's file.
  const downloadedKit = path.join(tmp, 'package', 'starter-kit', 'components', 'Button');
  mkdirSync(userKit, { recursive: true });
  mkdirSync(installedKit, { recursive: true });
  mkdirSync(downloadedKit, { recursive: true });
  writeFileSync(path.join(userKit, 'index.ts'), 'export const a = 1;\n');
  writeFileSync(path.join(installedKit, 'index.ts'), 'export const a = 1;\n');
  writeFileSync(path.join(downloadedKit, 'index.ts'), 'export const a = 2;\n');
  const config = baseConfig(dir, { starterKit: { version: '0.4.0', root: 'src/ds' }, components: ['src/ds/components/*/index.ts'] });
  const plan = await buildUpdatePlan(config, '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease, gitStatusImpl: () => '', tmpDirImpl: () => tmp,
  });
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

// Important finding, Fable correction pass (I1): the production default `execImpl` now gives `npm
// view`/`npm pack` their own 20s timeout so a real, unreachable registry fails fast instead of
// hanging `dev`'s whole event loop for minutes — simulated here by an injected `execImpl` that
// rejects the way a timed-out `execFile` would (its `killSignal`, never a resolved value).
test('buildUpdatePlan: an execImpl that rejects with a timeout error yields the offline { error }, never hangs', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const execImpl = async (command: string) => {
    if (command === 'npm') throw new Error('Command failed: npm view — ETIMEDOUT');
    return '';
  };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', { execImpl, gitStatusImpl: () => '' });
  assert.deepEqual(plan, { error: "Couldn't prepare the update. You may be offline, or npm didn't respond. Nothing was changed." });
  rmSync(dir, { recursive: true, force: true });
});

// M9 (Minor, Fable correction pass): `defaultGitStatus` fails *closed* now — a real git failure
// that isn't "not a git repository" (or git missing) must surface as a plan `{ error }`, never
// silently degrade to "outside a git repository, nothing is dirty". Exercised here through
// `gitStatusImpl` throwing the same `GitStatusError`-shaped failure the real default would, since
// forcing the real `git` binary itself to fail in a controlled, portable way isn't practical.
test('buildUpdatePlan: a gitStatusImpl failure other than "not a repository" returns a plan { error } naming git, not a silent "outside a git repository"', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const gitStatusImpl = () => { throw new Error('git status failed: fatal: detected dubious ownership in repository'); };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', { execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease, gitStatusImpl });
  assert.ok('error' in plan);
  if (!('error' in plan)) throw new Error('unreachable');
  assert.match(plan.error, /git/i);
  rmSync(dir, { recursive: true, force: true });
});

// Safe superseded update (frozen scope): a prior, already-finished `update` run left
// `package.json` and `package-lock.json` dirty, bumped only to the currently-installed
// `currentVersion` — exactly what Hermex looks like in practice. `buildUpdatePlan` must prove
// this and present the regular clean plan, not a special state.
function hermexHeadPackageJson(): string {
  return JSON.stringify({ name: 'hermex', dependencies: { '@krapwoo/ds-viewer': '0.3.0' } });
}
function hermexWorkingPackageJson(version: string): string {
  return JSON.stringify({ name: 'hermex', dependencies: { '@krapwoo/ds-viewer': version } });
}
function hermexLock(version: string): string {
  return JSON.stringify({
    name: 'hermex',
    lockfileVersion: 3,
    packages: {
      '': { name: 'hermex', dependencies: { '@krapwoo/ds-viewer': version } },
      'node_modules/@krapwoo/ds-viewer': { version, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${version}.tgz`, integrity: `sha512-${version}` },
    },
  });
}

test('buildUpdatePlan: a package.json and npm lockfile bumped only to currentVersion resolve to a regular clean plan (Hermex shape)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package.json': hermexHeadPackageJson(), 'package-lock.json': hermexLock('0.3.0') };
  const workingByPath: Record<string, string> = { 'package.json': hermexWorkingPackageJson('0.4.0'), 'package-lock.json': hermexLock('0.4.0') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package.json\n M package-lock.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, []);
  assert.equal(plan.files.find((f) => f.path === 'package.json')?.dirty, false);
  assert.equal(plan.files.find((f) => f.path === 'package-lock.json')?.dirty, false);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: a package.json bump mixed with an unrelated user edit stays dirty', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package.json': hermexHeadPackageJson() };
  const workingByPath: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'hermex', description: 'added by hand', dependencies: { '@krapwoo/ds-viewer': '0.4.0' } }),
  };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package.json']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: a lockfile bump alongside an unrelated package\'s entry changing stays dirty', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headLock = JSON.parse(hermexLock('0.3.0'));
  const workingLock = JSON.parse(hermexLock('0.4.0'));
  workingLock.packages['node_modules/other-pkg'] = { version: '2.0.0' };
  const headByPath: Record<string, string> = { 'package-lock.json': JSON.stringify(headLock) };
  const workingByPath: Record<string, string> = { 'package-lock.json': JSON.stringify(workingLock) };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package-lock.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package-lock.json']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: missing HEAD content (e.g. the file didn\'t exist at HEAD, or git show failed) stays dirty even with valid working content', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const workingByPath: Record<string, string> = { 'package.json': hermexWorkingPackageJson('0.4.0'), 'package-lock.json': hermexLock('0.4.0') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package.json\n M package-lock.json\n',
    gitShowImpl: () => undefined,
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package.json', 'package-lock.json']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: malformed working JSON stays dirty even with valid HEAD content', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package.json': hermexHeadPackageJson(), 'package-lock.json': hermexLock('0.3.0') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package.json\n M package-lock.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: () => '{ not json',
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package.json', 'package-lock.json']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: a working declaration that does not match currentVersion stays dirty', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package.json': hermexHeadPackageJson(), 'package-lock.json': hermexLock('0.3.0') };
  // Bumped to 0.4.1, but currentVersion (the installed version) is 0.4.0 — not provably the
  // currently-running install.
  const workingByPath: Record<string, string> = { 'package.json': hermexWorkingPackageJson('0.4.1'), 'package-lock.json': hermexLock('0.4.1') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package.json\n M package-lock.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package.json', 'package-lock.json']);
  rmSync(dir, { recursive: true, force: true });
});

function hermexLockMismatchedEntry(rootVersion: string, entryVersion: string): string {
  return JSON.stringify({
    name: 'hermex',
    lockfileVersion: 3,
    packages: {
      '': { name: 'hermex', dependencies: { '@krapwoo/ds-viewer': rootVersion } },
      'node_modules/@krapwoo/ds-viewer': { version: entryVersion, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${entryVersion}.tgz`, integrity: `sha512-${entryVersion}` },
    },
  });
}

test('buildUpdatePlan: a lock entry that does not match currentVersion stays dirty even though the root declaration does', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package-lock.json': hermexLock('0.3.0') };
  // The root declaration (`packages[""].dependencies`) correctly names currentVersion, but the
  // package's own lock entry (`packages["node_modules/@krapwoo/ds-viewer"]`) resolves a different
  // version — not provably the currently-running install.
  const workingByPath: Record<string, string> = { 'package-lock.json': hermexLockMismatchedEntry('0.4.0', '0.4.1') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package-lock.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package-lock.json']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: a dirty migration file is never classified safe, regardless of the dependency files', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package.json': hermexHeadPackageJson(), 'package-lock.json': hermexLock('0.3.0') };
  const workingByPath: Record<string, string> = { 'package.json': hermexWorkingPackageJson('0.4.0'), 'package-lock.json': hermexLock('0.4.0') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    gitStatusImpl: () => ' M package.json\n M package-lock.json\n M src/ds/Button.catalog.tsx\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['src/ds/Button.catalog.tsx']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: a renamed package.json stays dirty even when its content would otherwise prove a safe bump', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package.json': hermexHeadPackageJson() };
  const workingByPath: Record<string, string> = { 'package.json': hermexWorkingPackageJson('0.4.0') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    // `git status --porcelain`'s rename code ("R ") — never a plain modification, regardless of
    // what the content proof alone would conclude.
    gitStatusImpl: () => 'R  old-name.json -> package.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package.json']);
  rmSync(dir, { recursive: true, force: true });
});

test('buildUpdatePlan: an untracked package-lock.json stays dirty even when its content would otherwise prove a safe bump', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-plan-'));
  const headByPath: Record<string, string> = { 'package-lock.json': hermexLock('0.3.0') };
  const workingByPath: Record<string, string> = { 'package-lock.json': hermexLock('0.4.0') };
  const plan = await buildUpdatePlan(baseConfig(dir), '0.4.0', {
    execImpl: fakeExec(), fetchImpl: fakeFetchWithRelease,
    // `git status --porcelain`'s untracked code ("??") — never a plain modification.
    gitStatusImpl: () => '?? package-lock.json\n',
    gitShowImpl: (_root: string, p: string) => headByPath[p],
    readWorkingFileImpl: (_root: string, p: string) => workingByPath[p],
  });
  if ('error' in plan) throw new Error('unreachable');
  assert.deepEqual(plan.dirtyFiles, ['package-lock.json']);
  rmSync(dir, { recursive: true, force: true });
});

// Important finding, consolidated correction pass: `HEAD:${filePath}` resolves relative to the
// repository root, not `projectRoot` — only a `./`-prefixed pathspec is cwd-relative. A project
// in a subdirectory must read its *own* file at HEAD, never one with the same name at the repo
// root.
test('defaultGitShow and defaultReadWorkingFile resolve the subdirectory project\'s own file, never the repo root\'s same-named one', () => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot });

  const rootPackageJson = JSON.stringify({ name: 'repo-root-package' });
  writeFileSync(path.join(repoRoot, 'package.json'), rootPackageJson);

  const projectRoot = path.join(repoRoot, 'apps', 'mobile');
  mkdirSync(projectRoot, { recursive: true });
  const subprojectPackageJson = JSON.stringify({ name: 'subproject-package' });
  writeFileSync(path.join(projectRoot, 'package.json'), subprojectPackageJson);

  execFileSync('git', ['add', '-A'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repoRoot });

  assert.equal(defaultGitShow(projectRoot, 'package.json'), subprojectPackageJson);
  assert.equal(defaultReadWorkingFile(projectRoot, 'package.json'), subprojectPackageJson);
  assert.equal(defaultReadWorkingFile(projectRoot, 'missing.json'), undefined);

  rmSync(repoRoot, { recursive: true, force: true });
});

// Minor finding, successor review: `execFileSync` defaults to a 1 MiB `maxBuffer` — a committed
// file over that size must still come back in full, not truncated or thrown as ENOBUFS.
test('defaultGitShow returns a committed file over execFileSync\'s 1 MiB default maxBuffer in full', () => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot });

  const filler = 'x'.repeat(2 * 1024 * 1024);
  const bigPackageJson = JSON.stringify({ name: 'big-package', filler });
  writeFileSync(path.join(repoRoot, 'package.json'), bigPackageJson);
  execFileSync('git', ['add', '-A'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repoRoot });

  const result = defaultGitShow(repoRoot, 'package.json');
  assert.equal(result?.length, bigPackageJson.length);
  assert.equal(result, bigPackageJson);

  rmSync(repoRoot, { recursive: true, force: true });
});

// Minor finding, successor review: the repo-root layout (`git rev-parse --show-prefix` empty) has
// no assertion of its own — only the subdirectory layout above does.
test('defaultGitShow resolves the repository root\'s own file when the project is the repo root, and returns undefined for a missing file', () => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'ds-viewer-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot });

  const rootPackageJson = JSON.stringify({ name: 'repo-root-package' });
  writeFileSync(path.join(repoRoot, 'package.json'), rootPackageJson);
  execFileSync('git', ['add', '-A'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repoRoot });

  assert.equal(defaultGitShow(repoRoot, 'package.json'), rootPackageJson);
  assert.equal(defaultGitShow(repoRoot, 'missing.json'), undefined);

  rmSync(repoRoot, { recursive: true, force: true });
});

test('stripRepoPrefix: strips the repo-root prefix from a plain path and from both sides of a rename', () => {
  const porcelain = ' M apps/mobile/package.json\nR  apps/mobile/old-name.json -> apps/mobile/package-lock.json\n';
  assert.equal(
    stripRepoPrefix(porcelain, 'apps/mobile/'),
    ' M package.json\nR  old-name.json -> package-lock.json\n',
  );
});

test('stripRepoPrefix: a project at the repository root (empty prefix) returns the porcelain output unchanged', () => {
  const porcelain = ' M package.json\n';
  assert.equal(stripRepoPrefix(porcelain, ''), porcelain);
});
