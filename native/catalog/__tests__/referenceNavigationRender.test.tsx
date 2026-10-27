// Plan Task 2B2's own mounted regression: canonical inline references on ordinary pages
// (Composition facts, the derived "also used by" inverse use) and the real family-page link
// producers (Uses, related pages, anatomy legend) — all through `CatalogShell`'s own shared
// `ReferenceNavigation`, not `catalogReferences.ts` in isolation. Same warmup/realm precedent
// `sourceReferenceShellRender.test.tsx` documents in full (a real mounted `Modal`, since
// `CatalogShell` always renders `SourceReferencePicker`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import type { NavGroup, SectionDef } from '../types.ts';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { SectionBlock } = await import('../SectionBlock.tsx');
const { FamilyPage } = await import('../FamilyPage.tsx');
const { hashForId } = await import('../catalogNavigation.ts');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');

function click(el: Element, options: Partial<MouseEventInit> = {}) {
  let event!: MouseEvent;
  act(() => {
    event = new window.MouseEvent('click', { bubbles: true, cancelable: true, ...options });
    el.dispatchEvent(event);
  });
  return event;
}

function pageHeading(): string {
  return (document.querySelector('[role="heading"][aria-level="1"]')?.textContent || '').trim();
}

// Several fixture names below (e.g. "Dialog", "Button") are also real page ids, so they already
// have their own sidebar nav link with the exact same text — excluding `[role="navigation"]` (the
// sidebar) and `[role="dialog"]` (the Source reference picker) keeps this test's own links
// unambiguous: only the one this test actually exercises (Composition, "also used by", Uses,
// relatedPages, anatomy legend) is a candidate.
function linkNamed(container: HTMLElement, text: string): HTMLAnchorElement | undefined {
  return [...container.querySelectorAll('a[role="link"], a')]
    .filter((a) => !a.closest('[role="navigation"]') && !a.closest('[role="dialog"]'))
    .find((a) => (a.textContent || '').trim().startsWith(text)) as HTMLAnchorElement | undefined;
}

/** The member side panel is a `Modal`: it portals into `document.body`, outside the render
 *  container, so its own content is looked up from the open dialog instead. */
function openPanel(): HTMLElement | null {
  return document.querySelector('[role="dialog"][aria-modal="true"]');
}

function plainTextPresent(container: HTMLElement, text: string): boolean {
  return [...container.querySelectorAll('*')].some((e) => e.children.length === 0 && (e.textContent || '').includes(text));
}

/** Same jsdom-realities wrapper `sourceReferenceShellRender.test.tsx` documents in full. */
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

type Id =
  | 'Icon' | 'Button' | 'Dialog' | 'PageA' | 'PageB' | 'TokenSheet'
  | 'BotFamily';

const FAMILY: SectionDef<Id>['family'] = {
  whole: 'BotFamily',
  outline: new Map(),
  sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotFace'] }],
  relatedPages: [{ page: 'Button', note: 'A resolvable related page.' }, { page: 'LegacyFace', note: 'A real member alias.' }, { page: 'NoSuchPage', note: 'Unresolvable, plain text.' }],
  anatomy: {
    picture: React.createElement('div', null, 'picture'),
    groups: [
      { label: 'In this picture', items: [{ member: 'BotFace', description: 'The face part.' }] },
      {
        label: 'From other pages',
        items: [
          { other: 'Icon', description: 'A resolvable component elsewhere.' },
          { other: 'NoSuchComponent', description: 'Unresolvable, plain text, no link.' },
        ],
      },
    ],
  },
  members: [
    { id: 'BotFamily', source: 'BotFamily.tsx:1', path: 'BotFamily.tsx:1', fidelity: 'replicated', relationship: 'Main component', description: 'The whole.', alsoUsedBy: [{ component: 'Dialog', role: 'Confirmation' }] },
    {
      id: 'BotFace', aliases: ['LegacyFace'], source: 'BotFace.tsx:1', path: 'BotFace.tsx:1', fidelity: 'replicated', relationship: 'Part', parent: 'BotFamily',
      description: 'A face part.', related: 'Related to BotFamily.', composedOf: [{ component: 'Icon', role: 'Eyes', relationship: 'built-in' }, { component: 'NoSuchComponent', role: 'Decoration', relationship: 'built-in' }],
      alsoUsedBy: [{ component: 'PageA', role: 'Face on provider A' }],
    },
  ],
};

