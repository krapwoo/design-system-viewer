import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// anatomy-narrow-layout: a real-width mounted regression (below) needs react-native-web's own
// `onLayout` plumbing (`useElementLayout`) to see a genuine `ResizeObserver`, which it only ever
// does when `canUseDom` — a plain `typeof window !== 'undefined'` check `react-native-web`'s own
// `canUseDom` module freezes into a cached boolean the FIRST time it's imported, for the rest of
// the process — was already true at that moment. A plain top-level `import { FamilyPage } from
// '../FamilyPage.tsx'` (as every test here used before this fix) is hoisted ahead of any top-level
// code in this file, so it would still load `react-native`/`react-native-web` (and decide
// `canUseDom`) before a `window` ever exists — too late. Building a throwaway `window` here first,
// then reaching `renderCatalog`/`FamilyPage`/`anatomyColumns` only through a dynamic `import()`
// (unlike a static `import`, never hoisted ahead of this file's own top-level code), makes sure
// `react-native-web` first evaluates with a real `window.document` already in place — the same
// fix, and the same reason for it, as `catalogOrderingRender.test.tsx`'s own `warmup`.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
// react-native-web's own `canUseDom` gets cached the same way, at its own first import — reachable
// only through the same dynamic `import()` below, so it also now evaluates with a real `document`
// present. That code checks a bare `instanceof ShadowRoot` with no feature-detection guard — a real
// global in a browser (where `window` is `globalThis`), but not here, where `ShadowRoot` only
// exists as a property of our own `window` object, so the bare identifier throws a `ReferenceError`
// unless it's exposed as a true global too.
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
// The member side panel is a real `Modal`; its focus trap checks a bare `instanceof Node` against
// whichever window `renderCatalog` currently mounted into (`sourceReferencePickerRender.test.tsx`'s
// own precedent).
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { FamilyPage } = await import('../FamilyPage.tsx');
const { anatomyColumns } = await import('../familyModel.ts');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');
const { SectionBlock } = await import('../SectionBlock.tsx');

// A family whose legend has one numbered row and one row with no number at all: `Related` sits
// outside every `inWhole` section, so `numberFor` gives it no number and its legend row must
// render with no pin slot reserved. This is the shape `APPROVED.md` line 21 describes.
//
// `FamilyPage` takes `def: SectionDef`, not `family`/`resolvesAddress` directly — it reads
// `def.family!` and computes `resolvesAddress` itself from `knownAddressIds` plus the family's own
// member ids (see `FamilyPage`'s body in `FamilyPage.tsx`). The plan this test came from assumed
// `family` and `resolvesAddress` were props; they aren't, so the fixture wraps `family` inside
// `def` and callers that need a resolvable name outside the family pass `knownAddressIds` instead.
function familyWithPinlessLegendRow() {
  return {
    id: 'Whole',
    description: 'The whole thing.',
    path: 'Whole.tsx',
    family: {
      whole: 'Whole',
      members: [
        { id: 'Whole', source: 'Whole.tsx', fidelity: 'replicated' as const, relationship: 'Whole', description: 'The whole.' },
        { id: 'Part', source: 'Part.tsx', fidelity: 'replicated' as const, relationship: 'Part', parent: 'Whole', description: 'A part.' },
        { id: 'Related', source: 'Related.tsx', fidelity: 'replicated' as const, relationship: 'Related', description: 'Merely related.' },
      ],
      sections: [
        { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Part'] },
        { label: 'Related', kind: 'blocks' as const, inWhole: false, members: ['Related'] },
      ],
      outline: new Map([['Part', { number: '1', level: 0 }]]),
      anatomy: {
        picture: React.createElement('div', null, 'picture'),
        groups: [
          { label: 'In this picture', items: [{ member: 'Part', description: 'The numbered part.' }] },
          { label: 'No number of their own', items: [{ member: 'Related', description: 'The pinless row.' }] },
        ],
      },
    },
  };
}

test('a legend row with no pin reserves no pin slot, while a numbered row does', () => {
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def: familyWithPinlessLegendRow() } as never),
  );

  const rowOf = (name: string) => {
    const label = [...container.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && (e.textContent || '').trim() === name,
    );
    assert.ok(label, `expected a legend row named ${name}`);
    return label!.closest('div')!.parentElement!;
  };

  // The pin slot is a fixed-width element that exists only to hold a pin. The numbered row has one;
  // the pinless row must not, or its name renders under blank space (APPROVED.md lines 12 and 21).
  const numberedSlots = rowOf('Part').querySelectorAll('[data-testid="legend-pin-slot"]');
  const pinlessSlots = rowOf('Related').querySelectorAll('[data-testid="legend-pin-slot"]');
  assert.equal(numberedSlots.length, 1, 'a numbered legend row keeps its pin slot');
  assert.equal(pinlessSlots.length, 0, 'a legend row with no pin must reserve no slot at all');

  cleanup();
});

test('an anatomy with no picture renders no empty picture slot, and its legend still renders', () => {
  const def = familyWithPinlessLegendRow();
  const { picture: _picture, ...pictureless } = def.family.anatomy;
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def: { ...def, family: { ...def.family, anatomy: pictureless } } } as never),
  );
  try {
    assert.equal(Boolean(container.querySelector('[data-testid="anatomy-picture-measure"]')), false, 'a picture-less anatomy must not reserve a picture column');
    assert.ok((container.textContent || '').includes('The numbered part.'), 'expected the legend to render');
  } finally { cleanup(); }
});

