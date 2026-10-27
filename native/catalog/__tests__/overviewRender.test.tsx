// Mounted regression for the Overview page (contract O): the real `CatalogShell` + `CatalogSidebar` +
// `Overview` through react-native-web into jsdom. jsdom has no layout, so this proves structure,
// roles, routing and which cards/rows exist — never geometry. Same dynamic-import warmup and
// `Mount` wrapper `sourceReferenceShellRender.test.tsx` documents in full.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import type { NavGroup, SectionDef } from '../types.ts';
import type { UsageData, UsageUse } from '../usage.ts';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { OverviewThumbnail } = await import('../OverviewThumbnail.tsx');
const { ScrollRootContext } = await import('../scrollRootContext.ts');

function click(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** Back/forward: the browser changes the address and fires `hashchange`. */
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

const item = (key: string, text = key) => ({ key, name: key, node: <span>{`${text} specimen`}</span> });
const usesIn = (area: string, count: number): UsageUse[] => Array.from({ length: count }, (_, i) => ({ area, file: `${area}${i}.swift`, line: i + 1 }));
// Real projects' specimens hold interactive content; a card must stay valid HTML around it.
const interactive = (text: string) => <span>{text}<button type="button" aria-label="inner button" /><a href="#inner-link" aria-label="inner link" /></span>;
const base = (id: string) => ({ id, title: id, description: `${id} page.`, path: `${id}.tsx` });

/** How many times the Gallery page's `render()` has run (F9: a hover/focus must not re-run it). */
let galleryRenders = 0;

type Id = 'Chip' | 'Banner' | 'Toggle' | 'Gallery' | 'Colors' | 'Empty' | 'Card';
const SECTIONS: SectionDef<Id>[] = [
  { ...base('Chip'), variants: { items: [{ key: 'chip', name: 'chip', node: interactive('Chip specimen') }, item('chip2', 'Chip two')] } },
  { ...base('Banner'), states: { items: [item('banner', 'Banner')] } },
  { ...base('Toggle'), comparison: { rowLabel: 'r', columnLabel: 'c', rows: [], columns: [], cells: [{ rowKey: 'a', columnKey: 'b', node: <span>Toggle specimen</span> }] } },
  { ...base('Gallery'), render: () => { galleryRenders += 1; return <span>Gallery specimen</span>; } },
  { ...base('Colors'), tokenGallery: true, render: () => <span>Colors swatches</span> },
  base('Empty') as SectionDef<Id>,
  {
    ...base('Card'),
    family: {
      whole: 'Card', outline: new Map(), sections: [],
      members: [
        { id: 'Card', source: 'c:1', path: 'c:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w' },
        { id: 'CardHeader', source: 'c:2', path: 'c:2', fidelity: 'replicated', relationship: 'Part', description: 'h', variants: { items: [{ key: 'h', name: 'h', node: interactive('Card header specimen') }] } },
      ],
    },
  },
];
const GROUPS: NavGroup<Id>[] = [{ label: 'Components', ids: ['Chip', 'Banner', 'Toggle', 'Gallery', 'Empty', 'Card'] }, { label: 'Tokens', ids: ['Colors'] }];

const USAGE: UsageData = {
  version: 1,
  areas: ['Chat', 'Bots', 'Settings'],
  components: {
    Chip: { area: 'Chat', uses: [...usesIn('Chat', 3), ...usesIn('Bots', 2)] },
    Banner: { area: 'Bots', uses: usesIn('Bots', 4) },
    Toggle: { area: 'Chat', uses: usesIn('Chat', 1) },
    CardHeader: { area: 'Settings', uses: usesIn('Settings', 9) },
    // Present in the file but never shown: a token page and a page with nothing to show.
    Colors: { area: 'Chat', uses: usesIn('Chat', 50) },
    Empty: { area: 'Chat', uses: usesIn('Chat', 40) },
  },
};

function mount(hash: string | undefined, usage: UsageData | null = USAGE, sections: SectionDef<string>[] = SECTIONS, groups: NavGroup<string>[] = GROUPS) {
  return renderCatalog(
    <Mount hash={hash}>
      <CatalogShell appName="App" title="Component Catalog" groups={groups as NavGroup<Id>[]} sections={sections as SectionDef<Id>[]} usage={usage} />
    </Mount>,
  );
}

function pageHeading(): string {
  return (document.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
}
function sidebarLinks(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="navigation"] a')].map((a) => (a.textContent || '').trim());
}
function tabs(container: HTMLElement): Array<[string, string | null]> {
  return [...container.querySelectorAll('[role="tab"]')].map((t) => [(t.textContent || '').trim(), t.getAttribute('aria-selected')]);
}
function tabNamed(container: HTMLElement, name: string): HTMLElement {
  return [...container.querySelectorAll('[role="tab"]')].find((t) => (t.textContent || '').trim() === name) as HTMLElement;
}
function chipNamed(container: HTMLElement, name: string): HTMLElement {
  const chip = [...container.querySelectorAll('[role="button"][aria-pressed]')].find((c) => (c.textContent || '').trim() === name);
  assert.ok(chip, `expected a "${name}" chip`);
  return chip as HTMLElement;
}
function chipLabels(container: HTMLElement, group: string): string[] {
  return [...container.querySelectorAll(`[role="group"][aria-label="${group}"] [role="button"]`)].map((c) => (c.textContent || '').trim());
}
function pressed(container: HTMLElement, group: string): string[] {
  return [...container.querySelectorAll(`[role="group"][aria-label="${group}"] [role="button"][aria-pressed="true"]`)].map((c) => (c.textContent || '').trim());
}
/** A card's own link: not a link a live specimen carries inside its hidden thumbnail. */
function cards(container: HTMLElement): HTMLAnchorElement[] {
  return ([...container.querySelectorAll('[role="tabpanel"] [role="listitem"] a')] as HTMLAnchorElement[]).filter((a) => !a.closest('[aria-hidden="true"]'));
}
/** The whole card around its link: the thumbnail is the link's sibling, not its child. */
function boxOf(link: Element): HTMLElement {
  return link.closest('[role="listitem"]') as HTMLElement;
}
/** A card's (or row link's) title: its first text outside the hidden thumbnail. */
function titleOf(root: Element): string {
  const leaf = [...root.querySelectorAll('div')].find((d) => d.children.length === 0 && !d.closest('[aria-hidden="true"]') && (d.textContent || '').trim());
  return (leaf?.textContent || '').trim();
}
function groupHeadings(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="tabpanel"] [role="heading"][aria-level="2"]')].map((h) => (h.textContent || '').trim());
}
function titles(container: HTMLElement): string[] {
  return cards(container).map(titleOf);
}
function rowTitles(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="table"] [role="row"] [role="rowheader"] a')].filter((a) => !a.closest('[aria-hidden="true"]')).map(titleOf);
}

