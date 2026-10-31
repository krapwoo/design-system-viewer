import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANATOMY_PICTURE_SCRIPT, SPECIMEN_CONTRAST_SCRIPT, anatomyPictureIssues, HEAD_OVERLAP_SCRIPT, HEAD_WORD_BREAK_SCRIPT, headWordBreakIssues, launchOptions, NARROW_VIEWPORT, renderCheck } from '../render.ts';

// Slice G1. jsdom has no layout engine, so these run the real browser scripts against a small fake
// DOM whose rects are the geometry a real page produced.

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom, width: right - left, height: bottom - top });

class FakeEl {
  children: FakeEl[] = [];
  parentElement: FakeEl | null = null;
  props: { tid?: string; text?: string; rect: Rect; radius?: string; dir?: string; scroll?: [number, number] };
  constructor(props: { tid?: string; text?: string; rect: Rect; radius?: string; dir?: string; scroll?: [number, number] }) { this.props = props; }
  get scrollWidth() { return this.props.scroll?.[0] ?? this.props.rect.width; }
  get clientWidth() { return this.props.scroll?.[1] ?? this.props.rect.width; }
  closest(sel: string): FakeEl | null {
    const tid = sel.match(/^\[data-testid="(.+)"\]$/)?.[1];
    for (let el: FakeEl | null = this; el; el = el.parentElement) if (tid && el.props.tid === tid) return el;
    return null;
  }
  add(...kids: FakeEl[]) { for (const kid of kids) { kid.parentElement = this; this.children.push(kid); } return this; }
  get textContent() { return this.props.text ?? this.children.map((c) => c.textContent).join(''); }
  getBoundingClientRect() { return this.props.rect; }
  contains(other: unknown) { return other === this || this.descendants().includes(other as FakeEl); }
  descendants(): FakeEl[] { return this.children.flatMap((c) => [c, ...c.descendants()]); }
  querySelectorAll(sel: string) {
    const tid = sel.match(/^\[data-testid="(.+)"\]$/)?.[1];
    return this.descendants().filter((e) => (tid ? e.props.tid === tid : true));
  }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] ?? null; }
}

const getComputedStyle = (el: FakeEl) => ({ borderTopLeftRadius: el.props.radius ?? '0px', overflowX: 'visible', overflowY: 'visible', direction: el.props.dir ?? 'ltr' });

// ---- rule 5b: anatomy picture geometry ----

interface AnatomyDomOptions {
  /** The pin sits among the specimen's own children instead of in the pin layer. */
  inline?: boolean;
  dir?: 'rtl';
  /** [scrollWidth, clientWidth] of the stage. */
  scroll?: [number, number];
  /** The pin's top and bottom (default 60..82, inside the specimen's 40..200). */
  pinY?: [number, number];
  /** A second pin in the same rounded wrapper, to be sure neither hides the other. */
  second?: [number, number];
  /** The specimen's top and bottom (default 40..200). */
  specY?: [number, number];
  /** A column of pins at the first pin's x, one [top, bottom] each, instead of the single pin. */
  column?: Array<[number, number]>;
  /** The stage's top and bottom (default 0..240). */
  stageY?: [number, number];
  /** No side-by-side legend: the columns sit below the stage, as when the picture is stacked. */
  stacked?: boolean;
}