// anatomy-narrow-layout: a family whose anatomy legend has more than six items, across two
// groups — one nested part (an outline number with a `.` segment) and three "Other page" rows,
// two of them unresolvable. jsdom has no ResizeObserver, so `onLayout` never fires here and
// `anatomyLayout` always falls back to its original item-count-only decision — these assertions
// cover that mounted fallback wiring (picture content, pin slots, nesting, external links), not
// live width-driven switching, which needs the controller's own browser pass.
function familyWithManyAnatomyItems() {
  return {
    id: 'Whole',
    description: 'The whole thing.',
    path: 'Whole.tsx',
    family: {
      whole: 'Whole',
      members: [
        { id: 'Whole', source: 'Whole.tsx', fidelity: 'replicated' as const, relationship: 'Whole', description: 'The whole.' },
        { id: 'Part1', source: 'Part1.tsx', fidelity: 'replicated' as const, relationship: 'Part', description: 'First part.' },
        { id: 'Part2', source: 'Part2.tsx', fidelity: 'replicated' as const, relationship: 'Part', description: 'Second part.' },
        { id: 'Part3', source: 'Part3.tsx', fidelity: 'replicated' as const, relationship: 'Part', description: 'Nested child part.' },
        { id: 'Part4', source: 'Part4.tsx', fidelity: 'replicated' as const, relationship: 'Part', description: 'Third part.' },
      ],
      sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Part1', 'Part2', 'Part3', 'Part4'] }],
      outline: new Map([
        ['Part1', { number: '1', level: 0 }],
        ['Part2', { number: '2', level: 0 }],
        ['Part3', { number: '2.1', level: 1 }],
        ['Part4', { number: '3', level: 0 }],
      ]),
      anatomy: {
        picture: React.createElement('div', null, 'picture'),
        groups: [
          {
            label: 'In this picture',
            items: [
              { member: 'Part1', description: 'First part.' },
              { member: 'Part2', description: 'Second part.' },
              { member: 'Part3', description: 'Nested child part.' },
              { member: 'Part4', description: 'Third part.' },
            ],
          },
          {
            label: 'From other pages',
            items: [
              { other: 'ExternalOne', description: 'Lives elsewhere one.' },
              { other: 'ExternalTwo', description: 'Lives elsewhere two.' },
              { other: 'ExternalThree', description: 'Lives elsewhere three.' },
            ],
          },
        ],
      },
    },
  };
}

test('>6 anatomy items: the picture renders once, and the stacked legend keeps every group, its nested pin, and its external-page rows intact', () => {
  const def = familyWithManyAnatomyItems();
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['ExternalOne']) } as never),
  );

  assert.equal(container.querySelectorAll('[data-testid="anatomy-columns"]').length, 1, 'a >6-item legend renders stacked (picture above columns)');
  assert.equal(container.querySelectorAll('[data-testid="anatomy-legend"]').length, 0, 'never the side-by-side legend at the same time');

  // Only two groups are authored here, so the balanced distribution never exceeds 2 columns even
  // though the unmeasured fallback legend-column budget is 3 (`anatomyColumns` never produces
  // more columns than groups).
  const expectedColumns = anatomyColumns(def.family.anatomy.groups, 3).length;
  assert.equal(container.querySelectorAll('[data-testid="anatomy-columns"] > *').length, expectedColumns);

  assert.ok((container.textContent || '').includes('picture'), 'the authored picture content must still render');
  assert.equal(
    container.querySelectorAll('[data-testid="legend-pin-slot"]').length,
    7,
    'every legend row (numbered or "Other page") keeps its own slot — none dropped',
  );
  assert.ok((container.textContent || '').includes('In this picture'));
  assert.ok((container.textContent || '').includes('From other pages'));
  assert.ok((container.textContent || '').includes('2.1'), 'a nested child part keeps its own dotted outline number on its pin');
  assert.ok((container.textContent || '').includes('Other page'));

  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#ExternalOne'), 'a resolvable "Other page" row still links to its real address');
  assert.ok(!links.includes('#ExternalTwo') && !links.includes('#ExternalThree'), 'an unresolvable "Other page" row never renders as a link');
  assert.ok((container.textContent || '').includes('ExternalTwo'), 'but its name is still readable as plain text');

  cleanup();
});

test('<=6 anatomy items: the default (unmeasured) layout stays side by side, legend beside the picture', () => {
  const def = familyWithPinlessLegendRow();
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  assert.equal(container.querySelectorAll('[data-testid="anatomy-legend"]').length, 1);
  assert.equal(container.querySelectorAll('[data-testid="anatomy-columns"]').length, 0);
  assert.ok((container.textContent || '').includes('picture'));
  cleanup();
});

test('relatedPages renders a resolvable entry as a link and an unresolvable one as plain text', () => {
  const def = familyWithPinlessLegendRow();
  def.family.relatedPages = [
    { page: 'RealPage', note: 'Why you would go there.' },
    { page: 'GonePage' },
  ];
  // `resolvesAddress` is computed inside `FamilyPage` from `knownAddressIds` plus the family's own
  // member ids (see `FamilyPage`'s body) — there is no `resolvesAddress` prop to pass directly.
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['RealPage']) } as never),
  );

  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#RealPage'), 'a resolvable entry must render as a real link');
  assert.ok(!links.includes('#GonePage'), 'an unresolvable entry must never render as a link');
  assert.ok((container.textContent || '').includes('GonePage'), 'but its name must still be readable as plain text');
  assert.ok((container.textContent || '').includes('Why you would go there.'), 'a note must render when present');

  cleanup();
});