test('without usage there is no Overview entry, and its address is not found', () => {
  const { container, cleanup } = mount(undefined, null);
  assert.deepEqual(sidebarLinks(container), ['Banner', 'Card', 'Chip', 'Empty', 'Gallery', 'Toggle', 'Colors']);
  assert.equal(container.querySelector('[role="tab"]'), null);
  cleanup();

  for (const hash of ['#ds-viewer-overview', '#ds-viewer-overview/usage']) {
    const missing = mount(hash, null);
    assert.equal(pageHeading(), 'Page not found', hash);
    assert.match(missing.container.textContent || '', /There's no catalog page at #ds-viewer-overview/);
    assert.equal(missing.container.querySelector('[role="tab"]'), null);
    missing.cleanup();
  }
});

test('with usage, Overview is the first sidebar entry, above every group', () => {
  const { container, cleanup } = mount(undefined);
  assert.deepEqual(sidebarLinks(container), ['Overview', 'Banner', 'Card', 'Chip', 'Empty', 'Gallery', 'Toggle', 'Colors']);
  const overview = container.querySelector('[role="navigation"] a') as HTMLAnchorElement;
  assert.equal(overview.getAttribute('href'), '#ds-viewer-overview');
  assert.equal(overview.getAttribute('aria-current'), null);
  click(overview);
  assert.equal(pageHeading(), 'Overview');
  assert.equal(window.location.hash, '#ds-viewer-overview');
  assert.equal((container.querySelector('[role="navigation"] a') as HTMLElement).getAttribute('aria-current'), 'page');
  cleanup();
});

test('the tabs follow the keyboard model: one tab stop, arrows/Home/End move and select, and tab and panel point at each other', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  const key = (el: Element, name: string) => act(() => { el.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })); });
  const components = tabNamed(container, 'Components');
  const usageTab = tabNamed(container, 'Usage');
  const panel = container.querySelector('[role="tabpanel"]') as HTMLElement;
  const stops = () => [components, usageTab].map((tab) => tab.getAttribute('tabindex'));
  assert.deepEqual(stops(), ['0', '-1'], 'only the selected tab is in the tab order');
  assert.equal(components.getAttribute('aria-controls'), panel.id);
  assert.equal(usageTab.getAttribute('aria-controls'), panel.id);
  assert.equal(panel.getAttribute('aria-labelledby'), components.id);
  assert.ok(components.id && usageTab.id && components.id !== usageTab.id);

  components.focus();
  key(components, 'ArrowRight');
  assert.deepEqual(tabs(container), [['Components', 'false'], ['Usage', 'true']], 'ArrowRight selects the next tab');
  assert.equal(document.activeElement, usageTab, 'and moves focus to it');
  assert.deepEqual(stops(), ['-1', '0']);
  assert.equal(panel.getAttribute('aria-labelledby'), usageTab.id);
  assert.equal(window.location.hash, '#ds-viewer-overview/usage');

  key(usageTab, 'ArrowRight');
  assert.deepEqual(tabs(container), [['Components', 'true'], ['Usage', 'false']], 'it wraps');
  assert.equal(document.activeElement, components);
  key(components, 'ArrowLeft');
  assert.deepEqual(tabs(container), [['Components', 'false'], ['Usage', 'true']], 'ArrowLeft wraps the other way');
  key(usageTab, 'Home');
  assert.deepEqual(tabs(container), [['Components', 'true'], ['Usage', 'false']]);
  key(components, 'End');
  assert.deepEqual(tabs(container), [['Components', 'false'], ['Usage', 'true']]);
  assert.equal(document.activeElement, usageTab);
  key(usageTab, 'a'); // any other key does nothing
  assert.deepEqual(tabs(container), [['Components', 'false'], ['Usage', 'true']]);
  cleanup();
});

