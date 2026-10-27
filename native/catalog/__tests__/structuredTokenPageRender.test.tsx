// #61 mounted regression: drives the real `defineCatalogPage`/`buildCatalogSections` producer and
// the real `SectionBlock` renderer for an opted-in `tokenDefinition` page — not only JSX/source-text
// regexes. Same jsdom/`canUseDOM` warmup precedent `referenceNavigationRender.test.tsx` documents in
// full: a plain top-level import of anything that transitively reaches `react-dom`/`react-native-web`
// would decide `canUseDOM` before a real `window` exists, so every reachable module is loaded only
// through a dynamic `import()` below, after the warmup `window`/`document`/`navigator` are in place.
//
// `TokenSections`/`TokenGrid` (`TokenLayouts.tsx`) only render their real children once they've
// measured their own width via `onLayout` — jsdom has no `ResizeObserver` at all, so that never
// fires through the shared `renderCatalog` helper (see `familyPageRender.test.tsx`'s own
// "anatomy-narrow-layout" comment for the full explanation). This file reuses that exact same
// established fake-`ResizeObserver` pattern instead of inventing a second one, generalized to fire
// every node the shared observer instance has collected (`TokenSections`' own outer view, then
// each inner `TokenGrid`'s own, mounted only after the first resize commits) rather than needing a
// `data-testid` on each one.
//
// Every value below is a labeled fixture (design R5: "never present them as a real product's
// values") — none of it is Hermex's or any other real consumer's actual tokens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { TokenDefinition } from '../tokenDefinition.ts';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
// `react-native-web`'s own `AccessibilityInfo` (`MotionSpecimen.tsx`'s reduce-motion contract)
// decides `prefersReducedMotionMedia` once, at ITS OWN first import, from `window.matchMedia` —
// jsdom has no `matchMedia` at all, which would otherwise cache that as `null` forever for this
// process and make its own `addEventListener` return `undefined` (crashing on unmount's
// `subscription.remove()`). Stubbed before the first dynamic import below, the same "decide before
// a real window exists" timing this file's own warmup already guards for `canUseDom`. `matches:
// true` deliberately exercises `MotionSpecimen`'s reduced-motion path (R5: "cover reduced motion
// through the existing established pattern") — jsdom also has no `requestAnimationFrame`, which
// the real (non-reduced) `Animated.timing` path would otherwise need.
(warmup.window as unknown as { matchMedia: (query: string) => unknown }).matchMedia = (query: string) => ({
  matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
});

const { SectionBlock } = await import('../SectionBlock.tsx');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');
const { motionReplayLabel } = await import('../motionValueDomain.ts');

type ResizeEntry = { target: Element };
type ResizeCallback = (entries: ResizeEntry[]) => void;

class FakeResizeObserver {
  static current: FakeResizeObserver | undefined;
  observed = new Set<Element>();
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
  triggerAll() {
    this.callback([...this.observed].map((target) => ({ target })));
  }
}

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
  act(() => { root.render(element); });
  return {
    container,
    cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); },
  };
}

function stubOffsetWidth(node: Element, width: number) {
  Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
}

/** Fires every node the one shared `FakeResizeObserver` instance has collected so far, waiting out
 *  the real `setTimeout(0)` between the observer firing and `onLayout`'s own queued `UIManager.measure`
 *  actually running (`familyPageRender.test.tsx`'s own `resize` helper, generalized to every
 *  observed node rather than one caller-chosen one — a `TokenSections` card only mounts its own
 *  inner `TokenGrid`(s) once ITS width is known, so those appear as newly observed nodes only after
 *  an earlier round already committed). Call it a couple of times to let that cascade settle. */
