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
const { CARD_TITLE_MIN_HEIGHT } = await import('../Overview.tsx');
const { CATALOG_SPACE, CATALOG_TEXT } = await import('../tokens.ts');

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
  return ([...container.querySelectorAll('[role="listitem"] a')] as HTMLAnchorElement[]).filter((a) => !a.closest('[aria-hidden="true"]'));
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
  return [...container.querySelectorAll('[role="heading"][aria-level="2"]')].map((h) => (h.textContent || '').trim());
}
function titles(container: HTMLElement): string[] {
  return cards(container).map(titleOf);
}
test('without usage there is no Overview entry, and its address is not found', () => {
  const { container, cleanup } = mount(undefined, null);
  assert.deepEqual(sidebarLinks(container), ['Banner', 'Card', 'Chip', 'Empty', 'Gallery', 'Toggle', 'Colors']);
  cleanup();

  for (const hash of ['#ds-viewer-overview', '#ds-viewer-overview/usage']) {
    const missing = mount(hash, null);
    assert.equal(pageHeading(), 'Page not found', hash);
    assert.match(missing.container.textContent || '', /There's no catalog page at #ds-viewer-overview/);
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

test('the Overview has no tablist or tabpanel: it is the Components grid alone', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  assert.equal(pageHeading(), 'Overview');
  assert.equal(container.querySelector('[role="tablist"], [role="tab"], [role="tabpanel"], [role="table"]'), null);
  assert.equal(container.querySelector('[aria-label="Sort components"]'), null, 'no sort control');
  assert.deepEqual(chipLabels(container, 'Filter by area'), ['All areas', 'Chat', 'Bots', 'Settings']);
  assert.equal(titles(container).length, 5);
  cleanup();
});

test('an old #ds-viewer-overview/usage address opens the Overview, settles on the current address, and Back still leaves it', () => {
  const direct = mount('#ds-viewer-overview/usage');
  assert.equal(pageHeading(), 'Overview', 'not the not-found state');
  assert.equal(window.location.hash, '#ds-viewer-overview', 'rewritten in place');
  assert.equal(titles(direct.container).length, 5);
  direct.cleanup();

  const { container, cleanup } = mount('#ds-viewer-overview');
  click(cards(container).find((card) => titleOf(card) === 'Banner')!);
  assert.equal(pageHeading(), 'Banner');
  goTo('#ds-viewer-overview/usage'); // Back/Forward onto a retired address
  assert.equal(pageHeading(), 'Overview');
  assert.equal(titles(container).length, 5);
  goTo('#Banner'); // Back from the Overview still works
  assert.equal(pageHeading(), 'Banner');
  cleanup();
});

test('the Overview groups cards by home area in declared order, with a final "Other"', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  assert.deepEqual(groupHeadings(container), ['Chat', 'Bots', 'Settings', 'Other'], 'the heading is the area name alone; the count is a sibling');
  assert.deepEqual([...container.querySelectorAll('[role="heading"][aria-level="2"]')].map((h) => h.parentElement?.textContent), ['Chat2', 'Bots1', 'Settings1', 'Other1']);
  assert.deepEqual(titles(container), ['Chip', 'Toggle', 'Banner', 'Card', 'Gallery']);
  assert.match(container.textContent || '', /5 components/);
  cleanup();
});

test('a page with nothing to show and a token page get no card', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  const shown = titles(container);
  assert.ok(!shown.includes('Empty') && !shown.includes('Colors'));
  cleanup();
});

test('each filter chip narrows the cards; there is no "Shared across areas" chip or tag', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  assert.deepEqual(chipLabels(container, 'Filter by area'), ['All areas', 'Chat', 'Bots', 'Settings']);
  assert.deepEqual(pressed(container, 'Filter by area'), ['All areas']);

  click(chipNamed(container, 'Chat'));
  assert.deepEqual(pressed(container, 'Filter by area'), ['Chat']);
  assert.deepEqual(titles(container), ['Chip', 'Toggle']);
  click(chipNamed(container, 'Bots'));
  assert.deepEqual(titles(container), ['Banner']);
  click(chipNamed(container, 'Settings'));
  assert.deepEqual(titles(container), ['Card']);

  click(chipNamed(container, 'All areas'));
  assert.equal(titles(container).length, 5);
  assert.doesNotMatch(container.textContent || '', /Shared across areas/);
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
  const items = [...container.querySelectorAll('[role="listitem"]')];
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

test('activating a card opens its page, and Back returns to the same filter', () => {
  const { container, cleanup } = mount('#ds-viewer-overview');
  click(chipNamed(container, 'Bots'));
  const banner = cards(container).find((card) => titleOf(card) === 'Banner')!;
  click(banner);
  assert.equal(pageHeading(), 'Banner');
  assert.equal(window.location.hash, '#Banner');

  goTo('#ds-viewer-overview'); // Back
  assert.equal(pageHeading(), 'Overview');
  assert.deepEqual(pressed(container, 'Filter by area'), ['Bots']);
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

test('a real area named "Other" keeps its chip and group; a tokenGallery screen outside Tokens gets a card', () => {
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
  cleanup();
});

test('every card reserves a two-line title, so a long-titled card and a short one are the same height', () => {
  const LONG = 'A remarkably long component title that has to wrap onto a second line inside a narrow card';
  const v = (id: string, title: string) => ({ ...base(id), title, variants: { items: [item(id)] } });
  const sections = [v('Long', LONG), v('Short', 'Short')] as SectionDef<string>[];
  const groups: NavGroup<string>[] = [{ label: 'Components', ids: ['Long', 'Short'] }];
  const usage: UsageData = { version: 1, areas: ['Chat', 'Bots'], components: { Long: { area: 'Chat', uses: [...usesIn('Chat', 2), ...usesIn('Bots', 1)] } } };
  const { container, cleanup } = mount('#ds-viewer-overview', usage, sections, groups);
  const [long, short] = ['Long', 'Short'].map((title) => cards(container).find((card) => (card.textContent || '').includes(title === 'Long' ? LONG : 'Short'))!);

  // jsdom has no layout, so compare what decides the height: the reserved min-heights, which come
  // from the text roles' line heights rather than a pixel guess.
  const reserved = (link: HTMLElement) => {
    assert.equal(link.children.length, 2, 'title and usage line only');
    const [title] = [...link.children] as HTMLElement[];
    return { title: cssOf(title, 'min-height'), clamp: cssOf(title, '-webkit-line-clamp') };
  };
  const expected = { title: `${CATALOG_TEXT.bodyStrong.lineHeight * 2}px` };
  assert.equal(CARD_TITLE_MIN_HEIGHT, CATALOG_TEXT.bodyStrong.lineHeight * 2);
  const a = reserved(long);
  const b = reserved(short);
  assert.equal(a.title, expected.title);
  assert.deepEqual(a, b, 'identical height styles');
  assert.equal(a.clamp, '2', 'a title takes at most two lines');
  assert.equal(long.getAttribute('href'), '#Long');
  assert.match(long.textContent || '', new RegExp(LONG), 'the full title stays in the link\'s name');
  assert.equal(cssOf(long, 'height'), '', 'no fixed pixel height that could clip');
  cleanup();
});
