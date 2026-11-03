import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { ANATOMY_BRACKET_GAP, ANATOMY_EDGE_GAP, anatomyPinCrowdedIssues, ANATOMY_PIN_CROWDED_SCRIPT, clippedSpecimenIssues, gridUnusedWidthIssues, GRID_UNUSED_WIDTH_SCRIPT, headOverlapIssues, HEAD_OVERLAP_SCRIPT, identicalVariantIssues, issuesFromPage, loadProjectPuppeteer, NARROW_VIEWPORT, renderCheck, RENDER_UNAVAILABLE, stopDev } from '../render.ts';

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

// `grid-unused-width`: a wrapping row of equal fixed-width tiles whose full rows leave a large share of
// the container empty while more tiles wrap. The script reads layout, so it runs here against fake
// elements that carry the rects and computed styles it asks for.
interface FakeCell { rect: { left: number; top: number; right: number; bottom: number; width: number; height: number }; grow?: number }
function cells(count: number, width: number, perRow: number, gap = 16, height = 120): FakeCell[] {
  return Array.from({ length: count }, (_, i) => {
    const left = (i % perRow) * (width + gap);
    const top = Math.floor(i / perRow) * (height + gap);
    return { rect: { left, top, right: left + width, bottom: top + height, width, height } };
  });
}
function runGridScript(kids: FakeCell[], container: { width?: number; wrap?: string; direction?: string; overflowX?: string } = {}) {
  const width = container.width ?? 1000;
  const rect = { left: 0, top: 0, right: width, bottom: 400, width, height: 400 };
  const styles = new Map<unknown, Record<string, string>>();
  const children = kids.map((k) => { const el = { getBoundingClientRect: () => k.rect, parentElement: null as unknown }; styles.set(el, { display: 'flex', flexGrow: String(k.grow ?? 0) }); return el; });
  const row = { children, getBoundingClientRect: () => rect, parentElement: { parentElement: null } as unknown };
  styles.set(row, { display: 'flex', flexWrap: container.wrap ?? 'wrap', flexDirection: container.direction ?? 'row', overflowX: container.overflowX ?? 'visible' });
  styles.set(row.parentElement, { display: 'block', overflowX: 'visible' });
  const document = { body: {}, querySelectorAll: () => [row] };
  const getComputedStyle = (el: unknown) => ({ visibility: 'visible', overflowX: 'visible', flexGrow: '0', ...(styles.get(el) ?? {}) });
  return Function('document', 'getComputedStyle', `return ${GRID_UNUSED_WIDTH_SCRIPT};`)(document, getComputedStyle) as Array<Record<string, number>>;
}

test('grid-unused-width: three 360px tiles wrapping two to a row in 1000px leave about a quarter empty', () => {
  const [hit] = runGridScript(cells(6, 360, 2));
  assert.ok(hit, 'fixed-width cells stranding space must be reported');
  assert.deepEqual([hit.tiles, hit.tileWidth, hit.width, hit.rows], [6, 360, 1000, 3]);
  assert.equal(hit.empty, 0.26);
  const [issue] = gridUnusedWidthIssues({ id: 'Motion', file: 'pages/Motion.catalog.tsx' }, [hit as never]);
  assert.equal(issue.id, 'grid-unused-width');
  assert.equal(issue.severity, 'warning');
  assert.equal(issue.page, 'Motion');
  assert.match(issue.message, /6 tiles of 360px wrap into 3 rows in a 1000px row, leaving 26%/);
  assert.match(issue.fix, /TokenGrid/);
});

test('grid-unused-width: rows that fill the container, single rows, narrow pages and growing or unequal cells are not reported', () => {
  assert.deepEqual(runGridScript(cells(8, 229, 4)), [], 'a row that is full (a TokenGrid fills it exactly) is fine');
  assert.deepEqual(runGridScript(cells(2, 360, 2)), [], 'a single row does not wrap');
  assert.deepEqual(runGridScript(cells(6, 360, 2), { width: 400 }), [], 'a narrow container is left alone');
  assert.deepEqual(runGridScript(cells(6, 480, 1)), [], 'one tile per row is a narrow page, not a stranded gap');
  assert.deepEqual(runGridScript(cells(6, 360, 2).map((k) => ({ ...k, grow: 1 }))), [], 'cells that grow fill the row');
  const unequal = cells(6, 360, 2);
  unequal[3] = { rect: { ...unequal[3].rect, width: 300, right: unequal[3].rect.left + 300 } };
  assert.deepEqual(runGridScript(unequal), [], 'chips and pills of different widths are not tiles');
  assert.deepEqual(runGridScript(cells(6, 360, 2), { wrap: 'nowrap' }), [], 'a row that does not wrap');
  assert.deepEqual(runGridScript(cells(6, 360, 2), { overflowX: 'auto' }), [], 'a scroller is the reader\'s to move');
  assert.deepEqual(runGridScript(cells(6, 100, 2)), [], 'small cells (chips) are not tiles');
});

