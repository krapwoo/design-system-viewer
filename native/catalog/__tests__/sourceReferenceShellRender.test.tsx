// Mounted regression for #60's "actual shell" journey (plan Task 2B): drives the real `CatalogShell`
// + `CatalogSidebar` + `SourceReferencePicker` together — not `catalogReferences.ts`/
// `catalogNavigation.ts` in isolation, and not the picker leaf's own harness — so the Source
// reference entry/open/search/select/return/cancel journey is proven against a real mounted DOM,
// including the real Modal focus trap/restore React Native Web provides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import type { NavGroup, SectionDef } from '../types.ts';

// Same warmup dance `catalogOrderingRender.test.tsx` and `sourceReferencePickerRender.test.tsx`
// each already document in full: `react-dom` and react-native-web decide, at their own first
// import, whether `canUseDOM`/`canUseDom` — that decision must see a real `window.document`
// already in place, which only a dynamic `import()` below (never hoisted ahead of this file's own
// top-level code, unlike a static `import`) can guarantee.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
// `SourceReferencePicker` mounts a real React Native Web `Modal`, whose own focus trap
// (`ModalFocusTrap.js`) checks a bare `document.activeElement instanceof Node` — the same
// missing-true-global problem `ShadowRoot` above already works around. `renderCatalog` creates a
// fresh window per case; follow that window's own `Node` constructor so the trap sees the same
// realm as `document.activeElement`, just as in a browser (`sourceReferencePickerRender.test.tsx`'s
// own precedent).
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { hashForId } = await import('../catalogNavigation.ts');

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

function pressEscape() {
  act(() => {
    document.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
  });
}

function setHash(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event('hashchange'));
  });
}

function sidebarLinkTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="navigation"] a')].map((a) => (a.textContent || '').trim());
}

function pageHeading(): string {
  return (document.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
}

function pickerRowLinks(): HTMLAnchorElement[] {
  return [...document.querySelectorAll('[role="dialog"] a[role="link"]')] as HTMLAnchorElement[];
}

function pickerRowTitles(): string[] {
  return pickerRowLinks().map((a) => (a.firstElementChild?.textContent || '').trim());
}

function sourceTrigger(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[aria-label="Open source reference"]') as HTMLElement | null;
  assert.ok(el, 'expected the sidebar\'s own Source reference trigger');
  return el!;
}

function returnLink(): HTMLAnchorElement | undefined {
  return [...document.querySelectorAll('a')].find((a) => /^(Back to |Browse catalog$)/.test((a.textContent || '').trim())) as HTMLAnchorElement | undefined;
}

/** Same jsdom-realities wrapper `catalogOrderingRender.test.tsx` documents in full: `CatalogShell`
 *  reads `window.location.hash`/`window.localStorage` in `useState` initializers on its own first
 *  render (even when `embedded` — the version-footer's `dismissedMajor` read is unconditional) and
 *  later syncs the fragment with `window.history.replaceState`; jsdom's default `about:blank`
 *  document throws on both, so every mount here goes through this. */
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
      value: (_state: unknown, _title: string, url?: string | URL | null) => {
        if (url != null) window.location.hash = String(url);
      },
    });
    if (hash) window.location.hash = hash;
    setReady(true);
  }, [hash]);
  return ready ? <>{children}</> : null;
}

// Title order deliberately differs from id order (same precedent `catalogOrderingRender.test.tsx`
// already establishes): 'Button' < 'Card' < 'Zebra family' alphabetically, so `order[0]` (the
// title-canonical first browsable page) is the plain 'Button' page, not the family.
type Id = 'Button' | 'Card' | 'ButtonSource' | 'BotFamily' | 'BotSource';

