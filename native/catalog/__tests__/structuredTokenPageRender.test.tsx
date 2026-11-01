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
// The side panel's `Modal` focus trap reads the global `Node` (see `notesPanelRender.test.tsx`).
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });
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
  // A zero-width space is only a line-break hint (`breakableCodeName`), not part of the text.
  return [...container.querySelectorAll('*')].some((e) => e.children.length === 0 && (e.textContent || '').replace(/\u200B/g, '').includes(text));
}

/** Counts leaf elements whose own text includes `text` — used to tell "shown once, at the section
 *  level" apart from "shown on every entry" (correction C1's consolidation rule). */
function plainTextOccurrences(container: HTMLElement, text: string): number {
  return [...container.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').includes(text)).length;
}

function press(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** Every "Details ›" link on the page, by its accessible name ("Details for <token>"). */
function detailsLinks(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[aria-haspopup="dialog"]')].map((el) => el.getAttribute('aria-label') || '');
}

/** Opens one token's "Details ›" panel and returns its text. The caller closes it (or the cleanup does). */
function openDetails(container: HTMLElement, token: string): string {
  const link = container.querySelector(`[aria-label="Details for ${token}"]`);
  assert.ok(link, `expected a "Details for ${token}" link`);
  press(link);
  const panel = document.querySelector('[role="dialog"][aria-modal="true"]');
  assert.ok(panel, `expected "Details for ${token}" to open the side panel`);
  return (panel.textContent || '').replace(/\s+/g, ' ').trim();
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
    assert.ok(plainTextPresent(container, 'UIColor.systemBackground'), 'an unresolved value\'s real expression stays on its tile');
    assert.equal(plainTextPresent(container, 'AgentRunLiveActivityWidget.swift:42'), false, 'a source citation is not on the tile — it is in the token\'s Details panel');
    assert.equal(plainTextPresent(container, 'Screen background'), false, 'usage text is not on the tile either');
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
    // The consolidated line is the only provenance left on the page itself; surfaceB's per-entry
    // provenance is in each token's Details panel, one link per surfaceB entry (surfaceA's entries,
    // with no source or usage text and a line already above them, have none).
    assert.equal(plainTextOccurrences(container, 'Named token'), 1, 'surfaceA\'s consolidated line only — never once per surfaceA entry, and surfaceB\'s per-entry provenance is not on the page');
    assert.equal(plainTextPresent(container, 'Platform-provided'), false, 'per-entry provenance is not printed under the token');
    assert.equal(plainTextPresent(container, 'Unresolved finding'), false, 'per-entry provenance is not printed under the token');
    assert.deepEqual(detailsLinks(container), ['Details for Accent B', 'Details for Background', 'Details for Live Activity tint', 'Details for AccentColor']);
    assert.ok(openDetails(container, 'Background').includes('Platform-provided · named token'), 'a platform-provided value that is also exposed through a named token shows both, never a badge');
    assert.ok(openDetails(container, 'Background').includes('Screen background'), 'the usage text is in the panel');
    assert.ok(openDetails(container, 'Live Activity tint').includes('AgentRunLiveActivityWidget.swift:42'), 'an unresolved finding with a real drawable literal still gets its citation, in the panel');
    assert.ok(openDetails(container, 'Live Activity tint').includes('Unresolved finding'));
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
    // entry carries its own provenance (in its Details panel) rather than one line for the section.
    assert.equal(plainTextPresent(container, 'Named token'), false, 'provenance is not printed under the token');
    assert.equal(plainTextPresent(container, 'Inline value'), false, 'provenance is not printed under the token');
    assert.deepEqual(detailsLinks(container), ['Details for Base', 'Details for Bounce spring', 'Details for Conditional']);
    assert.ok(openDetails(container, 'Base').includes('Named token'), '"base" is a named token');
    assert.ok(openDetails(container, 'Bounce spring').includes('Inline value'));
    assert.ok(openDetails(container, 'Conditional').includes('Inline value'));
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
    assert.equal(plainTextOccurrences(container, 'Named token'), 1, 'one consolidated line for "consistent"; "mixed"\'s entries keep theirs in their Details panels');
    assert.equal(plainTextPresent(container, 'Inline value'), false);
    assert.deepEqual(detailsLinks(container), ['Details for Named one', 'Details for Inline one'], 'only "mixed"\'s entries need a link; "consistent" shares one line above its tiles');
    assert.ok(openDetails(container, 'Named one').includes('Named token'));
    assert.ok(openDetails(container, 'Inline one').includes('Inline value'), '"mixed"\'s own "inlineOne" entry has its own provenance');
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

// Details ›: on every token kind, a token's source and usage text leave its tile for the side panel
// its "Details ›" link opens. One entry per section, so provenance is consolidated above it (and
// absent from the link) and what the panel holds is exactly the entry's own `source` and `role`.
const SOURCE = 'Sources/Theme.swift:12';
const ROLE = 'Used for card corners (fixture)';
const KIND_FIXTURES: Array<{ kind: TokenDefinition['kind']; entry: Record<string, unknown>; shows: string }> = [
  { kind: 'colors', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#1a73e8' } } } }, shows: '#1a73e8' },
  { kind: 'typography', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { fontSize: 16, fontSizeUnit: 'px', fontWeight: 400 } } } }, shows: '16px' },
  { kind: 'spacing', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 8, unit: 'pt' } } } }, shows: '8pt' },
  { kind: 'radius', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 12, unit: 'pt' } } } }, shows: '12pt' },
  { kind: 'dimensions', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 44, unit: 'pt' } } } }, shows: '44pt' },
  { kind: 'opacity', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 0.4 } } } }, shows: '40%' },
  { kind: 'shadows', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#000000', opacity: 0.2, radius: 8, x: 0, y: 2 } } } }, shows: 'y 2' },
  { kind: 'motion', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { kind: 'timing', durationMs: 300, sourceValue: 0.3, sourceUnit: 's' } } } }, shows: '' },
  { kind: 'motion', entry: { value: { provenance: 'named', resolution: { status: 'resolved', value: { kind: 'native-expression', expression: '.spring(duration: 0.4)' } } } }, shows: '.spring(duration: 0.4)' },
  { kind: 'motion', entry: { value: { provenance: 'named', resolution: { status: 'unresolved', reason: 'Depends on isPressed.', expression: 'isPressed ? 0.1 : 0.3' } } }, shows: 'isPressed ? 0.1 : 0.3' },
];

