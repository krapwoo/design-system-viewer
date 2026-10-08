// cli/__tests__/updateCheck.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  cacheDirFor, checkForUpdate, isCacheFresh, isUpdateCheckEnabled, readCache, writeUpdateFile,
  type UpdateCheckResult,
} from '../updateCheck.ts';

test('cacheDirFor: macOS uses ~/Library/Caches/ds-viewer', () => {
  assert.equal(cacheDirFor('darwin', {}, '/Users/x'), '/Users/x/Library/Caches/ds-viewer');
});

test('cacheDirFor: Linux prefers XDG_CACHE_HOME when set', () => {
  assert.equal(cacheDirFor('linux', { XDG_CACHE_HOME: '/custom/cache' }, '/home/x'), '/custom/cache/ds-viewer');
});

test('cacheDirFor: Linux falls back to ~/.cache without XDG_CACHE_HOME', () => {
  assert.equal(cacheDirFor('linux', {}, '/home/x'), '/home/x/.cache/ds-viewer');
});

test('cacheDirFor: Windows uses %LOCALAPPDATA%', () => {
  assert.equal(cacheDirFor('win32', { LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }, 'C:\\Users\\x'), 'C:\\Users\\x\\AppData\\Local\\ds-viewer');
});

test('readCache returns undefined when the cache file does not exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  assert.equal(readCache(dir), undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('readCache returns undefined for corrupt JSON instead of throwing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  writeFileSync(path.join(dir, 'update-check.json'), '{not json');
  assert.equal(readCache(dir), undefined);
  rmSync(dir, { recursive: true, force: true });
});

const SAMPLE: UpdateCheckResult = { current: '0.4.0', latest: '0.5.0', breaking: false, summary: [], checkedAt: '2026-10-08T00:00:00.000Z' };

test('isCacheFresh is true within 24 hours and false after', () => {
  const checkedAt = Date.parse(SAMPLE.checkedAt);
  assert.equal(isCacheFresh(SAMPLE, checkedAt + 23 * 60 * 60 * 1000), true);
  assert.equal(isCacheFresh(SAMPLE, checkedAt + 25 * 60 * 60 * 1000), false);
});

test('isUpdateCheckEnabled: false when config.updateCheck is false', () => {
  assert.equal(isUpdateCheckEnabled({ updateCheck: false }, {}), false);
});

test('isUpdateCheckEnabled: false when DS_VIEWER_NO_UPDATE_CHECK=1, even with config.updateCheck true', () => {
  assert.equal(isUpdateCheckEnabled({ updateCheck: true }, { DS_VIEWER_NO_UPDATE_CHECK: '1' }), false);
});

test('isUpdateCheckEnabled: true by default', () => {
  assert.equal(isUpdateCheckEnabled({ updateCheck: true }, {}), true);
  assert.equal(isUpdateCheckEnabled({}, {}), true);
});

function fakeFetch(responses: Record<string, { ok: boolean; json: () => Promise<unknown> }>): typeof fetch {
  return (async (url: string | URL) => {
    const entry = responses[String(url)];
    if (!entry) throw new Error(`Unexpected fetch: ${url}`);
    return entry as unknown as Response;
  }) as typeof fetch;
}

test('checkForUpdate returns the fresh cache without making any request', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  writeFileSync(path.join(dir, 'update-check.json'), JSON.stringify({ ...SAMPLE, checkedAt: new Date().toISOString() }));
  const fetchImpl = (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
  const result = await checkForUpdate('0.4.0', { cacheDir: dir, fetchImpl });
  assert.equal(result?.latest, '0.5.0');
  rmSync(dir, { recursive: true, force: true });
});