test('renderCheck runs the grid-unused-width script on every page', () => {
  const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../render.ts'), 'utf8');
  assert.ok(source.includes('evaluate(GRID_UNUSED_WIDTH_SCRIPT)'), 'renderCheck must evaluate GRID_UNUSED_WIDTH_SCRIPT');
  assert.ok(source.includes('gridUnusedWidthIssues({ id, file'), 'its findings must reach the issues');
  // Measured at the wide viewport: after the narrow resize every wrapping row would look stranded.
  const measure = source.indexOf('evaluate(GRID_UNUSED_WIDTH_SCRIPT)');
  const resize = source.indexOf('setViewport({ width: NARROW_VIEWPORT.width');
  assert.ok(measure > 0 && resize > 0 && measure < resize, 'the grid check must run before the narrow resize');
  // The wiring is a source check like the narrow-viewport one above: a browser is not available to unit tests.
});

// `anatomy-pin-crowded`: pins that overlap each other or the picture's content, wherever they were
// placed. The script reads layout, so it runs against a small fake page whose elements carry the
// rects (and styles) it asks for.
type Box = { left: number; top: number; width: number; height: number };
const rectOf = (b: Box) => ({ left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height, width: b.width, height: b.height });
type Fake = {
  tag: string; testid?: string; box: Box; text?: string; style: Record<string, string>; children: Fake[]; parent?: Fake; rects?: Box[];
  nodeType?: number; hidden?: boolean; role?: string;
};
function fake(tag: string, box: Box, init: { testid?: string; text?: string; style?: Record<string, string>; children?: Fake[]; role?: string } = {}): Fake {
  const node: Fake = { tag, box, testid: init.testid, text: init.text, style: init.style ?? {}, children: init.children ?? [], role: init.role };
  for (const c of node.children) c.parent = node;
  return node;
}
const walk = (n: Fake): Fake[] => n.children.flatMap((c) => [c, ...walk(c)]);
const wrap = (n: Fake): Record<string, unknown> => {
  const el: Record<string, unknown> = {
    __fake: n,
    tagName: n.tag.toUpperCase(),
    getBoundingClientRect: () => rectOf(n.box),
    getAttribute: (name: string) => (name === 'data-testid' ? n.testid ?? null : name === 'role' ? n.role ?? null : null),
    get textContent() { return [n.text ?? '', ...n.children.map((c) => (wrap(c).textContent as string))].join(''); },
    get parentElement() { return n.parent ? wrap(n.parent) : null; },
    get children() { return n.children.map(wrap); },
    get childNodes() { return n.text ? [{ nodeType: 3, textContent: n.text, __fake: n }] : []; },
    querySelectorAll: (sel: string) => walk(n).filter((c) => select(c, sel)).map(wrap),
    querySelector: (sel: string) => { const found = walk(n).find((c) => select(c, sel)); return found ? wrap(found) : null; },
    closest: (sel: string) => { for (let c: Fake | undefined = n; c; c = c.parent) if (select(c, sel)) return wrap(c); return null; },
    contains: (other: { __fake: Fake }) => { for (let c: Fake | undefined = other.__fake; c; c = c.parent) if (c === n) return true; return false; },
  };
  return el;
};
const select = (n: Fake, sel: string) => (sel === '*' ? true : sel === 'svg' ? n.tag === 'svg' : sel === '[aria-hidden="true"]' ? n.hidden === true : sel === `[data-testid="${n.testid}"]`);
/** The picture: a stage holding `parts`. Returns the script's findings. */
function runPinScript(parts: Fake[], options: { rtl?: boolean; hidden?: boolean } = {}) {
  const stage = fake('div', { left: 0, top: 0, width: 600, height: 300 }, { testid: 'anatomy-stage', children: parts });
  stage.hidden = options.hidden;
  const document = {
    querySelectorAll: (sel: string) => (sel === '[data-testid="anatomy-stage"]' ? [wrap(stage)] : []),
    createRange: () => { let node: { __fake: Fake } | undefined; return { selectNodeContents: (n: { __fake: Fake }) => { node = n; }, getClientRects: () => (node ? (node.__fake.rects ?? [node.__fake.box]).map(rectOf) : []) }; },
  };
  const getComputedStyle = (el: { __fake: Fake }) => ({ display: 'block', visibility: 'visible', opacity: '1', direction: options.rtl ? 'rtl' : 'ltr', backgroundColor: 'rgba(0, 0, 0, 0)', ...el.__fake.style });
  return Function('document', 'getComputedStyle', `return ${ANATOMY_PIN_CROWDED_SCRIPT};`)(document, getComputedStyle) as Array<Record<string, unknown>>;
}
const pinAt = (left: number, top: number, text = '', width = 22) => fake('div', { left, top, width, height: 22 }, { testid: 'anatomy-pin', text });
const badgeAt = (pin: Fake) => { const b = fake('div', { left: pin.box.left + pin.box.width - 7, top: pin.box.top - 7, width: 14, height: 14 }); b.parent = pin; pin.children.push(b); return pin; };
const textAt = (left: number, top: number, width: number, text = 'Conversation') => fake('div', { left, top, width, height: 18 }, { text });
const braceAt = (left: number, top: number, height: number, testid?: string) => fake('div', { left, top, width: 3, height }, { testid, style: { borderLeftWidth: '2px', borderLeftStyle: 'solid', borderLeftColor: 'rgb(0, 0, 0)' } });
/** A lane beside a specimen that ends at x = 100: its pins and brackets are children of the layer. */
function lane(pins: Fake[], brackets: Fake[] = []) {
  const layer = fake('div', { left: 112, top: 0, width: 48, height: 200 }, { testid: 'anatomy-pin-layer', children: [...brackets, ...pins] });
  return fake('div', { left: 0, top: 0, width: 100, height: 200 }, { testid: 'anatomy-specimen-pins', children: [layer] });
}
const LANE_LEFT = 100 + ANATOMY_EDGE_GAP;