test('a family with no relatedPages and no Related sections renders no Related heading at all', () => {
  const def = familyWithPinlessLegendRow();
  def.family.sections = [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Part'] }];
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  const headings = [...container.querySelectorAll('h2')].map((h) => (h.textContent || '').trim());
  assert.ok(!headings.includes('Related'), 'an empty Related group must render nothing, not an empty heading');
  cleanup();
});

// Derived "Also used by" line: every fixture member above omits `alsoUsedBy` entirely, so none of
// the earlier tests exercise it — these do, reverting the line's own rendering in
// `BelowSpecimensLine` (FamilyPage.tsx) breaks all three.
test('alsoUsedBy renders in the member block, linking a resolvable user and showing its role', () => {
  const def = familyWithPinlessLegendRow();
  def.family.members = def.family.members.map((m) => (m.id === 'Part' ? { ...m, alsoUsedBy: [{ component: 'Dock', role: 'Header icon' }] } : m));
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['Dock']) } as never),
  );
  assert.ok((container.textContent || '').includes('Also used by Dock (Header icon)'), container.textContent || '');
  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#Dock'), 'a resolvable user must render as a real link');
  cleanup();
});

// Important finding 1: `buildCatalogSections` derives `alsoUsedBy` for the whole exactly like any
// other member, but `FamilyPage` renders the whole through its own `WholeBelowLine`, which used to
// take only `name`/`fidelity`/`source` and silently drop the derived value. This pins that the
// whole's line renders too — reverting `WholeBelowLine` back to its three-prop shape breaks it.
test('alsoUsedBy renders on the whole too, not only on parts and related members', () => {
  const def = familyWithPinlessLegendRow();
  def.family.members = def.family.members.map((m) =>
    m.id === 'Whole' ? { ...m, alsoUsedBy: [{ component: 'Dock', role: 'Header icon' }] } : m,
  );
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['Dock']) } as never),
  );
  assert.ok((container.textContent || '').includes('Also used by Dock (Header icon)'), container.textContent || '');
  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#Dock'), 'a resolvable user must render as a real link on the whole too');
  cleanup();
});

test('alsoUsedBy renders an unresolvable user as plain text, never a dead link', () => {
  const def = familyWithPinlessLegendRow();
  def.family.members = def.family.members.map((m) => (m.id === 'Part' ? { ...m, alsoUsedBy: [{ component: 'Ghost' }] } : m));
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  assert.ok((container.textContent || '').includes('Also used by Ghost'), container.textContent || '');
  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(!links.includes('#Ghost'), 'an unresolvable user must never render as a link');
  cleanup();
});

// Regression test for making `alsoUsedBy` optional: a hand-built family (a demo, a fixture) that
// omits the field entirely — every member above does — must still render no "Also used by" line,
// the same as an explicit `[]` would.
test('a hand-built family omitting alsoUsedBy renders no "Also used by" line', () => {
  const def = familyWithPinlessLegendRow();
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  assert.ok(!(container.textContent || '').includes('Also used by'));
  cleanup();
});

// anatomy-narrow-layout, mounted wiring regression: every test above renders through the shared
// `renderCatalog` helper, whose jsdom has no `ResizeObserver` at all — `onLayout` genuinely never
// fires there (see the `familyWithManyAnatomyItems` test's own comment), so a change that deleted
// the real width-wiring path entirely (`onCardLayout`/`onPictureLayout`/the state they feed
// `anatomyLayout`) could still pass every test above unnoticed. The tests below drive the actual
// react-native-web layout-observer path instead: a minimal fake `ResizeObserver`, installed on
// this file's own jsdom window before mounting, replays the one real observer instance
// `useElementLayout` (react-native-web's own `onLayout` plumbing) lazily creates and caches for
// the whole process. jsdom has no layout engine, so the DOM node being "resized" has its own
// `offsetWidth` stubbed directly — the synthetic measurement `UIManager.measure` (queued behind a
// real `setTimeout(0)`, which `resize` below awaits inside an async `act`) then reads. This proves
// real structural/wiring behavior — which element rendered, whether the picture's own DOM node and
// keyboard focus survive a reflow, whether every item/link/pin survives it too — never actual
// browser geometry (jsdom still reports zero for anything it doesn't fake).
type ResizeEntry = { target: Element };
type ResizeCallback = (entries: ResizeEntry[]) => void;

class FakeResizeObserver {
  // `useElementLayout` constructs this at most once per process (its own module-level cache), the
  // first time any `onLayout`-bearing node mounts anywhere — capturing that one instance here is
  // the only way a test can ever reach it to fire a synthetic resize.
  static current: FakeResizeObserver | undefined;
  private observed = new Set<Element>();
  constructor(private callback: ResizeCallback) {
    FakeResizeObserver.current = this;
  }
  observe(node: Element) {
    this.observed.add(node);
  }
  unobserve(node: Element) {
    this.observed.delete(node);
  }
  disconnect() {
    this.observed.clear();
  }
  trigger(node: Element) {
    if (this.observed.has(node)) this.callback([{ target: node }]);
  }
}

