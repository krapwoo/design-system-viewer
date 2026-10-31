// A token page that documents components, mounted through the real `CatalogShell`: what a legend
// row, an anatomy pin, a Uses line, a Parts card and the sidebar filter show for a documented
// component, where its address lands, and that a page id shows the page's title. jsdom has no
// layout (a `TokenGrid` never mounts here), so the tiles are rendered without a grid; this proves
// structure, titles, hrefs and focus, never geometry. Same warmup/`Mount` precedent as
// `partNumbersRender.test.tsx`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { Text } = await import('react-native');
const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { AnatomyPin, AnatomySpecimen } = await import('../Anatomy.tsx');
const { TokenTile } = await import('../TokenLayouts.tsx');
const { DocumentedAnchor } = await import('../DocumentedAnchor.tsx');
const { DocumentedFocusContext } = await import('../documentedFocusContext.ts');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');

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

const component = (name: string) => ({ name, file: `src/icons/${name}.tsx`, props: [], inheritedFrom: [] });
const COMPONENTS = [component('HeaderLogo'), component('FooterMark'), component('Hero')];
const other = (name: string) => ({ other: name, description: 'Used in the hero.' });

const PAGES = [
  // The token page: one tile bound with `TokenTile documents`, one custom tile with `DocumentedAnchor`.
  defineCatalogPage({
    id: 'Iconography', title: 'Icons', group: 'Tokens', description: 'Small icons.',
    documents: [{ component: 'HeaderLogo', title: 'Header logo' }, { component: 'FooterMark', title: 'Footer mark' }],
    render: () => (
      <>
        <TokenTile name="HeaderLogo" documents="HeaderLogo"><Text>logo glyph</Text></TokenTile>
        <DocumentedAnchor component="FooterMark"><Text>mark glyph</Text></DocumentedAnchor>
      </>
    ),
  }),
  // A page that names the documented components and the token page itself.
  defineCatalogPage({
    id: 'Hero', group: 'Components', description: 'A hero.',
    anatomy: {
      picture: <AnatomySpecimen pins={<><AnatomyPin other="HeaderLogo" /></>}><Text>hero</Text></AnatomySpecimen>,
      groups: [{ label: 'Used', items: [other('HeaderLogo'), other('FooterMark'), other('Iconography')] }],
    },
    composedOf: [{ component: 'HeaderLogo', role: 'Brand mark', relationship: 'built-in' }, { component: 'Iconography', role: 'Glyph set', relationship: 'slot' }],
    render: () => <Text>hero body</Text>,
  }),
].map((page) => ({ ...page, id: page.id!, file: `${page.id}.catalog.tsx` }));
const BUILT = buildCatalogSections(PAGES, COMPONENTS);

function mount(hash: string, partGroups?: string[], usage?: React.ComponentProps<typeof CatalogShell>['usage']) {
  return renderCatalog(
    <Mount hash={hash}>
      <CatalogShell appName="App" title="Catalog" groups={BUILT.groups} sections={BUILT.sections} partGroups={partGroups} usage={usage} />
    </Mount>,
  );
}

