// Mounted regression for the Parts block: the real `CatalogShell` (so the real reference
// navigation) around `SectionBlock`/`FamilyPage`, through react-native-web into jsdom. jsdom has no
// layout, so this proves structure, roles, routing and which entries become cards — never geometry.
// Same dynamic-import warmup and `Mount` wrapper `overviewRender.test.tsx` documents in full.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import type { ComposedOfEntry, NavGroup, SectionDef } from '../types.ts';
import type { UsageData } from '../usage.ts';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { CARD_TITLE_MIN_HEIGHT } = await import('../Overview.tsx');

function click(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}
function goTo(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event('hashchange'));
  });
}

function Mount({ hash, children }: { hash?: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    try {
      window.localStorage.getItem('ds-viewer-probe');
    } catch {
      const store = new Map<string, string>();
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => { store.set(key, value); },
          removeItem: (key: string) => { store.delete(key); },
          clear: () => store.clear(),
        },
      });
    }
    Object.defineProperty(window.history, 'replaceState', {
      configurable: true,
      value: (_state: unknown, _title: string, url?: string | URL | null) => { if (url != null) window.location.hash = String(url); },
    });
    if (hash) window.location.hash = hash;
    setReady(true);
  }, [hash]);
  return ready ? <>{children}</> : null;
}

const item = (key: string) => ({ key, name: key, node: <span>{`${key} specimen`}</span> });
// Real projects' specimens hold interactive content; a card must stay valid HTML around it.
const interactive = (text: string) => <span>{text}<button type="button" aria-label="inner button" /><a href="#inner-link" aria-label="inner link" /></span>;
const base = (id: string) => ({ id, title: id, description: `${id} page.`, path: `${id}.tsx` });
const c = (component: string, relationship: ComposedOfEntry['relationship'], role = `${component} role`): ComposedOfEntry => ({ component, role, relationship });

type Id = 'Host' | 'Chip' | 'Banner' | 'Toggle' | 'Colors' | 'Bare' | 'Panel' | 'Shelf' | 'Plain' | 'Quiet';
const SECTIONS: SectionDef<Id>[] = [
  {
    ...base('Host'),
    variants: { items: [item('host')] },
    composedOf: [c('Chip', 'built-in', 'Shows a tag.'), c('Gadget', 'built-in', 'Not in this catalog.'), c('Banner', 'slot', 'Fills the top.'), c('Toggle', 'related', 'Only related.'), c('Colors', 'built-in', 'Token page.'), c('PanelHeader', 'built-in', 'The panel\'s head.')],
  },
  { ...base('Chip'), variants: { items: [{ key: 'chip', name: 'chip', node: interactive('Chip specimen') }] } },
  { ...base('Banner'), states: { items: [item('banner')] } },
  { ...base('Toggle'), variants: { items: [item('toggle')] } },
  { ...base('Colors'), tokenGallery: true, render: () => <span>Colors swatches</span> },
  { ...base('Bare'), composedOf: [c('Chip', 'built-in')] },
  { ...base('Plain'), variants: { items: [item('plain')] }, composedOf: [c('Chip', 'related')] },
  { ...base('Quiet'), variants: { items: [item('quiet')] } },
  {
    ...base('Panel'),
    composedOf: [c('Banner', 'built-in', 'Page level banner.'), c('Toggle', 'related')],
    family: {
      whole: 'Panel', outline: new Map([['PanelHeader', { number: '1', level: 0 }]]),
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['PanelHeader'] }],
      members: [
        {
          id: 'Panel', source: 'p:1', path: 'p:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w', variants: { items: [item('panel')] },
          composedOf: [c('Chip', 'built-in', 'Whole chip.'), c('Banner', 'slot', 'Whole banner.'), c('PanelHeader', 'built-in', 'Own member.'), c('Toggle', 'related'), c('Gizmo', 'slot', 'Whole gizmo.')],
        },
        {
          id: 'PanelHeader', source: 'p:2', path: 'p:2', fidelity: 'replicated', relationship: 'Part', parent: 'Panel', description: 'h',
          variants: { items: [item('header')] }, composedOf: [c('Chip', 'built-in', 'Member chip.'), c('Toggle', 'built-in', 'Member toggle.')],
        },
      ],
    },
  },
  {
    ...base('Shelf'),
    family: {
      whole: 'Shelf', outline: new Map(), sections: [],
      members: [{ id: 'Shelf', source: 's:1', path: 's:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w', composedOf: [c('Chip', 'built-in', 'Shelf chip.')] }],
    },
  },
];
const GROUPS: NavGroup<Id>[] = [{ label: 'Components', ids: ['Host', 'Chip', 'Banner', 'Toggle', 'Bare', 'Plain', 'Quiet', 'Panel', 'Shelf'] }, { label: 'Tokens', ids: ['Colors'] }];
const USAGE: UsageData = { version: 1, components: { Host: { uses: [{ area: 'Chat', file: 'Host.swift', line: 1 }] } } };