const SECTIONS: SectionDef<Id>[] = [
  { id: 'Icon', title: 'Icon', description: 'A glyph.', path: 'src/Icon.tsx', component: 'IconComponent' },
  {
    id: 'Button', title: 'Button', description: 'The primary action.', path: 'src/Button.tsx',
    composedOf: [
      { component: 'Icon', role: 'Leading glyph', relationship: 'built-in' },
      { component: 'Tooltip', role: 'Optional hint', relationship: 'slot' },
      { component: 'NoSuchComponent', role: 'Nothing real', relationship: 'related' },
    ],
    alsoUsedBy: [{ component: 'Dialog', role: 'Confirm action' }],
  },
  { id: 'Dialog', title: 'Dialog', description: 'A modal dialog.', path: 'src/Dialog.tsx' },
  // Ambiguous component binding: both PageA and PageB claim "Shared" as their own export.
  { id: 'PageA', title: 'Page A', description: 'Claims Shared.', path: 'src/PageA.tsx', component: 'Shared', composedOf: [{ component: 'Shared', role: 'Self-reference, irrelevant', relationship: 'related' }] },
  { id: 'PageB', title: 'Page B', description: 'Also claims Shared.', path: 'src/PageB.tsx', component: 'Shared' },
  {
    id: 'TokenSheet', title: 'Token sheet', description: 'Raw tokens.', path: 'src/tokens.ts', tokenGallery: true, previewWidths: 'full',
    render: () => React.createElement(React.Fragment, null, 'tokens'),
    composedOf: [{ component: 'Icon', role: 'Swatch glyph', relationship: 'built-in' }],
    alsoUsedBy: [{ component: 'Dialog', role: 'Palette preview' }],
  },
  { id: 'BotFamily', title: 'Bot family', description: 'A family of parts.', path: 'src/BotFamily.tsx', family: FAMILY },
];
const GROUPS: NavGroup<Id>[] = [{ label: 'Components', ids: ['Icon', 'Button', 'Dialog', 'PageA', 'PageB', 'TokenSheet', 'BotFamily'] }];

function mountShell(initialPage: Id) {
  return renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage={initialPage} appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
}

test('an ordinary page\'s resolvable Composition name becomes a real canonical link, and activating it navigates', () => {
  const { container, cleanup } = mountShell('Button');
  const link = linkNamed(container, 'Icon');
  assert.ok(link, 'expected a real link for the resolvable Composition name');
  assert.equal(link!.getAttribute('href'), hashForId('Icon'));
  click(link!);
  assert.equal(pageHeading(), 'Icon', 'activating the Composition link must navigate to its canonical address');
  cleanup();
});

test('Composition omits only the built-in suffix while preserving slot/related labels, roles and metadata', () => {
  const { container, cleanup } = mountShell('Button');
  try {
    const facts = [
      ['Icon', 'Leading glyph'],
      ['Tooltip · slot', 'Optional hint'],
      ['NoSuchComponent · related', 'Nothing real'],
    ];
    for (const [label, role] of facts) {
      const values = [...container.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent === role);
      assert.equal(values.length, 1, `expected one actual composition value for ${role}`);
      assert.equal(values[0].parentElement?.firstElementChild?.textContent, label);
    }
    assert.deepEqual(SECTIONS.find(s => s.id === 'Button')?.composedOf?.map(e => e.relationship), ['built-in', 'slot', 'related']);
  } finally { cleanup(); }
});