const heading = () => (document.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
const legendLinks = (container: HTMLElement) => [...container.querySelectorAll('[data-testid="anatomy-body"] a')] as HTMLAnchorElement[];
const focusedTiles = () => [...document.querySelectorAll('[data-documented][data-focused="true"]')].map((el) => el.getAttribute('data-documented'));

test('the anatomy legend shows a documented component\'s title and a page id\'s page title, never a raw id', () => {
  const { container, cleanup } = mount('#Hero');
  try {
    const links = legendLinks(container);
    assert.deepEqual(links.map((a) => (a.textContent || '').trim().replace(/^Part \d+, /, '')), ['Header logo', 'Footer mark', 'Icons']);
    assert.deepEqual(links.map((a) => a.getAttribute('href')), ['#HeaderLogo', '#FooterMark', '#Iconography']);
    assert.equal(container.textContent?.includes('Iconography'), false, 'the raw page id is not shown on the page');
  } finally { cleanup(); }
});

test('an anatomy pin and the part count name a documented component by its title', () => {
  const { container, cleanup } = mount('#Hero');
  try {
    const labels = [...container.querySelectorAll('[role="img"][aria-label^="Part "]')].map((el) => el.getAttribute('aria-label'));
    assert.deepEqual(labels, ['Part 1, opens Header logo']);
  } finally { cleanup(); }
});

test('with part groups set, a documented component is a part although its tile sits on a token page', () => {
  const { container, cleanup } = mount('#Hero', ['Components']);
  try {
    const labels = [...container.querySelectorAll('[role="img"][aria-label^="Part "]')].map((el) => el.getAttribute('aria-label'));
    assert.deepEqual(labels, ['Part 1, opens Header logo']);
    const numbered = legendLinks(container).map((a) => a.getAttribute('aria-label'));
    assert.deepEqual(numbered.slice(0, 2), ['Part 1, Header logo', 'Part 2, Footer mark']);
    assert.equal(numbered[2], null, 'a token page that is not a documented component stays unnumbered');
  } finally { cleanup(); }
});

test('opening a documented component from the legend lands on its tile and outlines it', () => {
  const { container, cleanup } = mount('#Hero');
  try {
    const link = legendLinks(container).find((a) => a.getAttribute('href') === '#HeaderLogo')!;
    click(link);
    assert.equal(heading(), 'Icons', 'the page that documents it opens');
    assert.equal(window.location.hash, '#HeaderLogo', 'the address is the component, a member-style address');
    assert.deepEqual(focusedTiles(), ['HeaderLogo'], 'a TokenTile bound with `documents` is the focused tile');
  } finally { cleanup(); }
});

test('a custom tile wrapped in DocumentedAnchor is reached the same way, from the URL', () => {
  const { cleanup } = mount('#FooterMark');
  try {
    assert.equal(heading(), 'Icons');
    assert.deepEqual(focusedTiles(), ['FooterMark']);
    goTo('#HeaderLogo');
    assert.deepEqual(focusedTiles(), ['HeaderLogo'], 'moving to another tile moves the outline');
    goTo('#Iconography');
    assert.deepEqual(focusedTiles(), [], 'the page address focuses no tile');
  } finally { cleanup(); }
});

test('Uses and Parts name a documented component by its title and link to its tile; a page id shows its title', () => {
  const { container, cleanup } = mount('#Hero');
  try {
    const parts = [...container.querySelectorAll('[role="region"] a')] as HTMLAnchorElement[];
    const hrefs = parts.map((a) => a.getAttribute('href'));
    assert.ok(hrefs.includes('#HeaderLogo'), `Parts has a card for the documented component: ${hrefs}`);
    const card = parts.find((a) => a.getAttribute('href') === '#HeaderLogo')!;
    assert.ok((card.textContent || '').includes('Header logo'), 'the card carries the documented title');
    const trigger = [...container.querySelectorAll('[aria-haspopup="dialog"]')].find((b) => (b.textContent || '').startsWith('Notes and API'))!;
    click(trigger);
    const panel = document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
    const names = [...panel.querySelectorAll('a')].map((a) => `${(a.textContent || '').trim()}→${a.getAttribute('href')}`);
    assert.ok(names.includes('Header logo→#HeaderLogo'), `Uses shows the title: ${names}`);
    assert.ok(names.includes('Icons→#Iconography'), `a page id shows the page title: ${names}`);
  } finally { cleanup(); }
});

test('the documenting page keeps "Appears in" for each documented component, named by its title', () => {
  const usage = { version: 1 as const, components: { HeaderLogo: { uses: [{ area: 'Home', file: 'Home.swift', line: 3 }] }, FooterMark: { uses: [{ area: 'Home', file: 'Footer.swift' }, { area: 'Settings', file: 'Settings.swift' }] } } };
  const { container, cleanup } = mount('#Iconography', undefined, usage);
  try {
    const text = container.textContent || '';
    assert.ok(text.includes('Files that use Header logo · 1'), text);
    assert.ok(text.includes('Files that use Footer mark · 2'), text);
    assert.ok(text.includes('Home.swift:3'));
  } finally { cleanup(); }
});

test('the documenting page shows who also uses the documented component', () => {
  const { container, cleanup } = mount('#Iconography');
  try {
    const trigger = [...container.querySelectorAll('[aria-haspopup="dialog"]')].find((b) => (b.textContent || '').startsWith('Notes and API'));
    const root = trigger ? (click(trigger), document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement) : container;
    const users = [...root.querySelectorAll('a')].map((a) => `${(a.textContent || '').trim()}→${a.getAttribute('href')}`);
    assert.ok(users.includes('Hero→#Hero'), `Also used by lists Hero: ${users}`);
  } finally { cleanup(); }
});

test('the sidebar filter finds a documented component by its title and opens its tile', () => {
  const { container, cleanup } = mount('#Hero');
  try {
    const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
    assert.ok(input, 'expected the sidebar filter');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, 'header logo');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const hit = [...container.querySelectorAll('[role="navigation"] a')].find((a) => a.getAttribute('href') === '#HeaderLogo') as HTMLAnchorElement | undefined;
    assert.ok(hit, 'a search hit for the documented component');
    assert.ok((hit!.textContent || '').includes('Header logo'));
    click(hit!);
    assert.equal(heading(), 'Icons');
    assert.deepEqual(focusedTiles(), ['HeaderLogo']);
  } finally { cleanup(); }
});