test('the tab lives in the address: both tabs load directly, switching pushes, and Back restores it', () => {
  const direct = mount('#ds-viewer-overview/usage');
  assert.equal(pageHeading(), 'Overview');
  assert.deepEqual(tabs(direct.container), [['Components', 'false'], ['Usage', 'true']], 'a reload keeps the Usage tab');
  assert.ok(direct.container.querySelector('[role="table"]'));
  direct.cleanup();

  const { container, cleanup } = mount('#ds-viewer-overview');
  assert.deepEqual(tabs(container), [['Components', 'true'], ['Usage', 'false']]);
  assert.equal(container.querySelector('[role="table"]'), null);
  click(tabNamed(container, 'Usage'));
  assert.equal(window.location.hash, '#ds-viewer-overview/usage');
  assert.deepEqual(tabs(container), [['Components', 'false'], ['Usage', 'true']]);

  goTo('#ds-viewer-overview'); // Back
  assert.deepEqual(tabs(container), [['Components', 'true'], ['Usage', 'false']]);
  goTo('#ds-viewer-overview/usage'); // Forward
  assert.deepEqual(tabs(container), [['Components', 'false'], ['Usage', 'true']]);
  assert.equal(pageHeading(), 'Overview');

  // The sidebar link advertises the Components tab, so it opens that one.
  click(container.querySelector('[role="navigation"] a') as HTMLElement);
  assert.deepEqual(tabs(container), [['Components', 'true'], ['Usage', 'false']]);
  assert.equal(window.location.hash, '#ds-viewer-overview');
  cleanup();
});

test('the Components tab groups cards by home area in declared order, with a final "Other"', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  assert.deepEqual(groupHeadings(container), ['Chat', 'Bots', 'Settings', 'Other'], 'the heading is the area name alone; the count is a sibling');
  assert.deepEqual([...container.querySelectorAll('[role="tabpanel"] [role="heading"][aria-level="2"]')].map((h) => h.parentElement?.textContent), ['Chat2', 'Bots1', 'Settings1', 'Other1']);
  assert.deepEqual(titles(container), ['Chip', 'Toggle', 'Banner', 'Card', 'Gallery']);
  assert.match(container.textContent || '', /5 components/);
  cleanup();
});

test('a page with nothing to show and a token page get no card, and no table row', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  const shown = titles(container);
  assert.ok(!shown.includes('Empty') && !shown.includes('Colors'));
  click(tabNamed(container, 'Usage'));
  assert.deepEqual(rowTitles(container).sort(), ['Banner', 'Card', 'Chip', 'Toggle']);
  cleanup();
});

