// Mounted regression for displayed-title page ordering (fix/title-page-order): drives the actual
// `CatalogShell` + `CatalogSidebar` (not `catalogNavigation.ts` in isolation) to pin that the
// sidebar list, the pager, the initial route, and invalid-route recovery all agree on the same
// title-canonical order a real app (titled pages whose ids don't happen to sort the same way)
// would show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import type { NavGroup, SectionDef } from '../types.ts';

// `react-dom` decides once, at its own module's top-level evaluation, whether it `canUseDOM` (a
// plain `typeof window === 'undefined'` check, cached for the life of the process) — everything
// downstream of that decision, including whether a controlled `<input>`'s `onChange` ever fires
// for a dispatched native event, follows from it. `renderCatalog` only creates its jsdom `window`
// *inside* the function it exports, so a plain top-level `import { renderCatalog } from
// '../../../test/renderCatalog.tsx'` would still load `react-dom/client` (transitively, and so
// decide `canUseDOM`) before any test ever calls it — too late. Building a throwaway `window`
// here first, then reaching `renderCatalog`/`CatalogShell` only through a dynamic `import()`
// (unlike a static `import`, not hoisted ahead of this file's own top-level code), makes sure
// `react-dom` first evaluates with a real `window.document` already in place.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
// react-native-web's own `canUseDom` gets cached the same way, at its own first import — reachable
// only through the same dynamic `import()` below, so it also now evaluates with a real `document`
// present, and immediately creates a real stylesheet. That code checks a bare `instanceof
// ShadowRoot` with no feature-detection guard — a real global in a browser (where `window` is
// `globalThis`), but not here, where `ShadowRoot` only exists as a property of our own `window`
// object, so the bare identifier throws a `ReferenceError` unless it's exposed as a true global too.
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { hashForId } = await import('../catalogNavigation.ts');

// The user's own real-world example (see `catalogNavigation.test.ts`'s own fixture): ids whose
// alphabetical order ("Bot avatar, App connection request, Code block") is the wrong, pre-fix
// order; their displayed titles sort correctly ("App connection request, Bot avatar, Code block").
type Id = 'BotAvatarView' | 'BotConnectionRequestBody' | 'ChatCodeBlock';

const SECTIONS: SectionDef<Id>[] = [
  { id: 'BotAvatarView', title: 'Bot avatar', description: 'A bot avatar.', path: 'src/BotAvatarView.tsx' },
  { id: 'BotConnectionRequestBody', title: 'App connection request', description: 'A connection request.', path: 'src/BotConnectionRequestBody.tsx' },
  { id: 'ChatCodeBlock', title: 'Code block', description: 'A code block.', path: 'src/ChatCodeBlock.tsx' },
];
const GROUPS: NavGroup<Id>[] = [{ label: 'Components', ids: ['BotAvatarView', 'BotConnectionRequestBody', 'ChatCodeBlock'] }];
const TITLE_ORDER = ['App connection request', 'Bot avatar', 'Code block'];

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function typeInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

function sidebarLinkTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="navigation"] a')].map((a) => (a.textContent || '').trim());
}

/** `CatalogShell` reads `window.location.hash` and `window.localStorage` once, in `useState`
 *  initializers, on its own first render, and later syncs the fragment with
 *  `window.history.replaceState` (a same-page "don't push a new entry" sync, after the initial
 *  route resolves to a real page). jsdom's default document (`about:blank`, an opaque origin with
 *  no real path) throws on both `localStorage` access and `history.replaceState` with a bare
 *  fragment — and a hash must already be set before that first render to exercise notFound
 *  recovery rather than a later `hashchange` — so every mount here goes through this wrapper,
 *  which stubs working versions of both, and optionally sets the hash in a layout effect, then
 *  renders `children` only once that's done. */
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
    // jsdom can't rewrite an `about:blank` document's URL via the history API at all (even a
    // same-page, fragment-only `replaceState`) — but plain `location.hash` assignment, which is
    // all `CatalogShell`'s own fragment sync is trying to accomplish here, already works.
    Object.defineProperty(window.history, 'replaceState', {
      configurable: true,
      value: (_state: unknown, _title: string, url?: string | URL | null) => {
        if (url != null) window.location.hash = String(url);
      },
    });
    if (hash) window.location.hash = hash;
    setReady(true);
  }, [hash]);
  return ready ? <>{children}</> : null;
}

test('the sidebar lists every page in title-canonical order, not id order', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  assert.deepEqual(sidebarLinkTexts(container), TITLE_ORDER);
  cleanup();
});

test('filtering keeps the title-canonical relative order among the ids that still match', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  // The two Bot ids match, but ChatCodeBlock does not: the query must take effect and keep the
  // surviving pages in title order, not the BotAvatarView-first id order.
  const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
  assert.ok(input, 'expected the sidebar filter input');
  typeInto(input, 'bot');
  assert.deepEqual(sidebarLinkTexts(container), ['App connection request', 'Bot avatar']);
  cleanup();
});

