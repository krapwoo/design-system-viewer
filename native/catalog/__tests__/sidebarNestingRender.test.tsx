// Mounted check of sidebar categories (`sidebarParent`): drives the real `CatalogShell` +
// `CatalogSidebar` to pin the nested rows, the connector lines, the selected state, the filter,
// the ← → pager and the screen-reader structure. jsdom has no layout, so this proves structure,
// never geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import type { NavGroup, SectionDef } from '../types.ts';

// Same warm-up as `catalogOrderingRender.test.tsx`: react-dom and react-native-web decide
// `canUseDOM` once, at first import, so a real `window` must exist before the dynamic imports.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');

type Id = 'Buttons' | 'Banner' | 'Card' | 'PrimaryButton' | 'GhostButton' | 'DangerButton' | 'Colors';

const SECTIONS: SectionDef<Id>[] = [
  { id: 'Buttons', title: 'Buttons', description: 'Every button.', path: 'src/Buttons.tsx' },
  { id: 'Banner', title: 'Banner', description: 'A banner.', path: 'src/Banner.tsx' },
  { id: 'PrimaryButton', title: 'Primary', description: 'Primary.', path: 'src/PrimaryButton.tsx', sidebarParent: 'Buttons' },
  { id: 'GhostButton', title: 'Ghost', description: 'Ghost.', path: 'src/GhostButton.tsx', sidebarParent: 'Buttons' },
  { id: 'DangerButton', title: 'Danger', description: 'Danger.', path: 'src/DangerButton.tsx', sidebarParent: 'Buttons' },
  // Sorts between 'Buttons' and its children's titles, so a flat list would put it among them.
  { id: 'Card', title: 'Card', description: 'A card.', path: 'src/Card.tsx' },
  { id: 'Colors', title: 'Colors', description: 'Colors.', path: 'src/Colors.tsx' },
];
const GROUPS: NavGroup<Id>[] = [
  { label: 'Components', ids: ['Buttons', 'Banner', 'Card', 'PrimaryButton', 'GhostButton', 'DangerButton'] },
  { label: 'Tokens', ids: ['Colors'] },
];