const SECTIONS: SectionDef<Id>[] = [
  { id: 'Button', title: 'Button', description: 'The primary action.', path: 'src/Button.tsx', component: 'ButtonComponent' },
  { id: 'Card', title: 'Card', description: 'A surface for content.', path: 'src/Card.tsx' },
  {
    id: 'ButtonSource', title: 'Button source', description: 'The native declaration behind Button.',
    path: 'native/Button.swift:1', navigation: 'reference', component: 'ButtonSourceComponent',
  },
  {
    id: 'BotFamily', title: 'Zebra family', description: 'A family of parts.', path: 'src/BotFamily.tsx',
    family: {
      whole: 'BotFamily',
      outline: new Map(),
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotFace'] }],
      members: [
        { id: 'BotFamily', source: 'BotFamily.tsx:1', path: 'BotFamily.tsx:1', fidelity: 'replicated', relationship: 'Main component', description: 'The whole.' },
        {
          id: 'BotFace', source: 'BotFace.tsx:1', path: 'BotFace.tsx:1', fidelity: 'replicated', relationship: 'Part',
          parent: 'BotFamily', description: 'A face part.', aliases: ['OldFace'],
        },
      ],
    },
  },
  {
    id: 'BotSource', title: 'Bot source', description: 'The native declaration behind the family.', path: 'native/BotSource.swift:1',
    navigation: 'reference',
    family: {
      whole: 'BotSource',
      outline: new Map(),
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotSourcePart'] }],
      members: [
        { id: 'BotSource', source: 'BotSource.swift:1', path: 'BotSource.swift:1', fidelity: 'documentation-only', relationship: 'Main component', description: 'The whole (reference).' },
        {
          id: 'BotSourcePart', source: 'BotSourcePart.swift:1', path: 'BotSourcePart.swift:1', fidelity: 'documentation-only', relationship: 'Part',
          parent: 'BotSource', description: 'A part (reference).', aliases: ['OldSourcePart'],
        },
      ],
    },
  },
];
// ButtonSource/BotSource are deliberately absent here — the real-author convention a reference-only
// page follows (`CatalogSidebar.tsx`'s own `sourceReference` doc comment).
const GROUPS: NavGroup<Id>[] = [
  { label: 'Components', ids: ['Button', 'Card'] },
  { label: 'Patterns', ids: ['BotFamily'] },
];

// A legacy fixture with no `'reference'` page at all (default/omitted metadata).
type LegacyId = 'Button' | 'Card';
const LEGACY_SECTIONS: SectionDef<LegacyId>[] = [
  { id: 'Button', title: 'Button', description: 'The primary action.', path: 'src/Button.tsx' },
  { id: 'Card', title: 'Card', description: 'A surface for content.', path: 'src/Card.tsx' },
];
const LEGACY_GROUPS: NavGroup<LegacyId>[] = [{ label: 'Components', ids: ['Button', 'Card'] }];

test('a catalog with no reference-navigation page keeps the legacy sidebar unchanged, with no Source reference entry', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded appName="App" title="Component Catalog" groups={LEGACY_GROUPS} sections={LEGACY_SECTIONS} />
    </Mount>,
  );
  assert.deepEqual(sidebarLinkTexts(container), ['Button', 'Card']);
  assert.equal(container.querySelector('[aria-label="Open source reference"]'), null, 'no page opts into \'reference\', so no Source reference entry at all');
  cleanup();
});

test('an opted-in catalog shows the Source reference entry even when the active filter matches no browsing page', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  sourceTrigger(container); // present with no filter at all
  const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
  typeInto(input, 'zzz-no-such-page');
  assert.deepEqual(sidebarLinkTexts(container), [], 'the filter itself legitimately matches nothing');
  sourceTrigger(container); // still present — a filter with no visual-browsing hits must not hide it
  cleanup();
});