test('a non-embedded reference return has one activation owner', async () => {
  // The actual same-family Back→Browse href mutation is reproduced in the packed browser.
  // Pin the shared missing cancellation here without inventing another native-detail fixture.
  const sections = SECTIONS.map(s => s.id === 'BotFamily' ? { ...s, navigation: 'reference' as const } : s);
  const { container, cleanup } = renderCatalog(
    <Mount hash={hashForId('BotFamily')}>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={sections} />
    </Mount>,
  );
  try {
    await act(async () => {
      await new Promise<void>(resolve => window.addEventListener('hashchange', () => resolve(), { once: true }));
    });
    const browse = linkNamed(container, 'Browse catalog');
    assert.ok(browse);
    const event = click(browse);
    assert.equal(pageHeading(), 'Button');
    assert.equal(event.defaultPrevented, true, 'the callback owns navigation in normal as well as embedded shells');
  } finally { cleanup(); }
});

test('inline reference activation keeps its real page origin and completes a Back return', () => {
  const { container, cleanup } = mountShell('Button');
  try {
    click(linkNamed(container, 'Icon')!);
    assert.equal(pageHeading(), 'Icon');
    const back = linkNamed(container, 'Back to Button');
    assert.ok(back, 'inline reference activation must record its real origin, not just call ordinary select');
    click(back);
    assert.equal(pageHeading(), 'Button');
    assert.equal(document.activeElement?.textContent, 'Button');
    assert.equal(Boolean(linkNamed(container, 'Back to ')), false);
  } finally { cleanup(); }
});

test('a non-embedded shell\'s inline activation cancels the native anchor default and settles its own real hashchange with the origin retained', async () => {
  const { container, cleanup } = renderCatalog(
    <Mount hash={hashForId('Button')}>
      <CatalogShell appName="App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} />
    </Mount>,
  );
  try {
    // Let the initial URL's own queued hashchange finish before observing the activation's own,
    // the same ordering `sourceReferenceShellRender.test.tsx`'s own real-hashchange test documents.
    await act(async () => {
      await new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    });
    const changed = new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    const event = click(linkNamed(container, 'Icon')!);
    assert.equal(event.defaultPrevented, true, 'the shell owns normal reference activation; the native anchor default must not race it');
    await act(async () => { await changed; });
    assert.equal(pageHeading(), 'Icon');
    assert.equal(linkNamed(container, 'Back to Button')?.textContent, 'Back to Button', 'the origin must survive the shell\'s own hashchange settling');
  } finally { cleanup(); }
});

test('arriving through a tokenDefinition section alias keeps the alias hash, so a reload or copied URL keeps the section', async () => {
  const opacity = (id: string) => ({ id, name: id, kind: 'opacity' as const, value: { provenance: 'named' as const, resolution: { status: 'resolved' as const, value: { amount: 0.1 } } } });
  const tokenPage = {
    id: 'AliasTokens', title: 'Alias tokens', description: 'Two sections.', path: 'src/tokens.ts',
    tokenDefinition: {
      kind: 'opacity',
      sections: [
        { id: 'attention', title: 'Attention', entries: [opacity('a')] },
        { id: 'palette', title: 'Palette', entries: [opacity('b')], aliases: ['palette-alias'] },
      ],
    },
  };
  const sections = [...SECTIONS, tokenPage] as unknown as SectionDef<Id>[];
  const groups = [{ label: 'Components', ids: [...GROUPS[0].ids, 'AliasTokens'] }] as unknown as NavGroup<Id>[];
  const { container, cleanup } = renderCatalog(
    <Mount hash="#palette-alias">
      <CatalogShell appName="App" title="Component Catalog" groups={groups} sections={sections} />
    </Mount>,
  );
  try {
    await act(async () => {
      await new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    });
    assert.equal(pageHeading(), 'Alias tokens', 'the section alias opens its page');
    assert.equal(window.location.hash, '#palette-alias', 'the alias hash must not be rewritten to the page id while the section arrival is live');
    // Leaving the arrival (an ordinary navigation) canonicalizes as before.
    const next = linkNamed(container, 'Icon') ?? ([...document.querySelectorAll('[role="navigation"] a')].find((a) => (a.textContent || '').trim() === 'Icon') as HTMLAnchorElement);
    assert.ok(next, 'expected a nav link to another page');
    click(next);
    assert.equal(window.location.hash, hashForId('Icon'));
  } finally { cleanup(); }
});

