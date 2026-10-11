import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { issuesFromPage, loadProjectPuppeteer, renderCheck, RENDER_UNAVAILABLE, stopDev } from '../render.ts';

test('console errors and a missing heading are errors; overflow warnings are render-layout; other [Catalog] warnings are render-catalog-warning; noise is ignored', () => {
  const seen = new Set<string>();
  const issues = issuesFromPage({ id: 'Checkbox', file: 'x/Checkbox.catalog.tsx' }, [
    { type: 'error', text: 'Boom\n  at x' },
    { type: 'error', text: 'Boom\n  at y' },
    { type: 'warn', text: "[Catalog] Checkbox (a) is 166px wide in a 142px cell, so it's cut off." },
    { type: 'warning', text: "[Catalog] Checkbox (a) is 166px wide in a 142px cell, so it's cut off." },
    { type: 'warn', text: '[Catalog] Toast: composedOf references unknown component "Icon".' },
    { type: 'warn', text: '"shadow*" style props are deprecated. Use "boxShadow".' },
    { type: 'log', text: 'Running application' },
  ], false, seen);
  assert.deepEqual(issues.map((i) => [i.id, i.severity]), [
    ['render-no-heading', 'error'], ['render-error', 'error'], ['render-layout', 'warning'], ['render-catalog-warning', 'warning'],
  ]);
  assert.equal(issues[2].message, "Checkbox (a) is 166px wide in a 142px cell, so it's cut off.");
  assert.equal(issues[0].file, 'x/Checkbox.catalog.tsx');
});

test('a [Catalog] warning repeated on later pages is reported once, on the first page', () => {
  const seen = new Set<string>();
  const warning = { type: 'warn', text: '[Catalog] Page id "X" is used by more than one page.' };
  assert.equal(issuesFromPage({ id: 'A' }, [warning], true, seen).length, 1);
  assert.equal(issuesFromPage({ id: 'B' }, [warning], true, seen).length, 0);
});

test('without a browser installed in the project, render reports one clear error and starts nothing', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-render-'));
  writeFileSync(path.join(dir, 'package.json'), '{"name":"x","private":true}');
  assert.equal(loadProjectPuppeteer(dir), undefined);
  assert.deepEqual(await renderCheck(dir), [RENDER_UNAVAILABLE]);
  // A relative root is resolved, not mistaken for a missing browser.
  const relative = path.relative(process.cwd(), dir);
  assert.deepEqual(await renderCheck(relative), [RENDER_UNAVAILABLE]);
  rmSync(dir, { recursive: true, force: true });
});

// A fake browser whose pages answer from a script: `links` on the landing page, and per-id behaviour.
function fakeBrowser(links: string[], perPage: Record<string, 'ok' | 'throw'> = {}) {
  let landing = true;
  return {
    newPage: async () => {
      const isLanding = landing;
      landing = false;
      let id = '';
      return {
        setViewport: async () => {},
        on: () => {},
        goto: async (url: string) => {
          id = decodeURIComponent(url.split('#')[1] ?? '');
          if (perPage[id] === 'throw') throw new Error(`Navigation timeout for ${id}`);
        },
        evaluate: async () => (isLanding ? links : true),
        close: async () => {},
      };
    },
    close: async () => {},
  };
}
const fakeChild = () => Object.assign(new EventEmitter(), { pid: 4242, stdout: null, stderr: null, unref: () => {} });
const startedDev = async () => ({ child: fakeChild() as never, port: 5199 });

test('a browser that fails to launch is render-unavailable with the install command, and dev never starts', async () => {
  let started = false;
  const issues = await renderCheck('/tmp/x', {
    deps: { puppeteer: { launch: async () => { throw new Error('Could not find Chrome (ver. 131)'); } }, startDev: async () => { started = true; return startedDev(); }, stopDev: () => {} },
  });
  assert.deepEqual(issues.map((i) => [i.id, i.fix]), [['render-unavailable', 'npx puppeteer browsers install chrome']]);
  assert.equal(started, false);
});

test('no sidebar links is render-failed; a malformed link falls back to its raw text instead of failing the run', async () => {
  const none = await renderCheck('/tmp/x', { deps: { puppeteer: { launch: async () => fakeBrowser([]) }, startDev: startedDev, stopDev: () => {} } });
  assert.deepEqual(none.map((i) => i.id), ['render-failed']);
  const odd = await renderCheck('/tmp/x', { deps: { puppeteer: { launch: async () => fakeBrowser(['#Button', '#50%']) }, startDev: startedDev, stopDev: () => {} } });
  assert.deepEqual(odd, []);
});

test('one page failing is reported for that page; the other pages are still checked', async () => {
  const issues = await renderCheck('/tmp/x', {
    files: new Map([['Dialog', 'x/Dialog.catalog.tsx']]),
    deps: { puppeteer: { launch: async () => fakeBrowser(['#Button', '#Dialog', '#Toast'], { Dialog: 'throw' }) }, startDev: startedDev, stopDev: () => {} },
  });
  assert.deepEqual(issues.map((i) => [i.id, i.page, i.file]), [['render-error', 'Dialog', 'x/Dialog.catalog.tsx']]);
  assert.match(issues[0].message, /Navigation timeout/);
});

test('a signal while dev is still starting stops the spawned child, and exits with the signal\'s own code', async () => {
  const child = fakeChild();
  const stopped: unknown[] = [];
  const exits: number[] = [];
  let release!: () => void;
  const run = renderCheck('/tmp/x', {
    deps: {
      puppeteer: { launch: async () => fakeBrowser([]) },
      startDev: (_root: string, onSpawn: (c: never) => void) => {
        onSpawn(child as never);
        return new Promise((_resolve, reject) => { release = () => reject(new Error('stopped')); });
      },
      stopDev: (c: unknown) => { stopped.push(c); },
      exit: (code: number) => { exits.push(code); },
    },
  });
  await new Promise((r) => setTimeout(r, 20));
  process.emit('SIGHUP');
  release();
  await run;
  assert.deepEqual(exits, [129]);
  assert.ok(stopped.includes(child));
});

test('stopDev kills the whole tree on Windows and the whole process group elsewhere, then releases the pipes', () => {
  const calls: string[] = [];
  const child = { pid: 77, stdout: { destroy: () => calls.push('stdout') }, stderr: { destroy: () => calls.push('stderr') }, unref: () => calls.push('unref') };
  stopDev(child as never, { platform: 'win32', spawnSync: ((cmd: string, args: string[]) => { calls.push(`${cmd} ${args.join(' ')}`); return {} as never; }) as never, kill: () => calls.push('kill') });
  assert.deepEqual(calls, ['taskkill /pid 77 /T /F', 'stdout', 'stderr', 'unref']);
  calls.length = 0;
  stopDev(child as never, { platform: 'linux', kill: (pid: number, sig: string) => { calls.push(`kill ${pid} ${sig}`); } });
  assert.deepEqual(calls, ['kill -77 SIGTERM', 'stdout', 'stderr', 'unref']);
});
