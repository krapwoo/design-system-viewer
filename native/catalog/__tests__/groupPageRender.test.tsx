// #63 R2 mounted regression: drives the real `defineCatalogPage` → `buildCatalogSections` →
// `GroupPage` pipeline, not hand-built `FamilyDef` fixtures — the same jsdom/`canUseDOM` warmup
// precedent `familyPageRender.test.tsx` documents in full (a plain top-level import of anything
// that transitively reaches `react-dom`/`react-native-web` would decide `canUseDOM` before a real
// `window` exists, so every reachable module is loaded only through a dynamic `import()` below).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
// The member side panel is a real `Modal` (see `familyPageRender.test.tsx`).
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { GroupPage } = await import('../GroupPage.tsx');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');

function linkNamed(container: HTMLElement, text: string): HTMLAnchorElement | undefined {
  return [...container.querySelectorAll('a[role="link"], a')].find((a) => (a.textContent || '').trim().startsWith(text)) as HTMLAnchorElement | undefined;
}

// Scoped to the jump row itself (`JumpRow`'s own `accessibilityRole="list"` wrapper) — a plain
// `[role="link"]` search over the whole page would also match an unrelated same-named link
// elsewhere (e.g. a nested part's own anatomy legend row), which is exactly what a jump-row-only
// query must rule out.
function chipNamed(container: HTMLElement, title: string): Element | undefined {
  return [...container.querySelectorAll('[role="list"] [role="button"], [role="list"] [role="link"]')].find((el) => (el.textContent || '').includes(title));
}

function headingNamed(container: HTMLElement, name: string, level: number): HTMLElement | undefined {
  return [...container.querySelectorAll(`[role="heading"][aria-level="${level}"]`)].find((h) => (h.textContent || '').trim().startsWith(name)) as HTMLElement | undefined;
}

/** The smallest ancestor of `from` whose text includes `needle` — a member's own block. */
function smallestAncestorWith(from: Element, needle: string): HTMLElement | undefined {
  for (let el: Element | null = from; el; el = el.parentElement) if ((el.textContent || '').includes(needle)) return el as HTMLElement;
  return undefined;
}

function leafTexts(root: Element): string[] {
  return [...root.querySelectorAll('*')].filter((e) => e.children.length === 0).map((e) => (e.textContent || '').trim());
}

/** One group page ("Widgets") exercising: (a) a plain top-level member with its own specimen, (b)
 *  an embedded family (`EmbeddedWidget`) with its own `anatomy` and one nested part
 *  (`EmbeddedPart`), and (c) a member (`ExternalMember`) whose `parent` is another page's own
 *  whole — an external part of `TheFamily`, A5's own happy path. */
function widgetsFixture() {
  const widgets = defineCatalogPage({
    id: 'Widgets', group: 'Components', description: 'A group of widgets.',
    members: [
      {
        id: 'PlainWidget', source: 'plain.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'A plain widget.',
        variants: { items: [{ key: 'v1', name: 'Default', node: React.createElement('div', null, 'Plain specimen') }] },
      },
      {
        id: 'EmbeddedWidget', source: 'embedded.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'An embedded family.',
        notes: ['A note on the embedded family.'],
        anatomy: {
          picture: React.createElement('div', null, 'embedded picture'),
          groups: [{ label: 'In this picture', items: [{ member: 'EmbeddedPart', description: 'The nested part.' }] }],
        },
      },
      { id: 'EmbeddedPart', source: 'embedded.swift:2', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'EmbeddedWidget', description: 'A nested part.' },
      { id: 'ExternalMember', source: 'external.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'A member owned here, but also a family part.', parent: 'TheFamily' },
    ],
  });
  const theFamily = defineCatalogPage({
    id: 'TheFamily', group: 'Components', description: 'd', whole: 'TheFamily',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['FamilyOwnPart', 'ExternalMember'] }],
    members: [
      { id: 'TheFamily', source: 'w.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd' },
      { id: 'FamilyOwnPart', source: 'f.swift:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'TheFamily', description: 'd' },
    ],
  });
  const { sections } = buildCatalogSections([widgets, theFamily].map((p) => ({ ...p, file: `fixtures/${p.id}.catalog.tsx` })), []);
  return sections.find((s) => s.id === 'Widgets')!;
}