/** A card holding one anatomy: a 0..400 stage, the specimen from `spec`, one `anatomy-pin`, a legend at 420+. */
function anatomyDom(spec: [number, number], pin: [number, number], options: AnatomyDomOptions = {}) {
  const [pinTop, pinBottom] = options.pinY ?? [60, 82];
  const [specTop, specBottom] = options.specY ?? [40, 200];
  const specimen = new FakeEl({ rect: rect(spec[0], specTop, spec[1], specBottom) });
  const layer = new FakeEl({ tid: 'anatomy-pin-layer', rect: rect(spec[1], specTop, spec[1] + 30, specBottom) });
  const makePin = (x: [number, number], label: string) => new FakeEl({ tid: 'anatomy-pin', rect: rect(x[0], pinTop, x[1], pinBottom) }).add(new FakeEl({ text: label, rect: rect(x[0] + 6, pinTop + 4, x[1] - 6, pinBottom - 4) }));
  const pins = options.column
    ? options.column.map(([top, bottom], n) => new FakeEl({ tid: 'anatomy-pin', rect: rect(pin[0], top, pin[1], bottom) }).add(new FakeEl({ text: String(n + 1), rect: rect(pin[0] + 6, top + 4, pin[1] - 6, bottom - 4) })))
    : [makePin(pin, '1'), ...(options.second ? [makePin(options.second, '2')] : [])];
  if (options.inline) specimen.add(...pins); else layer.add(new FakeEl({ rect: rect(spec[1], 40, spec[1] + 60, 200), radius: '11px' }).add(...pins));
  const wrapper = new FakeEl({ tid: 'anatomy-specimen', rect: rect(0, 40, 400, 200) }).add(new FakeEl({ tid: 'anatomy-specimen-pins', rect: rect(spec[0], specTop, spec[1], specBottom) }).add(specimen, layer));
  const [stageTop, stageBottom] = options.stageY ?? [0, 240];
  const stage = new FakeEl({ tid: 'anatomy-stage', rect: rect(0, stageTop, 400, stageBottom), dir: options.dir, scroll: options.scroll }).add(wrapper);
  const legend = options.stacked
    ? new FakeEl({ tid: 'anatomy-columns', rect: rect(0, 240, 900, 600) })
    : new FakeEl({ tid: 'anatomy-legend', rect: rect(420, 0, 900, 240) });
  const body = new FakeEl({ tid: 'anatomy-body', rect: rect(0, 0, 900, 240) }).add(stage, legend);
  const card = new FakeEl({ tid: 'anatomy-card', rect: rect(0, 0, 900, 240) }).add(body);
  return new FakeEl({ rect: rect(0, 0, 1280, 800) }).add(card);
}
const measure = (root: FakeEl) => Function('document', 'getComputedStyle', `return ${ANATOMY_PICTURE_SCRIPT};`)(root, getComputedStyle);

test('a centred specimen with its pin beside it is clean', () => {
  assert.deepEqual(measure(anatomyDom([49, 351], [355, 377])), []);
});

test('a specimen more than 6px off the centre of its stage is reported, and 6px is not', () => {
  const [hit] = measure(anatomyDom([0, 300], [304, 326]));
  assert.equal(hit.kind, 'off-centre');
  assert.equal(hit.offset, 50);
  assert.deepEqual(measure(anatomyDom([55, 357], [361, 383])), [], '6px off is within tolerance');
});

test('a pin more than 48px from the specimen edge is reported; one beside it is not', () => {
  const far = measure(anatomyDom([49, 351], [430, 452])).filter((f: { kind: string }) => f.kind === 'pin-far');
  assert.equal(far.length, 1);
  assert.equal(far[0].distance, 79);
  assert.equal(far[0].pin, '1');
  assert.deepEqual(measure(anatomyDom([49, 351], [395, 397 + 20])).filter((f: { kind: string }) => f.kind === 'pin-far'), [], '44px away is within reach');
});

test('a pin carrying a ↗ badge yields exactly one finding, not one for the pin and one for its badge', () => {
  const dom = anatomyDom([49, 351], [430, 452]);
  const pin = dom.querySelectorAll('[data-testid="anatomy-pin"]')[0];
  // The badge hangs off the pin's top-right corner, so it sits partly outside the pin's own box.
  pin.add(new FakeEl({ rect: rect(445, 53, 459, 67), radius: '7px' }).add(new FakeEl({ text: '↗', rect: rect(448, 55, 456, 65) })));
  const far = measure(dom).filter((f: { kind: string }) => f.kind === 'pin-far');
  assert.equal(far.length, 1);
  assert.equal(far[0].pin, '1');
});

test('a pin drawn over the legend column is reported', () => {
  const found = measure(anatomyDom([49, 351], [395, 435]));
  assert.ok(found.some((f: { kind: string }) => f.kind === 'pin-over-legend'));
});