// Item B: independent of `documents` — any anatomy item, pin or link that targets a page id shows
// that page's title.
test('an anatomy item, pin and Uses link that target a page id show the page title, never the id', () => {
  const pages = [
    defineCatalogPage({ id: 'ColorPalette', title: 'Brand colors', group: 'Tokens', description: 'Colors.', render: () => <Text>swatches</Text> }),
    defineCatalogPage({
      id: 'Card', group: 'Components', description: 'A card.',
      anatomy: {
        picture: <AnatomySpecimen pins={<AnatomyPin other="ColorPalette" />}><Text>card</Text></AnatomySpecimen>,
        groups: [{ label: 'Used', items: [other('ColorPalette')] }],
      },
      composedOf: [{ component: 'ColorPalette', role: 'Fill', relationship: 'slot' }],
      render: () => <Text>card body</Text>,
    }),
  ].map((page) => ({ ...page, id: page.id!, file: `${page.id}.catalog.tsx` }));
  const built = buildCatalogSections(pages, []);
  const { container, cleanup } = renderCatalog(
    <Mount hash="#Card">
      <CatalogShell appName="App" title="Catalog" groups={built.groups} sections={built.sections} />
    </Mount>,
  );
  try {
    assert.deepEqual(legendLinks(container).map((a) => (a.textContent || '').trim().replace(/^Part \d+, /, '')), ['Brand colors']);
    assert.deepEqual([...container.querySelectorAll('[role="img"][aria-label^="Part "]')].map((el) => el.getAttribute('aria-label')), ['Part 1, opens Brand colors']);
    const trigger = [...container.querySelectorAll('[aria-haspopup="dialog"]')].find((b) => (b.textContent || '').startsWith('Notes and API'))!;
    click(trigger);
    const panel = document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
    assert.ok([...panel.querySelectorAll('a')].some((a) => (a.textContent || '').trim() === 'Brand colors' && a.getAttribute('href') === '#ColorPalette'));
    assert.equal(container.textContent?.includes('ColorPalette') || panel.textContent?.includes('ColorPalette'), false, 'the raw page id is not shown');
  } finally { cleanup(); }
});

