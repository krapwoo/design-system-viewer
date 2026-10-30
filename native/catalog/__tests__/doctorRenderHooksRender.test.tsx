// `doctor --render` reads the rendered catalog through a few hooks: the page heading and the pager
// beside it (`HEAD_OVERLAP_SCRIPT`, `HEAD_WORD_BREAK_SCRIPT`), and the anatomy stage, specimen, pins,
// legend and card (`ANATOMY_PICTURE_SCRIPT`). Those scripts are otherwise tested against hand-built
// fake DOMs, so this renders the real components and holds the scripts to what is really there: if
// FamilyPage, GroupPage or AnatomyBox is restructured, a test here fails instead of the check going
// quiet. jsdom has no layout, so geometry comes from rects stubbed onto the real elements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { FamilyPage } = await import('../FamilyPage.tsx');
const { GroupPage } = await import('../GroupPage.tsx');
const { AnatomyBox, AnatomySpecimen, AnatomyPin, Pin, ANATOMY_PIN_TEST_ID, ANATOMY_CARD_TEST_ID } = await import('../Anatomy.tsx');
const { ANATOMY_PICTURE_SCRIPT, HEAD_OVERLAP_SCRIPT, HEAD_WORD_BREAK_SCRIPT } = await import('../../../cli/render.ts');

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom, width: right - left, height: bottom - top });
const stub = (el: Element, r: Rect) => { (el as HTMLElement).getBoundingClientRect = () => r as DOMRect; };

// ---- F7: the real page heads ----

const LONG_ID = 'TranscriptMediaUnavailableChipFamily';
const pager = { previousId: 'A', nextId: 'B', onNavigate: () => {}, labelOf: (id: string) => id };
const member = (id: string) => ({ id, source: `${id}.tsx`, fidelity: 'replicated' as const, relationship: id, description: `${id}.` });
const family = { id: LONG_ID, description: 'A family.', path: 'X.tsx', family: { whole: LONG_ID, members: [member(LONG_ID)], sections: [], outline: new Map() } };
const group = { id: LONG_ID, description: 'A group.', path: 'X.tsx', family: { kind: 'group', whole: LONG_ID, members: [member('One')], sections: [], outline: new Map(), topLevel: [{ member: member('One'), parts: [] }] } };

for (const [name, element] of [
  ['FamilyPage', () => React.createElement(FamilyPage as never, { def: family, pager } as never)],
  ['GroupPage', () => React.createElement(GroupPage as never, { def: group, pager } as never)],
] as const) {
  test(`${name}: the head has the one heading and the pager arrows the overlap script reads, outside the heading`, () => {
    const { container, cleanup } = renderCatalog(element());
    try {
      const headings = container.querySelectorAll('[role="heading"]');
      assert.equal(headings.length >= 1, true, 'expected a role="heading"');
      const heading = headings[0];
      assert.equal(heading.textContent, LONG_ID, 'the heading holds the title as its text');
      const leaves = [...container.querySelectorAll('*')].filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '');
      const arrows = leaves.filter((el) => /^[←→]$/.test((el.textContent ?? '').trim()));
      assert.ok(arrows.length >= 1, 'expected a pager arrow as a text leaf the script can see');
      assert.ok(arrows.every((el) => !heading.contains(el)), 'the pager is outside the heading');

      // The overlap script, run on this real markup: put the title's text node under the arrows and it must say so.
      const titleLeaf = leaves.find((el) => heading.contains(el) && el.textContent === LONG_ID)!;
      assert.ok(titleLeaf, 'the title is a leaf inside the heading');
      for (const el of container.querySelectorAll('*')) stub(el, rect(0, 0, 0, 0));
      stub(heading, rect(48, 40, 700, 74));
      stub(titleLeaf, rect(48, 40, 700, 74));
      stub(arrows[0], rect(680, 40, 712, 72));
      const found = Function('document', 'getComputedStyle', `return ${HEAD_OVERLAP_SCRIPT};`)(window.document, window.getComputedStyle.bind(window));
      assert.equal(found.length, 1, JSON.stringify(found));
      assert.match(found[0].other, /^[←→]$/);
      stub(arrows[0], rect(720, 40, 752, 72));
      assert.deepEqual(Function('document', 'getComputedStyle', `return ${HEAD_OVERLAP_SCRIPT};`)(window.document, window.getComputedStyle.bind(window)), [], 'clear of the heading, nothing is reported');
    } finally { cleanup(); }
  });

  test(`${name}: the word-break script finds the title's text node through the heading's tree`, () => {
    const { container, cleanup } = renderCatalog(element());
    try {
      const heading = container.querySelector('[role="heading"]')!;
      const walker = window.document.createTreeWalker(heading, 4);
      const texts: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push((node as Text).data);
      assert.ok(texts.includes(LONG_ID), `expected the title as a text node, got ${JSON.stringify(texts)}`);
      // A wrapped title: the run's rects sit on two lines, so the script reports the split word.
      const range = window.document.createRange;
      window.document.createRange = () => {
        const real = range.call(window.document);
        real.getClientRects = () => [{ top: 10, width: 40 }, { top: 36, width: 40 }] as unknown as DOMRectList;
        return real;
      };
      try {
        const found = Function('document', `return ${HEAD_WORD_BREAK_SCRIPT};`)(window.document);
        assert.deepEqual(found, [{ word: LONG_ID, lines: 2 }]);
      } finally { window.document.createRange = range; }
    } finally { cleanup(); }
  });
}