test('a picture with no AnatomySpecimen has no specimen to measure and reports nothing here', () => {
  const stage = new FakeEl({ tid: 'anatomy-stage', rect: rect(0, 0, 400, 240) }).add(new FakeEl({ rect: rect(0, 0, 400, 100) }));
  assert.deepEqual(measure(new FakeEl({ rect: rect(0, 0, 1, 1) }).add(stage)), []);
});

test('anatomyPictureIssues names the page, the measurement and the fix, and ignores garbage from the browser', () => {
  const issues = anatomyPictureIssues({ id: 'Card', file: 'Card.catalog.tsx' }, [
    { kind: 'off-centre', stage: 0, offset: 50 }, { kind: 'pin-far', stage: 1, pin: '2', distance: 79 }, { kind: 'pin-over-legend', stage: 0, pin: '3' }, '#Button', null,
  ]);
  assert.equal(issues.length, 3);
  assert.ok(issues.every((i) => i.id === 'anatomy-picture-geometry' && i.severity === 'warning' && i.page === 'Card' && i.file === 'Card.catalog.tsx'));
  assert.match(issues[0].message, /sits 50px off the centre of its stage/);
  assert.match(issues[1].message, /Pin "2" in anatomy picture 2 is 79px from the specimen's edge/);
  assert.match(issues[2].message, /overlaps the legend column/);
  assert.match(issues[0].fix, /AnatomySpecimen/);
});

test('renderCheck runs the anatomy script at the default desktop width and reports what it finds', async () => {
  const fakeChild = () => Object.assign(new EventEmitter(), { pid: 1, stdout: null, stderr: null, unref: () => {} });
  let first = true;
  const widths: number[] = [];
  const browser = {
    newPage: async () => {
      if (first) { first = false; return { goto: async () => {}, evaluate: async () => ['#Card'], close: async () => {} }; }
      let width = 0;
      return {
        setViewport: async (v: { width: number }) => { width = v.width; widths.push(v.width); },
        on: () => {}, goto: async () => {},
        evaluate: async (arg: unknown) => {
          if (typeof arg !== 'string') return true;
          if (arg === ANATOMY_PICTURE_SCRIPT) return width === 1280 ? [{ kind: 'off-centre', stage: 0, offset: 50 }] : [];
          return [];
        },
        close: async () => {},
      };
    },
    close: async () => {},
  };
  const issues = await renderCheck('/tmp/x', { settleMs: 0, deps: { puppeteer: { launch: async () => browser }, startDev: async () => ({ child: fakeChild() as never, port: 5199 }), stopDev: () => {} } });
  const found = issues.filter((i) => i.id === 'anatomy-picture-geometry');
  assert.equal(found.length, 1, 'the anatomy measurement must reach the findings, taken at 1280');
  assert.equal(found[0].page, 'Card');
});

test('renderCheck runs the specimen-contrast script and reports each illegible cell as a warning on its page', async () => {
  const fakeChild = () => Object.assign(new EventEmitter(), { pid: 1, stdout: null, stderr: null, unref: () => {} });
  let first = true;
  const browser = {
    newPage: async () => {
      if (first) { first = false; return { goto: async () => {}, evaluate: async () => ['#SectionCard'], close: async () => {} }; }
      return {
        setViewport: async () => {}, on: () => {}, goto: async () => {},
        evaluate: async (arg: unknown) => {
          if (typeof arg !== 'string') return true;
          return arg === SPECIMEN_CONTRAST_SCRIPT ? [{ name: 'Dark', text: 'Card content', ratio: 1.2, kind: 'dark' }] : [];
        },
        close: async () => {},
      };
    },
    close: async () => {},
  };
  const issues = await renderCheck('/tmp/x', { settleMs: 0, deps: { puppeteer: { launch: async () => browser }, startDev: async () => ({ child: fakeChild() as never, port: 5199 }), stopDev: () => {} } });
  const found = issues.filter((i) => i.id === 'specimen-text-illegible');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'warning');
  assert.equal(found[0].page, 'SectionCard');
  assert.equal(found[0].message, "Text 'Card content' in 'SectionCard' · Dark is dark text on a dark background (1.2:1).");
});

// ---- rule 1: a long unbroken id under the pager ----

