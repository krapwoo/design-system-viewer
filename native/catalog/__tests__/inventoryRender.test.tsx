// `InventoryGroup` and `InventoryTile`, the building blocks of a category overview page's inventory:
// mounted through react-native-web, once on their own against a stand-in navigation and once inside
// the real `CatalogShell`, to pin that the shell hands them its own title/address resolution. jsdom
// has no layout, so a fake `ResizeObserver` gives a `TokenGrid` the width it needs to draw its tiles
// (the pattern `structuredTokenPageRender.test.tsx` documents); column counts are read off the tile
// widths that width produces, never measured.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { NavGroup, SectionDef } from '../types.ts';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;

const { InventoryGroup, InventoryTile } = await import('../Inventory.tsx');
const { ReferenceNavigationContext } = await import('../referenceNavigationContext.ts');
const { MemberTitlesContext } = await import('../memberTitlesContext.ts');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { Text, Pressable } = await import('react-native');

type ResizeEntry = { target: Element };
class FakeResizeObserver {
  static current: FakeResizeObserver | undefined;
  observed = new Set<Element>();
  constructor(private callback: (entries: ResizeEntry[]) => void) { FakeResizeObserver.current = this; }
  observe(node: Element) { this.observed.add(node); }
  unobserve(node: Element) { this.observed.delete(node); }
  disconnect() { this.observed.clear(); }
  triggerAll() { this.callback([...this.observed].map((target) => ({ target }))); }
}

function mountWith(element: React.ReactElement) {
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
  return { container, cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); } };
}