for (const [index, fixture] of KIND_FIXTURES.entries()) {
  test(`${fixture.kind} token #${index}: source and usage text move from the tile into its Details panel`, async () => {
    const def: TokenDefinition = {
      kind: fixture.kind,
      sections: [{ id: 's', title: 'Section (fixture)', entries: [{ id: 'token', name: 'Token (fixture)', kind: fixture.kind, source: SOURCE, role: ROLE, ...fixture.entry } as never] }],
    };
    const id = `tokens-details-${index}`;
    const pages = [defineCatalogPage({ id, group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
    const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: `fixtures/${id}.catalog.tsx` })), []);
    const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sections.find((s) => s.id === id)! } as never));
    try {
      await settleLayout();
      if (fixture.shows) assert.ok(plainTextPresent(container, fixture.shows), `the tile keeps its value/expression (${fixture.shows})`);
      assert.equal(plainTextPresent(container, SOURCE), false, 'the source is not on the tile');
      assert.equal(plainTextPresent(container, ROLE), false, 'the usage text is not on the tile');
      assert.deepEqual(detailsLinks(container), ['Details for Token (fixture)'], 'one Details link for the one token');
      const panel = openDetails(container, 'Token (fixture)');
      assert.ok(panel.includes(SOURCE), 'the panel holds the source');
      assert.ok(panel.includes(ROLE), 'the panel holds the usage text');
      assert.ok(panel.includes('Source'), 'under a Source label');
    } finally { cleanup(); }
  });
}

test('a token with no source, no usage text and a consolidated provenance line has no Details link', async () => {
  const def: TokenDefinition = {
    kind: 'spacing',
    sections: [{ id: 's', title: 'Section (fixture)', entries: [{ id: 'a', name: 'A', kind: 'spacing', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 4, unit: 'pt' } } } }] }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-nolink', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-nolink.catalog.tsx' })), []);
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sections.find((s) => s.id === 'tokens-nolink')! } as never));
  try {
    await settleLayout();
    assert.ok(plainTextPresent(container, 'Named token'), 'the consolidated provenance line stays above the tiles');
    assert.deepEqual(detailsLinks(container), []);
  } finally { cleanup(); }
});