test('a same-page section-alias arrival does not reset the main scroll', async () => {
  const opacity = (id: string) => ({ id, name: id, kind: 'opacity' as const, value: { provenance: 'named' as const, resolution: { status: 'resolved' as const, value: { amount: 0.1 } } } });
  const tokenPage = {
    id: 'AliasTokens', title: 'Alias tokens', description: 'Two sections.', path: 'src/tokens.ts',
    tokenDefinition: {
      kind: 'opacity',
      sections: [
        { id: 'attention', title: 'Attention', entries: [opacity('a')], aliases: ['attention-alias'] },
        { id: 'palette', title: 'Palette', entries: [opacity('b')], aliases: ['palette-alias'] },
      ],
    },
  };
  const sections = [...SECTIONS, tokenPage] as unknown as SectionDef<Id>[];
  const groups = [{ label: 'Components', ids: [...GROUPS[0].ids, 'AliasTokens'] }] as unknown as NavGroup<Id>[];
  let proto: Record<string, unknown> | undefined;
  let originalScrollTo: unknown;
  const resets: unknown[] = [];
  const { cleanup } = renderCatalog(
    <Mount hash="#palette-alias">
      <CatalogShell appName="App" title="Component Catalog" groups={groups} sections={sections} />
    </Mount>,
  );
  try {
    await act(async () => {
      await new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    });
    assert.equal(pageHeading(), 'Alias tokens');
    // Installed after mounting: `renderCatalog` provides the window this shell actually uses.
    // jsdom never scrolls, so record the shell's own reset of the main pane (`scrollTop = 0`, or the
    // `scrollTo` react-native-web's ScrollView falls back to). jsdom has no layout, so the token
    // sections never mount here; the section's own scroll is covered by the browser check.
    proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
    originalScrollTo = proto.scrollTo;
    Object.defineProperty(proto, 'scrollTop', { configurable: true, get: () => 0, set: (v: number) => { resets.push(v); } });
    proto.scrollTo = function (...args: unknown[]) { resets.push(args); };
    const changed = new Promise<void>((resolve) => window.addEventListener('hashchange', () => resolve(), { once: true }));
    window.location.hash = '#attention-alias';
    await act(async () => { await changed; });
    assert.equal(pageHeading(), 'Alias tokens', 'the second alias stays on the same page');
    assert.equal(window.location.hash, '#attention-alias');
    assert.deepEqual(resets, [], 'a same-page section arrival must not return the main pane to the top');
  } finally {
    if (proto) {
      delete proto.scrollTop;
      proto.scrollTo = originalScrollTo;
    }
    cleanup();
  }
});

test('a member-owned inverse reference returns to that member rather than the family page heading', () => {
  const { container, cleanup } = mountShell('BotFamily');
  try {
    const crossUse = linkNamed(container, 'PageA');
    assert.ok(crossUse, 'the non-whole member inverse use must be visible before opening any notes');
    click(crossUse);
    assert.equal(pageHeading(), 'Page A');
    const back = linkNamed(container, 'Back to Bot family');
    assert.ok(back, 'a member reference must retain an actual return destination');
    click(back);
    assert.equal(pageHeading(), 'Bot family');
    assert.ok(document.activeElement?.textContent?.includes('BotFace'), 'return must focus the member that owned the clicked reference even when no member route was selected beforehand');
  } finally { cleanup(); }
});

test('a related sentence activates its actual member link and returns to the owning part', () => {
  const { container, cleanup } = mountShell('BotFamily');
  try {
    const related = linkNamed(container, 'BotFamily');
    assert.ok(related, 'the related sentence should link its actual same-family address');
    click(related);
    const back = linkNamed(container, 'Back to Bot family');
    assert.ok(back, 'same-page target and member origin are distinct addresses');
    click(back);
    assert.ok(document.activeElement?.textContent?.includes('BotFace'), 'return must recover the part that owns the related sentence');
  } finally { cleanup(); }
});