async function resizeAll(width: number) {
  const observer = FakeResizeObserver.current;
  if (!observer) return;
  for (const node of observer.observed) stubOffsetWidth(node, width);
  await act(async () => {
    observer.triggerAll();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function settleLayout(width = 1200) {
  for (let i = 0; i < 3; i += 1) await resizeAll(width);
}

function plainTextPresent(container: HTMLElement, text: string): boolean {
  return [...container.querySelectorAll('*')].some((e) => e.children.length === 0 && (e.textContent || '').includes(text));
}

/** Counts leaf elements whose own text includes `text` — used to tell "shown once, at the section
 *  level" apart from "shown on every entry" (correction C1's consolidation rule). */
function plainTextOccurrences(container: HTMLElement, text: string): number {
  return [...container.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').includes(text)).length;
}

function pageHeading(): string {
  return (document.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
}

// Two independent, scoped palettes with an EQUAL entry name ("accent") in two different sections —
// real per-entry light/dark appearances, a named token whose value is platform-provided, an
// unresolved centralization finding with a real drawable literal, and a truly unresolved value with
// no fabricated sample (the three required R2 positive cases).
function fixtureColorsDefinition(): TokenDefinition {
  return {
    kind: 'colors',
    sections: [
      {
        id: 'surfaceA', title: 'Surface A (fixture)',
        entries: [
          { id: 'accent', name: 'Accent A', kind: 'colors', appearance: 'light', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#1a73e8' } } } },
          { id: 'accentDark', name: 'Accent A (dark)', kind: 'colors', appearance: 'dark', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#4d9bff' } } } },
        ],
      },
      {
        id: 'surfaceB', title: 'Surface B (fixture)',
        entries: [
          // Scoped duplicate of "accent" — same id, different section: allowed.
          { id: 'accent', name: 'Accent B', kind: 'colors', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#ab47bc' } } } },
          // A named token whose own value is platform-provided — no literal to draw.
          {
            id: 'background', name: 'Background', kind: 'colors', role: 'Screen background',
            value: { provenance: 'platform', named: true, resolution: { status: 'unresolved', reason: 'Provided by the platform at runtime.', expression: 'UIColor.systemBackground' } },
          },
          // An unresolved centralization finding with a real drawable color literal.
          {
            id: 'liveActivityTint', name: 'Live Activity tint', kind: 'colors', source: 'AgentRunLiveActivityWidget.swift:42',
            value: { provenance: 'unresolved-finding', resolution: { status: 'resolved', value: { color: '#f2994a' } } },
          },
          // A truly undefined value — no fabricated sample, only the real reason/expression.
          {
            id: 'accentColorAsset', name: 'AccentColor', kind: 'colors',
            value: { provenance: 'unresolved-finding', resolution: { status: 'unresolved', reason: 'AccentColor.colorset has no defined value.', expression: 'AccentColor' } },
          },
        ],
      },
    ],
  };
}

function fixtureMotionDefinition(): TokenDefinition {
  return {
    kind: 'motion',
    sections: [
      {
        id: 'durations', title: 'Durations (fixture)',
        entries: [
          { id: 'base', name: 'Base', kind: 'motion', value: { provenance: 'named', resolution: { status: 'resolved', value: { kind: 'timing', durationMs: 300, sourceValue: 0.3, sourceUnit: 's' } } } },
          { id: 'bounceSpring', name: 'Bounce spring', kind: 'motion', value: { provenance: 'inline', resolution: { status: 'resolved', value: { kind: 'native-expression', expression: '.spring(duration: 0.4, bounce: 0.3)', detail: 'Not the stiffness/damping/mass model.' } } } },
          { id: 'conditional', name: 'Conditional', kind: 'motion', value: { provenance: 'inline', resolution: { status: 'unresolved', reason: 'Depends on isPressed; no one fixed value.' } } },
        ],
      },
    ],
  };
}

test('producer-to-renderer: a real buildCatalogSections + mounted SectionBlock derives the canonical title and renders real color entries', async () => {
  const pages = [defineCatalogPage({ id: 'tokens-colors', group: 'Tokens', description: 'Fixture colors.', tokenDefinition: fixtureColorsDefinition() })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-colors.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-colors')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    await settleLayout();
    assert.equal(pageHeading(), 'Colors', 'title must derive from the kind when omitted');
    assert.ok(plainTextPresent(container, 'Accent A'), 'expected the light-appearance entry');
    assert.ok(plainTextPresent(container, 'Accent A (dark)'), 'expected the independent dark-appearance entry');
    assert.ok(plainTextPresent(container, '#1a73e8'), 'the light-appearance entry must show its own real value, not just its name');
    assert.ok(plainTextPresent(container, '#4d9bff'), 'the independent dark-appearance entry must show its own real value');
    assert.ok(plainTextPresent(container, 'Accent B'), 'a scoped duplicate id in a different section must still render under its own name');
    assert.ok(plainTextPresent(container, 'Provided by the platform at runtime.'), 'a named token whose value is platform-provided must show its real reason, not a fabricated sample');
    assert.ok(plainTextPresent(container, 'AgentRunLiveActivityWidget.swift:42'), 'an unresolved finding with a real drawable literal must still show its citation');
    assert.ok(plainTextPresent(container, 'AccentColor.colorset has no defined value.'), 'a truly unresolved value must show its real reason');
    // Correction C2: the invented "not drawable" classification must never appear; a neutral
    // placeholder stands in its place.
    assert.equal(plainTextPresent(container, 'not drawable'), false, 'the fabricated "not drawable" classification must never appear');
    assert.ok(plainTextPresent(container, 'No sample'), 'a neutral placeholder stands in for an unresolved value\'s missing preview');
    // Correction C1: real provenance is visible as plain caption text, never a badge. Section
    // "surfaceA" (both entries "named", no `named` flag) is fully consolidated — shown once, not
    // per entry; section "surfaceB" mixes "named"/"platform"+named/"unresolved-finding", so each of
    // its entries shows its own line instead.
    // surfaceA's two entries share one caption, consolidated to a single section-level line;
    // surfaceB mixes provenance, so its own "accent" entry (also "named") shows its own line too —
    // 2 total, never 4 (one per surfaceA entry would be the bug this guards against).
    assert.equal(plainTextOccurrences(container, 'Named token'), 2, 'surfaceA\'s consolidated line, plus surfaceB\'s own non-consolidated "accent" entry — never once per surfaceA entry');
    assert.ok(plainTextPresent(container, 'Platform-provided · named token'), 'a platform-provided value that is also exposed through a named token shows both, never a badge');
    assert.equal(plainTextOccurrences(container, 'Unresolved finding'), 2, 'surfaceB\'s two unresolved-finding entries each show their own provenance line');
  } finally { cleanup(); }
});

test('mounted SectionBlock renders real motion entries: a replayable timing specimen, an honest non-replayable native expression, and a symbolic/unresolved value', async () => {
  const pages = [defineCatalogPage({ id: 'tokens-motion', group: 'Tokens', description: 'Fixture motion.', tokenDefinition: fixtureMotionDefinition() })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-motion.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-motion')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    await settleLayout();
    assert.equal(pageHeading(), 'Motion');
    const replay = [...container.querySelectorAll('[role="button"]')].find((b) => b.getAttribute('aria-label') === motionReplayLabel({ kind: 'timing', duration: 300, label: '0.3s' }));
    assert.ok(replay, 'expected a real MotionSpecimen replay control wired to the entry\'s own real label/duration');
    assert.ok(plainTextPresent(container, 'not replayable as physics'), 'a native duration/bounce expression must stay honest text, never a guessed physics conversion');
    assert.ok(plainTextPresent(container, '.spring(duration: 0.4, bounce: 0.3)'), 'the real native expression must still be shown');
    assert.ok(plainTextPresent(container, 'Depends on isPressed; no one fixed value.'));
    // Correction C2: "symbolic / conditional" was a fabricated classification — never shown now.
    assert.equal(plainTextPresent(container, 'symbolic / conditional'), false, 'the fabricated "symbolic / conditional" classification must never appear');
    // Correction C1: "base" is "named", the other two are "inline" — not all three agree, so every
    // entry shows its own provenance line rather than one consolidated at the section level.
    assert.ok(plainTextPresent(container, 'Named token'), '"base" is a named token');
    assert.equal(plainTextOccurrences(container, 'Inline value'), 2, '"bounceSpring" and "conditional" are both inline values, each shown on its own entry');
  } finally { cleanup(); }
});

test('mounted SectionBlock surfaces an actionable diagnostic for invalid opted-in data instead of a fake specimen or nothing', async () => {
  const def: TokenDefinition = {
    kind: 'spacing',
    sections: [{
      id: 'scale', title: 'Scale (fixture)',
      entries: [
        { id: 'sm', name: 'Small', kind: 'spacing', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 8, unit: 'px' } } } },
        { id: 'sm', name: 'Small (duplicate)', kind: 'spacing', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 9, unit: 'px' } } } },
      ],
    }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-spacing', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-spacing.catalog.tsx' })), []);
  const sectionDef = sections.find((s) => s.id === 'tokens-spacing')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sectionDef } as never));
  try {
    await settleLayout();
    assert.ok(plainTextPresent(container, 'Invalid token data'), 'invalid opted-in data must produce a visible diagnostic');
    assert.ok(plainTextPresent(container, 'more than one entry with id "sm"'));
    assert.ok(plainTextPresent(container, 'Small'), 'the first, valid occurrence must still render — never silently nothing');
    assert.ok(plainTextPresent(container, '8px'));
  } finally { cleanup(); }
});