// Issue #51's exact case on a family or group page: the title is one unbroken identifier, so at an
// 800px window it keeps its intrinsic width and paints through its own column into the ← → pager.
// At 1280 the same page is clean, which is why only the narrow pass can see it.
const LONG_ID = 'TranscriptMediaUnavailableChipFamily';

function pageHeadDom(width: number) {
  const headingEnd = 700; // the unbroken id's intrinsic width: room at 1280, past the ← at 800
  const heading = new FakeEl({ tid: 'heading', text: LONG_ID, rect: rect(48, 40, headingEnd, 74) });
  const back = new FakeEl({ text: '←', rect: rect(width - 120, 40, width - 88, 72) });
  const next = new FakeEl({ text: '→', rect: rect(width - 80, 40, width - 48, 72) });
  const root = new FakeEl({ rect: rect(0, 0, width, 600) }).add(heading, back, next);
  return {
    querySelector: (s: string) => (s === '[role="heading"]' ? heading : null),
    querySelectorAll: () => root.descendants(),
  };
}

for (const pageId of ['TranscriptMediaUnavailableChipFamily', 'TranscriptMediaUnavailableChipGroup']) {
  test(`doctor --render reports a long unbroken title overlapping the pager on ${pageId.endsWith('Group') ? 'a group' : 'a family'} page`, async () => {
    const fakeChild = () => Object.assign(new EventEmitter(), { pid: 1, stdout: null, stderr: null, unref: () => {} });
    let first = true;
    const browser = {
      newPage: async () => {
        if (first) { first = false; return { goto: async () => {}, evaluate: async () => [`#${pageId}`], close: async () => {} }; }
        let width = 1280;
        return {
          setViewport: async (v: { width: number }) => { width = v.width; },
          on: () => {}, goto: async () => {},
          evaluate: async (arg: unknown) => {
            if (typeof arg !== 'string') return true;
            if (arg === HEAD_OVERLAP_SCRIPT) return Function('document', 'getComputedStyle', `return ${HEAD_OVERLAP_SCRIPT};`)(pageHeadDom(width), getComputedStyle);
            return [];
          },
          close: async () => {},
        };
      },
      close: async () => {},
    };
    const issues = await renderCheck('/tmp/x', { settleMs: 0, deps: { puppeteer: { launch: async () => browser }, startDev: async () => ({ child: fakeChild() as never, port: 5199 }), stopDev: () => {} } });
    const found = issues.filter((i) => i.id === 'page-head-overlap');
    assert.equal(found.length, 1, 'the long title must be reported under the pager at the narrow width');
    assert.equal(found[0].severity, 'error');
    assert.equal(found[0].page, pageId);
    assert.match(found[0].message, new RegExp(`At ${NARROW_VIEWPORT.width}px the page heading is covered by "\\u2190" over 20x32px`));
  });
}

test('the same long title is clean at 1280, where the pager has room', () => {
  const found = Function('document', 'getComputedStyle', `return ${HEAD_OVERLAP_SCRIPT};`)(pageHeadDom(1280), getComputedStyle);
  assert.deepEqual(found, []);
});

// ---- the heading hint: a heading that breaks inside a word ----

/** A heading holding one text node; `lineTops` gives, per whitespace/hyphen-delimited run, the tops of the lines it spans. */
function headingDom(text: string, lineTops: Record<string, number[]>) {
  const node = { data: text };
  const heading = {};
  return {
    querySelector: (s: string) => (s === '[role="heading"]' ? heading : null),
    createTreeWalker: () => { let done = false; return { nextNode: () => (done ? null : ((done = true), node)) }; },
    createRange: () => {
      const range = { start: 0, end: 0, setStart: (_n: unknown, o: number) => { range.start = o; }, setEnd: (_n: unknown, o: number) => { range.end = o; },
        getClientRects: () => (lineTops[text.slice(range.start, range.end)] ?? [10]).map((top) => ({ top, width: 40 })) };
      return range;
    },
  };
}
const runWordBreak = (dom: unknown) => Function('document', `return ${HEAD_WORD_BREAK_SCRIPT};`)(dom);