// ---- F8: the real anatomy box carries every hook the geometry script uses ----

function mountAnatomy(picture: React.ReactNode) {
  const anatomy = { picture, groups: [{ label: 'In this picture', items: [{ other: 'Chip', description: 'A chip.' }] }] };
  return renderCatalog(<AnatomyBox anatomy={anatomy} byId={new Map()} outline={new Map()} resolvesAddress={() => false} previewWidth={402} />);
}

test('the anatomy box carries each testID the geometry script uses, nested the way the script walks it', () => {
  const { container, cleanup } = mountAnatomy(<AnatomySpecimen pins={<AnatomyPin other="Chip" />}><span>content</span></AnatomySpecimen>);
  try {
    const byId = (id: string) => container.querySelector(`[data-testid="${id}"]`);
    for (const id of ['anatomy-card', 'anatomy-stage', 'anatomy-specimen', 'anatomy-specimen-pins', 'anatomy-pin-layer', 'anatomy-pin', 'anatomy-legend']) {
      assert.ok(byId(id) !== null || id === 'anatomy-legend', `expected data-testid="${id}"`);
      assert.ok(ANATOMY_PICTURE_SCRIPT.includes(`"${id}"`) || id === 'anatomy-pin-layer' || id === 'anatomy-body', `the script should name ${id}`);
    }
    assert.equal(ANATOMY_PIN_TEST_ID, 'anatomy-pin');
    assert.equal(ANATOMY_CARD_TEST_ID, 'anatomy-card');
    const stage = byId('anatomy-stage')!;
    const card = stage.closest('[data-testid="anatomy-card"]');
    assert.ok(card, 'the stage is inside the anatomy card, so the script can find the legend from it');
    assert.ok(card!.querySelector('[data-testid="anatomy-legend"]') ?? card!.querySelector('[data-testid="anatomy-columns"]'), 'the legend (or its stacked columns) is inside the same card');
    assert.ok(stage.querySelector('[data-testid="anatomy-specimen"]'), 'the specimen is inside the stage');
    assert.ok(stage.querySelector('[data-testid="anatomy-pin"]'), 'the pin is inside the stage');
  } finally { cleanup(); }
});

test('a pin placed in the specimen children is an anatomy-pin in the stage, and the badge on a pin that opens a page is not', () => {
  const { container, cleanup } = mountAnatomy(<AnatomySpecimen><AnatomyPin other="Chip" /><span>content</span></AnatomySpecimen>);
  try {
    const stage = container.querySelector('[data-testid="anatomy-stage"]')!;
    assert.equal(stage.querySelectorAll('[data-testid="anatomy-pin"]').length, 1);
    assert.equal(stage.querySelector('[data-testid="anatomy-pin-layer"]'), null, 'it did not come through the pins prop');
  } finally { cleanup(); }
});

test('the geometry script, run on the real anatomy box, finds a stage pin that no pins prop produced', () => {
  const { container, cleanup } = mountAnatomy(<AnatomySpecimen><AnatomyPin other="Chip" /><span>content</span></AnatomySpecimen>);
  try {
    for (const el of container.querySelectorAll('*')) stub(el, rect(0, 0, 0, 0));
    const get = (id: string) => container.querySelector(`[data-testid="${id}"]`)!;
    stub(get('anatomy-stage'), rect(0, 0, 400, 240));
    stub(get('anatomy-specimen'), rect(0, 40, 400, 200));
    const root = get('anatomy-specimen').children[0] as Element;
    stub(root, rect(49, 40, 351, 200));
    for (const child of root.children) if (child.getAttribute("data-testid") !== "anatomy-pin") stub(child, rect(49, 40, 351, 200));
    stub(get('anatomy-pin'), rect(500, 60, 522, 82));
    const found = Function('document', 'getComputedStyle', `return ${ANATOMY_PICTURE_SCRIPT};`)(window.document, window.getComputedStyle.bind(window));
    assert.ok(found.some((f: { kind: string }) => f.kind === 'pin-far'), JSON.stringify(found));
  } finally { cleanup(); }
});

test('a numbered Pin is one anatomy-pin; the badge on a pin that opens a page is not a second one', () => {
  const { container, cleanup } = renderCatalog(<><Pin number="1" /><Pin number="2" opens /></>);
  try {
    const pins = container.querySelectorAll('[data-testid="anatomy-pin"]');
    assert.equal(pins.length, 2);
    assert.equal(pins[1].textContent, '2↗');
    assert.equal(pins[1].querySelectorAll('[data-testid="anatomy-pin"]').length, 0, 'the badge inside is not a pin');
  } finally { cleanup(); }
});