test('an explicit unresolved navigation never fabricates an anatomy member link', () => {
  const def = SECTIONS.find(s => s.id === 'BotFamily')!;
  const { container, cleanup } = renderCatalog(
    <FamilyPage def={def} navigation={{ resolve: () => undefined, open: () => assert.fail('an unresolved address cannot activate') }} />,
  );
  try {
    assert.equal(Boolean(linkNamed(container, 'BotFace')), false, 'an explicit unresolved result is plain text, not a raw-href escape hatch');
    assert.ok(plainTextPresent(container, 'BotFace'));
  } finally { cleanup(); }
});

test('an ordinary page\'s unresolvable Composition name (and its relationship suffix) stays honest plain text, never a dead link', () => {
  const { container, cleanup } = mountShell('Button');
  assert.equal(Boolean(linkNamed(container, 'NoSuchComponent')), false);
  assert.ok(plainTextPresent(container, 'NoSuchComponent · related'), 'the relationship suffix stays, unlinked');
  // A 'slot' composition name also renders its own suffix, independent of resolvability.
  assert.ok(plainTextPresent(container, 'Tooltip · slot') || linkNamed(container, 'Tooltip') !== undefined);
  cleanup();
});

test("an ordinary page's derived \"also used by\" inverse use is always-visible and links to its real user", () => {
  const { container, cleanup } = mountShell('Button');
  assert.ok(plainTextPresent(container, 'Also used by'), 'expected the derived inverse-use sentence');
  const dialogLink = linkNamed(container, 'Dialog');
  assert.ok(dialogLink, 'expected "Dialog" to be a real link inside the "Also used by" sentence');
  click(dialogLink!);
  assert.equal(pageHeading(), 'Dialog');
  cleanup();
});

test('an ordinary page with no "also used by" users renders no such row at all — no empty gap, no label', () => {
  const { container, cleanup } = mountShell('Icon');
  assert.equal(plainTextPresent(container, 'Also used by'), false);
  cleanup();
});

test('a token-gallery page renders both a linked Composition name and its own "also used by" inverse use in Quick reference', () => {
  const { container, cleanup } = mountShell('TokenSheet');
  const iconLink = linkNamed(container, 'Icon');
  assert.ok(iconLink);
  assert.equal(iconLink!.getAttribute('href'), hashForId('Icon'));
  assert.ok(plainTextPresent(container, 'Also used by'));
  assert.ok(linkNamed(container, 'Dialog'));
  cleanup();
});

test('a component name claimed by more than one page is ambiguous and stays plain text, never a guessed link', () => {
  const { container, cleanup } = mountShell('PageA');
  // "Shared" names PageA's own composedOf entry — ambiguous (PageA and PageB both bind it) — so it
  // must render as plain text even though it happens to equal this very page's own component.
  assert.equal(Boolean(linkNamed(container, 'Shared')), false);
  assert.ok(plainTextPresent(container, 'Shared · related'));
  cleanup();
});

test('a family member\'s "Uses" line links a resolvable sibling composition name and leaves an unresolvable one as plain text', () => {
  const { container, cleanup } = mountShell('BotFamily');
  // Open BotFace's own side panel to reveal its Uses line.
  const toggle = [...container.querySelectorAll('[role="button"]')].find((b) => (b.textContent || '').includes('Notes') || (b.textContent || '').includes('API') || (b.textContent || '').includes('Details')) as HTMLElement | undefined;
  assert.ok(toggle, 'expected BotFace\'s own disclosure trigger');
  click(toggle!);
  const panel = openPanel();
  assert.ok(panel, 'the trigger opens a side panel dialog');
  const usesLine = [...panel!.querySelectorAll('div')].find(e => e.textContent?.startsWith('Uses ') && e.textContent.includes('(Eyes)'));
  assert.ok(usesLine, 'find the Uses sentence inside the panel rather than the earlier anatomy link with the same label');
  const usesIconLink = [...usesLine!.querySelectorAll('a')].find((a) => (a.textContent || '').trim().startsWith('Icon')) as HTMLAnchorElement | undefined;
  assert.ok(usesIconLink, 'expected "Icon" inside the Uses line to be a real link');
  assert.equal([...usesLine!.querySelectorAll('a')].some((a) => (a.textContent || '').trim().startsWith('NoSuchComponent')), false);
  click(usesIconLink!);
  assert.equal(pageHeading(), 'Icon');
  assert.ok(openPanel() === null, 'following a reference inside the panel closes the panel');
  cleanup();
});