test('a heading whose single long word is split over two lines is reported, naming the word', () => {
  const found = runWordBreak(headingDom('TranscriptMediaUnavailableChipFamily', { TranscriptMediaUnavailableChipFamily: [10, 36] }));
  assert.deepEqual(found, [{ word: 'TranscriptMediaUnavailableChipFamily', lines: 2 }]);
});

test('a heading that wraps between words, or whose long word fits on one line, is clean', () => {
  assert.deepEqual(runWordBreak(headingDom('Transcript media unavailable chip', { Transcript: [10], media: [10], unavailable: [36], chip: [36] })), []);
  assert.deepEqual(runWordBreak(headingDom('TranscriptMediaUnavailableChipFamily', {})), []);
});

test('a break at a hyphen is a real break opportunity, not a split word', () => {
  assert.deepEqual(runWordBreak(headingDom('Pull-to-refresh', { Pull: [10], to: [10], refresh: [36] })), []);
});

test('headWordBreakIssues makes one hint per page that asks for a human title', () => {
  const [issue, ...rest] = headWordBreakIssues({ id: 'TranscriptMediaUnavailableChipFamily', file: 'X.catalog.tsx' }, [{ word: 'TranscriptMediaUnavailableChipFamily', lines: 2 }, { word: 'Other', lines: 2 }]);
  assert.equal(rest.length, 0);
  assert.equal(issue.id, 'heading-breaks-word');
  assert.equal(issue.severity, 'hint');
  assert.equal(issue.page, 'TranscriptMediaUnavailableChipFamily');
  assert.match(issue.message, new RegExp(`At ${NARROW_VIEWPORT.width}px the page heading breaks inside "TranscriptMediaUnavailableChipFamily"`));
  assert.match(issue.fix, /human `title`/);
});

test('renderCheck runs the heading-break script at the narrow width only and reports its hint', async () => {
  const fakeChild = () => Object.assign(new EventEmitter(), { pid: 1, stdout: null, stderr: null, unref: () => {} });
  let first = true;
  const browser = {
    newPage: async () => {
      if (first) { first = false; return { goto: async () => {}, evaluate: async () => ['#Chip'], close: async () => {} }; }
      let width = 1280;
      return {
        setViewport: async (v: { width: number }) => { width = v.width; },
        on: () => {}, goto: async () => {},
        evaluate: async (arg: unknown) => {
          if (typeof arg !== 'string') return true;
          if (arg === HEAD_WORD_BREAK_SCRIPT) return width === NARROW_VIEWPORT.width ? [{ word: 'TranscriptMediaUnavailableChipFamily', lines: 2 }] : [];
          return [];
        },
        close: async () => {},
      };
    },
    close: async () => {},
  };
  const issues = await renderCheck('/tmp/x', { settleMs: 0, deps: { puppeteer: { launch: async () => browser }, startDev: async () => ({ child: fakeChild() as never, port: 5199 }), stopDev: () => {} } });
  const found = issues.filter((i) => i.id === 'heading-breaks-word');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'hint');
});

// ---- the docs and generated files name `doctor --render` as the CI step ----

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('the README names `doctor --render --ci` as the documented CI step in getting started', () => {
  const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
  const start = readme.indexOf('## Using `@krapwoo/ds-viewer` in your own project');
  const end = readme.indexOf('### Seeing what an upgrade changes');
  assert.ok(start >= 0 && end > start);
  assert.match(readme.slice(start, end), /doctor --render --ci/);
});

// ---- F5: every pin in the stage is measured, wherever it was placed ----

const kinds = (found: Array<{ kind: string }>) => found.map((f) => f.kind);

test('F5: a pin placed in the specimen children (not in the pin layer) is measured', () => {
  const far = measure(anatomyDom([49, 351], [430, 452], { inline: true }));
  assert.deepEqual(kinds(far), ['pin-far'], 'an inline pin 79px away is reported');
  assert.deepEqual(measure(anatomyDom([49, 351], [355, 377], { inline: true })), [], 'an inline pin beside the specimen is clean');
});