// I-1: a family page's `relatedPages` list is a third place a page id / documented component is named.
test('a family page\'s relatedPages entry shows the page title for a page id and the documented title for a component', () => {
  const card = defineCatalogPage({
    id: 'Card', group: 'Components', description: 'A card family.',
    members: [
      { id: 'CardWhole', source: 'card.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'The card.' },
      { id: 'CardHeader', source: 'card.swift:9', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'CardWhole', description: 'The header.', variants: { items: [{ key: 'v', name: 'Default', node: <Text>Header specimen</Text> }] } },
    ],
    whole: 'CardWhole', sections: [{ label: 'Anatomy', kind: 'blocks' as const, inWhole: true, members: ['CardHeader'] }],
    relatedPages: [{ page: 'Iconography', note: 'Glyphs.' }, { page: 'HeaderLogo', note: 'The mark.' }],
  } as never);
  const pages = [...PAGES, { ...card, id: 'Card', file: 'Card.catalog.tsx' }];
  const built = buildCatalogSections(pages as never, COMPONENTS);
  const { container, cleanup } = renderCatalog(
    <Mount hash="#Card">
      <CatalogShell appName="App" title="Catalog" groups={built.groups} sections={built.sections} />
    </Mount>,
  );
  try {
    const related = [...container.querySelectorAll('a')].filter((a) => ['#Iconography', '#HeaderLogo'].includes(a.getAttribute('href') || ''));
    const rows = related.map((a) => `${(a.textContent || '').trim()}→${a.getAttribute('href')}`);
    assert.ok(rows.includes('Icons→#Iconography'), `a page id shows the page title: ${rows}`);
    assert.ok(rows.includes('Header logo→#HeaderLogo'), `a documented component shows its title: ${rows}`);
    assert.equal(container.textContent?.includes('Iconography'), false, 'the raw page id is not shown');
  } finally { cleanup(); }
});

// M-5: the anchor jumps through the shared `scrollAndFocusMember`, whose native branch asks for the
// node handle. react-native-web has no native focus to call, but its `findNodeHandle` throws "not
// supported on web", so reaching it proves the anchor takes the native branch (before the change the
// anchor did nothing off web).
test('on native, opening a documented tile takes the shared native focus path', async () => {
  const { Platform } = await import('react-native');
  const original = Platform.OS;
  (Platform as { OS: string }).OS = 'ios';
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => { errors.push(event.error ?? event.message); event.preventDefault(); };
  window.addEventListener('error', onError);
  try {
    let thrown: unknown;
    try {
      const { cleanup } = renderCatalog(
        <DocumentedFocusContext.Provider value={{ memberId: 'FooterMark', nonce: 1 }}>
          <DocumentedAnchor component="FooterMark"><Text>mark glyph</Text></DocumentedAnchor>
        </DocumentedFocusContext.Provider>,
      );
      cleanup();
    } catch (error) { thrown = error; }
    const reached = [thrown, ...errors].some((error) => /findNodeHandle is not supported/.test(String((error as Error | undefined)?.message ?? error)));
    assert.ok(reached, `the native focus path ran: ${String(thrown)} / ${errors.map(String)}`);
  } finally {
    (Platform as { OS: string }).OS = original;
    window.removeEventListener('error', onError);
  }
});

// M-1: a documented component with no bound tile opens its page at the top; a bound tile still wins.
test('a documented component with no bound tile opens its page at the top, and a bound tile still scrolls itself into view', () => {
  const jumps: string[] = [];
  function SpyScroll() {
    (window.Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = function (this: Element) {
      jumps.push(this.getAttribute('data-documented') ?? this.getAttribute('data-testid') ?? this.tagName);
    };
    return null;
  }
  const loose = defineCatalogPage({ id: 'Loose', title: 'Loose icons', group: 'Tokens', description: 'Icons.', documents: [{ component: 'Hero', title: 'Hero mark' }], render: () => <Text>no bound tile</Text> });
  const built = buildCatalogSections([...PAGES, { ...loose, id: 'Loose', file: 'Loose.catalog.tsx' }].filter((page) => page.id !== 'Hero') as never, COMPONENTS);
  const open = (hash: string) => {
    jumps.length = 0;
    const { cleanup } = renderCatalog(
      <Mount hash={hash}>
        <SpyScroll />
        <CatalogShell appName="App" title="Catalog" groups={built.groups} sections={built.sections} />
      </Mount>,
    );
    const heading = (document.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
    cleanup();
    return heading;
  };
  assert.equal(open('#Hero'), 'Loose icons');
  assert.equal(jumps.length, 1, `the unbound address returns to the top once: ${jumps}`);
  assert.equal(open('#FooterMark'), 'Icons');
  assert.equal(jumps[jumps.length - 1], 'FooterMark', `the bound tile's own jump comes last: ${jumps}`);
  assert.equal(open('#Iconography'), 'Icons');
  assert.deepEqual(jumps, [], 'a plain page address does not use this jump');
});

// M-2: independent of `documents` — a Parts card and a pin label name a titled family member by its
// own title (the page that holds it is no longer what they show).
test('a Parts card and a pin label name a titled family member by the member\'s title, not its family page\'s', () => {
  const card = defineCatalogPage({
    id: 'CardFamily', title: 'Card family', group: 'Components', description: 'A card family.',
    members: [
      { id: 'CardWhole', source: 'card.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'The card.' },
      { id: 'CardHeader', title: 'Card header', source: 'card.swift:9', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'CardWhole', description: 'The header.', variants: { items: [{ key: 'v', name: 'Default', node: <Text>Header specimen</Text> }] } },
    ],
    whole: 'CardWhole', sections: [{ label: 'Anatomy', kind: 'blocks' as const, inWhole: true, members: ['CardHeader'] }],
  } as never);
  const shelf = defineCatalogPage({
    id: 'Shelf', group: 'Components', description: 'A shelf.',
    anatomy: { picture: <AnatomySpecimen pins={<AnatomyPin other="CardHeader" />}><Text>shelf</Text></AnatomySpecimen>, groups: [{ label: 'Used', items: [other('CardHeader')] }] },
    composedOf: [{ component: 'CardHeader', role: 'Heading', relationship: 'slot' }],
    render: () => <Text>shelf body</Text>,
  });
  const built = buildCatalogSections([card, shelf].map((page) => ({ ...page, id: page.id!, file: `${page.id}.catalog.tsx` })) as never, []);
  const { container, cleanup } = renderCatalog(
    <Mount hash="#Shelf">
      <CatalogShell appName="App" title="Catalog" groups={built.groups} sections={built.sections} />
    </Mount>,
  );
  try {
    const labels = [...container.querySelectorAll('[role="img"][aria-label^="Part "]')].map((el) => el.getAttribute('aria-label'));
    assert.deepEqual(labels, ['Part 1, opens Card header']);
    const parts = [...container.querySelectorAll('[role="region"] a')] as HTMLAnchorElement[];
    const cardLink = parts.find((a) => a.getAttribute('href') === '#CardHeader');
    assert.ok(cardLink, `a Parts card links the member: ${parts.map((a) => a.getAttribute('href'))}`);
    assert.ok((cardLink!.textContent || '').includes('Card header'));
    assert.equal((cardLink!.textContent || '').includes('Card family'), false, 'the family page\'s title is not shown');
  } finally { cleanup(); }
});

// N-1: an unbound documented component opens its page at the very top (the main scroll resets),
// like a plain page address; a bound tile's own jump still comes after the reset and wins.
test('an unbound documented component resets the main scroll to the top, and a bound tile\'s jump still comes last', () => {
  const events: string[] = [];
  // Installed while rendering: the window the catalog renders into is not the one this file imports.
  function Spy() {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollTop', { configurable: true, get() { return 0; }, set(value: number) { events.push(`top:${value}`); } });
    (window.Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = function (this: Element) {
      events.push(`jump:${this.getAttribute('data-documented') ?? 'page'}`);
    };
    return null;
  }
  const loose = defineCatalogPage({ id: 'Loose', title: 'Loose icons', group: 'Tokens', description: 'Icons.', documents: [{ component: 'Hero', title: 'Hero mark' }], render: () => <Text>no bound tile</Text> });
  const built = buildCatalogSections([...PAGES, { ...loose, id: 'Loose', file: 'Loose.catalog.tsx' }].filter((page) => page.id !== 'Hero') as never, COMPONENTS);
  const open = (hash: string) => {
    events.length = 0;
    const { cleanup } = renderCatalog(
      <Mount hash={hash}>
        <Spy />
        <CatalogShell appName="App" title="Catalog" groups={built.groups} sections={built.sections} />
      </Mount>,
    );
    cleanup();
    return [...events];
  };
  {
    assert.ok(open('#Hero').includes('top:0'), 'the unbound address returns the main scroll to the top');
    const bound = open('#FooterMark');
    assert.ok(bound.includes('top:0'), 'a bound address resets first too');
    assert.equal(bound[bound.length - 1], 'jump:FooterMark', `the bound tile's jump comes after the reset: ${bound}`);
    assert.equal(open('#Iconography').includes('top:0'), true, 'a plain page address still resets (the existing rule)');
  }
});

// A new `sections` object (a hot reload) is not a new target: an open unbound documented address
// must not be scrolled back to the top again.
test('re-rendering with a new sections object does not reset the scroll of an open documented address', () => {
  const tops: number[] = [];
  function Spy() {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollTop', { configurable: true, get() { return 0; }, set(value: number) { tops.push(value); } });
    return null;
  }
  const loose = defineCatalogPage({ id: 'Loose', title: 'Loose icons', group: 'Tokens', description: 'Icons.', documents: [{ component: 'Hero', title: 'Hero mark' }], render: () => <Text>no bound tile</Text> });
  const pages = [...PAGES, { ...loose, id: 'Loose', file: 'Loose.catalog.tsx' }].filter((page) => page.id !== 'Hero') as never;
  const first = buildCatalogSections(pages, COMPONENTS);
  const second = buildCatalogSections(pages, COMPONENTS);
  assert.notEqual(first.sections, second.sections, 'a rebuild gives a new sections object');
  let swap: (() => void) | undefined;
  function Shell() {
    const [built, setBuilt] = useState(first);
    swap = () => setBuilt(second);
    return <CatalogShell appName="App" title="Catalog" groups={built.groups} sections={built.sections} />;
  }
  const { cleanup } = renderCatalog(
    <Mount hash="#Hero">
      <Spy />
      <Shell />
    </Mount>,
  );
  try {
    assert.ok(tops.includes(0), 'the unbound address reset the scroll on arrival');
    tops.length = 0;
    act(() => { swap!(); });
    assert.deepEqual(tops, [], `a new sections object does not scroll again: ${tops}`);
  } finally { cleanup(); }
});