test('a group page is dispatched to GroupPage, and a member\'s inline reference link completes a Back return like a family member', () => {
  // A deliberately separate, minimal sections/groups pair (the same isolation the
  // "producer-to-renderer wiring" test below uses) — reusing the shared `SECTIONS`/`GROUPS` above
  // would shift their own alphabetical-by-title browse order and break an unrelated test.
  type GroupId = 'Icon' | 'BotGroup';
  const groupFamily: SectionDef<GroupId>['family'] = {
    kind: 'group',
    whole: undefined,
    outline: new Map(),
    sections: [],
    members: [
      {
        id: 'GroupWidget', source: 'GroupWidget.tsx:1', path: 'GroupWidget.tsx:1', fidelity: 'replicated', relationship: 'Top-level',
        description: 'A plain group member.', composedOf: [{ component: 'Icon', role: 'Eyes', relationship: 'built-in' }],
      },
    ],
  };
  const sections: SectionDef<GroupId>[] = [
    { id: 'Icon', title: 'Icon', description: 'A glyph.', path: 'src/Icon.tsx', component: 'IconComponent' },
    { id: 'BotGroup', title: 'Bot group', description: 'A group of parts.', path: 'src/BotGroup.tsx', family: groupFamily },
  ];
  const groups: NavGroup<GroupId>[] = [{ label: 'Components', ids: ['Icon', 'BotGroup'] }];
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage={'BotGroup' as never} appName="App" title="Component Catalog" groups={groups as never} sections={sections as never} />
    </Mount>,
  );
  try {
    assert.ok((container.textContent || '').includes('GroupWidget'), 'expected the group page to render its own top-level member');
    const toggle = [...container.querySelectorAll('[role="button"]')].find((b) => (b.textContent || '').includes('Notes') || (b.textContent || '').includes('API') || (b.textContent || '').includes('Details')) as HTMLElement | undefined;
    assert.ok(toggle, 'expected GroupWidget\'s own disclosure trigger');
    click(toggle!);
    const panel = openPanel();
    assert.ok(panel, 'the trigger opens a side panel dialog');
    const usesLine = [...panel!.querySelectorAll('div')].find((e) => e.textContent?.startsWith('Uses ') && e.textContent.includes('(Eyes)'));
    assert.ok(usesLine, 'expected the Uses sentence inside the group member\'s side panel');
    const usesIconLink = [...usesLine!.querySelectorAll('a')].find((a) => (a.textContent || '').trim().startsWith('Icon')) as HTMLAnchorElement | undefined;
    assert.ok(usesIconLink, 'expected "Icon" inside the Uses line to be a real link');
    click(usesIconLink!);
    assert.equal(pageHeading(), 'Icon', 'the group member\'s inline reference link must actually navigate');
    assert.ok(openPanel() === null, 'following a reference inside the panel closes the panel');
    const back = linkNamed(container, 'Back to Bot group');
    assert.ok(back, 'a group member reference must retain an actual return destination, like a family member');
    click(back!);
    assert.equal(pageHeading(), 'Bot group');
    const active = document.activeElement as HTMLElement | null;
    assert.ok(active && active !== document.body, 'return must move focus off <body> (whose text contains every member)');
    assert.equal(active!.getAttribute('tabindex'), '-1', 'the member\'s own focusable heading');
    assert.equal(active!.getAttribute('role'), 'heading');
    assert.equal((active!.textContent || '').trim().startsWith('GroupWidget'), true, 'return must focus the member that owned the clicked reference');
  } finally { cleanup(); }
});