test('a token\'s own note stays on its tile; a light/dark pair has one Details link whose panel covers both sides', async () => {
  const def: TokenDefinition = {
    kind: 'colors',
    sections: [{
      id: 's', title: 'Section (fixture)',
      entries: [
        { id: 'l', name: 'Accent', kind: 'colors', appearance: 'light', source: 'Light.swift:1', role: 'Primary actions (fixture)', note: 'Pairs with dark', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#111111' } } } },
        { id: 'd', name: 'Accent', kind: 'colors', appearance: 'dark', source: 'Dark.swift:2', value: { provenance: 'inline', resolution: { status: 'resolved', value: { color: '#eeeeee' } } } },
      ],
    }],
  };
  const pages = [defineCatalogPage({ id: 'tokens-pair-details', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: 'fixtures/tokens-pair-details.catalog.tsx' })), []);
  const { container, cleanup } = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sections.find((s) => s.id === 'tokens-pair-details')! } as never));
  try {
    await settleLayout();
    assert.ok(plainTextPresent(container, 'Pairs with dark'), 'a non-provenance note about the value stays on the tile');
    assert.equal(plainTextPresent(container, 'Primary actions (fixture)'), false);
    assert.deepEqual(detailsLinks(container), ['Details for Accent'], 'one link for the pair, named by the bare name');
    const panel = openDetails(container, 'Accent');
    assert.ok(panel.includes('Source (light)') && panel.includes('Light.swift:1'));
    assert.ok(panel.includes('Source (dark)') && panel.includes('Dark.swift:2'));
    assert.ok(panel.includes('Primary actions (fixture)'));
    assert.ok(panel.includes('Light: Named token · Dark: Inline value'), 'the two sides\' differing provenance');
  } finally { cleanup(); }
});

async function renderColorsDef(id: string, entries: unknown[]) {
  const def = { kind: 'colors', sections: [{ id: 's', title: 'Section (fixture)', entries }] } as TokenDefinition;
  const pages = [defineCatalogPage({ id, group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: `fixtures/${id}.catalog.tsx` })), []);
  const rendered = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sections.find((s) => s.id === id)! } as never));
  await settleLayout();
  return rendered;
}
const COLOR_VALUE = (color: string) => ({ provenance: 'named', resolution: { status: 'resolved', value: { color } } });

test('a colors entry with only `expression` and `usages` gets a link; its panel shows the expression and lists every site', async () => {
  const sites = ['Views/A.swift:10', 'Views/B.swift:22', 'Views/C.swift:5'];
  const { container, cleanup } = await renderColorsDef('tokens-expr-usages', [
    { id: 'a', name: 'Brand', kind: 'colors', expression: 'Color("brand")', usages: sites, value: COLOR_VALUE('#123456') },
  ]);
  try {
    assert.deepEqual(detailsLinks(container), ['Details for Brand'], 'expression and usages alone earn the link');
    const panel = openDetails(container, 'Brand');
    assert.ok(panel.includes('Expression') && panel.includes('Color("brand")'));
    assert.ok(panel.includes('Used at 3 sites'));
    for (const site of sites) assert.ok(panel.includes(site), `lists ${site}`);
  } finally { cleanup(); }
});

test('a light/dark pair: equal expressions show once, differing ones show per side, and usages from both sides are listed', async () => {
  const { container, cleanup } = await renderColorsDef('tokens-expr-pair', [
    { id: 'l', name: 'Ink', kind: 'colors', appearance: 'light', expression: 'Color("ink")', role: 'Body text (light fixture)', usages: ['A.swift:1', 'Shared.swift:2'], value: COLOR_VALUE('#111111') },
    { id: 'd', name: 'Ink', kind: 'colors', appearance: 'dark', expression: 'Color("ink-dark")', role: 'Body text (dark fixture)', usages: ['Shared.swift:2', 'B.swift:3'], value: COLOR_VALUE('#eeeeee') },
  ]);
  try {
    const panel = openDetails(container, 'Ink');
    assert.ok(panel.includes('Usage (light)') && panel.includes('Body text (light fixture)'), 'a differing role shows per side');
    assert.ok(panel.includes('Usage (dark)') && panel.includes('Body text (dark fixture)'), 'the dark role is not dropped');
    assert.ok(panel.includes('Expression (light)') && panel.includes('Color("ink")'));
    assert.ok(panel.includes('Expression (dark)') && panel.includes('Color("ink-dark")'));
    assert.ok(panel.includes('Used at 3 sites'), 'the shared site is listed once');
    for (const site of ['A.swift:1', 'Shared.swift:2', 'B.swift:3']) assert.ok(panel.includes(site));
  } finally { cleanup(); }
  const same = await renderColorsDef('tokens-expr-pair-same', [
    { id: 'l', name: 'Ink', kind: 'colors', appearance: 'light', expression: 'Color("ink")', value: COLOR_VALUE('#111111') },
    { id: 'd', name: 'Ink', kind: 'colors', appearance: 'dark', expression: 'Color("ink")', value: COLOR_VALUE('#eeeeee') },
  ]);
  try {
    const panel = openDetails(same.container, 'Ink');
    assert.ok(panel.includes('Expression') && !panel.includes('Expression (light)'), 'an equal expression is one fact');
  } finally { same.cleanup(); }
});