test('each filter chip narrows the cards; "Shared across areas" appears only on shared cards', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  assert.deepEqual(chipLabels(container, 'Filter by area'), ['All areas', 'Chat', 'Bots', 'Settings', 'Shared across areas']);
  assert.deepEqual(pressed(container, 'Filter by area'), ['All areas']);

  click(chipNamed(container, 'Chat'));
  assert.deepEqual(pressed(container, 'Filter by area'), ['Chat']);
  assert.deepEqual(titles(container), ['Chip', 'Toggle']);
  click(chipNamed(container, 'Bots'));
  assert.deepEqual(titles(container), ['Banner']);
  click(chipNamed(container, 'Settings'));
  assert.deepEqual(titles(container), ['Card']);

  click(chipNamed(container, 'Shared across areas'));
  assert.deepEqual(titles(container), ['Chip']);
  assert.deepEqual(groupHeadings(container), ['Chat']);

  click(chipNamed(container, 'All areas'));
  assert.equal(titles(container).length, 5);
  const tagged = cards(container).filter((card) => (card.textContent || '').includes('Shared across areas')).map(titleOf);
  assert.deepEqual(tagged, ['Chip'], 'only a component used outside its home area carries the tag');
  cleanup();
});

test('"Most used" is one flat list, most uses first; "By area" restores the groups', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  assert.deepEqual(pressed(container, 'Sort components'), ['By area']);
  click(chipNamed(container, 'Most used'));
  assert.deepEqual(pressed(container, 'Sort components'), ['Most used']);
  assert.deepEqual(groupHeadings(container), []);
  assert.deepEqual(titles(container), ['Card', 'Chip', 'Banner', 'Toggle', 'Gallery']);
  click(chipNamed(container, 'By area'));
  assert.equal(groupHeadings(container).length, 4);
  cleanup();
});

test('cards read as links with a usage line, and carry no usage line text for an unrecorded page', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  const byTitle = new Map(cards(container).map((card) => [titleOf(card), card]));
  assert.match(byTitle.get('Chip')!.textContent || '', /5 uses · 2 areas/);
  assert.match(byTitle.get('Banner')!.textContent || '', /4 uses · Bots only/);
  assert.match(byTitle.get('Toggle')!.textContent || '', /1 use · Chat only/);
  assert.match(byTitle.get('Gallery')!.textContent || '', /No usage recorded/);
  assert.equal(byTitle.get('Banner')!.getAttribute('href'), '#Banner');
  cleanup();
});

test('a card is valid HTML around an interactive specimen: no nested links, one tab stop, no nesting warnings', () => {
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
  let rendered: ReturnType<typeof mount>;
  try {
    rendered = mount('#ds-viewer-overview');
  } finally {
    console.error = originalError;
  }
  const { container, cleanup } = rendered;
  assert.deepEqual(errors.filter((message) => /validateDOMNesting|cannot be a descendant|cannot contain|nested/i.test(message)), [], 'React reports no invalid DOM nesting');
  assert.equal(container.querySelector('a a, a button, button a, button button'), null, 'nothing interactive sits inside a link');
  const items = [...container.querySelectorAll('[role="tabpanel"] [role="listitem"]')];
  assert.equal(items.length, 5);
  for (const li of items) {
    const stops = [...li.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((el) => !el.closest('[inert]') && el.getAttribute('tabindex') !== '-1');
    assert.equal(stops.length, 1, `one tab stop in the "${titleOf(li)}" card: ${stops.map((el) => el.outerHTML.slice(0, 160)).join(' | ')}`);
    assert.equal(stops[0].tagName, 'A');
  }
  // The specimen's own link and button are there, but inert and hidden, beside the card's link.
  const chipItem = items.find((li) => li.textContent?.includes('Chip specimen'))!;
  assert.ok(chipItem.querySelector('[aria-hidden="true"][inert] button'));
  assert.ok(chipItem.querySelector('[aria-hidden="true"][inert] a'));
  cleanup();
});

test('activating a card opens its page, and Back returns to the same tab, filter and sort', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  click(chipNamed(container, 'Bots'));
  click(chipNamed(container, 'Most used'));
  const banner = cards(container).find((card) => titleOf(card) === 'Banner')!;
  click(banner);
  assert.equal(pageHeading(), 'Banner');
  assert.equal(window.location.hash, '#Banner');

  goTo('#ds-viewer-overview'); // Back
  assert.equal(pageHeading(), 'Overview');
  assert.deepEqual(tabs(container), [['Components', 'true'], ['Usage', 'false']]);
  assert.deepEqual(pressed(container, 'Filter by area'), ['Bots']);
  assert.deepEqual(pressed(container, 'Sort components'), ['Most used']);
  assert.deepEqual(titles(container), ['Banner']);
  cleanup();
});