// Renders exactly like the shared `renderCatalog` helper (a protected file this fix never edits),
// but on a jsdom window that also carries the fake `ResizeObserver` above, so react-native-web's
// own `onLayout` plumbing actually has one to construct.
function renderWithResizeObserver(element: React.ReactElement) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (dom.window as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    documentOf: dom.window.document,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      dom.window.close();
    },
  };
}

function stubOffsetWidth(node: Element, width: number) {
  Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
}

// Replays a resize for `node` and waits out `UIManager.measure`'s own real `setTimeout(0)` — the
// delay between the fake observer firing and `onLayout` (and the `setState` it causes) actually
// running — inside a single async `act`, so the resulting re-render is already committed by the
// time this resolves.
async function resize(node: Element, width: number) {
  stubOffsetWidth(node, width);
  await act(async () => {
    FakeResizeObserver.current?.trigger(node);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test('mounted wiring: real width/picture measurements drive a reversible side-by-side <-> stacked switch, keep the picture\'s own DOM instance, and restore focus across the reflow', async () => {
  const def = familyWithPinlessLegendRow();
  const { container, documentOf, cleanup } = renderWithResizeObserver(React.createElement(FamilyPage as never, { def } as never));

  const cardNode = container.querySelector('[data-testid="anatomy-body"]')!;
  const pictureWrapper = container.querySelector('[data-testid="anatomy-picture-measure"]')!;
  assert.ok(cardNode && pictureWrapper, 'expected both measured wrappers to render on web');
  const pictureNodeBefore = pictureWrapper.firstElementChild;

  // Consumer-reproduced wide geometry (card 1112, picture 266): room for the intact stage plus a
  // readable legend column, so the real wiring (not the item-count fallback) must choose
  // side-by-side.
  await resize(pictureWrapper, 266);
  await resize(cardNode, 1112);
  assert.equal(container.querySelectorAll('[data-testid="anatomy-legend"]').length, 1, 'wide real measurements: side by side');
  assert.equal(container.querySelectorAll('[data-testid="anatomy-columns"]').length, 0);

  const partLink = container.querySelector('a[href="#Part"]') as unknown as { focus: () => void } | null;
  assert.ok(partLink, 'expected the Part legend row to render as a link');
  partLink!.focus();
  assert.equal(documentOf.activeElement === partLink, true, 'the Part legend link actually holds focus before the reflow');

  // The consumer-reproduced narrow geometry (card 440) — the real defect: a roomy card stacks a
  // <=6-item legend's rows into `anatomyColumns`, a different tree position than `anatomyLegend`.
  await resize(cardNode, 440);
  assert.equal(container.querySelectorAll('[data-testid="anatomy-columns"]').length, 1, 'narrow real measurements: stacked');
  assert.equal(container.querySelectorAll('[data-testid="anatomy-legend"]').length, 0);
  assert.equal(pictureWrapper.firstElementChild === pictureNodeBefore, true, 'the picture keeps its own DOM instance across the reflow');
  const activeAfterShrink = documentOf.activeElement;
  assert.equal(activeAfterShrink === documentOf.body, false, 'focus must not fall off the page when the old anchor disconnects');
  assert.equal((activeAfterShrink as unknown as Element).getAttribute('href'), '#Part', 'focus is restored to the Part row\'s replacement anchor');

  // Growing back must be just as reversible — both the layout decision and the focus restoration.
  await resize(cardNode, 1112);
  assert.equal(container.querySelectorAll('[data-testid="anatomy-legend"]').length, 1, 'growing back: side by side again');
  assert.equal(pictureWrapper.firstElementChild === pictureNodeBefore, true, 'the picture still keeps its own DOM instance');
  const activeAfterGrow = documentOf.activeElement;
  assert.equal(activeAfterGrow === documentOf.body, false);
  assert.equal((activeAfterGrow as unknown as Element).getAttribute('href'), '#Part', 'focus is restored again growing back');

  // At a fixed card width, only a genuinely wider picture (not a hardcoded 266px) should tip the
  // decision to stacked: 700px fits picture 266 (594px needed) but not picture 400 (728px needed).
  await resize(cardNode, 700);
  assert.equal(container.querySelectorAll('[data-testid="anatomy-legend"]').length, 1, 'card 700 still fits a 266px picture beside a legend');
  await resize(pictureWrapper, 400);
  assert.equal(container.querySelectorAll('[data-testid="anatomy-columns"]').length, 1, 'the same 700px card no longer fits a genuinely wider 400px picture');
  assert.equal(documentOf.activeElement === documentOf.body, false, 'focus survives a picture-measurement-driven switch too');

  cleanup();
});

test('mounted wiring: a >6-item legend narrows its real column count as the card narrows, keeping every item, link and pin, and restoring focus', async () => {
  const def = familyWithManyAnatomyItems();
  const { container, documentOf, cleanup } = renderWithResizeObserver(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['ExternalOne']) } as never),
  );

  const cardNode = container.querySelector('[data-testid="anatomy-body"]')!;
  const pictureWrapper = container.querySelector('[data-testid="anatomy-picture-measure"]')!;
  await resize(pictureWrapper, 266);
  await resize(cardNode, 840); // 3 legend-column budget (clipped to this fixture's 2 groups).

  const columnsOf = () => container.querySelectorAll('[data-testid="anatomy-columns"] > *').length;
  const wideColumns = columnsOf();
  assert.equal(wideColumns, anatomyColumns(def.family.anatomy.groups, 3).length);

  // `ExternalOne`'s own group lands in a *different* column at 2 columns vs. 1 (the balancing
  // algorithm's shortest-column assignment moves the whole group, not just drops a column) — the
  // same column-index change the real `anatomyColumns` reassignment causes, so this is the row
  // that actually gets remounted at a new tree position, not merely re-rendered in place.
  const externalLink = container.querySelector('a[href="#ExternalOne"]') as unknown as { focus: () => void } | null;
  assert.ok(externalLink, 'expected the ExternalOne legend row to render as a link');
  externalLink!.focus();
  assert.equal(documentOf.activeElement === externalLink, true);

  // Narrowing to a 1-column budget redistributes every group into fewer `anatomyColumns` tracks —
  // a different tree position for whichever row currently holds focus.
  await resize(cardNode, 280);
  const narrowColumns = columnsOf();
  assert.equal(narrowColumns, anatomyColumns(def.family.anatomy.groups, 1).length);
  assert.ok(narrowColumns < wideColumns, 'the column count actually narrowed');

  const activeAfterNarrow = documentOf.activeElement;
  assert.equal(activeAfterNarrow === documentOf.body, false, 'focus must not fall off the page when the column redistribution disconnects the old anchor');
  assert.equal((activeAfterNarrow as unknown as Element).getAttribute('href'), '#ExternalOne');

  // Nothing authored was dropped, reordered or duplicated by the real reflow.
  assert.equal(container.querySelectorAll('[data-testid="legend-pin-slot"]').length, 7);
  assert.ok((container.textContent || '').includes('2.1'), 'the nested child part keeps its own dotted outline number');
  assert.ok((container.textContent || '').includes('picture'), 'the authored picture content is still present');
  const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#ExternalOne'), 'a resolvable "Other page" row still links to its real address');
  assert.ok(!links.includes('#ExternalTwo') && !links.includes('#ExternalThree'));

  cleanup();
});