// --- Value scales from scanner findings (`tokenScale`) -----------------------------------------
const { tokenScale } = await import('../tokenScale.ts');

async function renderDefinition(id: string, def: TokenDefinition) {
  const pages = [defineCatalogPage({ id, group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
  const { sections } = buildCatalogSections(pages.map((p) => ({ ...p, file: `fixtures/${id}.catalog.tsx` })), []);
  const rendered = renderWithResizeObserver(React.createElement(SectionBlock as never, { def: sections.find((s) => s.id === id)! } as never));
  await settleLayout();
  return rendered;
}

const SCALE_FINDINGS = [
  { expression: 'cornerRadius: 6', usages: ['A.swift:1'], unit: 'pt', value: 6 },
  { expression: 'RoundedRectangle(cornerRadius: 6, style: .continuous)', usages: ['B.swift:2'], unit: 'pt', value: 6 },
  { expression: 'cornerRadius: pill.height / 2', unresolved: { reason: 'size' as const, detail: 'Half of the pill height' } },
];

test('a page of findings says, near the top, that there are no tokens; it is gone when one is a named token', async () => {
  const inline = await renderDefinition('tokens-scale-note', tokenScale('radius', SCALE_FINDINGS));
  try {
    assert.ok(plainTextPresent(inline.container, 'No radius tokens yet'));
    assert.ok(plainTextPresent(inline.container, "These are values written in the app's code, not shared tokens."));
    assert.ok(inline.container.querySelector('[role="note"]'), 'in the viewer\'s own note banner');
  } finally { inline.cleanup(); }
  const named = await renderDefinition('tokens-scale-named', tokenScale('radius', [...SCALE_FINDINGS, { expression: 'DS.r', value: 4, unit: 'pt', provenance: 'named' }]));
  try {
    assert.equal(plainTextPresent(named.container, 'No radius tokens yet'), false);
  } finally { named.cleanup(); }
  const optedOut = await renderDefinition('tokens-scale-optout', tokenScale('radius', SCALE_FINDINGS, { showNoTokensNote: false }));
  try {
    assert.equal(plainTextPresent(optedOut.container, 'No radius tokens yet'), false);
  } finally { optedOut.cleanup(); }
});

test('a value tile shows its value once, and Details lists every way it is written and every site', async () => {
  const { container, cleanup } = await renderDefinition('tokens-scale-details', tokenScale('radius', SCALE_FINDINGS));
  try {
    assert.equal(plainTextOccurrences(container, '6pt'), 1, 'the value is printed once, not as both name and value');
    assert.deepEqual(detailsLinks(container), ['Details for 6pt', 'Details for cornerRadius: pill.height / 2']);
    const panel = openDetails(container, '6pt');
    assert.ok(panel.includes('Written 2 ways'));
    assert.ok(panel.includes('cornerRadius: 6') && panel.includes('RoundedRectangle(cornerRadius: 6, style: .continuous)'));
    assert.ok(panel.includes('Used at 2 sites'));
  } finally { cleanup(); }
});

test('what is not a fixed value is grouped by reason under its own heading, with the reason on the tile', async () => {
  const { container, cleanup } = await renderDefinition('tokens-scale-groups', tokenScale('radius', SCALE_FINDINGS));
  try {
    assert.ok(plainTextPresent(container, 'Not a fixed value'));
    assert.ok(plainTextPresent(container, 'Depends on size'));
    assert.ok(plainTextPresent(container, 'Half of the pill height'));
  } finally { cleanup(); }
});

test('an entry with one written form shows it as an ordinary Expression, not "Written 1 ways"', async () => {
  const { container, cleanup } = await renderDefinition('tokens-scale-one-form', tokenScale('radius', [{ expression: 'cornerRadius: 2', value: 2, unit: 'pt' }]));
  try {
    const panel = openDetails(container, '2pt');
    assert.ok(panel.includes('Expression') && panel.includes('cornerRadius: 2'));
    assert.equal(panel.includes('Written'), false);
  } finally { cleanup(); }
});

const dimensionEntry = (id: string, extra: Record<string, unknown>) =>
  ({ id, name: id, kind: 'radius', value: { provenance: 'inline', resolution: { status: 'resolved', value: { amount: 6, unit: 'pt' } } }, ...extra }) as never;

test('a repeated written form counts once: ["a", "a"] is an ordinary Expression, not "Written 2 ways"', async () => {
  const def: TokenDefinition = { kind: 'radius', sections: [{ id: 's', title: 'S', entries: [dimensionEntry('dup', { expressions: ['cornerRadius: 6', 'cornerRadius: 6'] })] }] };
  const { container, cleanup } = await renderDefinition('tokens-scale-dup-forms', def);
  try {
    const panel = openDetails(container, 'dup');
    assert.equal(panel.includes('Written'), false);
    assert.ok(panel.includes('Expression') && panel.includes('cornerRadius: 6'));
  } finally { cleanup(); }
});

test('an expression that is not in expressions is still shown, once, alongside the others', async () => {
  const def: TokenDefinition = { kind: 'radius', sections: [{ id: 's', title: 'S', entries: [dimensionEntry('extra', { expression: 'cornerRadius: 6', expressions: ['RoundedRectangle(cornerRadius: 6)', 'cornerRadius: 6'] })] }] };
  const { container, cleanup } = await renderDefinition('tokens-scale-extra-form', def);
  try {
    const panel = openDetails(container, 'extra');
    assert.ok(panel.includes('Written 2 ways'), panel);
    assert.ok(panel.includes('RoundedRectangle(cornerRadius: 6)') && panel.includes('cornerRadius: 6'));
  } finally { cleanup(); }
  const alone: TokenDefinition = { kind: 'radius', sections: [{ id: 's', title: 'S', entries: [dimensionEntry('lone', { expression: 'cornerRadius: 6', expressions: ['RoundedRectangle(cornerRadius: 6)'] })] }] };
  const second = await renderDefinition('tokens-scale-extra-form-2', alone);
  try {
    const panel = openDetails(second.container, 'lone');
    assert.ok(panel.includes('Written 2 ways'), 'expression plus a different single form is two forms');
  } finally { second.cleanup(); }
});

test('expressions are not read for a light/dark color pair, which keeps showing its two sides\' expression', async () => {
  const side = (appearance: string, expression: string) => ({
    id: appearance, name: 'Surface', kind: 'colors', appearance, expression, expressions: ['ignored-a', 'ignored-b'],
    value: { provenance: 'named', resolution: { status: 'resolved', value: { color: appearance === 'light' ? '#ffffff' : '#000000' } } },
  }) as never;
  const def: TokenDefinition = { kind: 'colors', sections: [{ id: 's', title: 'S', entries: [side('light', 'Color.surface'), side('dark', 'Color.surface')] }] };
  const { container, cleanup } = await renderDefinition('tokens-scale-pair-forms', def);
  try {
    const panel = openDetails(container, 'Surface');
    assert.equal(panel.includes('Written'), false);
    assert.equal(panel.includes('ignored-a'), false);
    assert.ok(panel.includes('Color.surface'));
  } finally { cleanup(); }
});

test('a named finding with no value shows its name on the unresolved tile', async () => {
  const { container, cleanup } = await renderDefinition('tokens-scale-named-unresolved', tokenScale('radius', [{ expression: 'cornerRadius: theme.corner', name: 'ThemeMetrics.corner', unresolved: { reason: 'other', detail: 'Read from the theme' } }]));
  try {
    assert.ok(plainTextPresent(container, 'ThemeMetrics.corner'), 'the name is not dropped');
  } finally { cleanup(); }
});

test('any dimension tile named for its own value shows it once; one named otherwise still shows its value', async () => {
  const def: TokenDefinition = { kind: 'radius', sections: [{ id: 's', title: 'S', entries: [
    { id: 'a', name: '8pt', kind: 'radius', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 8, unit: 'pt' } } } },
    { id: 'b', name: 'Small', kind: 'radius', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 4, unit: 'pt' } } } },
  ] }] };
  const { container, cleanup } = await renderDefinition('tokens-plain-value-once', def);
  try {
    assert.equal(plainTextOccurrences(container, '8pt'), 1, 'a hand-written definition, no tokenScale involved');
    assert.equal(plainTextOccurrences(container, '4pt'), 1, '"Small" is not its value, so the value is shown');
  } finally { cleanup(); }
});