test('a family card opens the family page', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  click(cards(container).find((card) => titleOf(card) === 'Card')!);
  assert.equal(pageHeading(), 'Card');
  cleanup();
});

test('the thumbnail is the first specimen, hidden from assistive technology, inert and not clickable', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  const chip = boxOf(cards(container).find((card) => titleOf(card) === 'Chip')!);
  const frame = chip.querySelector('[aria-hidden="true"]') as HTMLElement;
  assert.ok(frame, 'a hidden frame');
  assert.equal(frame.textContent, 'Chip specimen', 'the first variant only');
  assert.equal(frame.hasAttribute('inert'), true, 'nothing inside can take focus');
  const style = window.getComputedStyle(frame);
  assert.equal(style.pointerEvents, 'none');
  assert.equal(chip.querySelectorAll('[aria-hidden="true"]').length, 1);
  // The family card shows its first member's specimen; a render() page shows its render output.
  const card = boxOf(cards(container).find((c) => titleOf(c) === 'Card')!);
  assert.equal((card.querySelector('[aria-hidden="true"]') as HTMLElement).textContent, 'Card header specimen');
  const gallery = boxOf(cards(container).find((c) => titleOf(c) === 'Gallery')!);
  assert.equal((gallery.querySelector('[aria-hidden="true"]') as HTMLElement).textContent, 'Gallery specimen');
  cleanup();
});

test('the thumbnail mounts only near the viewport when IntersectionObserver exists, and at once when it does not', () => {
  const g = globalThis as Record<string, unknown>;
  class FakeObserver {
    static instances: FakeObserver[] = [];
    disconnected = false;
    target?: Element;
    constructor(public callback: (entries: Array<{ isIntersecting: boolean }>) => void, public options?: { rootMargin?: string }) { FakeObserver.instances.push(this); }
    observe(target: Element) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  g.IntersectionObserver = FakeObserver;
  try {
    const { container, cleanup } = renderCatalog(<OverviewThumbnail source={{ node: <span>lazy specimen</span> }} height={100} />);
    assert.equal(container.textContent, '', 'nothing mounted before it is near');
    assert.equal(FakeObserver.instances.length, 1);
    assert.equal(FakeObserver.instances[0].options?.rootMargin, '200px');
    act(() => { FakeObserver.instances[0].callback([{ isIntersecting: false }]); });
    assert.equal(container.textContent, '', 'not intersecting yet');
    act(() => { FakeObserver.instances[0].callback([{ isIntersecting: true }]); });
    assert.equal(container.textContent, 'lazy specimen');
    assert.equal(FakeObserver.instances[0].disconnected, true, 'one-shot: it stops observing once mounted');
    cleanup();
  } finally {
    delete g.IntersectionObserver;
  }
  const fallback = renderCatalog(<OverviewThumbnail source={{ node: <span>eager specimen</span> }} height={100} />);
  assert.equal(fallback.container.textContent, 'eager specimen', 'without IntersectionObserver it mounts immediately');
  fallback.cleanup();
});

test('a specimen that throws leaves its thumbnail empty and the page standing', () => {
  const Boom = () => { throw new Error('boom'); };
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const { container, cleanup } = renderCatalog(<div><OverviewThumbnail source={{ node: <Boom /> }} height={100} /><span>still here</span></div>);
    assert.equal(container.textContent, 'still here');
    cleanup();
  } finally {
    console.error = originalError;
  }
});

