import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { issuesFromPage, loadProjectPuppeteer, renderCheck, RENDER_UNAVAILABLE } from '../render.ts';

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