test('mounted SectionBlock renders explicit dimensional units, never a calibrated-pixel guess for a native point value', async () => {
  const def: TokenDefinition = {
    kind: 'radius',
    sections: [{
      id: 'scale', title: 'Scale (fixture)',
      entries: [
        { id: 'control', name: 'Control', kind: 'radius', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 12, unit: 'pt' } } } },
      ],
    }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-radius', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-radius.catalog.tsx' })), []);
  const sectionDef = sections.find((s) => s.id === 'tokens-radius')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sectionDef } as never));
  try {
    await settleLayout();
    assert.equal(pageHeading(), 'Radius');
    assert.ok(plainTextPresent(container, '12pt'), 'native points must be labeled with their own real unit, never presented as calibrated browser pixels');
  } finally { cleanup(); }
});

test('mounted SectionBlock renders a real shadow specimen and an opacity entry at its own real ratio', async () => {
  const shadowDef: TokenDefinition = {
    kind: 'shadows',
    sections: [{ id: 'elevation', title: 'Elevation (fixture)', entries: [
      { id: 'card', name: 'Card', kind: 'shadows', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#000000', opacity: 0.2, radius: 8, x: 0, y: 2 } } } },
    ] }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-shadows', group: 'Tokens', description: 'Fixture.', tokenDefinition: shadowDef })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-shadows.catalog.tsx' })), []);
  const sectionDef = sections.find((s) => s.id === 'tokens-shadows')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sectionDef } as never));
  try {
    await settleLayout();
    assert.equal(pageHeading(), 'Shadows');
    assert.ok(plainTextPresent(container, '20% #000000'), 'expected the real shadow literal\'s own opacity/color, not a fabricated value');
  } finally { cleanup(); }
});