// anatomy-narrow-layout, focus-registry regression: the two mounted tests above prove focus is
// *restored* after a reflow disconnects the row that held it. This proves the opposite case — once
// the reader deliberately blurs that link (moves focus to the page background, not to some other
// control the tests above can't distinguish from "nothing"), a later reflow must never refocus the
// replacement row. Covers both link variants a legend row can render: a plain member row
// (`AnatomyMemberRow`, `Part1`) and a resolved "Other page" row (`AnatomyOtherRow`, `ExternalOne`).
test('mounted wiring: deliberately blurring a legend link keeps focus off it across a later reflow, for both a member row and a resolved external row', async () => {
  const def = familyWithManyAnatomyItems();
  const { container, documentOf, cleanup } = renderWithResizeObserver(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['ExternalOne']) } as never),
  );

  // jsdom's `document`/`window` graph is circular, so comparing `documentOf.activeElement` directly
  // against a DOM node with `assert.equal`/`assert.notEqual` is only safe when the assertion
  // *passes* — a failing DOM diff can stall while formatting the large React/jsdom graph.
  // Compare boolean identity here so the RED assertion stays small and actionable.
  const isBody = () => documentOf.activeElement === documentOf.body;

  const cardNode = container.querySelector('[data-testid="anatomy-body"]')!;
  const pictureWrapper = container.querySelector('[data-testid="anatomy-picture-measure"]')!;
  await resize(pictureWrapper, 266);
  await resize(cardNode, 840); // 3 legend-column budget (clipped to this fixture's 2 groups).

  const partLink = container.querySelector('a[href="#Part1"]') as unknown as { focus: () => void; blur: () => void } | null;
  assert.ok(partLink, 'expected the Part1 legend row to render as a link');
  partLink!.focus();
  assert.equal(documentOf.activeElement === (partLink as unknown as Element), true, 'the Part1 link actually holds focus before blurring');
  partLink!.blur();
  assert.equal(isBody(), true, 'deliberately blurring the link must leave focus on body, not on the link');

  await resize(cardNode, 280);
  assert.equal(isBody(), true, 'narrowing after a deliberate blur must not steal focus back to the replacement Part1 anchor');

  await resize(cardNode, 840);
  const externalLink = container.querySelector('a[href="#ExternalOne"]') as unknown as { focus: () => void; blur: () => void } | null;
  assert.ok(externalLink, 'expected the ExternalOne legend row to render as a link');
  externalLink!.focus();
  assert.equal(documentOf.activeElement === (externalLink as unknown as Element), true, 'the ExternalOne link actually holds focus before blurring');
  externalLink!.blur();
  assert.equal(isBody(), true, 'deliberately blurring the external link must leave focus on body, not on the link');

  await resize(cardNode, 280);
  assert.equal(isBody(), true, 'narrowing after a deliberate blur must not steal focus back to the replacement ExternalOne anchor');

  cleanup();
});

