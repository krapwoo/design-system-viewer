import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { clippedSpecimenIssues, headOverlapIssues, HEAD_OVERLAP_SCRIPT, identicalVariantIssues, issuesFromPage, loadProjectPuppeteer, NARROW_VIEWPORT, renderCheck, RENDER_UNAVAILABLE, stopDev } from '../render.ts';

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

test('a TokenGrid order warning is a token-grid-order warning, reported once per page', () => {
  const seen = new Set<string>();
  const warning = { type: 'warn', text: '[Catalog] TokenGrid order: "4pt" comes after "17pt". Order tiles smallest to largest, or set order="authored" on the TokenGrid if this order is deliberate.' };
  const first = issuesFromPage({ id: 'Radius', file: 'x/Radius.catalog.tsx' }, [warning, warning], true, seen);
  assert.deepEqual(first.map((i) => [i.id, i.severity, i.page, i.file]), [['token-grid-order', 'warning', 'Radius', 'x/Radius.catalog.tsx']]);
  assert.equal(first[0].message, '"4pt" comes after "17pt". Order tiles smallest to largest, or set order="authored" on the TokenGrid if this order is deliberate.');
  assert.match(first[0].fix ?? '', /smallest to largest/);
  assert.equal(issuesFromPage({ id: 'Spacing' }, [warning], true, seen).length, 1, 'another page with the same problem is its own finding');
  assert.equal(issuesFromPage({ id: 'Radius' }, [warning], true, seen).length, 0);
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
    settleMs: 0, deps: { puppeteer: { launch: async () => { throw new Error('Could not find Chrome (ver. 131)'); } }, startDev: async () => { started = true; return startedDev(); }, stopDev: () => {} },
  });
  assert.deepEqual(issues.map((i) => [i.id, i.fix]), [['render-unavailable', 'npx puppeteer browsers install chrome']]);
  assert.equal(started, false);
});

test('no sidebar links is render-failed; a malformed link falls back to its raw text instead of failing the run', async () => {
  const none = await renderCheck('/tmp/x', { settleMs: 0, deps: { puppeteer: { launch: async () => fakeBrowser([]) }, startDev: startedDev, stopDev: () => {} } });
  assert.deepEqual(none.map((i) => i.id), ['render-failed']);
  const odd = await renderCheck('/tmp/x', { settleMs: 0, deps: { puppeteer: { launch: async () => fakeBrowser(['#Button', '#50%']) }, startDev: startedDev, stopDev: () => {} } });
  assert.deepEqual(odd, []);
});