test('mounted SectionBlock renders a real typography specimen with its own fontSize/unit, consolidating its one shared provenance at the section level', async () => {
  const def: TokenDefinition = {
    kind: 'typography',
    sections: [{
      id: 'body', title: 'Body (fixture)',
      entries: [
        { id: 'body', name: 'Body', kind: 'typography', value: { provenance: 'named', resolution: { status: 'resolved', value: { fontSize: 16, fontSizeUnit: 'px', fontWeight: 400 } } } },
      ],
    }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-typography', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-typography.catalog.tsx' })), []);
  const sectionDef = sections.find((s) => s.id === 'tokens-typography')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sectionDef } as never));
  try {
    await settleLayout();
    assert.equal(pageHeading(), 'Typography');
    assert.ok(plainTextPresent(container, '16px'), 'the real fontSize and its own unit must be visible');
    assert.ok(plainTextPresent(container, 'Named token'), 'the entry\'s own provenance is shown (consolidated, with a single entry in the section)');
  } finally { cleanup(); }
});

test('mounted SectionBlock renders a dimensions-kind entry with its own real unit', async () => {
  const def: TokenDefinition = {
    kind: 'dimensions',
    sections: [{
      id: 'control', title: 'Control (fixture)',
      entries: [
        { id: 'height', name: 'Control height', kind: 'dimensions', value: { provenance: 'inline', resolution: { status: 'resolved', value: { amount: 44, unit: 'pt' } } } },
      ],
    }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-dimensions', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-dimensions.catalog.tsx' })), []);
  const sectionDef = sections.find((s) => s.id === 'tokens-dimensions')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sectionDef } as never));
  try {
    await settleLayout();
    assert.equal(pageHeading(), 'Dimensions');
    assert.ok(plainTextPresent(container, '44pt'), 'a dimensions-kind entry must show its own real unit');
    assert.ok(plainTextPresent(container, 'Inline value'), 'the entry\'s own provenance is shown');
  } finally { cleanup(); }
});