test('anatomy-pin-crowded: lane pins that overlap, hug the specimen or sit on a bracket are each reported', () => {
  const [overlap] = runPinScript([lane([pinAt(LANE_LEFT + 20, 10, '2.2'), pinAt(LANE_LEFT + 20, 20, '9')])]);
  assert.equal(overlap.overlapping, 1);
  assert.deepEqual(overlap.labels, ['2.2', '9']);
  const [near] = runPinScript([lane([pinAt(104, 10)])]);
  assert.equal(near.nearSpecimen, 4);
  const [bracketNear] = runPinScript([lane([pinAt(LANE_LEFT + 20, 10)], [braceAt(100, 0, 50, 'anatomy-bracket')])]);
  assert.equal(bracketNear.nearSpecimen, 0, 'a bracket against the specimen is reported too');
  const [onBracket] = runPinScript([lane([pinAt(LANE_LEFT + 4, 10)], [fake('div', { left: LANE_LEFT, top: 0, width: 6, height: 50 }, { testid: 'anatomy-bracket' })])]);
  assert.equal(onBracket.overBracket, 1);
  const [issue] = anatomyPinCrowdedIssues({ id: 'Transcript', file: 'pages/T.catalog.tsx' }, [overlap as never]);
  assert.equal(issue.id, 'anatomy-pin-crowded');
  assert.equal(issue.severity, 'warning');
  assert.equal(issue.page, 'Transcript');
  assert.match(issue.message, /1 pair of pins overlap or touch \(pins 2\.2, 9\)/);
});

test('anatomy-pin-crowded: lane pins kept the gaps apart, and a bracket clear of both, are not reported', () => {
  const pin = (top: number, left = LANE_LEFT + ANATOMY_BRACKET_GAP + 6) => pinAt(left, top);
  assert.deepEqual(runPinScript([lane([pin(0), pin(26), pin(52)], [fake('div', { left: LANE_LEFT, top: 0, width: 6, height: 80 }, { testid: 'anatomy-bracket' })])]), []);
  assert.deepEqual(runPinScript([lane([pin(0), pin(0, LANE_LEFT + 60)])]), [], 'pins side by side do not overlap');
});