test('the pager walks the title-canonical order, not id order, and actually navigates', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="BotConnectionRequestBody" appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  const heading = () => (container.querySelector('[role="heading"]')?.textContent || '').trim();
  assert.equal(heading(), 'App connection request');

  // From the title-canonical first page, "Next" must name the title-canonical second page
  // ("Bot avatar"), not the id-canonical one ("Code block" would come next by raw id order:
  // BotAvatarView < BotConnectionRequestBody < ChatCodeBlock).
  const next = () => container.querySelector('[aria-label^="Next:"]') as HTMLElement;
  assert.equal(next().getAttribute('aria-label'), 'Next: Bot avatar');
  click(next());
  assert.equal(heading(), 'Bot avatar');

  assert.equal(next().getAttribute('aria-label'), 'Next: Code block');
  click(next());
  assert.equal(heading(), 'Code block');

  const previous = () => container.querySelector('[aria-label^="Previous:"]') as HTMLElement;
  assert.equal(previous().getAttribute('aria-label'), 'Previous: Bot avatar');
  click(previous());
  assert.equal(heading(), 'Bot avatar');

  cleanup();
});

test('an empty initial route resolves to the title-canonical first page, not the id-canonical one', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  const heading = (container.querySelector('[role="heading"]')?.textContent || '').trim();
  assert.equal(heading, 'App connection request');
  cleanup();
});

test('an invalid hash still shows Page not found, and its recovery link opens the title-canonical first page', () => {
  const { container, cleanup } = renderCatalog(
    <Mount hash="#NoSuchPage">
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  assert.ok((container.textContent || '').includes('Page not found'));
  const firstPageLink = [...container.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === 'Open the first page');
  assert.ok(firstPageLink, 'expected a recovery link');
  // Canonical first page is "App connection request" (BotConnectionRequestBody) by title, not
  // "Bot avatar" (BotAvatarView), which an id-only fallback would have picked instead.
  assert.equal(firstPageLink!.getAttribute('href'), hashForId('BotConnectionRequestBody'));

  // The link must not just point at the right page — clicking it must actually open it.
  click(firstPageLink!);
  const heading = (container.querySelector('[role="heading"]')?.textContent || '').trim();
  assert.equal(heading, 'App connection request');

  cleanup();
});

// A family page mixed in among the titled pages above: pins that threading `labels` through to
// `orderedIds`/`sortIds` doesn't disturb member search hits (still the member id, still linking to
// the member's own address) or where they land (the owning family page, still resolved the same
// way regardless of where that family page now sorts).
type FamilyId = Id | 'AssistantBotFamily';
const FAMILY_SECTIONS: SectionDef<FamilyId>[] = [
  ...SECTIONS,
  {
    id: 'AssistantBotFamily',
    title: 'Assistant bot',
    description: 'A family of parts.',
    path: 'src/AssistantBotFamily.tsx',
    family: {
      whole: 'AssistantBotFamily',
      outline: new Map(),
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['AssistantBotFace'] }],
      members: [
        { id: 'AssistantBotFamily', source: 'AssistantBotFamily.tsx:1', path: 'AssistantBotFamily.tsx:1', fidelity: 'replicated', relationship: 'Main component', description: 'The whole.' },
        {
          id: 'AssistantBotFace', source: 'AssistantBotFace.tsx:1', path: 'AssistantBotFace.tsx:1', fidelity: 'replicated', relationship: 'Part',
          parent: 'AssistantBotFamily', description: 'A face part.', aliases: ['OldFaceAlias'],
        },
      ],
    },
  },
];
const FAMILY_GROUPS: NavGroup<FamilyId>[] = [
  { label: 'Components', ids: ['BotAvatarView', 'BotConnectionRequestBody', 'ChatCodeBlock'] },
  { label: 'Patterns', ids: ['AssistantBotFamily'] },
];

test('a member search hit still links to the member address and opens its owning family page', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded appName="App" title="Component Catalog" groups={FAMILY_GROUPS} sections={FAMILY_SECTIONS} />
    </Mount>,
  );
  const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
  typeInto(input, 'oldfacealias');

  const memberHit = [...container.querySelectorAll('a')].find((a) => (a.textContent || '').includes('AssistantBotFace'));
  assert.ok(memberHit, 'expected a member search hit for the alias');
  assert.ok((memberHit!.textContent || '').includes('AssistantBotFace — in Assistant bot'));
  assert.equal(memberHit!.getAttribute('href'), hashForId('AssistantBotFace'));

  click(memberHit!);
  const pageHeading = (container.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
  assert.equal(pageHeading, 'Assistant bot', 'selecting the member hit must open its owning family page');

  cleanup();
});