test('F5: two pins in one rounded wrapper are both measured, not hidden by the radius heuristic', () => {
  const found = measure(anatomyDom([49, 351], [430, 452], { second: [460, 482] }));
  assert.deepEqual(found.map((f: { pin: string }) => f.pin).sort(), ['1', '2']);
});

test('F5: a pin on the far side of the specimen, or above or below it, is reported', () => {
  const opposite = measure(anatomyDom([100, 300], [10, 32]));
  assert.deepEqual(opposite.map((f: { kind: string; where?: string }) => `${f.kind}:${f.where}`), ['pin-outside:opposite']);
  const above = measure(anatomyDom([49, 351], [355, 377], { pinY: [10, 32] }));
  assert.deepEqual(above.map((f: { kind: string; where?: string }) => `${f.kind}:${f.where}`), ['pin-outside:above']);
  const below = measure(anatomyDom([49, 351], [355, 377], { pinY: [210, 232] }));
  assert.deepEqual(below.map((f: { kind: string; where?: string }) => `${f.kind}:${f.where}`), ['pin-outside:below']);
});

test('F5: the pin hook in the real Anatomy.tsx is the id the script looks for', () => {
  const source = readFileSync(path.join(root, 'native/catalog/Anatomy.tsx'), 'utf8');
  assert.match(source, /ANATOMY_PIN_TEST_ID = 'anatomy-pin'/);
  assert.ok(ANATOMY_PICTURE_SCRIPT.includes('[data-testid="anatomy-pin"]'));
});

test('F5: anatomyPictureIssues words a pin outside the specimen', () => {
  const [issue] = anatomyPictureIssues({ id: 'Card' }, [{ kind: 'pin-outside', stage: 0, pin: '3', where: 'above' }]);
  assert.match(issue.message, /Pin "3" in anatomy picture 1 sits above the specimen/);
});

// ---- a column of pins taller than a short specimen overhangs it and is judged as a whole ----

const SHORT = { specY: [402, 431] as [number, number], stageY: [300, 620] as [number, number] };
const column = (shift: number): Array<[number, number]> => [[366, 388], [392, 414], [418, 440], [444, 466]].map(([a, b]) => [a + shift, b + shift]);

test('a centred pin column taller than a short specimen is clean (measured: specimen 402-431, pins 366-466)', () => {
  assert.deepEqual(measure(anatomyDom([49, 351], [355, 377], { ...SHORT, column: column(0) })), []);
});

test('the same column shifted 120px down is reported once per pin, below the specimen', () => {
  const found = measure(anatomyDom([49, 351], [355, 377], { ...SHORT, column: column(120) }));
  assert.deepEqual(found.map((f: { kind: string; where?: string; pin: string }) => `${f.pin}:${f.kind}:${f.where}`), ['1:pin-outside:below', '2:pin-outside:below', '3:pin-outside:below', '4:pin-outside:below']);
});

test('a column that does not overlap the specimen at all is reported', () => {
  const found = measure(anatomyDom([49, 351], [355, 377], { ...SHORT, column: [[300, 322], [326, 348], [352, 374], [378, 400]] }));
  assert.deepEqual(kinds(found), ['pin-outside', 'pin-outside', 'pin-outside', 'pin-outside']);
  assert.ok(found.every((f: { where: string }) => f.where === 'above'));
});

test('a single pin far above a tall specimen is still reported', () => {
  const found = measure(anatomyDom([49, 351], [355, 377], { pinY: [10, 32] }));
  assert.deepEqual(found.map((f: { kind: string; where?: string }) => `${f.kind}:${f.where}`), ['pin-outside:above']);
});

// ---- F8: the legend, a scrolling stage, and right-to-left ----

test('F8: the legend is found from the stage through anatomy-card, however deep the stage is wrapped', () => {
  const dom = anatomyDom([49, 351], [395, 435]);
  const stage = dom.querySelectorAll('[data-testid="anatomy-stage"]')[0];
  // A new wrapper between the body and the stage must not disable the legend check.
  const body = stage.parentElement!;
  const outer = new FakeEl({ rect: stage.props.rect });
  const wrap = new FakeEl({ rect: stage.props.rect });
  body.children.splice(body.children.indexOf(stage), 1, outer);
  outer.parentElement = body;
  outer.add(wrap);
  wrap.add(stage);
  assert.ok(measure(dom).some((f: { kind: string }) => f.kind === 'pin-over-legend'));
});