test('the Usage tab is a real table: roles, headers by area, heat cells, and a per-area count', () => {
  const { container, cleanup } = mount('#ds-viewer-overview/usage');
  const table = container.querySelector('[role="table"]') as HTMLElement;
  assert.ok(table);
  assert.equal(table.getAttribute('aria-label'), 'Where each component is used');
  const headers = [...table.querySelectorAll('[role="columnheader"]')].map((h) => (h.textContent || '').trim());
  assert.deepEqual(headers, ['Component', 'Areas', 'Chat', 'Bots', 'Settings']);
  const rows = [...table.querySelectorAll('[role="row"]')];
  assert.equal(rows.length, 5, 'a header row and four components');
  assert.equal(table.querySelectorAll('[role="rowheader"]').length, 4);
  for (const row of rows.slice(1)) assert.equal(row.querySelectorAll('[role="cell"]').length, 4, 'Areas plus one cell per area');

  // "Most shared first" is the default: Chip is in two areas.
  assert.deepEqual(rowTitles(container), ['Chip', 'Card', 'Banner', 'Toggle']);
  const chip = rows[1];
  const cellText = [...chip.querySelectorAll('[role="cell"]')].map((c) => (c.textContent || '').trim());
  assert.deepEqual(cellText, ['2', '3', '2', ''], 'areas, then Chat, Bots, Settings; a zero cell is empty');
  assert.match(chip.textContent || '', /5 uses · home: Chat/);

  // Heat: the largest count (Card's 9 in Settings) takes the darkest step; the shade is on an inset
  // chip inside the cell, never the cell itself, and zeros are empty cells.
  const cellAt = (row: Element, index: number) => (row.querySelectorAll('[role="cell"]')[index] as HTMLElement);
  const chipIn = (row: Element, index: number) => cellAt(row, index).firstElementChild as HTMLElement | null;
  const card = rows[2];
  assert.match(chipIn(card, 3)!.getAttribute('style') || '', /rgba\(23, 77, 198, 0\.9\)/);
  const chipEl = chipIn(card, 3)!;
  assert.deepEqual([cssOf(chipEl, 'width'), cssOf(chipEl, 'height'), cssOf(chipEl, 'border-top-left-radius')], ['36px', '28px', '8px'], 'an inset chip, not the whole cell');
  assert.doesNotMatch(cellAt(card, 3).getAttribute('style') || '', /rgba/, 'the cell itself is not shaded');
  assert.equal(chipIn(chip, 3), null, 'a zero cell has no chip and no text');
  assert.equal(cellAt(chip, 3).childElementCount, 0);
  assert.match(chipIn(chip, 1)!.getAttribute('style') || '', /rgba\(23, 77, 198, 0\.28\)/, '3 of 9 is the second step');
  cleanup();
});

test('a table row is not a tab stop of its own: its link is the only one', () => {
  const { container, cleanup } = mount('#ds-viewer-overview/usage');
  const rows = [...container.querySelectorAll('[role="table"] [role="row"]')].slice(1);
  assert.equal(rows.length, 4);
  for (const row of rows) {
    const stops = [...row.querySelectorAll('a[href], button, [tabindex]')].filter((el) => !el.closest('[inert]') && el.getAttribute('tabindex') !== '-1');
    assert.deepEqual(stops.map((el) => el.tagName), ['A'], `"${titleOf(row)}" row`);
    assert.equal(row.getAttribute('tabindex'), '-1');
  }
  cleanup();
});

test('the table sorts "Most shared first" or "Most used first"', () => {
  const { container, cleanup } = mount('#ds-viewer-overview/usage');
  assert.deepEqual(pressed(container, 'Sort the table'), ['Most shared first']);
  assert.deepEqual(rowTitles(container), ['Chip', 'Card', 'Banner', 'Toggle']);
  click(chipNamed(container, 'Most used first'));
  assert.deepEqual(pressed(container, 'Sort the table'), ['Most used first']);
  assert.deepEqual(rowTitles(container), ['Card', 'Chip', 'Banner', 'Toggle']);
  click(chipNamed(container, 'Most shared first'));
  assert.deepEqual(rowTitles(container), ['Chip', 'Card', 'Banner', 'Toggle']);
  cleanup();
});