test('one page failing is reported for that page; the other pages are still checked', async () => {
  const issues = await renderCheck('/tmp/x', {
    files: new Map([['Dialog', 'x/Dialog.catalog.tsx']]),
    settleMs: 0,
    settleMs: 0, deps: { puppeteer: { launch: async () => fakeBrowser(['#Button', '#Dialog', '#Toast'], { Dialog: 'throw' }) }, startDev: startedDev, stopDev: () => {} },
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

test('identicalVariantIssues names both examples and the card they share', () => {
  const issues = identicalVariantIssues({ id: 'TokenSections', file: 'pages/TokenSections.catalog.tsx' }, [
    { card: 'TokenSections: Variants', names: ['Two columns', 'Three columns, with a wide section'] },
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, 'identical-variants');
  assert.equal(issues[0].severity, 'warning');
  assert.equal(issues[0].page, 'TokenSections');
  assert.match(issues[0].message, /"Two columns" and "Three columns, with a wide section" render identically/);
  assert.match(issues[0].fix, /wider specimenSize/);
  assert.deepEqual(identicalVariantIssues({ id: 'X' }, []), []);
});

test('clippedSpecimenIssues names the example, the distance and the side', () => {
  const issues = clippedSpecimenIssues({ id: 'Tooltip', file: 'components/Tooltip/Tooltip.catalog.tsx' }, [
    { name: 'Placement: bottom', overflow: 234, side: 'left' },
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, 'specimen-clipped');
  assert.equal(issues[0].severity, 'warning');
  assert.equal(issues[0].page, 'Tooltip');
  assert.match(issues[0].message, /"Placement: bottom" paints 234px past the left of its cell/);
  // The message has to say why this is a finding when PillRow's scrolling row is not.
  assert.match(issues[0].message, /cut off rather than scrollable/);
  assert.match(issues[0].fix, /itemsFill/);
  assert.deepEqual(clippedSpecimenIssues({ id: 'X' }, []), []);
});

test('a clipped specimen with no caption still reports', () => {
  // Cells in a token grid have no caption strip; the finding must still name the page and distance
  // rather than render as an empty pair of quotes.
  const [issue] = clippedSpecimenIssues({ id: 'Radius' }, [{ name: '', overflow: 12, side: 'right' }]);
  assert.match(issue.message, /^An example paints 12px past the right of its cell/);
});

test('a failing identical-variants script is advisory, not a render-error for the page', async () => {
  // The heading check answers, then the injected script throws — as it could on a detached child
  // document. An advisory check must not become this page's error.
  const browser = {
    newPage: async () => {
      let call = 0;
      return {
        setViewport: async () => {},
        on: () => {},
        goto: async () => {},
        evaluate: async (arg: unknown) => {
          call += 1;
          if (call === 1) return ['#Button'];
          if (typeof arg === 'string' && arg.includes('fingerprint')) throw new Error('Execution context was destroyed');
          return true;
        },
        close: async () => {},
      };
    },
    close: async () => {},
  };
  const issues = await renderCheck('/tmp/x', {
    settleMs: 0,
    deps: { puppeteer: { launch: async () => browser }, startDev: startedDev, stopDev: () => {} },
  });
  assert.deepEqual(issues, []);
});

test('renderCheck turns a clipped specimen into an issue, and a throwing clip script is advisory', async () => {
  // The rule's own script runs in the browser and cannot be unit-tested here, but the wiring can:
  // a page that reports a clipped specimen must reach the findings, and a script that throws must
  // cost the page nothing — the same contract the identical-variants pass has.
  const pageFor = (clipped: unknown) => ({
    setViewport: async () => {},
    on: () => {},
    goto: async () => {},
    evaluate: async (arg: unknown, ...rest: unknown[]) => {
      if (typeof arg !== 'string') return true; // the heading probe is a function
      if (arg.includes('fingerprint')) return [];
      if (arg.includes('CONTAINS')) {
        if (clipped instanceof Error) throw clipped;
        return clipped;
      }
      return rest.length ? true : ['#Button'];
    },
    close: async () => {},
  });
  const run = async (clipped: unknown) => {
    let first = true;
    const browser = {
      newPage: async () => {
        if (first) {
          first = false;
          return { ...pageFor(clipped), evaluate: async () => ['#Button'] };
        }
        return pageFor(clipped);
      },
      close: async () => {},
    };
    return renderCheck('/tmp/x', {
      settleMs: 0,
      deps: { puppeteer: { launch: async () => browser }, startDev: startedDev, stopDev: () => {} },
    });
  };

  const reported = await run([{ name: 'Placement: bottom', overflow: 34, side: 'left' }]);
  const clip = reported.find((i) => i.id === 'specimen-clipped');
  assert.ok(clip, 'a clipped specimen must reach the findings');
  assert.match(clip!.message, /34px past the left/);

  assert.deepEqual((await run(new Error('Execution context was destroyed'))).filter((i) => i.id === 'specimen-clipped'), []);
});

// Issue #51: a page title that is one unbroken identifier kept its full intrinsic width at an
// 800px window and painted through its own column into the pager, covering the `←` button by
// 14x22. Every one of a consumer's 61 failures paired the page heading with `←` or `→`, and none
// appeared at 1280 — the width every other render check runs at, which is why nothing caught it.
test('headOverlapIssues names what covers the heading, by how much, and the width it was seen at', () => {
  const issues = headOverlapIssues(
    { id: 'TranscriptMediaUnavailableChip', file: 'components/Chip/Chip.catalog.tsx' },
    [{ other: '\u2190', w: 14, h: 22 }],
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, 'page-head-overlap');
  assert.equal(issues[0].severity, 'error');
  assert.equal(issues[0].page, 'TranscriptMediaUnavailableChip');
  assert.equal(issues[0].file, 'components/Chip/Chip.catalog.tsx');
  assert.match(issues[0].message, /heading is covered by "\u2190" over 14x22px/);
  assert.match(issues[0].message, new RegExp(`At ${NARROW_VIEWPORT.width}px`));
});

test('headOverlapIssues reports nothing when the heading is clear', () => {
  assert.deepEqual(headOverlapIssues({ id: 'X' }, []), []);
});

test("the narrow viewport is Puppeteer's own default, the width a consumer smoke check judges a catalog at", () => {
  assert.deepEqual({ ...NARROW_VIEWPORT }, { width: 800, height: 600 });
});

// The script runs in a browser, so it is exercised here against a minimal fake DOM: enough of
// querySelector/getBoundingClientRect/getComputedStyle for the measurement rule itself, which is
// the part that decides whether a real overlap is reported or missed. `contains` is wired against
// the mapped nodes, not the literals, so the heading-descendant guard is genuinely exercised —
// wiring it against the literals silently makes `contains` always false and leaves that guard
// untested while every assertion still passes.
function runHeadOverlapScript(nodes: Array<Record<string, any>>) {
  const mapped = nodes.map((n) => ({
    isHeading: Boolean(n.isHeading),
    children: [] as unknown[],
    parentElement: null,
    textContent: n.text ?? '',
    getBoundingClientRect: () => n.rect,
    contains(this: any, o: unknown) { return o === this || (this.__kids ?? []).includes(o); },
    __kids: [] as unknown[],
  }));
  nodes.forEach((n, i) => {
    if (typeof n.childOf === 'number') mapped[n.childOf].__kids.push(mapped[i]);
  });
  const heading = mapped.find((n) => n.isHeading);
  const document = {
    querySelector: (s: string) => (s === '[role="heading"]' ? heading : null),
    querySelectorAll: () => mapped,
  };
  const getComputedStyle = () => ({ overflowX: 'visible', overflowY: 'visible' });
  return Function('document', 'getComputedStyle', `return ${HEAD_OVERLAP_SCRIPT};`)(document, getComputedStyle);
}

test("a 1px seam between the heading and its neighbour is not an overlap, but the issue's own 14x22 is", () => {
  const heading = { isHeading: true, text: 'TranscriptMediaUnavailableChip', rect: { left: 0, top: 50, right: 300, bottom: 84, width: 300, height: 34 } };
  const seam = [heading, { text: '\u2190', rect: { left: 299.5, top: 50, right: 331, bottom: 82, width: 31, height: 32 } }];
  assert.deepEqual(runHeadOverlapScript(seam), [], 'a sub-pixel seam between neighbours must not be reported');
  const real = [heading, { text: '\u2190', rect: { left: 286, top: 62, right: 318, bottom: 94, width: 32, height: 32 } }];
  const [hit] = runHeadOverlapScript(real);
  assert.equal(hit.other, '\u2190');
  assert.equal(hit.w, 14);
  assert.equal(hit.h, 22);
});

test("the heading's own text child is never reported as covering the heading", () => {
  const heading = { isHeading: true, text: 'TranscriptMediaUnavailableChip', rect: { left: 0, top: 50, right: 300, bottom: 84, width: 300, height: 34 } };
  // The heading View and the Text inside it share almost the same box by construction.
  const child = { text: 'TranscriptMediaUnavailableChip', childOf: 0, rect: { left: 0, top: 50, right: 300, bottom: 84, width: 300, height: 34 } };
  assert.deepEqual(runHeadOverlapScript([heading, child]), [], "a heading's own descendant must never be reported as painting over it");
});

// Mutation-checked gap: the resize itself runs only under a real browser, so deleting it leaves
// every unit test passing while `check:catalog` silently returns to measuring at 1280 only — the
// width issue #51 never reproduced at. Same source-assertion pattern comparison.test.ts and
// sectionHeader.test.ts already use for wiring a unit test cannot reach.
test('renderCheck resizes to the narrow viewport before it measures the heading', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../render.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const resize = source.indexOf('setViewport({ width: NARROW_VIEWPORT.width');
  const measure = source.indexOf('evaluate(HEAD_OVERLAP_SCRIPT)');
  assert.ok(resize > 0, 'renderCheck must set NARROW_VIEWPORT before measuring the page head');
  assert.ok(measure > 0, 'renderCheck must evaluate HEAD_OVERLAP_SCRIPT');
  assert.ok(resize < measure, 'the narrow viewport must be applied before the heading is measured, or the check runs at the width the bug never appears at');
});