test('reference-only pages and their family member stay out of the sidebar, its member search, and the pager sequence', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="Button" appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  // Title-canonical order, with both reference pages absent entirely.
  assert.deepEqual(sidebarLinkTexts(container), ['Button', 'Card', 'Zebra family']);

  const input = container.querySelector('input[aria-label="Filter components"]') as HTMLInputElement;
  typeInto(input, 'oldsourcepart');
  assert.equal([...container.querySelectorAll('a')].some((a) => (a.textContent || '').includes('BotSourcePart')), false, 'a reference family\'s own member must not be a sidebar search hit');
  typeInto(input, '');
  typeInto(input, 'oldface');
  assert.ok([...container.querySelectorAll('a')].some((a) => (a.textContent || '').includes('BotFace')), 'an ordinary (browsable) family member alias must still be a sidebar search hit');

  const next = () => container.querySelector('[aria-label^="Next:"]') as HTMLElement | null;
  assert.equal(next()?.getAttribute('aria-label'), 'Next: Card');
  click(next()!);
  assert.equal(next()?.getAttribute('aria-label'), 'Next: Zebra family', 'the pager must skip both reference pages entirely');
  cleanup();
});

test('the picker finds a reference family member catalog-wide by its alias, opens the canonical destination with member focus, and its Back link returns to the real origin', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="Button" appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  assert.equal(pageHeading(), 'Button');
  click(sourceTrigger(container));
  // Catalog-wide, not page-local: Button, Card, Button source, Zebra family (whole), BotFace,
  // Bot source (whole), BotSourcePart — seven entries regardless of the current page or
  // browsability.
  assert.equal(pickerRowTitles().length, 7);

  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  typeInto(input, 'oldsourcepart');
  assert.deepEqual(pickerRowTitles(), ['BotSourcePart — in Bot source']);
  click(pickerRowLinks()[0]);

  assert.equal(pickerRowLinks().length, 0, 'selecting must close the picker');
  assert.equal(pageHeading(), 'Bot source', 'the owning family page must open');
  assert.equal(document.activeElement?.getAttribute('role'), 'heading');
  assert.ok((document.activeElement?.textContent || '').includes('BotSourcePart'), 'the member itself must be focused, not the page heading');

  const back = returnLink();
  assert.ok(back, 'expected a real return link');
  assert.equal(back!.textContent, 'Back to Button');
  assert.equal(back!.getAttribute('href'), hashForId('Button'));
  click(back!);
  assert.equal(pageHeading(), 'Button', 'the return link must actually navigate back to the origin');
  assert.equal(document.activeElement, container.querySelector('[role="heading"][aria-level="1"]'), 'the origin\'s own heading must be focused');
  assert.equal(returnLink(), undefined, 'Button is not a reference page, so no return control belongs there');
  cleanup();
});

test('selecting a plain reference page by its component name opens it, focuses its heading, and its Back link returns to the real origin page', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="Card" appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  click(sourceTrigger(container));
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  typeInto(input, 'ButtonSourceComponent');
  assert.deepEqual(pickerRowTitles(), ['Button source']);
  click(pickerRowLinks()[0]);

  assert.equal(pageHeading(), 'Button source');
  assert.equal(document.activeElement, container.querySelector('[role="heading"][aria-level="1"]'), 'a page-level selection focuses the page heading');

  const back = returnLink();
  assert.equal(back?.textContent, 'Back to Card');
  click(back!);
  assert.equal(pageHeading(), 'Card');
  cleanup();
});

test('catalog-wide lookup keeps return navigation when the chosen destination is a normal browsing page', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="Card" appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  try {
    click(sourceTrigger(container));
    const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
    typeInto(input, 'ButtonComponent');
    assert.deepEqual(pickerRowTitles(), ['Button']);
    click(pickerRowLinks()[0]);
    assert.equal(pageHeading(), 'Button');
    assert.equal(returnLink()?.textContent, 'Back to Card', 'every catalog-wide source choice needs its actual origin, not only reference-only destinations');
    click(returnLink()!);
    assert.equal(pageHeading(), 'Card');
    assert.equal(returnLink(), undefined);
  } finally {
    cleanup();
  }
});

