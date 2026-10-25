// Mounted regression for SourceReferencePicker (#60 plan Task 2): drives the actual exported
// component through React Native Web into a real jsdom DOM — including React Native's own
// `Modal`, which portals its content into `document.body` rather than the render container — so
// search/filter/clear, selection, cancellation, and focus trapping/restoration are proven against
// real controls, not source-string assertions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useState } from 'react';
import { act } from 'react';
// Type-only: erased entirely by the strip-types/esbuild loader, so it carries none of the
// `canUseDOM`-ordering risk the warmup dance below exists to avoid for the real (value) imports.
import type { ReferenceEntry } from '../catalogReferences.ts';

// Same warmup dance `catalogOrderingRender.test.tsx` already documents in full: `react-dom` and
// react-native-web each decide, at their own first import, whether `canUseDOM`/`canUseDom` — that
// decision must see a real `window.document` already in place, which only a dynamic `import()`
// below (never hoisted ahead of this code, unlike a static `import`) can guarantee.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
// React Native Web's own `Modal` (`ModalFocusTrap.js`) checks a bare `document.activeElement
// instanceof Node` — the same missing-true-global problem `ShadowRoot` above already works
// around, with the same static-assignment precedent.
// renderCatalog creates a fresh window per case. Follow that window's Node constructor so the
// real Modal focus trap sees the same realm as document.activeElement, just as in a browser.
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { SourceReferencePicker } = await import('../SourceReferencePicker.tsx');
const { CatalogButton } = await import('../CatalogButton.tsx');
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

function rowLinks(): HTMLAnchorElement[] {
  return [...document.querySelectorAll('a[role="link"]')] as HTMLAnchorElement[];
}

// Each row renders two `Text` children (title, then component/path) — only the first is the
// title this file's own expectations are written against.
function rowTitles(): string[] {
  return rowLinks().map((a) => (a.firstElementChild?.textContent || '').trim());
}

const ENTRIES: ReferenceEntry[] = [
  { pageId: 'Button', title: 'Button', component: 'Button', aliases: [], path: 'src/components/Button/index.ts' },
  { pageId: 'Card', title: 'Card', component: 'Card', aliases: ['LegacyCard'], source: 'native/Card.swift:1', path: 'src/components/Card/index.ts' },
  { pageId: 'BotAvatarView', title: 'Bot avatar', component: 'BotAvatarView', aliases: [], path: 'native/BotAvatarView.swift' },
  {
    pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView', title: 'BotAnimatedFaceView', component: 'FaceComponent',
    aliases: ['OldFaceView'], path: 'native/BotFaceMotion.swift',
  },
];
// Verified once, directly against `catalogNavigation.ts`'s own `sortIds` (the same comparator the
// component itself reuses), rather than hand-guessed collation order.
const FULL_TITLE_ORDER = ['Bot avatar', 'BotAnimatedFaceView — in Bot avatar', 'Button', 'Card'];

function Harness({ entries, initialOpen = false, searchLabel }: { entries: ReferenceEntry[]; initialOpen?: boolean; searchLabel?: string }) {
  const [open, setOpen] = useState(initialOpen);
  const [selected, setSelected] = useState<ReferenceEntry | null>(null);
  const [dismissed, setDismissed] = useState(0);
  return (
    <>
      <CatalogButton label="Open" onPress={() => setOpen(true)} />
      <SourceReferencePicker
        visible={open}
        entries={entries}
        searchLabel={searchLabel}
        onDismiss={() => { setDismissed((n) => n + 1); setOpen(false); }}
        onSelect={(entry: ReferenceEntry) => { setSelected(entry); setOpen(false); }}
      />
      <div data-testid="selected">{selected ? (selected.memberId ?? selected.pageId) : ''}</div>
      <div data-testid="dismissed">{dismissed}</div>
    </>
  );
}