test('the jump row lists exactly the top-level members, each with its own qualifier', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def, knownAddressIds: new Set(['TheFamily']) } as never));
  try {
    assert.ok(chipNamed(container, 'PlainWidget'), 'expected a jump chip for the plain top-level member');
    assert.ok(chipNamed(container, 'EmbeddedWidget'), 'expected a jump chip for the embedded-family top-level member');
    assert.ok(chipNamed(container, 'ExternalMember'), 'expected a jump chip for the external-part top-level member');
    // Nested members never get their own top-level jump chip.
    assert.equal(Boolean(chipNamed(container, 'EmbeddedPart')), false, 'a nested part must not get its own jump chip');
    assert.equal(Boolean(chipNamed(container, 'FamilyOwnPart')), false, "another page's own member must not appear in this page's jump row");

    assert.ok((chipNamed(container, 'EmbeddedWidget')?.textContent || '').includes('+1 part'), 'expected the embedded family\'s own "+k parts" qualifier');
    assert.ok((chipNamed(container, 'ExternalMember')?.textContent || '').includes('Part 2 of TheFamily'), 'expected the external part\'s own "Part N of <Family>" qualifier');
    assert.equal((chipNamed(container, 'PlainWidget')?.textContent || '').trim(), 'PlainWidget', 'a member with no parts and no partOf gets no qualifier at all');
  } finally { cleanup(); }
});

test('the jump row is a real list: every child is a listitem holding exactly one chip', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def } as never));
  try {
    const list = container.querySelector('[role="list"]')!;
    assert.ok(list, 'expected the jump row list');
    const children = [...list.children];
    assert.equal(children.length, 3, 'one item per top-level member');
    for (const child of children) {
      assert.equal(child.getAttribute('role'), 'listitem', 'a list may only own listitems');
      assert.equal(child.children.length, 1);
      assert.ok(child.children[0].matches('[role="link"], [role="button"]'), 'the chip is inside its item');
    }
  } finally { cleanup(); }
});

test('a plain top-level member renders its own specimens and below-specimens line', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def } as never));
  try {
    assert.ok((container.textContent || '').includes('Plain specimen'), 'expected the member\'s own specimen to render');
    assert.ok((container.textContent || '').includes('plain.swift:1'), 'expected the member\'s own source line to render');
    assert.ok((container.textContent || '').includes('A plain widget.'), 'expected the member\'s own description to render');
  } finally { cleanup(); }
});

test('an embedded family renders its own anatomy box and its numbered nested part tree', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def } as never));
  try {
    assert.ok((container.textContent || '').includes('Anatomy'), 'expected the embedded family\'s own anatomy box');
    assert.ok((container.textContent || '').includes('embedded picture'), 'expected the authored anatomy picture to render');
    // The legend alone names "EmbeddedPart", so the nested part tree is asserted on its own: the
    // part's level-3 heading, in a block carrying its own source line, outside the legend.
    const partHeading = headingNamed(container, 'EmbeddedPart', 3);
    assert.ok(partHeading, 'expected the nested part to render its own level-3 heading (the part tree)');
    assert.equal(partHeading!.closest('[data-testid="anatomy-legend"]'), null, 'the part heading is the tree\'s, not the legend\'s');
    const partBlock = smallestAncestorWith(partHeading!, 'embedded.swift:2')!;
    assert.ok(partBlock, 'expected the nested part\'s own block to carry its source line');
    assert.equal((partBlock.textContent || '').includes('embedded.swift:1'), false, 'the part block is its own, not the top-level member\'s');
    // Pins, scoped: the legend's pin slot, and the part tree's own pin, each read "1".
    const slots = [...container.querySelectorAll('[data-testid="legend-pin-slot"]')];
    assert.deepEqual(slots.map((slot) => (slot.textContent || '').trim()), ['1'], 'the legend pins EmbeddedPart as 1, once');
    const partTree = partBlock.parentElement!;
    assert.ok(leafTexts(partTree).includes('1'), 'expected the nested part tree\'s own pin to read "1"');
  } finally { cleanup(); }
});

test('an external-part member shows "Part N of <Family>" linking to the family page', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def, knownAddressIds: new Set(['TheFamily']) } as never));
  try {
    assert.ok((container.textContent || '').includes('Part 2 of TheFamily'), 'expected the partOf line to render');
    const link = linkNamed(container, 'TheFamily');
    assert.ok(link, 'expected "TheFamily" to render as a real link');
    assert.equal(link!.getAttribute('href'), '#TheFamily');
    // The jump chip also reads "Part 2 of TheFamily"; scope to the link's own line so this
    // assertion proves the member's "Part N of" line itself, not the chip.
    assert.equal((link!.parentElement?.textContent || '').trim(), 'Part 2 of TheFamily');
  } finally { cleanup(); }
});