test('Escape cancels the picker with no navigation and restores focus to the sidebar\'s own Source reference trigger', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="Button" appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  const trigger = sourceTrigger(container);
  act(() => trigger.focus());
  click(trigger);
  assert.ok(pickerRowLinks().length > 0, 'expected the picker to be open');
  pressEscape();
  assert.equal(pickerRowLinks().length, 0, 'Escape must close the picker with no selection');
  assert.equal(pageHeading(), 'Button', 'cancelling must never navigate');
  assert.equal(document.activeElement, trigger, 'focus must return to the control that opened the picker');
  cleanup();
});

test('selecting the picker\'s own already-active entry works, and re-selecting it after it was already the recorded origin clears the self-referential return link', () => {
  const { container, cleanup } = renderCatalog(
    <Mount hash={hashForId('BotSourcePart')}>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  assert.equal(pageHeading(), 'Bot source');
  assert.equal(returnLink()?.textContent, 'Browse catalog', 'a direct URL load has no recorded origin yet');

  click(sourceTrigger(container));
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  typeInto(input, 'botsourcepart');
  assert.deepEqual(pickerRowTitles(), ['BotSourcePart — in Bot source']);
  click(pickerRowLinks()[0]); // re-selects the page/member already open — must not error
  assert.equal(pageHeading(), 'Bot source');
  assert.equal(
    returnLink()?.textContent,
    'Browse catalog',
    'the picker was opened from this same page/member, so recording it as its own origin must not produce a self-referential "Back to Bot source" link',
  );
  cleanup();
});

test('a directly loaded reference page URL has no invented origin: it offers Browse catalog to the title-canonical first browsable page, and that link actually navigates', () => {
  const { container, cleanup } = renderCatalog(
    <Mount hash={hashForId('ButtonSource')}>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  assert.equal(pageHeading(), 'Button source', 'a reference page\'s own address must still be routable');
  const browse = returnLink();
  assert.equal(browse?.textContent, 'Browse catalog');
  assert.equal(browse!.getAttribute('href'), hashForId('Button'));
  click(browse!);
  assert.equal(pageHeading(), 'Button');
  cleanup();
});

// All pages are `'reference'`: there is no browsable page to fabricate a link to at all.
type AllRefId = 'RefA' | 'RefB';
const ALL_REFERENCE_SECTIONS: SectionDef<AllRefId>[] = [
  { id: 'RefA', title: 'Ref A', description: 'A reference-only page.', path: 'native/RefA.swift:1', navigation: 'reference' },
  { id: 'RefB', title: 'Ref B', description: 'Another reference-only page.', path: 'native/RefB.swift:1', navigation: 'reference' },
];

test('an all-reference catalog keeps every reference destination and the picker usable, inventing no browse link even once a real origin exists', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="RefA" appName="App" title="Component Catalog" groups={[]} sections={ALL_REFERENCE_SECTIONS} />
    </Mount>,
  );
  assert.deepEqual(sidebarLinkTexts(container), [], 'no browsable page exists to list');
  sourceTrigger(container); // the Source reference entry itself stays usable
  assert.equal(pageHeading(), 'Ref A');
  assert.equal(returnLink(), undefined, 'no browsable page exists, so no link may be fabricated on first load');

  click(sourceTrigger(container));
  assert.deepEqual(pickerRowTitles(), ['Ref A', 'Ref B']);
  click(pickerRowLinks().find((a) => (a.textContent || '').includes('Ref B'))!);
  assert.equal(pageHeading(), 'Ref B');
  // A real origin now exists (the picker was opened from Ref A) — the return control may show,
  // even though Ref A itself isn't a browsable page either.
  assert.equal(returnLink()?.textContent, 'Back to Ref A');
  cleanup();
});