test('anatomy-pin-crowded: right-to-left text measures the lane from the specimen\'s left edge', () => {
  // Specimen from x = 300 to 400, the lane to its left: a pin 40px off its left edge is clear, one 4px off is not.
  const rtlLane = (pinLeft: number) => fake('div', { left: 300, top: 0, width: 100, height: 200 }, { testid: 'anatomy-specimen-pins', children: [fake('div', { left: 240, top: 0, width: 48, height: 200 }, { testid: 'anatomy-pin-layer', children: [pinAt(pinLeft, 10)] })] });
  assert.deepEqual(runPinScript([rtlLane(240)], { rtl: true }), [], 'a pin 38px clear of the left edge is not "near the specimen"');
  assert.equal(runPinScript([rtlLane(274)], { rtl: true })[0].nearSpecimen, 4);
  assert.equal(runPinScript([rtlLane(240)], { rtl: false })[0].nearSpecimen, -160, 'read as left-to-right, the same lane would be nonsense (a pin 160px inside the specimen)');
});

test('anatomy-pin-crowded: pins placed by hand in the picture\'s own layout are measured too', () => {
  // The Hermex transcript: a row of [content][pin], hand-drawn brackets, no `pins` lane at all.
  const content = (top: number) => textAt(40, top, 220, 'Conversation transcript');
  const crowded = [
    content(20), content(60),
    pinAt(262, 18, '2.2'), pinAt(262, 30, '9'),                 // overlap each other
    braceAt(300, 50, 60), pinAt(298, 70, '10'),                  // a pin on a bracket
  ];
  const [found] = runPinScript(crowded);
  assert.equal(found.pins, 3);
  assert.equal(found.overlapping, 1);
  assert.equal(found.overContent, 1, 'the pin on the bracket');
  assert.deepEqual(found.labels, ['2.2', '9', '10']);
  const [issue] = anatomyPinCrowdedIssues({ id: 'Transcript' }, [found as never]);
  assert.match(issue.message, /1 pin placed by hand overlaps or touches text, a control or a bracket/);
  // Over text, over a control, touching a marked bracket and over an unmarked hand-drawn one.
  assert.equal(runPinScript([textAt(40, 20, 200), pinAt(150, 20, '4')])[0].overContent, 1, 'over text');
  assert.equal(runPinScript([fake('button', { left: 40, top: 20, width: 100, height: 30 }, { text: 'Send' }), pinAt(130, 24, '4')])[0].overContent, 1, 'over a control');
  // react-native-web: a Pressable is a div with a role (its padded area counts, not just its label), and
  // an Image is an empty div painted with a background image.
  assert.equal(runPinScript([fake('div', { left: 40, top: 20, width: 100, height: 44 }, { role: 'button', children: [textAt(60, 33, 30, 'Go')] }), pinAt(120, 24, '4')])[0].overContent, 1, 'over a Pressable\'s padded area');
  assert.equal(runPinScript([fake('div', { left: 40, top: 20, width: 60, height: 60 }, { style: { backgroundImage: 'url(a.png)' } }), pinAt(80, 40, '4')])[0].overContent, 1, 'over a react-native Image');
  // L9: a control or role that holds the pin (a row that is a button, with the pin placed inside it) is an ancestor, not content under it.
  assert.deepEqual(runPinScript([fake('div', { left: 40, top: 20, width: 200, height: 44 }, { role: 'button', children: [textAt(60, 33, 30, 'Go'), pinAt(200, 24, '4')] })]), [], 'a button that contains the pin is not content under it');
  assert.deepEqual(runPinScript([fake('button', { left: 40, top: 20, width: 200, height: 44 }, { children: [textAt(60, 33, 30, 'Go'), pinAt(190, 24, '4')] })]), [], 'nor is a button element');
  assert.equal(runPinScript([fake('div', { left: 40, top: 20, width: 200, height: 44 }, { role: 'button', children: [textAt(60, 33, 130, 'Go'), pinAt(150, 24, '4')] })])[0].overContent, 1, 'still over the text inside it');
  assert.equal(runPinScript([braceAt(200, 0, 100, 'anatomy-bracket'), pinAt(198, 40, '5')])[0].overContent, 1, 'on a marked bracket');
  assert.equal(runPinScript([braceAt(200, 0, 100), pinAt(190, 40, '5')])[0].overContent, 1, 'on an unmarked, hand-drawn bracket');
  assert.equal(runPinScript([textAt(255, 20, 100), badgeAt(pinAt(230, 20, '6'))])[0].overContent, 1, 'the ↗ badge counts: the pin is clear of the text but its badge is not');
  assert.deepEqual(runPinScript([textAt(255, 20, 100), pinAt(230, 20, '6')]), [], 'the same pin without a badge is clear');
  assert.equal(runPinScript([pinAt(100, 10, '1'), badgeAt(pinAt(100, 38, '2'))])[0].overlapping, 1, 'a badge reaching into the pin above');
});