test('a group page renders no whole block and no Compare block', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def } as never));
  try {
    assert.equal(leafTexts(container).includes('Compare'), false, 'a group page must never render a Compare block');
    // The page id ("Widgets") shows once, as the page title. A family's whole would add a
    // second, member-level heading carrying the page id; a group page has only its members'.
    assert.equal(leafTexts(container).filter((t) => t === 'Widgets').length, 1, 'the page id appears only as the page title');
    assert.equal(headingNamed(container, 'Widgets', 2), undefined, 'no whole-style member block for the page id');
    const memberHeadings = [...container.querySelectorAll('[role="heading"][aria-level="2"]')].map((h) => (h.textContent || '').trim().replace(/Documentation only$/, ''));
    assert.deepEqual(memberHeadings, ['PlainWidget', 'EmbeddedWidget', 'ExternalMember'], 'exactly the top-level members, in authored order');
  } finally { cleanup(); }
});

test('a group page\'s own page-level notShown renders under the page head', () => {
  const page = defineCatalogPage({
    id: 'Quiet', group: 'Components', description: 'A group.', notShown: 'A timer fires after ten seconds.',
    members: [{ id: 'QuietA', source: 'q.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'd' }],
  });
  const { sections } = buildCatalogSections([{ ...page, file: 'fixtures/Quiet.catalog.tsx' }], []);
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def: sections.find((s) => s.id === 'Quiet')! } as never));
  try {
    assert.ok((container.textContent || '').includes('Not shown in the browser: A timer fires after ten seconds.'));
  } finally { cleanup(); }
});

test('group page member focus scrolls to and focuses the addressed member, nested parts included', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(
    React.createElement(GroupPage as never, { def, focusMemberId: 'EmbeddedPart', focusNonce: 1 } as never),
  );
  try {
    const active = document.activeElement as HTMLElement | null;
    assert.ok(active && active !== document.body, 'focus must actually move off <body> (whose text contains the whole page)');
    assert.equal(active!.getAttribute('tabindex'), '-1', 'the member\'s own programmatically-focusable node');
    assert.equal(active!.getAttribute('role'), 'heading');
    assert.equal(active!.getAttribute('aria-level'), '3', 'the nested part\'s own heading, not the top-level member\'s');
    assert.ok((active!.textContent || '').trim().startsWith('EmbeddedPart'));
    assert.equal((active!.textContent || '').includes('EmbeddedWidget'), false);
    assert.ok((smallestAncestorWith(active!, 'embedded.swift:2')?.textContent || '').includes('embedded.swift:2'), 'inside the part\'s own block');
    assert.equal((smallestAncestorWith(active!, 'embedded.swift:2')?.textContent || '').includes('embedded.swift:1'), false);
    assert.ok(container.contains(active!));
  } finally { cleanup(); }
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

test('a group page renders the group explainer, not the family one', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def } as never));
  try {
    const text = container.textContent || '';
    assert.ok(text.includes('Group page. These are separate components shown together because they’re used in the same place. Each has its own API, unlike variants, which are one component changed by its props.'));
    assert.equal(text.includes('Family page.'), false);
  } finally { cleanup(); }
});

test('a group member\'s trigger opens the side panel with its notes; Esc closes it and returns focus', () => {
  const def = widgetsFixture();
  const { container, cleanup } = renderCatalog(React.createElement(GroupPage as never, { def } as never));
  try {
    assert.equal(triggers(container).length, 1, 'only EmbeddedWidget has anything to disclose');
    const trigger = triggers(container)[0];
    act(() => { trigger.focus(); });
    press(trigger);
    assert.equal(panelTitle(), 'EmbeddedWidget');
    assert.ok((panelEl()!.textContent || '').includes('A note on the embedded family.'));
    assert.equal((container.textContent || '').includes('A note on the embedded family.'), false, 'no inline expansion on a group page either');
    pressEscape();
    assert.ok(panelEl() === null, 'panel closed');
    assert.ok(document.activeElement === trigger, 'focus on trigger');
  } finally { cleanup(); }
});