// Correction C1, isolated: one section where every entry shares the same provenance+named pair
// (consolidated — shown exactly once, at the section level) next to one where they disagree (shown
// on every entry) — the exact mechanism the colors/motion tests above exercise incidentally.
test('mounted SectionBlock consolidates a section\'s shared provenance to one line, but shows it per entry when a section\'s entries disagree', async () => {
  const def: TokenDefinition = {
    kind: 'opacity',
    sections: [
      {
        id: 'consistent', title: 'Consistent (fixture)',
        entries: [
          { id: 'low', name: 'Low', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.2 } } } },
          { id: 'mid', name: 'Mid', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.4 } } } },
          { id: 'high', name: 'High', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.6 } } } },
        ],
      },
      {
        id: 'mixed', title: 'Mixed (fixture)',
        entries: [
          { id: 'namedOne', name: 'Named one', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.1 } } } },
          { id: 'inlineOne', name: 'Inline one', kind: 'opacity', value: { provenance: 'inline', resolution: { status: 'resolved', value: { amount: 0.9 } } } },
        ],
      },
    ],
  };
  const pages = [defineCatalogPage({ id: 'tokens-opacity', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-opacity.catalog.tsx' })), []);
  const sectionDef = sections.find((s) => s.id === 'tokens-opacity')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sectionDef } as never));
  try {
    await settleLayout();
    assert.equal(pageHeading(), 'Opacity');
    // "consistent"'s 3 entries share "Named token" — consolidated, once. "mixed"'s own "namedOne"
    // entry also happens to be "named", but since "mixed" itself disagrees it shows its own line too
    // — 2 total, never 1 (fully suppressed) and never 4 (consolidation not applied at all).
    assert.equal(plainTextOccurrences(container, 'Named token'), 2, 'one consolidated line for "consistent", plus "mixed"\'s own non-consolidated "namedOne" entry');
    assert.equal(plainTextOccurrences(container, 'Inline value'), 1, '"mixed"\'s own "inlineOne" entry shows its own line');
  } finally { cleanup(); }
});