async function settle(width: number) {
  for (let i = 0; i < 3; i += 1) {
    const observer = FakeResizeObserver.current;
    if (!observer) return;
    for (const node of observer.observed) {
      Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
      Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
    }
    await act(async () => { observer.triggerAll(); await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
}

const links = (container: HTMLElement) => [...container.querySelectorAll('a')];
const click = (el: Element) => act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });

/** A stand-in for the shell's navigation: two pages (`PrimaryButton`, `Chips`), one titled member of
 *  `Chips`, and one untitled one. */
function fakeNavigation(opened: unknown[][] = []) {
  const resolve = (name: string) => {
    if (name === 'PrimaryButton' || name === 'Chips') return { pageId: name };
    if (name === 'FilterChip' || name === 'ChatTactileButtonStyle') return { pageId: 'Chips', memberId: name };
    return undefined;
  };
  return {
    resolve,
    open: (...args: unknown[]) => { opened.push(args); },
    page: (pageId: string) => ({ PrimaryButton: { title: 'Primary button' }, Chips: { title: 'Chips' } } as Record<string, { title: string }>)[pageId],
  };
}
const memberTitles = { titles: new Map([['FilterChip', 'Filter chip']]), pageIds: new Set(['Chips']) };

function inStandIn(children: React.ReactNode, opened: unknown[][] = []) {
  return (
    <ReferenceNavigationContext.Provider value={fakeNavigation(opened) as never}>
      <MemberTitlesContext.Provider value={memberTitles}>{children}</MemberTitlesContext.Provider>
    </ReferenceNavigationContext.Provider>
  );
}

const tiles = (n: number) => Array.from({ length: n }, (_, i) => <InventoryTile key={i} target="PrimaryButton" specimen={<Text>specimen {i}</Text>} />);
/** The widths, in px, of the tile slots the grid drew. */
const slotWidths = (container: HTMLElement) =>
  [...container.querySelectorAll('div')]
    .filter((el) => el.children.length === 1 && el.querySelector('a') && /^width: [\d.]+px;?$/.test(el.getAttribute('style') ?? ''))
    .map((el) => Math.round(parseFloat((el.getAttribute('style') ?? '').replace('width: ', ''))));

test('a group titles itself with its count, describes itself, and draws a tile per child', async () => {
  const { container, cleanup } = mountWith(inStandIn(
    <InventoryGroup title="Shared styles" description="Buttons that take their look from one shared style.">{tiles(3)}</InventoryGroup>,
  ));
  await settle(1200);
  const text = container.textContent || '';
  assert.ok(text.includes('Shared styles · 3'), text);
  assert.ok(text.includes('Buttons that take their look from one shared style.'));
  assert.equal(links(container).length, 3);
  cleanup();
});

test('a group with no tiles renders nothing', async () => {
  const { container, cleanup } = mountWith(inStandIn(<InventoryGroup title="Empty" description="Nothing here.">{[]}</InventoryGroup>));
  await settle(1200);
  assert.equal(container.textContent, '');
  cleanup();
});

test('three and five tiles sit three across; four, six and the rest four across; a narrow page drops to one', async () => {
  const across = async (count: number, width: number) => {
    const { container, cleanup } = mountWith(inStandIn(<InventoryGroup title="G" description="d">{tiles(count)}</InventoryGroup>));
    await settle(width);
    const widths = slotWidths(container);
    cleanup();
    assert.equal(widths.length, count, `${count} tiles drawn`);
    return Math.round((width + 20) / (widths[0] + 20)); // columns, from a tile's share of the row
  };
  assert.equal(await across(3, 1200), 3);
  assert.equal(await across(5, 1200), 3);
  assert.equal(await across(4, 1200), 4);
  assert.equal(await across(6, 1200), 4);
  assert.equal(await across(2, 1200), 4, 'a pair keeps the tile size of a full row instead of stretching');
  assert.equal(await across(5, 500), 1, 'a narrow page drops below the cap');
});

test('a tile\'s title is its page\'s title and links to that page, never the id', () => {
  const opened: unknown[][] = [];
  const { container, cleanup } = mountWith(inStandIn(<InventoryTile target="PrimaryButton" specimen={<Text>x</Text>} />, opened));
  const [link] = links(container);
  assert.equal((link.textContent || '').trim(), 'Primary button');
  assert.equal(link.getAttribute('href'), '#PrimaryButton');
  click(link);
  assert.deepEqual(opened, [['PrimaryButton', undefined, undefined]], 'activating it opens the page through the shell');
  cleanup();
});

test('a #member address resolves like an id, to the member\'s title and address', () => {
  const opened: unknown[][] = [];
  const { container, cleanup } = mountWith(inStandIn(<InventoryTile target="#FilterChip" specimen={<Text>x</Text>} />, opened));
  const [link] = links(container);
  assert.equal((link.textContent || '').trim(), 'Filter chip');
  assert.equal(link.getAttribute('href'), '#FilterChip');
  click(link);
  assert.deepEqual(opened, [['Chips', 'FilterChip', undefined]]);
  cleanup();
});

test('a member with no title shows a readable name, and a tile\'s own title overrides both', () => {
  const plain = mountWith(inStandIn(<InventoryTile target="ChatTactileButtonStyle" specimen={<Text>x</Text>} />));
  assert.equal((links(plain.container)[0].textContent || '').trim(), 'Chat tactile button style');
  plain.cleanup();
  const own = mountWith(inStandIn(<InventoryTile target="PrimaryButton" title="The main one" specimen={<Text>x</Text>} />));
  assert.equal((links(own.container)[0].textContent || '').trim(), 'The main one');
  own.cleanup();
});

test('inside a shell, a target that resolves to nothing is plain text, not a dead link', () => {
  const { container, cleanup } = mountWith(inStandIn(<InventoryTile target="GhostOfAButton" specimen={<Text>x</Text>} />));
  assert.equal(links(container).length, 0);
  assert.ok((container.textContent || '').includes('Ghost of a button'));
  cleanup();
});

test('outside a shell the title is a readable name linking to #target', () => {
  const { container, cleanup } = mountWith(<InventoryTile target="PrimaryButton" specimen={<Text>x</Text>} />);
  const [link] = links(container);
  assert.equal((link.textContent || '').trim(), 'Primary button');
  assert.equal(link.getAttribute('href'), '#PrimaryButton');
  cleanup();
});

test('one tab stop per tile: the title link; the specimen is hidden from assistive technology and inert', () => {
  const { container, cleanup } = mountWith(inStandIn(
    <InventoryTile target="PrimaryButton" specimen={<Pressable accessibilityRole="button"><Text>Continue</Text></Pressable>} />,
  ));
  const hidden = container.querySelector('[aria-hidden="true"]') as HTMLElement;
  assert.ok(hidden, 'the specimen sits in an aria-hidden wrapper');
  assert.equal(hidden.hasAttribute('inert'), true, 'and it is inert');
  assert.ok(hidden.textContent?.includes('Continue'), 'the real specimen is in it');
  assert.equal(links(container).length, 1);
  const focusable = [...container.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')].filter((el) => !hidden.contains(el));
  assert.equal(focusable.length, 1, 'only the title link is outside the inert specimen');
  assert.equal(focusable[0].tagName, 'A');
  cleanup();
});

test('with no specimen, a page target draws that page\'s own first specimen, also inert', () => {
  const navigation = { ...fakeNavigation(), page: (id: string) => ({ title: id === 'PrimaryButton' ? 'Primary button' : 'Chips', source: { node: <Text>the page's own specimen</Text> } }) };
  const { container, cleanup } = mountWith(
    <ReferenceNavigationContext.Provider value={navigation as never}><InventoryTile target="PrimaryButton" /></ReferenceNavigationContext.Provider>,
  );
  const hidden = container.querySelector('[aria-hidden="true"]') as HTMLElement;
  assert.ok(hidden.textContent?.includes("the page's own specimen"));
  assert.equal(hidden.hasAttribute('inert'), true);
  cleanup();
});

/** A navigation over `pages`: each has a title (omitted: the id stands in, as the shell's `page()` does)
 *  and a specimen drawn by `render`. */
function pagesNavigation(pages: Record<string, { title?: string; render: () => React.ReactNode }>) {
  return {
    resolve: (name: string) => (name in pages ? { pageId: name } : undefined),
    open: () => {},
    page: (id: string) => (id in pages ? { title: pages[id].title ?? id, source: { render: pages[id].render } } : undefined),
  };
}
const withPages = (pages: Parameters<typeof pagesNavigation>[0], children: React.ReactNode) => (
  <ReferenceNavigationContext.Provider value={pagesNavigation(pages) as never}>{children}</ReferenceNavigationContext.Provider>
);
const countOf = (text: string, part: string) => text.split(part).length - 1;

test('a tile that targets its own page, with no specimen, draws that page once and then says "No specimen"', () => {
  const pages = {
    Self: { title: 'Self', render: () => <><Text>self-specimen</Text><InventoryTile target="Self" /></> },
  };
  const { container, cleanup } = mountWith(withPages(pages, <InventoryTile target="Self" />));
  const text = container.textContent || '';
  assert.equal(countOf(text, 'self-specimen'), 1, text);
  assert.equal(countOf(text, 'No specimen'), 1, text);
  cleanup();
});

test('two pages that target each other with no specimens stop at the repeat', () => {
  const pages = {
    Alpha: { title: 'Alpha', render: () => <><Text>alpha-specimen</Text><InventoryTile target="Beta" /></> },
    Beta: { title: 'Beta', render: () => <><Text>beta-specimen</Text><InventoryTile target="Alpha" /></> },
  };
  const { container, cleanup } = mountWith(withPages(pages, <InventoryTile target="Alpha" />));
  const text = container.textContent || '';
  assert.equal(countOf(text, 'alpha-specimen'), 1, text);
  assert.equal(countOf(text, 'beta-specimen'), 1, text);
  assert.equal(countOf(text, 'No specimen'), 1, text);
  cleanup();
});

test('an untitled page shows a readable name, not its id', () => {
  const pages = { PrimaryButton: { render: () => <Text>x</Text> }, Chips: { title: 'Chips & friends', render: () => <Text>y</Text> } };
  const { container, cleanup } = mountWith(withPages(pages, <><InventoryTile target="PrimaryButton" /><InventoryTile target="Chips" /></>));
  assert.deepEqual(links(container).map((a) => (a.textContent || '').trim()), ['Primary button', 'Chips & friends']);
  cleanup();
});

test('with no specimen and no page to take one from, the stage says so', () => {
  const { container, cleanup } = mountWith(inStandIn(<InventoryTile target="FilterChip" />));
  assert.ok((container.querySelector('[aria-hidden="true"]')?.textContent || '').includes('No specimen'));
  cleanup();
});

/* The real shell. */

type Id = 'Buttons' | 'PrimaryButton';
const SECTIONS: SectionDef<Id>[] = [
  {
    id: 'Buttons', title: 'Buttons', description: 'Every button.', path: 'src/Buttons.tsx',
    render: () => (
      <InventoryGroup title="Shared styles" description="From one shared style.">
        <InventoryTile target="PrimaryButton" specimen={<Text>specimen</Text>} />
        <InventoryTile target="#PrimaryButton" specimen={<Text>specimen two</Text>} />
        <InventoryTile target="NotAPage" specimen={<Text>specimen three</Text>} />
      </InventoryGroup>
    ),
  },
  { id: 'PrimaryButton', title: 'Primary button', description: 'Primary.', path: 'src/PrimaryButton.tsx', sidebarParent: 'Buttons' },
];
const GROUPS: NavGroup<Id>[] = [{ label: 'Components', ids: ['Buttons', 'PrimaryButton'] }];

function Mount({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() },
    });
    Object.defineProperty(window.history, 'replaceState', {
      configurable: true,
      value: (_s: unknown, _t: string, url?: string | URL | null) => { if (url != null) window.location.hash = String(url); },
    });
    setReady(true);
  }, []);
  return ready ? <>{children}</> : null;
}

test('inside the real shell a tile links to the page by its title, and activating it opens that page', async () => {
  const { container, cleanup } = mountWith(
    <Mount><CatalogShell embedded initialPage="Buttons" appName="App" title="Catalog" groups={GROUPS} sections={SECTIONS} /></Mount>,
  );
  await settle(1200);
  const inventory = links(container).filter((a) => !a.closest('[role="navigation"]'));
  assert.deepEqual(inventory.map((a) => (a.textContent || '').trim()), ['Primary button', 'Primary button']);
  assert.deepEqual(inventory.map((a) => a.getAttribute('href')), ['#PrimaryButton', '#PrimaryButton']);
  assert.ok((container.textContent || '').includes('Not a page'), 'an unknown target is a readable name, as text');
  click(inventory[0]);
  assert.equal((container.querySelector('[role="heading"]')?.textContent || '').trim(), 'Primary button');
  cleanup();
});