test('the radius sample is square, so a large corner and a full round one draw differently', async () => {
  const { radiusSampleCorner, RADIUS_SAMPLE_SIZE, RADIUS_SAMPLE_BOX } = await import('../StructuredTokenPage.tsx');
  assert.equal(RADIUS_SAMPLE_BOX.width, RADIUS_SAMPLE_BOX.height, 'the sample box is square');
  // The starter kit's own steps: large 24, round 999.
  assert.notEqual(radiusSampleCorner(24), radiusSampleCorner(999), 'large and round are told apart');
  assert.equal(radiusSampleCorner(999), RADIUS_SAMPLE_BOX.height / 2, 'a full-round value draws a circle');
  assert.equal(RADIUS_SAMPLE_BOX.height, RADIUS_SAMPLE_SIZE);
  assert.equal(radiusSampleCorner(24), 24);
  assert.equal(radiusSampleCorner(-4), 0);
});

test('a capped value is not printed twice, wide grids draw bars to scale, and code names wrap at dots', async () => {
  const { dimensionValueText, dimensionBarScale, dimensionBarWidth, breakableCodeName, DIMENSION_BAR_MAX } = await import('../StructuredTokenPage.tsx');
  assert.equal(dimensionValueText('max 100pt', '100pt'), undefined, 'max 100pt already says 100pt');
  assert.equal(dimensionValueText('min 360pt', '360pt'), undefined);
  assert.equal(dimensionValueText('6pt', '6pt'), undefined);
  assert.equal(dimensionValueText('Card', '6pt'), '6pt', 'a named tile still shows its value');
  assert.equal(dimensionValueText('1100pt', '100pt'), '100pt', 'only a whole trailing word counts');
  const scale = dimensionBarScale([12, 132, 520]);
  assert.notEqual(dimensionBarWidth(132, scale), dimensionBarWidth(520, scale), '132 and 520 draw differently');
  assert.equal(dimensionBarWidth(520, scale), DIMENSION_BAR_MAX);
  assert.equal(dimensionBarScale([12, 44, 120]), 1, 'a grid that fits is drawn at its real size');
  assert.equal(breakableCodeName('BotPendingRequestCard.cornerRadius'), 'BotPendingRequestCard.\u200BcornerRadius');
  assert.equal(breakableCodeName('0.5 and 1.25'), '0.5 and 1.25', 'decimals are left alone');
});

test('a grid drawn to scale says so', async () => {
  const def: TokenDefinition = { kind: 'dimensions', sections: [{ id: 'w', title: 'Widths', entries: [
    { id: 'a', name: '12pt', kind: 'dimensions', value: { provenance: 'inline', resolution: { status: 'resolved', value: { amount: 12, unit: 'pt' } } } },
    { id: 'b', name: 'max 520pt', kind: 'dimensions', note: 'SheetMetrics.maxWidth', value: { provenance: 'inline', resolution: { status: 'resolved', value: { amount: 520, unit: 'pt' } } } },
  ] }] };
  const { container, cleanup } = await renderDefinition('tokens-bar-scale', def);
  try {
    assert.match(container.textContent ?? '', /Bars are drawn to scale to fit; the longest is 520pt\./);
    assert.doesNotMatch(container.textContent ?? '', /max 520pt520pt/, 'the capped tile does not repeat its value');
    assert.match(container.textContent ?? '', /SheetMetrics\.\u200BmaxWidth/, 'a code-name note may wrap at its dot');
  } finally {
    cleanup();
  }
});