test('anatomy-pin-crowded: hand-placed pins with room are not reported', () => {
  const row = (top: number, label: string) => [textAt(40, top, 220, 'Conversation transcript'), pinAt(272, top - 2, label)];
  // A pin in a reserved gutter 12px beside wide text boxes, pins 6px apart, a bracket 8px from its pin.
  assert.deepEqual(runPinScript([...row(20, '1'), ...row(50, '2'), ...row(80, '3')]), []);
  assert.deepEqual(runPinScript([braceAt(300, 40, 60), pinAt(311, 60, '4')]), [], 'a pin 8px off a bracket');
  assert.deepEqual(runPinScript([badgeAt(pinAt(100, 40, '1')), badgeAt(pinAt(100, 77, '2'))]), [], 'badges clear of the pin above');
  // Text is measured by its glyphs: a pin beside a short line in a wide text box is clear of it.
  const wide = textAt(40, 20, 300); wide.rects = [{ left: 40, top: 20, width: 80, height: 18 }];
  assert.deepEqual(runPinScript([wide, pinAt(200, 20, '1')]), []);
  // A container's box and background are not content: the pin sits on its row.
  const rowBox = fake('div', { left: 0, top: 0, width: 400, height: 40 }, { style: { backgroundColor: 'rgb(240, 240, 240)' }, children: [textAt(10, 10, 100)] });
  assert.deepEqual(runPinScript([rowBox, pinAt(300, 8, '1')]), []);
  // Hidden content is ignored.
  assert.deepEqual(runPinScript([fake('div', { left: 40, top: 20, width: 200, height: 18 }, { text: 'hidden', style: { visibility: 'hidden' } }), pinAt(100, 20, '1')]), []);
  assert.deepEqual(runPinScript([]), [], 'no pins, no findings');
  assert.deepEqual(runPinScript([textAt(40, 20, 200), pinAt(150, 20, '4')], { hidden: true }), [], 'a picture inside an aria-hidden thumbnail is not measured');
});

test('renderCheck runs the anatomy-pin-crowded script on every page', () => {
  const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../render.ts'), 'utf8');
  assert.ok(source.includes('evaluate(ANATOMY_PIN_CROWDED_SCRIPT)'));
  assert.ok(source.includes('anatomyPinCrowdedIssues({ id, file'));
});

test('the doctor check and the viewer agree on the lane gaps', async () => {
  const model = await import('../../native/catalog/familyModel.ts');
  assert.equal(ANATOMY_EDGE_GAP, model.ANATOMY_PIN_EDGE_GAP);
  assert.equal(ANATOMY_BRACKET_GAP, model.ANATOMY_PIN_BRACKET_GAP);
});

// `sections-in-one-box`: the browser script's behaviour is pinned against the real components in
// `native/catalog/__tests__/inventoryPageLayoutRender.test.tsx`; here the wiring into `renderCheck`.
test('renderCheck runs the sections-in-one-box script on every page, at the wide viewport', () => {
  const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../render.ts'), 'utf8');
  assert.ok(source.includes('evaluate(INVENTORY_BOX_SCRIPT)'), 'renderCheck must evaluate INVENTORY_BOX_SCRIPT');
  assert.ok(source.includes('inventoryBoxIssues({ id, file'), 'its findings must reach the issues');
  const measure = source.indexOf('evaluate(INVENTORY_BOX_SCRIPT)');
  const resize = source.indexOf('setViewport({ width: NARROW_VIEWPORT.width');
  assert.ok(measure > 0 && resize > 0 && measure < resize, 'the check must run before the narrow resize');
});