test('the family whole\'s own "also used by" line links its real user', () => {
  const { container, cleanup } = mountShell('BotFamily');
  assert.ok(plainTextPresent(container, 'Also used by'));
  const dialogLink = linkNamed(container, 'Dialog');
  assert.ok(dialogLink);
  click(dialogLink!);
  assert.equal(pageHeading(), 'Dialog');
  const back = linkNamed(container, 'Back to Bot family');
  assert.ok(back, 'the whole renderer must carry its own source context');
  click(back);
  assert.ok(document.activeElement?.textContent?.includes('BotFamily.tsx:1'), 'return must focus the existing whole wrapper with its source line, not the page heading');
  cleanup();
});

test('a family page\'s relatedPages list links a resolvable page and keeps an unresolvable one as plain text', () => {
  const { container, cleanup } = mountShell('BotFamily');
  const buttonLink = linkNamed(container, 'Button');
  assert.ok(buttonLink, 'expected the resolvable relatedPages entry to be a real link');
  click(buttonLink!);
  assert.equal(pageHeading(), 'Button');
  cleanup();
});

test('a related-page member alias uses its canonical href and actual member focus', () => {
  const { container, cleanup } = mountShell('BotFamily');
  try {
    const alias = linkNamed(container, 'LegacyFace');
    assert.ok(alias);
    assert.equal(alias.getAttribute('href'), '#BotFace');
    const event = click(alias);
    assert.equal(event.defaultPrevented, true);
    assert.ok(document.activeElement?.textContent?.includes('BotFace'));
  } finally { cleanup(); }
});

test('a family page\'s unresolvable relatedPages entry stays plain text, never a dead link', () => {
  const { container, cleanup } = mountShell('BotFamily');
  assert.equal(Boolean(linkNamed(container, 'NoSuchPage')), false);
  assert.ok(plainTextPresent(container, 'NoSuchPage'));
  cleanup();
});

test("a family page's anatomy legend links its own member (and focuses it) and a resolvable other-page entry, while an unresolvable one stays plain text", () => {
  const { container, cleanup } = mountShell('BotFamily');
  const faceLink = linkNamed(container, 'BotFace');
  assert.ok(faceLink, 'expected the anatomy legend\'s own member row to be a real link');
  click(faceLink!);
  assert.ok((document.activeElement?.textContent || '').includes('BotFace'), 'activating the anatomy legend row must focus the member itself');

  const iconLink = linkNamed(container, 'Icon');
  assert.ok(iconLink, 'expected the anatomy legend\'s resolvable "other page" row to be a real link');
  assert.equal(Boolean(linkNamed(container, 'NoSuchComponent')), false, 'the anatomy legend\'s unresolvable "other page" row must stay plain text');
  click(iconLink!);
  assert.equal(pageHeading(), 'Icon', 'the anatomy other-page link must actually activate');
  const back = linkNamed(container, 'Back to Bot family');
  assert.ok(back);
  click(back);
  assert.equal(document.activeElement?.textContent, 'Bot family', 'an anatomy-level reference starts at the page, not the stale previously-selected member');
  cleanup();
});

test("an embedded shell's new canonical links never touch the host document's URL, and a modified click opens a new tab instead of navigating", () => {
  const { container, cleanup } = mountShell('Button');
  window.location.hash = '#host-page-untouched';
  const hostHash = window.location.hash;

  const modified = click(linkNamed(container, 'Icon')!, { ctrlKey: true });
  assert.equal(modified.defaultPrevented, false, 'a modified click must reach the browser\'s own new-tab handling');
  assert.equal(pageHeading(), 'Button', 'a modified click must not navigate the current page');

  const plain = click(linkNamed(container, 'Icon')!);
  assert.equal(plain.defaultPrevented, true, 'an embedded shell must cancel the native document navigation on a plain click');
  assert.equal(pageHeading(), 'Icon', 'the plain click must still have navigated internally');
  assert.equal(window.location.hash, hostHash, 'an embedded shell must never read or write the host document\'s own address');
  cleanup();
});