test('checkForUpdate fetches both requests on a cache miss and writes the cache', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  const fetchImpl = fakeFetch({
    'https://registry.npmjs.org/@krapwoo%2Fds-viewer/latest': { ok: true, json: async () => ({ version: '0.5.0' }) },
    'https://api.github.com/repos/krapwoo/design-system-viewer/releases/tags/v0.5.0': {
      ok: true, json: async () => ({ body: '- Faster sync\n- New Tabs component\n\nSome prose that is not a bullet.', published_at: '2026-10-06T00:00:00Z' }),
    },
  });
  const result = await checkForUpdate('0.4.0', { cacheDir: dir, fetchImpl });
  assert.deepEqual(result?.summary, ['Faster sync', 'New Tabs component']);
  assert.equal(result?.breaking, false);
  assert.equal(result?.releasedAt, '2026-10-06T00:00:00Z');
  const cached = JSON.parse(readFileSync(path.join(dir, 'update-check.json'), 'utf8'));
  assert.equal(cached.latest, '0.5.0');
  rmSync(dir, { recursive: true, force: true });
});

test('checkForUpdate is silent (resolves undefined) when the registry request fails and there is no cache', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  const fetchImpl = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  const result = await checkForUpdate('0.4.0', { cacheDir: dir, fetchImpl });
  assert.equal(result, undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('checkForUpdate aborts the registry request after its own timeout instead of hanging', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  const fetchImpl = ((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
  const start = Date.now();
  const result = await checkForUpdate('0.4.0', { cacheDir: dir, fetchImpl, timeoutMs: 20 });
  assert.ok(Date.now() - start < 500, 'must not hang waiting for a request that never resolves');
  assert.equal(result, undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('checkForUpdate still returns a result when only the GitHub release request fails (summary stays empty)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  const fetchImpl = (async (url: string) => {
    if (String(url).includes('registry.npmjs.org')) return { ok: true, json: async () => ({ version: '0.5.0' }) } as unknown as Response;
    throw new Error('github unreachable');
  }) as unknown as typeof fetch;
  const result = await checkForUpdate('0.4.0', { cacheDir: dir, fetchImpl });
  assert.equal(result?.latest, '0.5.0');
  assert.deepEqual(result?.summary, []);
  rmSync(dir, { recursive: true, force: true });
});

test('writeUpdateFile writes null when there is no result', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-project-'));
  const file = writeUpdateFile(dir, undefined);
  assert.equal(readFileSync(file, 'utf8').trim(), 'null');
  rmSync(dir, { recursive: true, force: true });
});

test('writeUpdateFile writes the full result shape', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-project-'));
  const file = writeUpdateFile(dir, SAMPLE);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), SAMPLE);
  rmSync(dir, { recursive: true, force: true });
});

test('checkForUpdate resolves undefined when the cached/fetched latest is not newer than the current version (already up to date, or ahead of a registry that has not caught up yet)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  const fetchImpl = fakeFetch({
    'https://registry.npmjs.org/@krapwoo%2Fds-viewer/latest': { ok: true, json: async () => ({ version: '0.4.0' }) },
  });
  const result = await checkForUpdate('0.4.0', { cacheDir: dir, fetchImpl });
  assert.equal(result, undefined);
  rmSync(dir, { recursive: true, force: true });
});

// M5 (Minor, Fable correction pass): `checkForUpdate` is documented as never throwing — a cached
// `latest` that isn't valid semver (a corrupted write, or a cache from some future, differently
// shaped release) must not propagate `parseVersion`'s own throw up through `dev()`'s own `await`.
test('checkForUpdate resolves undefined, never throws, for a fresh cache whose "latest" is not valid semver', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  writeFileSync(path.join(dir, 'update-check.json'), JSON.stringify({ latest: 'not-a-version', summary: [], checkedAt: new Date().toISOString() }));
  const fetchImpl = (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
  const result = await checkForUpdate('0.4.0', { cacheDir: dir, fetchImpl });
  assert.equal(result, undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('checkForUpdate overlays the current version it is called with onto a cache a different project wrote (the cache never carries current/breaking)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-cache-'));
  writeFileSync(path.join(dir, 'update-check.json'), JSON.stringify({ latest: '0.5.0', summary: [], checkedAt: new Date().toISOString() }));
  const fetchImpl = (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
  const result = await checkForUpdate('0.3.0', { cacheDir: dir, fetchImpl });
  assert.equal(result?.current, '0.3.0');
  assert.equal(result?.breaking, false);
  rmSync(dir, { recursive: true, force: true });
});