test('an all-reference catalog without an explicit initial page never claims the registered catalog is empty', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded appName="App" title="Component Catalog" groups={[]} sections={ALL_REFERENCE_SECTIONS} />
    </Mount>,
  );
  try {
    assert.equal(container.textContent?.includes('No catalog pages are available.'), false, 'registered reference pages must not be reported as an empty catalog');
    assert.equal(container.querySelector('[role="navigation"]')?.textContent?.includes('No matches'), false, 'an unfiltered source-only catalog must not claim a search found no matches');
    click(sourceTrigger(container));
    assert.deepEqual(pickerRowTitles(), ['Ref A', 'Ref B']);
  } finally {
    cleanup();
  }
});

test('an empty catalog keeps its truthful empty-state feedback, with no Source reference entry', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded appName="App" title="Component Catalog" groups={[]} sections={[]} />
    </Mount>,
  );
  assert.ok((container.textContent || '').includes('No catalog pages are available.'));
  assert.equal(container.querySelector('[role="navigation"]')?.textContent?.includes('No matches'), true, 'omitted navigation metadata preserves the legacy empty-sidebar presentation');
  assert.equal(container.querySelector('[aria-label="Open source reference"]'), null);
  cleanup();
});

test('an invalid hash still shows Page not found and recovers to the first browsable page, even with reference pages registered', () => {
  const { container, cleanup } = renderCatalog(
    <Mount hash="#NoSuchPage">
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  assert.ok((container.textContent || '').includes('Page not found'));
  const firstPageLink = [...container.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === 'Open the first page');
  assert.equal(firstPageLink!.getAttribute('href'), hashForId('Button'));
  click(firstPageLink!);
  assert.equal(pageHeading(), 'Button');
  cleanup();
});

test('the shell preserves a source journey origin after its own real hashchange event settles', async () => {
  const { container, cleanup } = renderCatalog(
    <Mount hash={hashForId('Card')}>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  try {
    // Let the initial URL's queued event finish before observing the selection's own event.
    await act(async () => {
      await new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    });
    click(sourceTrigger(container));
    const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
    typeInto(input, 'ButtonSourceComponent');
    const changed = new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    click(pickerRowLinks()[0]);
    await act(async () => { await changed; });
    assert.equal(pageHeading(), 'Button source');
    assert.equal(returnLink()?.textContent, 'Back to Card', 'the shell must not erase its source origin when its own URL synchronization fires hashchange');
  } finally {
    cleanup();
  }
});

test('browser back/forward through a reference address keeps routing correct and never leaves a stale return control on an unrelated page', () => {
  const { cleanup } = renderCatalog(
    <Mount hash={hashForId('Button')}>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  assert.equal(pageHeading(), 'Button');

  setHash(hashForId('ButtonSource')); // simulated forward navigation
  assert.equal(pageHeading(), 'Button source');
  assert.equal(returnLink()?.textContent, 'Browse catalog', 'hashchange navigation records no origin either');

  setHash(hashForId('Button')); // simulated back navigation
  assert.equal(pageHeading(), 'Button');
  assert.equal(returnLink(), undefined, 'no stale return control may survive onto this unrelated, non-reference page');
  cleanup();
});

test('an embedded shell\'s Source reference journey never reads or writes the host document\'s URL', () => {
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage="Card" appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  window.location.hash = '#host-page-untouched';
  const hostHash = window.location.hash;

  click(sourceTrigger(container));
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  typeInto(input, 'ButtonSourceComponent');
  click(pickerRowLinks()[0]);

  assert.equal(pageHeading(), 'Button source', 'the embedded shell must still have actually navigated internally');
  assert.equal(window.location.hash, hostHash, 'an embedded shell must never read or write the host document\'s own address');
  const back = returnLink();
  assert.equal(back?.textContent, 'Back to Card');
  const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  act(() => { back!.dispatchEvent(event); });
  assert.equal(event.defaultPrevented, true, 'the embedded return anchor must cancel native document navigation');
  assert.equal(pageHeading(), 'Card');
  assert.equal(window.location.hash, hostHash, 'returning must preserve the host document address too');
  cleanup();
});