function mount(hash: string) {
  return renderCatalog(
    <Mount hash={hash}>
      <CatalogShell appName="App" title="Catalog" groups={GROUPS} sections={SECTIONS} usage={USAGE} />
    </Mount>,
  );
}
function pageHeading(): string {
  return (document.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
}
function region(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[role="region"]') as HTMLElement | null;
}
/** A card's own link: not a link a live specimen carries inside its hidden thumbnail. */
function cardLinks(root: Element): HTMLAnchorElement[] {
  return ([...root.querySelectorAll('[role="listitem"] a')] as HTMLAnchorElement[]).filter((a) => !a.closest('[aria-hidden="true"]'));
}
const titleOf = (card: Element) => ((card.children[0] as HTMLElement).textContent || '').trim();
const captionOf = (card: Element) => ((card.children[1] as HTMLElement).textContent || '').trim();
/** Plain rows: list items with no link in them. */
function plainRows(root: Element): string[] {
  return [...root.querySelectorAll('[role="listitem"]')].filter((li) => !li.querySelector('a')).map((li) => (li.textContent || '').trim());
}

test('a page with no qualifying entry shows no Parts block, and no empty region or heading', () => {
  for (const hash of ['#Quiet']) {
    const { container, cleanup } = mount(hash);
    assert.equal(region(container), null, `no region on ${hash}`);
    assert.ok(![...container.querySelectorAll('[role="heading"]')].some((h) => /^(Parts|Uses these components)$/.test((h.textContent || '').trim()) && h.closest('[role="region"]')));
    cleanup();
  }
});

test('a page whose only entry is related shows no block', () => {
  const { container, cleanup } = mount('#Plain');
  assert.equal(pageHeading(), 'Plain');
  assert.equal(region(container), null);
  cleanup();
});

test('a standalone page shows a labelled "Parts" region: built-in and slot entries only, in declared order', () => {
  const { container, cleanup } = mount('#Host');
  const block = region(container)!;
  assert.ok(block, 'a region');
  const heading = block.querySelector('[role="heading"]') as HTMLElement;
  assert.equal((heading.textContent || '').trim(), 'Parts');
  assert.equal(heading.getAttribute('aria-level'), '2');
  assert.ok(heading.id, 'the heading has an id');
  assert.equal(block.getAttribute('aria-labelledby'), heading.id, 'the region is labelled by its heading');
  const cards = cardLinks(block);
  assert.deepEqual(cards.map(titleOf), ['Chip', 'Banner', 'Colors', 'Panel'], 'resolved entries as cards, related (Toggle) left out; a member entry shows its page');
  assert.deepEqual(cards.map(captionOf), ['Shows a tag.', 'Fills the top.', 'Token page.', 'The panel\'s head.'], 'the role is the caption, not a usage line');
  assert.doesNotMatch(block.textContent || '', /Only related/);
  cleanup();
});

test('an entry that does not resolve is a compact plain row (name and role), not a card', () => {
  const { container, cleanup } = mount('#Host');
  const block = region(container)!;
  assert.deepEqual(plainRows(block), ['GadgetNot in this catalog.']);
  assert.equal(block.querySelectorAll('[role="listitem"]').length, 5, 'four cards and one plain row');
  assert.equal(cardLinks(block).some((a) => (a.textContent || '').includes('Gadget')), false);
  cleanup();
});

test('the block sits after the specimens and before "Appears in"', () => {
  const { container, cleanup } = mount('#Host');
  const block = region(container)!;
  const specimen = [...container.querySelectorAll('span')].find((s) => s.textContent === 'host specimen')!;
  const appearsIn = [...container.querySelectorAll('div')].find((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Appears in')!;
  assert.ok(appearsIn, 'the Appears in block exists');
  const FOLLOWING = window.Node.DOCUMENT_POSITION_FOLLOWING;
  assert.ok(specimen.compareDocumentPosition(block) & FOLLOWING, 'after the specimens');
  assert.ok(block.compareDocumentPosition(appearsIn) & FOLLOWING, 'before Appears in');
  cleanup();
});

test('activating a card opens that page like the Composition link does, and Back returns', () => {
  const { container, cleanup } = mount('#Host');
  const chip = cardLinks(region(container)!).find((a) => titleOf(a) === 'Chip')!;
  assert.equal(chip.getAttribute('href'), '#Chip');
  click(chip);
  assert.equal(pageHeading(), 'Chip');
  assert.equal(window.location.hash, '#Chip');
  goTo('#Host'); // Back
  assert.equal(pageHeading(), 'Host');
  assert.ok(region(container), 'the block is back');
  cleanup();
});

test('a card for a family member opens the family at that member', () => {
  const { container, cleanup } = mount('#Host');
  const panel = cardLinks(region(container)!).find((a) => titleOf(a) === 'Panel')!;
  assert.equal(panel.getAttribute('href'), '#PanelHeader', 'the member\'s own address, as the Composition link');
  click(panel);
  assert.equal(pageHeading(), 'Panel');
  assert.equal(window.location.hash, '#PanelHeader');
  cleanup();
});

test('the thumbnail is the target page\'s first specimen, hidden and inert; a page with none keeps an empty frame', () => {
  const { container, cleanup } = mount('#Host');
  const block = region(container)!;
  const frames = (title: string) => [...cardLinks(block).find((a) => titleOf(a) === title)!.closest('[role="listitem"]')!.querySelectorAll('[aria-hidden="true"]:not([data-testid="part-badge"])')];
  const chipFrames = frames('Chip');
  assert.equal(chipFrames.length, 1);
  assert.equal(chipFrames[0].textContent, 'Chip specimen');
  assert.equal(chipFrames[0].hasAttribute('inert'), true);
  assert.equal(frames('Colors')[0].textContent, '', 'a token page has no specimen to show');
  cleanup();
});

test('every card is the same height: one thumbnail height, a reserved two-line title, a one-line caption', () => {
  const { container, cleanup } = mount('#Host');
  const links = cardLinks(region(container)!);
  assert.equal(links.length, 4);
  const shape = links.map((link) => {
    const frame = link.closest('[role="listitem"]')!.querySelector('[aria-hidden="true"]') as HTMLElement;
    const [title, caption] = [...link.children] as HTMLElement[];
    return { frame: cssOf(frame, 'height'), title: cssOf(title, 'min-height'), titleClamp: cssOf(title, '-webkit-line-clamp'), captionNowrap: cssOf(caption, 'white-space') };
  });
  assert.equal(shape[0].title, `${CARD_TITLE_MIN_HEIGHT}px`);
  assert.equal(shape[0].titleClamp, '2');
  assert.equal(shape[0].captionNowrap, 'nowrap', 'the caption is one line');
  for (const s of shape) assert.deepEqual(s, shape[0], 'identical height styles');
  cleanup();
});

test('a card is valid HTML around an interactive specimen: no nested links, one tab stop each, no nesting warnings', () => {
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
  let rendered: ReturnType<typeof mount>;
  try {
    rendered = mount('#Host');
  } finally {
    console.error = originalError;
  }
  const { container, cleanup } = rendered;
  assert.deepEqual(errors.filter((message) => /validateDOMNesting|cannot be a descendant|cannot contain|nested/i.test(message)), [], 'React reports no invalid DOM nesting');
  assert.equal(container.querySelector('a a, a button, button a, button button'), null, 'nothing interactive sits inside a link');
  const cards = [...region(container)!.querySelectorAll('[role="listitem"]')].filter((li) => li.querySelector('a'));
  assert.equal(cards.length, 4);
  for (const li of cards) {
    const stops = [...li.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((el) => !el.closest('[inert]') && el.getAttribute('tabindex') !== '-1');
    assert.equal(stops.length, 1, `one tab stop: ${stops.map((el) => el.outerHTML.slice(0, 120)).join(' | ')}`);
    assert.equal(stops[0].tagName, 'A');
  }
  assert.ok(region(container)!.querySelector('[aria-hidden="true"][inert] button'), 'the specimen\'s own button is there, inert');
  cleanup();
});

test('a family page lists the page\'s and the whole\'s entries, titled "Uses these components" beside its Parts section', () => {
  const { container, cleanup } = mount('#Panel');
  const block = region(container)!;
  assert.ok(block);
  assert.equal(((block.querySelector('[role="heading"]') as HTMLElement).textContent || '').trim(), 'Uses these components');
  const headings = [...container.querySelectorAll('[role="heading"][aria-level="2"]')].map((h) => (h.textContent || '').trim());
  assert.equal(headings.filter((h) => h === 'Parts').length, 1, 'one "Parts" heading: the members\' own');
  // Page: Banner (built-in). Whole: Chip, Banner (duplicate), PanelHeader (a member), Toggle (related), Gizmo.
  assert.deepEqual(cardLinks(block).map(titleOf), ['Banner', 'Chip']);
  assert.deepEqual(cardLinks(block).map(captionOf), ['Page level banner.', 'Whole chip.'], 'first declaration wins; the member\'s own entries are not pulled in');
  assert.deepEqual(plainRows(block), ['GizmoWhole gizmo.']);
  assert.doesNotMatch(block.textContent || '', /Own member|Member chip|Member toggle/);
  cleanup();
});

test("a family page's block follows its members; one with no Parts section keeps the title 'Parts'", () => {
  const panel = mount('#Panel');
  const header = [...panel.container.querySelectorAll('span')].find((d) => d.textContent === 'header specimen')!;
  assert.ok(header, 'the member is rendered');
  assert.ok(header.compareDocumentPosition(region(panel.container)!) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'after the members');
  panel.cleanup();

  const shelf = mount('#Shelf');
  const block = region(shelf.container)!;
  assert.equal(((block.querySelector('[role="heading"]') as HTMLElement).textContent || '').trim(), 'Parts');
  assert.deepEqual(cardLinks(block).map(titleOf), ['Chip']);
  shelf.cleanup();
});

/** react-native-web turns each style into atomic classes and injects their rules once, into the window
 *  that was current when it was first imported (the warmup window above) — read a property back there. */
function cssOf(el: Element, property: string): string {
  const inline = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(el.getAttribute('style') || '');
  if (inline) return inline[1].trim();
  const classes = new Set((el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  let found = '';
  for (const sheet of [...warmup.window.document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      const match = /^\.([\w-]+)\s*\{(.*)\}$/s.exec(rule.cssText);
      if (!match || !classes.has(match[1])) continue;
      const declaration = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+)`).exec(match[2]);
      if (declaration) found = declaration[1].trim();
    }
  }
  return found;
}