test('F8: a stage that scrolls sideways is not reported as off-centre, but its pins are still checked', () => {
  assert.deepEqual(kinds(measure(anatomyDom([0, 300], [304, 326], { scroll: [600, 400] }))), []);
  assert.deepEqual(kinds(measure(anatomyDom([0, 300], [304, 326], { scroll: [400, 400] }))), ['off-centre']);
  assert.deepEqual(kinds(measure(anatomyDom([0, 300], [430, 452], { scroll: [600, 400] }))), ['pin-far']);
});

test('F8: in right-to-left text the pin column is on the left, and a pin there is neither far nor on the wrong side', () => {
  // specimen 100..300 with its pin at 60..82 on the left (distance 18), legend on the right
  assert.deepEqual(measure(anatomyDom([100, 300], [60, 82], { dir: 'rtl' })), []);
  // far to the left: 100 - 10 = 90px beyond the edge
  assert.deepEqual(kinds(measure(anatomyDom([100, 300], [-20, 2], { dir: 'rtl' }))), ['pin-far']);
  // a pin on the right of the specimen is on the wrong side in rtl
  assert.deepEqual(measure(anatomyDom([49, 351], [355, 377], { dir: 'rtl' })).map((f: { kind: string; where?: string }) => `${f.kind}:${f.where}`), ['pin-outside:opposite']);
});

// ---- F10: break opportunities the browser really has ----

test('F10: a CJK heading that wraps between characters is not a split word', () => {
  const text = '한국어제목이매우길어서줄바꿈됩니다';
  // The whole run spans two lines (it wrapped), each character sits on one.
  assert.deepEqual(runWordBreak(headingDom(text, { [text]: [10, 36] })), []);
  assert.deepEqual(runWordBreak(headingDom('日本語のとても長い見出し', { '日本語のとても長い見出し': [10, 36] })), []);
});

test('F10: a break after a slash or a dash is a break opportunity', () => {
  assert.deepEqual(runWordBreak(headingDom('src/components/Button', { 'src/components/Button': [10, 36], src: [10], components: [10], Button: [36] })), []);
  assert.deepEqual(runWordBreak(headingDom('Cards—Layouts', { 'Cards—Layouts': [10, 36], Cards: [10], Layouts: [36] })), []);
  assert.deepEqual(runWordBreak(headingDom('A–B​chip', { 'A–B​chip': [10, 36] })), []);
});

test('F10: without Intl.Segmenter the character-class fallback gives the same answers', () => {
  const noSegmenter = (dom: unknown) => Function('document', 'Intl', `return ${HEAD_WORD_BREAK_SCRIPT};`)(dom, {});
  const text = '한국어제목이매우길어서줄바꿈됩니다';
  assert.deepEqual(noSegmenter(headingDom(text, { [text]: [10, 36] })), []);
  assert.deepEqual(noSegmenter(headingDom('src/components/Button', { 'src/components/Button': [10, 36] })), []);
  assert.deepEqual(noSegmenter(headingDom('TranscriptMediaUnavailableChipFamily', { TranscriptMediaUnavailableChipFamily: [10, 36] })), [{ word: 'TranscriptMediaUnavailableChipFamily', lines: 2 }]);
});

// ---- F6: the browser is launched without Chrome's sandbox on a CI runner, and only there ----

test('F6: launchOptions adds --no-sandbox only when CI is set', () => {
  assert.deepEqual(launchOptions({}), { headless: true });
  assert.deepEqual(launchOptions({ CI: '' }), { headless: true });
  assert.deepEqual(launchOptions({ CI: 'false' }), { headless: true });
  assert.deepEqual(launchOptions({ CI: 'true' }), { headless: true, args: ['--no-sandbox'] });
  assert.deepEqual(launchOptions({ CI: '1' }), { headless: true, args: ['--no-sandbox'] });
});