// #63 R3: a family's own part list for an id defined on a group page (`FamilyDef.externalParts`)
// — real `defineCatalogPage` → `buildCatalogSections` (not a hand-built `FamilyDef`), since the
// external part's own number is computed by that pre-pass, not authorable directly.
function familyWithExternalPartFixture(ownerFidelity: 'documentation-only' | 'replicated' = 'documentation-only', withAnatomy = false) {
  const family = defineCatalogPage({
    id: 'BotAvatarView', group: 'Components', description: 'd', whole: 'BotAvatarView',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['BotAnimatedFaceView', 'ExternalEyes'] }],
    members: [
      { id: 'BotAvatarView', source: 'w.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'The whole.' },
      { id: 'BotAnimatedFaceView', source: 'f.swift:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'BotAvatarView', description: 'The own part.' },
    ],
    ...(withAnatomy ? {
      anatomy: {
        picture: React.createElement('div', null, 'picture'),
        groups: [{ label: 'Shown', items: [{ member: 'BotAnimatedFaceView', description: 'Own.' }, { member: 'ExternalEyes', description: 'External.' }] }],
      },
    } : {}),
  });
  const group = defineCatalogPage({
    id: 'EyesGroup', group: 'Components', description: 'd', title: 'Eyes group',
    members: [
      { id: 'ExternalEyes', source: 'e.swift:1', fidelity: ownerFidelity, relationship: 'Top', parent: 'BotAvatarView', description: 'd' },
    ],
  });
  const { sections } = buildCatalogSections([family, group].map((p) => ({ ...p, file: `fixtures/${p.id}.catalog.tsx` })), []);
  return sections.find((s) => s.id === 'BotAvatarView')!;
}

test('an external-part row in the family\'s own part list shows its number, no specimens, and a "Details on <group title>" link', () => {
  const def = familyWithExternalPartFixture();
  // In the real shell, `knownAddressIds` is every page id plus every member id/alias catalog-wide
  // (`CatalogShell`'s own `aliasMap`) — `ExternalEyes` itself, not only its own group page's id.
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['EyesGroup', 'ExternalEyes']) } as never),
  );
  try {
    assert.ok((container.textContent || '').includes('ExternalEyes'), 'expected the external part\'s own name to render');
    assert.ok((container.textContent || '').includes('Details on Eyes group'), 'expected the "Details on <group title>" link text');
    assert.equal((container.textContent || '').includes('2'), true, 'expected the external part\'s own outline number (2) to render as a pin');
    assert.equal((container.textContent || '').includes('e.swift:1'), false, 'the external part must never show its own source line (no duplicated details)');

    const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    assert.ok(links.includes('#ExternalEyes'), 'the "Details on" link must point at the external member\'s own address');
  } finally { cleanup(); }
});

/** The class list of the pin showing `number` — scoped to a root; a dashed pin (documentation-only)
 *  and a solid one carry different atomic classes, so comparing two pins' classes tells them apart. */
function pinClassFor(root: ParentNode, number: string): string {
  const leaf = [...root.querySelectorAll('[aria-hidden="true"] > *')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === number);
  assert.ok(leaf, `expected a pin reading "${number}"`);
  return leaf!.parentElement!.className;
}

// Part-list rows are solid for own and external parts alike (only anatomy pins are ever dashed).
test('an external part\'s anatomy legend pin is dashed or solid by its owning member\'s fidelity', () => {
  for (const [fidelity, sameAsDashedOwnPart] of [['documentation-only', true], ['replicated', false]] as const) {
    const def = familyWithExternalPartFixture(fidelity, true);
    const { container, cleanup } = renderCatalog(
      React.createElement(FamilyPage as never, { def, knownAddressIds: new Set(['EyesGroup', 'ExternalEyes']) } as never),
    );
    try {
      const slots = [...container.querySelectorAll('[data-testid="legend-pin-slot"]')];
      assert.equal(slots.length, 2);
      assert.equal(pinClassFor(slots[1], '2') === pinClassFor(slots[0], '1'), sameAsDashedOwnPart, `owner ${fidelity}`);
    } finally { cleanup(); }
  }
});

// ---- Member side panel (P1), page-kind explainer (P2), page notes (P3) -------------------------

const PANEL_SELECTOR = '[role="dialog"][aria-modal="true"]';

function panelEl(): HTMLElement | null {
  return document.querySelector(PANEL_SELECTOR);
}

function triggers(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('[aria-haspopup="dialog"]')] as HTMLElement[];
}

function triggerFor(container: HTMLElement, memberLabelStart: string): HTMLElement {
  const match = triggers(container).find((t) => (t.textContent || '').startsWith(memberLabelStart));
  assert.ok(match, `expected a side-panel trigger starting "${memberLabelStart}"`);
  return match!;
}

function press(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

function pressEscape() {
  act(() => { document.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); });
}

function panelTitle(): string {
  const dialog = panelEl()!;
  const id = dialog.getAttribute('aria-labelledby');
  assert.ok(id, 'the dialog must be labelled by its heading');
  return (document.getElementById(id!)?.textContent || '').trim();
}

