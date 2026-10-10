// cli/__tests__/versionStatus.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildVersionStatus, preferencesDirFor, readPersonalAutoCheck, resolveAutoCheck, runUpdateCheck, writePersonalAutoCheck,
} from '../updateCheck.ts';

const REGISTRY = 'https://registry.npmjs.org/@krapwoo%2Fds-viewer/latest';
const release = (v: string) => `https://api.github.com/repos/krapwoo/design-system-viewer/releases/tags/v${v}`;

function fakeFetch(latest: string | Error): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl = (async (url: string | URL) => {
    calls.push(String(url));
    if (latest instanceof Error) throw latest;
    if (String(url) === REGISTRY) return { ok: true, json: async () => ({ version: latest }) } as unknown as Response;
    if (String(url) === release(latest)) return { ok: true, json: async () => ({ body: '- One thing', published_at: '2026-10-10T00:00:00Z' }) } as unknown as Response;
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const tmp = (name: string) => mkdtempSync(path.join(tmpdir(), `ds-viewer-${name}-`));

test('preferencesDirFor: a settings folder, not the cache folder the OS may clear', () => {
  assert.equal(preferencesDirFor('darwin', {}, '/Users/w'), '/Users/w/Library/Application Support/ds-viewer');
  assert.equal(preferencesDirFor('linux', { XDG_CONFIG_HOME: '/x' }, '/home/w'), '/x/ds-viewer');
  assert.equal(preferencesDirFor('linux', {}, '/home/w'), '/home/w/.config/ds-viewer');
  assert.equal(preferencesDirFor('win32', { APPDATA: 'C:\\Users\\w\\AppData\\Roaming' }, 'C:\\Users\\w'), 'C:\\Users\\w\\AppData\\Roaming\\ds-viewer');
});

test('the personal switch is saved per project and never touches another project', () => {
  const dir = tmp('prefs');
  assert.equal(readPersonalAutoCheck(dir, '/work/skiffr'), undefined);
  writePersonalAutoCheck(dir, '/work/skiffr', true);
  writePersonalAutoCheck(dir, '/work/other', false);
  assert.equal(readPersonalAutoCheck(dir, '/work/skiffr'), true);
  assert.equal(readPersonalAutoCheck(dir, '/work/other'), false);
  writePersonalAutoCheck(dir, '/work/skiffr', false);
  assert.equal(readPersonalAutoCheck(dir, '/work/skiffr'), false);
  assert.equal(readPersonalAutoCheck(dir, '/work/other'), false);
  rmSync(dir, { recursive: true, force: true });
});

test('a corrupt preferences file reads as "no personal setting" instead of throwing', () => {
  const dir = tmp('prefs');
  writeFileSync(path.join(dir, 'preferences.json'), '{not json');
  assert.equal(readPersonalAutoCheck(dir, '/work/skiffr'), undefined);
  writePersonalAutoCheck(dir, '/work/skiffr', true);
  assert.equal(readPersonalAutoCheck(dir, '/work/skiffr'), true);
  rmSync(dir, { recursive: true, force: true });
});

test('resolveAutoCheck: CI env wins, then your switch, then the project config, then on by default', () => {
  const ci = { DS_VIEWER_NO_UPDATE_CHECK: '1' };
  assert.deepEqual(resolveAutoCheck({ updateCheck: true }, ci, true), { enabled: false, source: 'env' });
  assert.deepEqual(resolveAutoCheck({ updateCheck: false }, {}, true), { enabled: true, source: 'personal' });
  assert.deepEqual(resolveAutoCheck({ updateCheck: true }, {}, false), { enabled: false, source: 'personal' });
  assert.deepEqual(resolveAutoCheck({ updateCheck: false }, {}, undefined), { enabled: false, source: 'project' });
  assert.deepEqual(resolveAutoCheck({ updateCheck: true }, {}, undefined), { enabled: true, source: 'project' });
  assert.deepEqual(resolveAutoCheck({}, {}, undefined), { enabled: true, source: 'default' });
});

test('runUpdateCheck: an unreachable registry reports "unreachable", not "no update"', async () => {
  const cacheDir = tmp('cache');
  const { fetchImpl } = fakeFetch(new Error('offline'));
  const outcome = await runUpdateCheck('0.4.4', { cacheDir, fetchImpl });
  assert.equal(outcome.reached, false);
  assert.equal(outcome.result, undefined);
  rmSync(cacheDir, { recursive: true, force: true });
});

test('runUpdateCheck: force skips a fresh cache and asks npm again (Check now)', async () => {
  const cacheDir = tmp('cache');
  writeFileSync(path.join(cacheDir, 'update-check.json'), JSON.stringify({ latest: '0.4.4', summary: [], checkedAt: new Date().toISOString() }));
  const { fetchImpl, calls } = fakeFetch('0.4.5');
  const cached = await runUpdateCheck('0.4.4', { cacheDir, fetchImpl });
  assert.equal(calls.length, 0, 'a fresh cache answers without a request');
  assert.equal(cached.result, undefined);
  const forced = await runUpdateCheck('0.4.4', { cacheDir, fetchImpl, force: true });
  assert.equal(calls[0], REGISTRY);
  assert.equal(forced.reached, true);
  assert.equal(forced.result?.latest, '0.4.5');
  assert.equal(JSON.parse(readFileSync(path.join(cacheDir, 'update-check.json'), 'utf8')).latest, '0.4.5');
  rmSync(cacheDir, { recursive: true, force: true });
});

test('buildVersionStatus: checks off never runs a check, and still reports the last check known on this computer', async () => {
  const cacheDir = tmp('cache');
  writeFileSync(path.join(cacheDir, 'update-check.json'), JSON.stringify({ latest: '0.4.5', summary: [], checkedAt: '2026-10-07T00:00:00Z' }));
  const { fetchImpl, calls } = fakeFetch('0.4.6');
  const status = await buildVersionStatus('0.4.4', { enabled: false, source: 'project' }, { cacheDir, fetchImpl });
  assert.equal(calls.length, 0);
  assert.deepEqual(
    { current: status.current, autoCheck: status.autoCheck, lastCheckedAt: status.lastCheckedAt, lastOutcome: status.lastOutcome, update: status.update },
    { current: '0.4.4', autoCheck: { enabled: false, source: 'project' }, lastCheckedAt: '2026-10-07T00:00:00Z', lastOutcome: 'not-run', update: null },
  );
  rmSync(cacheDir, { recursive: true, force: true });
});

test('buildVersionStatus: checks on reports the update, or "unreachable" when npm does not answer', async () => {
  const cacheDir = tmp('cache');
  const ok = await buildVersionStatus('0.4.4', { enabled: true, source: 'default' }, { cacheDir, fetchImpl: fakeFetch('0.4.5').fetchImpl });
  assert.equal(ok.lastOutcome, 'ok');
  assert.equal(ok.update?.latest, '0.4.5');
  assert.deepEqual(ok.update?.summary, ['One thing']);
  assert.ok(ok.lastCheckedAt);
  rmSync(cacheDir, { recursive: true, force: true });

  const emptyCache = tmp('cache');
  const down = await buildVersionStatus('0.4.4', { enabled: true, source: 'default' }, { cacheDir: emptyCache, fetchImpl: fakeFetch(new Error('offline')).fetchImpl });
  assert.equal(down.lastOutcome, 'unreachable');
  assert.equal(down.update, null);
  assert.equal(down.lastCheckedAt, undefined);
  rmSync(emptyCache, { recursive: true, force: true });
});