test('a long color token name stays fully readable instead of being clipped to one line', async () => {
  const longName = 'Live Activity widget background tint (fixture)';
  const def: TokenDefinition = {
    kind: 'colors',
    sections: [{ id: 'long', title: 'Long names (fixture)', entries: [
      { id: 'long', name: longName, kind: 'colors', value: { provenance: 'inline', resolution: { status: 'resolved', value: { color: '#f2994a' } } } },
    ] }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-long', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-long.catalog.tsx' })), []);
  const sectionDef = sections.find((s) => s.id === 'tokens-long')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sectionDef } as never));
  try {
    await settleLayout();
    const nameNode = [...container.querySelectorAll('*')].find((n) => n.children.length === 0 && n.textContent === longName) as HTMLElement | undefined;
    assert.equal(Boolean(nameNode), true, 'the full name is rendered');
    // jsdom does not apply react-native-web's atomic stylesheet, so computed style cannot observe
    // `numberOfLines={1}`; its emitted single-line classes are the observable rendered contract here.
    const classes = nameNode!.className;
    assert.equal(/r-whiteSpace-|r-textOverflow-/.test(classes), false, `the token name must wrap, not be clipped to one line (${classes})`);
  } finally { cleanup(); }
});

// #64 B1: groups inside a category.
function fixtureGroupsDefinition(): TokenDefinition {
  return {
    kind: 'opacity',
    sections: [{
      id: 'scale', title: 'Scale (fixture)',
      entries: [{ id: 'base', name: 'Base (fixture)', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.5 } } } }],
      groups: [{
        id: 'extra', title: 'Extra group (fixture)', desc: 'A sub-group of the Scale section.',
        entries: [{ id: 'faint', name: 'Faint (fixture)', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.1 } } } }],
      }],
    }],
  };
}

test('mounted SectionBlock renders a group\'s own sub-heading and its entries, after the section\'s own entries', async () => {
  const pages = [defineCatalogPage({ id: 'tokens-groups', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixtureGroupsDefinition() })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-groups.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-groups')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    await settleLayout();
    assert.ok(plainTextPresent(container, 'Base (fixture)'), 'the section\'s own entry must still render');
    assert.ok(plainTextPresent(container, 'Extra group (fixture)'), 'expected the group\'s own sub-heading');
    assert.ok(plainTextPresent(container, 'A sub-group of the Scale section.'), 'expected the group\'s own desc');
    assert.ok(plainTextPresent(container, 'Faint (fixture)'), 'expected the group\'s own entry');
  } finally { cleanup(); }
});

// #64 B2: category jump row.
test('mounted SectionBlock shows a jump row chip per section, with counts including group entries, only when there is more than one section', async () => {
  const twoSections: TokenDefinition = {
    kind: 'opacity',
    sections: [
      { id: 'attention', title: 'Attention (fixture)', entries: [{ id: 'a', name: 'A', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.1 } } } }] },
      {
        id: 'palette', title: 'Palette (fixture)',
        entries: [{ id: 'b', name: 'B', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.2 } } } }],
        groups: [{ id: 'g', title: 'G', entries: [{ id: 'c', name: 'C', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.3 } } } }] }],
      },
    ],
  };
  const pages = [defineCatalogPage({ id: 'tokens-jump', group: 'Tokens', description: 'Fixture.', tokenDefinition: twoSections })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-jump.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-jump')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    await settleLayout();
    const chips = [...container.querySelectorAll('[role="button"]')];
    const attentionChip = chips.find((b) => b.getAttribute('aria-label') === 'Attention (fixture), 1 value');
    const paletteChip = chips.find((b) => b.getAttribute('aria-label') === 'Palette (fixture), 2 values');
    assert.ok(attentionChip, 'expected a jump chip naming the Attention section with its own entry count');
    assert.ok(paletteChip, 'expected a jump chip for Palette whose count includes its group\'s entry');
  } finally { cleanup(); }
});