function panelFamilyFixture() {
  const page = defineCatalogPage({
    id: 'Suite', group: 'Components', description: 'The suite.', whole: 'Suite',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Alpha', 'Beta', 'Gamma'] }],
    members: [
      { id: 'Suite', source: 's.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'The whole.' },
      {
        id: 'Alpha', source: 'a.swift:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Suite', description: 'First part.',
        notes: ['Alpha note one.'], whenToUse: 'Use Alpha for first things.', api: 'struct Alpha: View',
        composedOf: [{ component: 'Beta', role: 'Helper', relationship: 'built-in' as const }],
      },
      { id: 'Beta', source: 'b.swift:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Suite', description: 'Second part.', notes: ['Beta note one.'] },
      { id: 'Gamma', source: 'g.swift:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Suite', description: 'Nothing to disclose.' },
    ],
  });
  const { sections } = buildCatalogSections([{ ...page, file: 'fixtures/Suite.catalog.tsx' }], []);
  return sections.find((s) => s.id === 'Suite')!;
}

test('pressing a member trigger opens a dialog with its notes and API, and nothing expands below the member', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
  try {
    assert.ok(panelEl() === null, 'no panel until a trigger is pressed');
    const trigger = triggerFor(container, 'Notes and API');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.ok((trigger.textContent || '').trim().endsWith('›'), 'the trigger ends in a › chevron');
    press(trigger);
    const dialog = panelEl();
    assert.ok(dialog, 'expected a dialog after pressing the trigger');
    assert.equal(panelTitle(), 'Alpha', 'the dialog is labelled by the member name');
    const text = dialog!.textContent || '';
    assert.ok(text.includes('Notes and API'), 'the panel kicker is the trigger label');
    assert.ok(text.includes('Alpha note one.') && text.includes('Use Alpha for first things.') && text.includes('struct Alpha: View'), 'the panel shows notes, guidance and API');
    assert.equal(triggerFor(container, 'Notes and API').getAttribute('aria-expanded'), 'true');
    assert.equal(triggerFor(container, 'Notes and API').getAttribute('aria-haspopup'), 'dialog');
    assert.equal((container.textContent || '').includes('Alpha note one.'), false, 'nothing expands inline below the member');
    assert.equal((container.textContent || '').includes('struct Alpha: View'), false);
  } finally { cleanup(); }
});

test('Esc closes the panel and returns focus to the trigger that opened it', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
  try {
    const trigger = triggerFor(container, 'Notes and API');
    act(() => { trigger.focus(); });
    press(trigger);
    assert.ok(panelEl());
    assert.ok(panelEl()!.contains(document.activeElement), 'focus moves into the panel on open');
    pressEscape();
    assert.ok(panelEl() === null, 'Esc closes the panel');
    assert.ok(document.activeElement === trigger, 'focus returns to the opening trigger');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  } finally { cleanup(); }
});

test('the × button (named "Close") and a scrim press both close the panel', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
  try {
    press(triggerFor(container, 'Notes and API'));
    const close = panelEl()!.querySelector('[aria-label="Close"]');
    assert.ok(close, 'expected a control with the accessible name "Close"');
    press(close!);
    assert.ok(panelEl() === null, 'the Close button closes the panel');
    press(triggerFor(container, 'Notes and API'));
    const scrim = document.querySelector('[data-testid="member-panel-scrim"]');
    assert.ok(scrim, 'expected the scrim behind the panel');
    press(scrim!);
    assert.ok(panelEl() === null, 'a scrim press closes the panel');
  } finally { cleanup(); }
});

test('Tab wrapping out of the panel (either focus bracket) lands on a real control inside it, never the scrim', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
  try {
    press(triggerFor(container, 'Notes and API'));
    const dialog = panelEl()!;
    const scrim = document.querySelector('[data-testid="member-panel-scrim"]')!;
    assert.ok(scrim, 'expected the scrim behind the panel');
    const brackets = [...document.querySelectorAll('div[role="presentation"][tabindex="0"]')] as HTMLElement[];
    assert.ok(brackets.length >= 2, 'expected the modal focus trap\'s leading and trailing brackets');
    for (const bracket of [brackets[brackets.length - 1], brackets[0]]) {
      act(() => { bracket.focus(); });
      const active = document.activeElement as HTMLElement;
      assert.ok(active !== scrim && !scrim.contains(active), 'focus never lands on the scrim');
      assert.ok(active !== document.body && dialog.contains(active), 'focus stays inside the panel');
      assert.ok(active.matches('button, a, [role="button"], [role="link"], [tabindex="0"]'), `focus lands on a real control, got <${active.tagName.toLowerCase()} tabindex=${active.getAttribute('tabindex')}>`);
    }
  } finally { cleanup(); }
});

test('the open panel sets body overflow to hidden and restores it on close and on unmount', () => {
  try {
    const first = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
    try {
      document.body.style.overflow = 'auto'; // after render: `renderCatalog` resets the body's style
      assert.equal(document.body.style.overflow, 'auto', 'untouched until a panel opens');
      press(triggerFor(first.container, 'Notes and API'));
      assert.equal(document.body.style.overflow, 'hidden', 'locked while the panel is open');
      pressEscape();
      assert.equal(document.body.style.overflow, 'auto', 'restored to what it was on close');
    } finally { first.cleanup(); }

    const second = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
    document.body.style.overflow = 'auto';
    press(triggerFor(second.container, 'Notes and API'));
    assert.equal(document.body.style.overflow, 'hidden');
    second.cleanup(); // unmounted while still open
    assert.equal(document.body.style.overflow, 'auto', 'restored on unmount');
  } finally { document.body.style.overflow = ''; }
});