function click(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

function typeInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

const sidebarLinkTexts = (container: HTMLElement) => [...container.querySelectorAll('[role="navigation"] a')].map((a) => (a.textContent || '').trim());

/** `CatalogShell` needs a working `localStorage` and `history.replaceState`; jsdom's `about:blank`
 *  has neither (see `catalogOrderingRender.test.tsx`). */
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

function mount(initialPage?: Id) {
  return renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage={initialPage} appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
}

test('nested pages are listed under their parent, sorted by title, not at their own alphabetical place', () => {
  const { container, cleanup } = mount();
  assert.deepEqual(sidebarLinkTexts(container), ['Banner', 'Buttons', 'Danger', 'Ghost', 'Primary', 'Card', 'Colors']);
  cleanup();
});

test('the nested rows are a list named for the parent, with a connector per row (an elbow on the last)', () => {
  const { container, cleanup } = mount();
  const lists = container.querySelectorAll('[role="navigation"] [role="list"]');
  assert.equal(lists.length, 1);
  assert.equal(lists[0].getAttribute('aria-label'), 'Buttons pages');
  const items = [...lists[0].querySelectorAll('[role="listitem"]')];
  assert.deepEqual(items.map((item) => (item.querySelector('a')?.textContent || '').trim()), ['Danger', 'Ghost', 'Primary']);
  // Each row's connector column is decorative: it holds only empty boxes, no text and no links.
  for (const item of items) assert.equal(item.querySelectorAll('a').length, 1);
  // Two rows with a spine + tick (2 boxes each), then one with the single elbow box.
  const connectorBoxes = items.map((item) => item.firstElementChild!.children.length);
  assert.deepEqual(connectorBoxes, [2, 2, 1]);
  cleanup();
});

test('selecting a child highlights the child and not the parent', () => {
  const { container, cleanup } = mount();
  const link = (text: string) => [...container.querySelectorAll('[role="navigation"] a')].find((a) => (a.textContent || '').trim() === text) as HTMLElement;
  click(link('Ghost'));
  assert.equal(link('Ghost').getAttribute('aria-current'), 'page');
  assert.equal(link('Buttons').getAttribute('aria-current'), null);
  assert.equal((container.querySelector('[role="heading"]')?.textContent || '').trim(), 'Ghost');
  cleanup();
});

test('the filter finds a child and shows its parent row above it', () => {
  const { container, cleanup } = mount();
  const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
  typeInto(input, 'ghost');
  assert.deepEqual(sidebarLinkTexts(container), ['Buttons', 'Ghost']);
  typeInto(input, 'buttons');
  assert.deepEqual(sidebarLinkTexts(container), ['Buttons', 'Danger', 'Ghost', 'Primary']);
  cleanup();
});

test('the pager follows the sidebar: parent, then its children, then the next top-level page', () => {
  const { container, cleanup } = mount('Banner');
  const label = (prefix: string) => container.querySelector(`[aria-label^="${prefix}"]`)?.getAttribute('aria-label');
  const next = () => container.querySelector('[aria-label^="Next:"]') as HTMLElement;
  const heading = () => (container.querySelector('[role="heading"]')?.textContent || '').trim();
  const seen = [heading()];
  while (label('Next:')) { click(next()); seen.push(heading()); }
  assert.deepEqual(seen, ['Banner', 'Buttons', 'Danger', 'Ghost', 'Primary', 'Card', 'Colors']);
  cleanup();
});

/** jsdom has no layout: the sidebar's scroll node is a 100px window at the top of the page, and each
 *  row sits at a fixed offset inside the list, shifted by the node's own scrollTop. */
function stubSidebarLayout(container: HTMLElement, rowTops: Record<string, number>) {
  const nav = container.querySelector('[role="navigation"]') as HTMLElement;
  // The sidebar's `ScrollView` is the navigation's first child (above the footer).
  const scrollNode = nav.firstElementChild as HTMLElement;
  const proto = (window as unknown as { Element: { prototype: { getBoundingClientRect: () => unknown } } }).Element.prototype;
  proto.getBoundingClientRect = function (this: HTMLElement) {
    const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 100, width: 100, height, x: 0, y: top });
    if (this === scrollNode) return rect(0, 100);
    const top = rowTops[(this.textContent || '').trim()];
    return top === undefined ? rect(0, 0) : rect(top - scrollNode.scrollTop, 30);
  };
  return scrollNode;
}

function mountInOuterScroller(initialPage: Id) {
  const rendered = mount(initialPage);
  const outer = rendered.container.ownerDocument.createElement('div');
  outer.style.overflowY = 'auto';
  rendered.container.parentElement!.insertBefore(outer, rendered.container);
  outer.appendChild(rendered.container);
  outer.scrollTop = 7;
  return { ...rendered, outer };
}

const linkIn = (container: HTMLElement, text: string) => [...container.querySelectorAll('[role="navigation"] a')].find((a) => (a.textContent || '').trim() === text) as HTMLElement;

test('the open page below the fold scrolls the sidebar list, and nothing outside it', () => {
  const { container, outer, cleanup } = mountInOuterScroller('Banner');
  const scrollNode = stubSidebarLayout(container, { Banner: 10, Ghost: 150, Card: 400 });
  // The old behaviour, `scrollIntoView`, moves every scrollable ancestor: it must not be used.
  let intoViewCalls = 0;
  (window as unknown as { HTMLElement: { prototype: { scrollIntoView?: () => void } } }).HTMLElement.prototype.scrollIntoView = () => { intoViewCalls++; };
  click(linkIn(container, 'Ghost'));
  assert.equal(scrollNode.scrollTop, 80, 'the row (150..180) is brought to the bottom edge (100) of the list');
  assert.equal(outer.scrollTop, 7, 'an outer scroll container is left where it was');
  assert.equal(intoViewCalls, 0);
  cleanup();
});

test('a row above the visible area scrolls the sidebar back up to it', () => {
  const { container, outer, cleanup } = mountInOuterScroller('Card');
  const scrollNode = stubSidebarLayout(container, { Banner: 10, Card: 400 });
  scrollNode.scrollTop = 350;
  click(linkIn(container, 'Banner'));
  assert.equal(scrollNode.scrollTop, 10, 'the row (at 10 in the list, shown at -340) is brought to the top edge');
  assert.equal(outer.scrollTop, 7);
  cleanup();
});