test('empty query lists every entry, A–Z by displayed title with the member\'s own "— in <family>" convention', () => {
  const { container, cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  assert.deepEqual(rowTitles(), FULL_TITLE_ORDER);
  assert.equal(document.querySelectorAll('[role="listitem"]').length, ENTRIES.length, 'each source result is a semantic list item');
  const dialog = document.querySelector('[role="dialog"]');
  assert.equal(dialog?.getAttribute('aria-label'), 'Source reference', 'the modal needs an accessible name');
  assert.ok([...dialog!.querySelectorAll('*')].some((node) => node.children.length === 0 && node.textContent === 'Search source references'), 'the search label must also be visible');
  void container;
  cleanup();
});

test('a nonempty filter narrows to a sorted subset via real input events', () => {
  const { container, cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  assert.ok(input, 'expected the picker\'s own search field');
  typeInto(input, 'bot');
  assert.deepEqual(rowTitles(), ['Bot avatar', 'BotAnimatedFaceView — in Bot avatar']);
  void container;
  cleanup();
});

test('a query matches by alias and by source path, not just id/title/component', () => {
  const { cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  typeInto(input, 'legacycard');
  assert.deepEqual(rowTitles(), ['Card']); // alias
  const cardLink = rowLinks()[0];
  assert.ok(cardLink.textContent?.includes('native/Card.swift:1'), 'show the authored declaration source');
  assert.ok(cardLink.textContent?.includes('src/components/Card/index.ts'), 'retain the distinct implementation path');
  typeInto(input, 'native/Card.swift');
  assert.deepEqual(rowTitles(), ['Card']);
  typeInto(input, 'botfacemotion');
  assert.deepEqual(rowTitles(), ['BotAnimatedFaceView — in Bot avatar']); // source path
  cleanup();
});

test('clearing the filter recovers the full list and returns focus to the field it cleared', () => {
  const { cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  typeInto(input, 'bot');
  assert.equal(rowTitles().length, 2);
  const clear = document.querySelector('[aria-label="Clear filter"]') as HTMLElement;
  assert.ok(clear, 'expected the search field\'s own Clear control');
  click(clear);
  assert.deepEqual(rowTitles(), FULL_TITLE_ORDER);
  assert.equal(document.activeElement, input, 'Clear must return focus to the field it emptied');
  cleanup();
});

test('a query with no matches in a nonempty catalog gets its own honest message, distinct from an empty catalog', () => {
  const { cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  typeInto(input, 'zzz-no-such-thing');
  assert.equal(rowLinks().length, 0);
  assert.ok((document.body.textContent || '').includes('No matches for "zzz-no-such-thing"'));
  cleanup();
});

test('an empty catalog shows its own honest message regardless of query, and invents no data', () => {
  const { cleanup } = renderCatalog(<Harness entries={[]} initialOpen />);
  assert.equal(rowLinks().length, 0);
  assert.ok((document.body.textContent || '').includes('No source references are registered.'));
  cleanup();
});

test('selecting a result activates the real control, fires onSelect with the right entry, and the row is a real addressable link', () => {
  const { container, cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  const buttonLink = rowLinks().find((a) => (a.firstElementChild?.textContent || '').trim() === 'Button')!;
  assert.ok(buttonLink, 'expected a real link for the Button entry');
  assert.equal(buttonLink.getAttribute('href'), hashForId('Button'));
  click(buttonLink);
  assert.equal(container.querySelector('[data-testid="selected"]')?.textContent, 'Button');
  // Selecting closes the picker (the harness's own `onSelect` sets `open` false) — its own result
  // rows must no longer be in the document once it does.
  assert.equal(rowLinks().length, 0);
  cleanup();
});

test('a member result\'s href addresses the member itself, not its owning family page', () => {
  const { cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  const faceLink = rowLinks().find((a) => (a.textContent || '').includes('BotAnimatedFaceView'))!;
  assert.equal(faceLink.getAttribute('href'), hashForId('BotAnimatedFaceView'));
  cleanup();
});

test('Escape dismisses without selecting, and restores focus to the control that opened the picker', () => {
  const { container, cleanup } = renderCatalog(<Harness entries={ENTRIES} />);
  try {
    const openButton = container.querySelector('[aria-label="Open"]') as HTMLElement;
    assert.ok(openButton, 'expected the harness\'s own trigger');
    // dispatchEvent does not perform the browser's pointer-focus default action.
    act(() => openButton.focus());
    click(openButton);
    assert.ok(rowLinks().length > 0, 'expected the picker to be open');
    pressEscape();
    assert.equal(rowLinks().length, 0, 'Escape must close the picker with no selection');
    assert.equal(container.querySelector('[data-testid="selected"]')?.textContent, '');
    assert.equal(container.querySelector('[data-testid="dismissed"]')?.textContent, '1');
    assert.equal(document.activeElement, openButton, 'focus must return to the control that opened the picker');
  } finally {
    cleanup();
  }
});

test('the explicit Close control dismisses without selecting', () => {
  const { container, cleanup } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  const closeButton = document.querySelector('[aria-label="Close source reference picker"]') as HTMLElement;
  assert.ok(closeButton, 'expected the picker\'s own explicit Close control');
  click(closeButton);
  assert.equal(rowLinks().length, 0);
  assert.equal(container.querySelector('[data-testid="dismissed"]')?.textContent, '1');
  cleanup();
});

test('opening the picker moves focus into its own search field (Modal\'s own focus trap)', () => {
  const { container, cleanup } = renderCatalog(<Harness entries={ENTRIES} />);
  const openButton = container.querySelector('[aria-label="Open"]') as HTMLElement;
  click(openButton);
  const input = document.querySelector('input[aria-label="Search source references"]') as HTMLInputElement;
  assert.ok(input, 'expected the search field to be present once open');
  assert.equal(document.activeElement, input, 'the field\'s own autoFocus should have it focused once the modal opens');
  cleanup();
});

test('searchLabel overrides the picker\'s default label; omitting it keeps the default', () => {
  const { cleanup: cleanupOverride } = renderCatalog(<Harness entries={ENTRIES} initialOpen searchLabel="Find a declaration" />);
  assert.ok(document.querySelector('input[aria-label="Find a declaration"]'), 'expected the overridden label');
  assert.equal(document.querySelector('input[aria-label="Search source references"]'), null);
  cleanupOverride();

  const { cleanup: cleanupDefault } = renderCatalog(<Harness entries={ENTRIES} initialOpen />);
  assert.ok(document.querySelector('input[aria-label="Search source references"]'), 'expected the default label');
  cleanupDefault();
});