for (const [label, ci, expected] of [['under CI', 'true', ['--no-sandbox']], ['outside CI', undefined, undefined]] as const) {
  test(`F6: renderCheck launches the browser ${label} with ${expected ? '--no-sandbox' : 'no sandbox override'}`, async () => {
    const before = process.env.CI;
    if (ci === undefined) delete process.env.CI; else process.env.CI = ci;
    let launched: { headless?: boolean; args?: string[] } | undefined;
    const fakeChild = () => Object.assign(new EventEmitter(), { pid: 1, stdout: null, stderr: null, unref: () => {} });
    let landing = true;
    const browser = {
      newPage: async () => {
        const isLanding = landing;
        landing = false;
        return { setViewport: async () => {}, on: () => {}, goto: async () => {}, evaluate: async () => (isLanding ? ['#Card'] : true), close: async () => {} };
      },
      close: async () => {},
    };
    try {
      await renderCheck('/tmp/x', { settleMs: 0, deps: { puppeteer: { launch: async (o: object) => { launched = o; return browser; } }, startDev: async () => ({ child: fakeChild() as never, port: 5199 }), stopDev: () => {} } });
    } finally {
      if (before === undefined) delete process.env.CI; else process.env.CI = before;
    }
    assert.equal(launched?.headless, true);
    assert.deepEqual(launched?.args, expected);
  });
}

// ---- a pin cut off by the picture area, and the stacked legend ----

test('a pin that extends past the stage is reported as cut off, once, with the stage named', () => {
  const found = measure(anatomyDom([49, 351], [355, 377], { column: [[30, 52], [60, 82], [200, 222], [226, 248]] }));
  const cut = found.filter((f: { kind: string }) => f.kind === 'pin-cut-off');
  assert.deepEqual(cut.map((f: { pin: string }) => f.pin), ['4']);
  const [issue] = anatomyPictureIssues({ id: 'Card' }, cut);
  assert.match(issue.message, /Pin "4" in anatomy picture 1 is cut off by the picture area\./);
});

test('the BotReplyFooter shape is clean: stacked, a 29px specimen, a 4-pin column the stage now holds', () => {
  // Specimen 306-335, pins 270-370, stage 241-400 (the block grew to hold the column), columns below at 400+.
  const dom = anatomyDom([49, 351], [355, 377], { specY: [306, 335], stageY: [241, 400], stacked: true, column: [[270, 292], [296, 318], [322, 344], [348, 370]] });
  assert.deepEqual(measure(dom), []);
});

test('the same shape with the stage only as tall as the specimen (before the fix) cut-off fires, and nothing reports the legend', () => {
  const dom = anatomyDom([49, 351], [355, 377], { specY: [306, 335], stageY: [281, 358], stacked: true, column: [[270, 292], [296, 318], [322, 344], [348, 370]] });
  const found = measure(dom);
  assert.deepEqual(found.filter((f: { kind: string }) => f.kind === 'pin-cut-off').map((f: { pin: string }) => f.pin), ['1', '4'], 'the first pin is cut at the top, the last at the bottom');
  assert.equal(found.filter((f: { kind: string }) => f.kind === 'pin-over-legend').length, 0, 'stacked: no legend to overlap');
});

test('a correct pin plus a far-off stray pin is two runs: exactly one finding, for the stray', () => {
  // Specimen 200-240; pin 1 sits beside it, pin 2 is 83px above it. Merged, the two form one tall 100-227 column whose centre is above the specimen, so the correct pin is flagged too.
  const dom = anatomyDom([49, 351], [355, 377], { specY: [200, 240], stageY: [80, 300], stacked: true, column: [[205, 227], [100, 122]] });
  const found = measure(dom);
  assert.equal(found.length, 1);
  assert.deepEqual({ kind: found[0].kind, pin: found[0].pin, where: found[0].where }, { kind: 'pin-outside', pin: '2', where: 'above' });
});

test('the BotReplyFooter column (4 pins, 4px gaps, 366-466 against a 402-431 specimen) stays one clean run', () => {
  const dom = anatomyDom([49, 351], [355, 377], { specY: [402, 431], stageY: [330, 500], stacked: true, column: [[366, 388], [392, 414], [418, 440], [444, 466]] });
  assert.deepEqual(measure(dom), []);
});