test('a row already in view causes no scroll at all', () => {
  const { container, outer, cleanup } = mountInOuterScroller('Banner');
  const scrollNode = stubSidebarLayout(container, { Banner: 10, Ghost: 50 });
  click(linkIn(container, 'Ghost'));
  assert.equal(scrollNode.scrollTop, 0);
  assert.equal(outer.scrollTop, 7);
  cleanup();
});

test('clearing a filter re-mounts the open page\'s row without scrolling the list again', () => {
  const { container, cleanup } = mountInOuterScroller('Banner');
  const scrollNode = stubSidebarLayout(container, { Banner: 10, Ghost: 150, Card: 400 });
  click(linkIn(container, 'Ghost'));
  assert.equal(scrollNode.scrollTop, 80, 'choosing the page reveals its row');
  // The reader scrolls back up, filters the open page's row out of the list, then clears the filter.
  scrollNode.scrollTop = 0;
  const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
  typeInto(input, 'zzz');
  assert.equal(linkIn(container, 'Ghost'), undefined, 'the row really is unmounted by the filter');
  typeInto(input, '');
  assert.ok(linkIn(container, 'Ghost'), 'and mounted again');
  assert.equal(scrollNode.scrollTop, 0, 'a row that only re-mounted is not scrolled to');
  // Choosing another page still reveals it, and coming back to the first reveals that one again.
  click(linkIn(container, 'Card'));
  assert.equal(scrollNode.scrollTop, 330);
  click(linkIn(container, 'Ghost'));
  assert.equal(scrollNode.scrollTop, 150, 'the row (150 - 330 = -180) is brought to the top edge');
  cleanup();
});

test('a page left while a filter hides its row is revealed again when the filter is cleared', () => {
  // The shell owns the URL here (not embedded), so an address change opens a page as a link would.
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  const scrollNode = stubSidebarLayout(container, { Banner: 10, Ghost: 150, Card: 400 });
  click(linkIn(container, 'Ghost'));
  assert.equal(scrollNode.scrollTop, 80, 'choosing the page reveals its row');
  const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
  // The filter hides every row, then the reader goes to another page and back by address: no row
  // mounts for either, so only the sidebar itself can notice the open page changed.
  typeInto(input, 'zzz');
  assert.equal(linkIn(container, 'Ghost'), undefined, 'the row really is unmounted by the filter');
  const go = (hash: string) => act(() => { window.location.hash = hash; window.dispatchEvent(new window.HashChangeEvent('hashchange')); });
  go('#Card');
  go('#GhostButton');
  scrollNode.scrollTop = 0;
  typeInto(input, '');
  assert.equal(linkIn(container, 'Ghost').getAttribute('aria-current'), 'page');
  assert.equal(scrollNode.scrollTop, 80, 'the row mounts active and is revealed');
  cleanup();
});

test('coming back to a page after visiting one with no sidebar row reveals its row again', () => {
  // `Notes` is a page no group lists, like a reference page opened from a source link.
  // The shell owns the URL here (not embedded), so an address change opens a page as a link would.
  const sections = [...SECTIONS, { id: 'Notes', title: 'Notes', description: 'Notes.', path: 'src/Notes.tsx', navigation: 'reference' }] as unknown as SectionDef<Id>[];
  const rendered = renderCatalog(
    <Mount>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={sections} />
    </Mount>,
  );
  const { container, cleanup } = rendered;
  const scrollNode = stubSidebarLayout(container, { Banner: 10, Ghost: 150, Card: 400 });
  click(linkIn(container, 'Ghost'));
  assert.equal(scrollNode.scrollTop, 80, 'choosing the page reveals its row');
  const go = (hash: string) => act(() => { window.location.hash = hash; window.dispatchEvent(new window.HashChangeEvent('hashchange')); });
  go('#Notes');
  assert.equal((container.querySelector('[role="heading"]')?.textContent || '').trim(), 'Notes', 'precondition: the row-less page is open');
  scrollNode.scrollTop = 0;
  go('#GhostButton');
  assert.equal(linkIn(container, 'Ghost').getAttribute('aria-current'), 'page');
  assert.equal(scrollNode.scrollTop, 80, 'the row is revealed again');
  cleanup();
});