test('a standalone-mounted SectionBlock with no navigation prop keeps its prior unlinked Composition rendering', () => {
  const def: SectionDef<Id> = SECTIONS.find((s) => s.id === 'Button')!;
  const { container, cleanup } = renderCatalog(React.createElement(SectionBlock as never, { def } as never));
  assert.equal(Boolean(linkNamed(container, 'Icon')), false, 'no navigation prop means no canonical link, the prior default');
  assert.ok(plainTextPresent(container, 'Icon'));
  assert.ok(plainTextPresent(container, 'Also used by'), 'the derived inverse-use sentence itself is independent of navigation');
  cleanup();
});

test('a standalone-mounted FamilyPage with no navigation prop keeps its prior resolvesAddress-only link behavior', () => {
  const def: SectionDef<Id> = SECTIONS.find((s) => s.id === 'BotFamily')!;
  const { container, cleanup } = renderCatalog(React.createElement(FamilyPage as never, { def } as never));
  // With no `navigation` and no `knownAddressIds`, only this family's own sibling member ids
  // resolve — "Icon" (outside the family) must render as plain text, the prior standalone default.
  assert.equal(Boolean(linkNamed(container, 'Icon')), false);
  assert.ok(plainTextPresent(container, 'Icon'));
  assert.ok(linkNamed(container, 'BotFace'), 'omitting navigation still preserves local anatomy links');
  cleanup();
});

test('producer-to-renderer wiring: a real buildCatalogSections + mounted CatalogShell canonically links a Composition name to a page whose id differs from its component export', () => {
  const pages = [
    // `GlyphPage`'s own id deliberately differs from its real component export ("Glyph") — the
    // canonical-link resolver must still find it as the one unambiguous owner, never a guess.
    defineCatalogPage({ id: 'GlyphPage', component: 'Glyph', group: 'Components', description: 'A glyph page.', composedOf: [] }),
    defineCatalogPage({
      id: 'ActionPage', group: 'Components', description: 'Uses the glyph.',
      composedOf: [{ component: 'Glyph', role: 'Leading glyph', relationship: 'built-in' }],
    }),
    defineCatalogPage({ id: 'RelatedCaller', group: 'Components', description: 'Related, not a physical user.', composedOf: [{ component: 'Glyph', role: 'Related comparison', relationship: 'related' }] }),
    defineCatalogPage({ id: 'SlotCaller', group: 'Components', description: 'Optional slot, not a built-in user.', composedOf: [{ component: 'Glyph', role: 'Optional slot', relationship: 'slot' }] }),
  ];
  const { sections, groups } = buildCatalogSections(
    pages.map((p) => ({ ...p, file: `pages/${p.id}.catalog.tsx` })),
    [{ name: 'Glyph', file: 'replicas/Glyph.tsx', props: [], inheritedFrom: [] }],
  );
  const { container, cleanup } = renderCatalog(
    <Mount>
      <CatalogShell embedded initialPage={'ActionPage' as never} appName="App" title="Component Catalog" groups={groups as never} sections={sections as never} />
    </Mount>,
  );
  const link = linkNamed(container, 'Glyph');
  assert.ok(link, 'expected the real producer-authored composedOf entry to resolve through the real buildCatalogSections output');
  click(link!);
  assert.equal(pageHeading(), 'GlyphPage', 'must land on the page that actually owns the "Glyph" export, not a guess');
  assert.ok(plainTextPresent(container, 'Also used by'), 'the real producer inverse must reach the ordinary renderer');
  assert.ok(linkNamed(container, 'ActionPage'), 'the actual built-in user must be linked');
  assert.equal(Boolean(linkNamed(container, 'RelatedCaller')), false, 'related comparisons must not become built-in users');
  assert.equal(Boolean(linkNamed(container, 'SlotCaller')), false, 'optional slots must not become built-in users');
  cleanup();
});