test('activating a table row (or its link) opens the page, and Back returns to the Usage tab', () => {
  const { container, cleanup } = mount('#ds-viewer-overview/usage');
  click(chipNamed(container, 'Most used first'));
  const rows = () => [...container.querySelectorAll('[role="table"] [role="row"]')];
  click(rows()[2]); // the whole row: Chip, second by uses
  assert.equal(pageHeading(), 'Chip');
  assert.equal(window.location.hash, '#Chip');

  goTo('#ds-viewer-overview/usage'); // Back
  assert.equal(pageHeading(), 'Overview');
  assert.deepEqual(tabs(container), [['Components', 'false'], ['Usage', 'true']]);
  assert.deepEqual(pressed(container, 'Sort the table'), ['Most used first']);

  const link = rows()[3].querySelector('a') as HTMLAnchorElement;
  assert.equal(link.getAttribute('href'), '#Banner');
  click(link);
  assert.equal(pageHeading(), 'Banner');
  cleanup();
});

/** react-native-web turns each style into atomic classes and injects their rules once, into the window
 *  that was current when it was first imported (the warmup window above) — read a property back there. */
function cssOf(el: Element, property: string): string {
  // A style object written inline in the component (not through StyleSheet) is an inline style.
  const inline = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(el.getAttribute('style') || '');
  if (inline) return inline[1].trim();
  const classes = new Set((el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  let found = '';
  // RNW's reset class (`css-view-…`) sets defaults for many properties; the atomic classes that
  // override them are injected later, so the last matching rule is the one that applies.
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

/** react-native-web turns `overflowX` into an atomic class and injects its rule once, into the window
 *  that was current when it was first imported (the warmup window above) — read the rule back there. */
function overflowXOf(el: Element): string {
  const classes = (el.getAttribute('class') || '').split(/\s+/).filter((name) => name.startsWith('r-overflowX-'));
  for (const sheet of [...warmup.window.document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      const text = rule.cssText;
      if (classes.some((name) => text.includes(`.${name}`))) return /overflow-x:\s*(\w+)/.exec(text)?.[1] ?? '';
    }
  }
  return '';
}

test('the table scrolls inside its own container, not the page', () => {
  const { container, cleanup } = mount('#ds-viewer-overview/usage');
  const table = container.querySelector('[role="table"]') as HTMLElement;
  const scrollers: Element[] = [];
  for (let el = table.parentElement; el && el !== container; el = el.parentElement) if (['auto', 'scroll'].includes(overflowXOf(el))) scrollers.push(el);
  assert.equal(scrollers.length, 1, 'exactly one horizontally scrolling ancestor');
  // It sits inside the main column, so the page itself does not scroll sideways.
  assert.ok(scrollers[0].parentElement && scrollers[0].parentElement !== container);
  assert.ok(scrollers[0].querySelector('[role="table"]'));
  cleanup();
});

test('hovering or focusing a card re-renders neither its live specimen nor its neighbours', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  const gallery = cards(container).find((card) => titleOf(card) === 'Gallery')!;
  const before = galleryRenders;
  assert.ok(before >= 1, 'it rendered once');
  act(() => { gallery.focus(); });
  assert.equal(document.activeElement, gallery);
  act(() => { gallery.blur(); });
  act(() => { gallery.focus(); });
  assert.equal(galleryRenders, before, 'focus changes the card, not the memoized thumbnail');
  cleanup();
});

test('the thumbnails watch the shell\'s scrolling column, so the lookahead applies inside it', () => {
  const g = globalThis as Record<string, unknown>;
  class FakeObserver {
    static instances: FakeObserver[] = [];
    target?: Element;
    constructor(public callback: unknown, public options?: { root?: Element | null; rootMargin?: string }) { FakeObserver.instances.push(this); }
    observe(target: Element) { this.target = target; }
    disconnect() { /* unused */ }
  }
  g.IntersectionObserver = FakeObserver;
  try {
    const { container, cleanup } = mount('#ds-viewer-overview');
    assert.ok(FakeObserver.instances.length >= 5, 'a thumbnail per card');
    for (const observer of FakeObserver.instances) {
      const root = observer.options?.root;
      assert.ok(root, 'the observer has a root');
      assert.ok(root!.contains(observer.target!), 'the root is an ancestor of the frame it watches');
      assert.notEqual(root, container, 'the root is the scrolling column, not the whole app');
      assert.equal(observer.options?.rootMargin, '200px');
    }
    cleanup();

    // Outside the shell there is no scroll root: the window is the root, as before.
    FakeObserver.instances.length = 0;
    const alone = renderCatalog(<OverviewThumbnail source={{ node: <span>x</span> }} height={100} />);
    assert.equal(FakeObserver.instances[0].options?.root, undefined);
    alone.cleanup();
    FakeObserver.instances.length = 0;
    const root = document.createElement('div');
    const scoped = renderCatalog(<ScrollRootContext.Provider value={() => root}><OverviewThumbnail source={{ node: <span>x</span> }} height={100} /></ScrollRootContext.Provider>);
    assert.equal(FakeObserver.instances[0].options?.root, root);
    scoped.cleanup();
  } finally {
    delete g.IntersectionObserver;
  }
});

test('a thumbnail lays out at its page\'s preview width and sits on its surface', () => {
  const wide = renderCatalog(<OverviewThumbnail source={{ node: <span>wide</span>, width: 768, surface: 'dark' }} height={100} />);
  const frame = wide.container.firstElementChild as HTMLElement;
  const stage = frame.firstElementChild as HTMLElement;
  assert.equal(cssOf(stage, 'width'), '768px');
  const surface = stage.querySelector('span')!.parentElement as HTMLElement;
  assert.match(cssOf(surface, 'background-color'), /^rgba\(24,\s*24,\s*24,\s*1/, 'the dark stage behind the specimen');
  // The specimen sits in a cell of that width, not a shrink-to-fit box: a specimen sized against its
  // container (PhoneFrame is `width: 100%`) would otherwise collapse to a couple of pixels.
  const cell = stage.firstElementChild as HTMLElement;
  assert.equal(cssOf(cell, 'width'), '768px');
  assert.equal(cssOf(surface, 'width'), '100%');
  wide.cleanup();
  const plain = renderCatalog(<OverviewThumbnail source={{ node: <span>plain</span> }} height={100} />);
  assert.equal(cssOf((plain.container.firstElementChild as HTMLElement).firstElementChild!, 'width'), '402px');
  plain.cleanup();
});

test('a real area named "Other" keeps its chip, group and column; a tokenGallery screen outside Tokens gets a card', () => {
  const v = (id: string) => ({ ...base(id), variants: { items: [item(id)] } });
  const sections = [v('Alpha'), v('Beta'), { ...v('Screen'), tokenGallery: true }, { ...v('Swatches'), tokenGallery: true }] as SectionDef<string>[];
  const groups: NavGroup<string>[] = [{ label: 'Patterns', ids: ['Screen'] }, { label: 'Components', ids: ['Alpha', 'Beta'] }, { label: 'Tokens', ids: ['Swatches'] }];
  const usage: UsageData = { version: 1, components: { Alpha: { area: 'Other', uses: usesIn('Other', 2) } } };
  const { container, cleanup } = mount('#ds-viewer-overview', usage, sections, groups);
  assert.deepEqual(groupHeadings(container), ['Other', 'Other'], 'the real area, then the home-less group');
  assert.deepEqual(chipLabels(container, 'Filter by area'), ['All areas', 'Other']);
  assert.deepEqual(titles(container), ['Alpha', 'Beta', 'Screen']);
  click(chipNamed(container, 'Other'));
  assert.deepEqual(titles(container), ['Alpha'], 'the chip filters to the real area only');
  click(tabNamed(container, 'Usage'));
  assert.deepEqual([...container.querySelectorAll('[role="columnheader"]')].map((h) => (h.textContent || '').trim()), ['Component', 'Areas', 'Other']);
  cleanup();
});

test('the Usage table grows its Component column to fill a wide container and keeps a minimum for narrow ones', () => {
  const { container, cleanup } = mount('#ds-viewer-overview/usage');
  const table = container.querySelector('[role="table"]') as HTMLElement;
  assert.equal(cssOf(table, 'flex-grow'), '1');
  assert.equal(cssOf(table, 'min-width'), `${300 + 72 + 3 * 96}px`);
  assert.equal(cssOf(table, 'width'), '', 'no fixed width that would stop short of the container');
  assert.equal(cssOf(table.parentElement!, 'flex-grow'), '1', 'the scroller\'s content is at least the container wide');
  const header = table.querySelector('[role="columnheader"]') as HTMLElement;
  assert.deepEqual([cssOf(header, 'flex-grow'), cssOf(header, 'flex-basis'), cssOf(header, 'min-width')], ['1', '300px', '300px']);
  const body = table.querySelectorAll('[role="rowheader"]')[0] as HTMLElement;
  assert.deepEqual([cssOf(body, 'flex-grow'), cssOf(body, 'flex-basis'), cssOf(body, 'min-width')], ['1', '300px', '300px']);
  cleanup();
});