test('opening a second member\'s trigger swaps the panel content; only one panel is ever open', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
  try {
    const [first, second] = triggers(container);
    assert.equal(triggers(container).length, 2, 'Alpha and Beta have a trigger');
    press(first);
    assert.equal(panelTitle(), 'Alpha');
    press(second);
    assert.equal(document.querySelectorAll(PANEL_SELECTOR).length, 1, 'only one panel at a time');
    assert.equal(panelTitle(), 'Beta');
    assert.ok((panelEl()!.textContent || '').includes('Beta note one.'));
    assert.equal((panelEl()!.textContent || '').includes('Alpha note one.'), false, 'the first member\'s content is gone');
  } finally { cleanup(); }
});

test('a member with nothing to disclose renders no trigger', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
  try {
    assert.equal(triggers(container).length, 2, 'Gamma (no notes/API/guidance) gets no trigger, Alpha and Beta do');
    assert.ok((container.textContent || '').includes('Nothing to disclose.'), 'Gamma itself still renders');
  } finally { cleanup(); }
});

test('the family explainer renders on a family page, the group copy does not', () => {
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture() } as never));
  try {
    const text = container.textContent || '';
    assert.ok(text.includes('Family page. One component and the parts it’s built from. Each part is its own component, unlike variants, which are one component changed by its props.'));
    assert.equal(text.includes('Group page.'), false);
  } finally { cleanup(); }
});

test('a plain component page shows neither page-kind explainer', () => {
  const page = defineCatalogPage({ id: 'Plain', group: 'Components', description: 'A plain page.', source: 'src/Plain.tsx' });
  const { sections } = buildCatalogSections([{ ...page, file: 'fixtures/Plain.catalog.tsx' }], []);
  const { container, cleanup } = renderCatalog(React.createElement(SectionBlock as never, { def: sections[0] } as never));
  try {
    const text = container.textContent || '';
    assert.ok(text.includes('A plain page.'));
    assert.equal(text.includes('Family page.'), false);
    assert.equal(text.includes('Group page.'), false);
  } finally { cleanup(); }
});

test('page notes render as a Notes entry in the standalone page\'s Notes and API panel', () => {
  const page = defineCatalogPage({ id: 'Noted', group: 'Components', description: 'A noted page.', source: 'src/Noted.tsx', notes: ['First page note.', 'Second page note.'] });
  const { sections } = buildCatalogSections([{ ...page, file: 'fixtures/Noted.catalog.tsx' }], []);
  const { container, cleanup } = renderCatalog(React.createElement(SectionBlock as never, { def: sections[0] } as never));
  try {
    assert.equal((container.textContent || '').includes('First page note.'), false, 'notes are not inline on the page');
    press(triggerFor(container, 'Notes and API'));
    const panel = panelEl()!;
    const label = [...panel.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Notes');
    assert.ok(label, 'expected a "Notes" entry label');
    const entry = label!.parentElement!;
    assert.ok((entry.textContent || '').includes('First page note.') && (entry.textContent || '').includes('Second page note.'), 'every note is listed under Notes');
  } finally { cleanup(); }
});

test('a page without notes renders no Notes entry', () => {
  const page = defineCatalogPage({ id: 'Unnoted', group: 'Components', description: 'No notes.', source: 'src/Unnoted.tsx' });
  const { sections } = buildCatalogSections([{ ...page, file: 'fixtures/Unnoted.catalog.tsx' }], []);
  const { container, cleanup } = renderCatalog(React.createElement(SectionBlock as never, { def: sections[0] } as never));
  try {
    press(triggerFor(container, 'Notes and API'));
    assert.equal([...panelEl()!.querySelectorAll('*')].some((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Notes'), false);
  } finally { cleanup(); }
});

test('following a link inside the panel closes the panel first, then navigates (same-page target)', () => {
  const calls: string[] = [];
  const navigation = {
    resolve: (name: string) => ({ pageId: 'Suite', memberId: name }),
    open: (pageId: string, memberId?: string) => { calls.push(`${pageId}/${memberId}:panelOpen=${panelEl() !== null}`); },
  };
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def: panelFamilyFixture(), navigation } as never));
  try {
    press(triggerFor(container, 'Notes and API'));
    const link = [...panelEl()!.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === 'Beta');
    assert.ok(link, 'expected the Uses line\'s Beta reference to be a link inside the panel');
    press(link!);
    assert.deepEqual(calls, ['Suite/Beta:panelOpen=true'], 'navigation is requested exactly once');
    assert.ok(panelEl() === null, 'the panel is closed after following the link');
  } finally { cleanup(); }
});

test('a family page lays its anatomy picture out at the whole member\'s first preview width when the page declares none', () => {
  const def = familyWithPinlessLegendRow();
  const members = def.family.members.map((m) => (m.id === 'Whole' ? { ...m, previewWidths: [402, 390, 320] } : m));
  const { container, cleanup } = renderCatalog(
    React.createElement(FamilyPage as never, { def: { ...def, family: { ...def.family, members } } } as never),
  );
  try {
    const picture = container.querySelector('[data-testid="anatomy-picture-measure"]') as HTMLElement | null;
    assert.ok(picture, 'expected the anatomy picture wrapper');
    assert.equal(picture!.style.width, '462px', 'the picture must use the whole member\'s first preview width (plus the pin margin)');
  } finally {
    cleanup();
  }
});