test('a section alias arrival scrolls to its section once the sections have measured and mounted', async () => {
  const twoSections: TokenDefinition = {
    kind: 'opacity',
    sections: [
      { id: 'attention', title: 'Attention (fixture)', entries: [{ id: 'a', name: 'A', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.1 } } } }] },
      { id: 'palette', title: 'Palette (fixture)', entries: [{ id: 'b', name: 'B', kind: 'opacity', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.2 } } } }] },
    ],
  };
  const pages = [defineCatalogPage({ id: 'tokens-arrival', group: 'Tokens', description: 'Fixture.', tokenDefinition: twoSections })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-arrival.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-arrival')!;
  // The arrival is set on the very first render — before `TokenSections` has a width, so no
  // section node exists yet (the real browser order: route first, layout later).
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def, focusSectionId: 'palette', focusNonce: 1 } as never));
  const scrolled: string[] = [];
  (window as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
    scrolled.push((this.textContent || '').trim());
  };
  try {
    await settleLayout();
    assert.ok(plainTextPresent(container, 'Palette (fixture)'), 'expected the sections to have mounted after layout');
    assert.equal(scrolled.length, 1, 'expected exactly one scroll, once the arrival section mounted');
    assert.ok(scrolled[0]!.startsWith('Palette (fixture)'), `expected the Palette section to scroll into view, got "${scrolled[0]}"`);
  } finally { cleanup(); }
});

test('mounted SectionBlock shows no jump row when the page has only one section', async () => {
  const pages = [defineCatalogPage({ id: 'tokens-one-section', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixtureGroupsDefinition() })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-one-section.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-one-section')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    await settleLayout();
    const chips = [...container.querySelectorAll('[role="button"]')].filter((b) => (b.getAttribute('aria-label') || '').includes('value'));
    assert.equal(chips.length, 0, 'a single-section page must show no jump row');
  } finally { cleanup(); }
});

// #64 B3: light/dark pairing.
function fixturePairingDefinition(): TokenDefinition {
  return {
    kind: 'colors',
    sections: [{
      id: 'paired', title: 'Paired (fixture)',
      entries: [
        { id: 'accentLight', name: 'Accent (fixture)', kind: 'colors', appearance: 'light', value: { provenance: 'inline', resolution: { status: 'resolved', value: { color: '#111111' } } } },
        { id: 'accentDark', name: 'Accent (fixture)', kind: 'colors', appearance: 'dark', value: { provenance: 'inline', resolution: { status: 'resolved', value: { color: '#eeeeee' } } } },
        { id: 'soloDark', name: 'Solo (fixture)', kind: 'colors', appearance: 'dark', value: { provenance: 'inline', resolution: { status: 'resolved', value: { color: '#222222' } } } },
      ],
    }],
  };
}

test('mounted SectionBlock renders a light/dark pair as one swatch: the bare name once, and both values on one line', async () => {
  const pages = [defineCatalogPage({ id: 'tokens-paired', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixturePairingDefinition() })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-paired.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-paired')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    await settleLayout();
    assert.equal(plainTextOccurrences(container, 'Accent (fixture)'), 1, 'the pair\'s bare name must render exactly once, never "(light)"/"(dark)"');
    assert.ok(plainTextPresent(container, '#111111 · #eeeeee'), 'expected the combined light · dark value line');
  } finally { cleanup(); }
});

test('mounted SectionBlock still renders an unpaired dark entry exactly as today', async () => {
  const pages = [defineCatalogPage({ id: 'tokens-paired-2', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixturePairingDefinition() })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-paired-2.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-paired-2')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    await settleLayout();
    assert.ok(plainTextPresent(container, 'Solo (fixture) (dark)'), 'an unpaired dark entry must still show its own "(dark)" suffix, unchanged');
    assert.ok(plainTextPresent(container, '#222222'), 'its own real value must still render');
  } finally { cleanup(); }
});

test('a legacy tokenGallery page with no tokenDefinition is unaffected by this change', async () => {
  const pages = [defineCatalogPage({ id: 'tokens-legacy', group: 'Tokens', description: 'Legacy.', tokenGallery: true, render: () => React.createElement(React.Fragment, null, 'legacy content') })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-legacy.catalog.tsx' })), []);
  const def = sections.find((s) => s.id === 'tokens-legacy')!;
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def } as never));
  try {
    assert.ok(plainTextPresent(container, 'legacy content'));
  } finally { cleanup(); }
});
