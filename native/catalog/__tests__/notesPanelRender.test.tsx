// R1 mounted regression: a standalone page's Guidance / Quick reference / Composition / Props live
// behind a "Notes and API ›" control in the shared overlay side panel, not inline. The same
// dynamic-import warmup `familyPageRender.test.tsx` documents in full (nothing reaching
// `react-dom`/`react-native-web` may import before a real `window` exists), and its `Node` getter
// for the Modal's focus trap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { SectionBlock } = await import('../SectionBlock.tsx');
const { ReferenceDetails } = await import('../ReferenceDetails.tsx');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');

const PANEL = '[role="dialog"][aria-modal="true"]';
const panelEl = () => document.querySelector(PANEL) as HTMLElement | null;

function press(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

function pressEscape() {
  act(() => { document.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); });
}

function triggerIn(container: HTMLElement): HTMLElement | undefined {
  return [...container.querySelectorAll('[aria-haspopup="dialog"]')].find((el) => (el.textContent || '').startsWith('Notes and API')) as HTMLElement | undefined;
}

function pageDef(extra: Record<string, unknown> = {}) {
  const page = defineCatalogPage({
    id: 'Chip', group: 'Components', description: 'A small label.', source: 'src/Chip.tsx',
    whenToUse: 'Use a chip for a short, removable label.',
    a11y: 'Announced as a button; Backspace removes it.',
    notes: ['Chips never wrap their label.', 'Keep labels under 20 characters.'],
    composedOf: [{ component: 'Icon', role: 'Leading glyph', relationship: 'built-in' }],
    variants: { items: [{ key: 'v', name: 'Default', node: <div>Chip specimen</div> }] },
    ...extra,
  } as never);
  const props = [{ name: 'label', type: 'string', required: true, desc: 'What it says.' }];
  return buildCatalogSections([page], [{ name: 'Chip', file: 'Chip.tsx', props, inheritedFrom: [] }], []).sections[0];
}

const normalize = (text: string | null) => (text || '').replace(/\s+/g, ' ').trim();

test('the reference card is not inline; a "Notes and API" control after the specimens opens it, the description stays', () => {
  const def = pageDef();
  const { container, cleanup } = renderCatalog(<SectionBlock def={def} />);
  try {
    const text = container.textContent || '';
    assert.ok(text.includes('A small label.'), 'the page description stays on the page');
    for (const inline of ['Guidance', 'Quick reference', 'Use a chip for a short', 'Announced as a button', 'Keep labels under 20']) {
      assert.equal(text.includes(inline), false, `"${inline}" is not inline`);
    }
    const trigger = triggerIn(container);
    assert.ok(trigger, 'expected the "Notes and API ›" control');
    assert.ok(text.indexOf('Notes and API') > text.indexOf('Chip specimen'), 'after the specimens');
    assert.equal(trigger!.getAttribute('aria-expanded'), 'false');
    assert.equal(panelEl(), null, 'closed until pressed');
    press(trigger!);
    assert.ok(panelEl(), 'pressing it opens the side panel');
    assert.equal(trigger!.getAttribute('aria-expanded'), 'true');
  } finally { cleanup(); }
});

test('the panel holds every field the inline card showed', () => {
  const def = pageDef();
  assert.ok(def.path, 'fixture sanity: the page has a source path');
  const card = renderCatalog(<ReferenceDetails def={def} />);
  const cardText = normalize(card.container.textContent);
  card.cleanup();
  for (const field of ['Guidance', 'Use a chip for a short, removable label.', 'Quick reference', 'Source', def.path ?? '', 'Accessibility', 'Announced as a button; Backspace removes it.', 'Notes', 'Chips never wrap their label.', 'Keep labels under 20 characters.', 'Composition', 'Leading glyph', 'Props', 'What it says.']) {
    assert.ok(cardText.includes(field), `fixture sanity: the old card showed "${field}"`);
  }

  const { container, cleanup } = renderCatalog(<SectionBlock def={def} />);
  try {
    press(triggerIn(container)!);
    assert.ok(normalize(panelEl()!.textContent).includes(cardText), 'the panel contains exactly the content the old card rendered');
  } finally { cleanup(); }
});

test('the panel is named by the page and closes with ×, Esc and a scrim press', () => {
  const { container, cleanup } = renderCatalog(<SectionBlock def={pageDef()} />);
  try {
    const trigger = triggerIn(container)!;
    press(trigger);
    const id = panelEl()!.getAttribute('aria-labelledby');
    assert.ok(id);
    assert.equal(normalize(document.getElementById(id!)?.textContent), 'Chip', 'the dialog is labelled by the page');

    press(panelEl()!.querySelector('[aria-label="Close"]')!);
    assert.equal(panelEl(), null, '× closes');

    press(trigger);
    pressEscape();
    assert.equal(panelEl(), null, 'Esc closes');

    press(trigger);
    press(document.querySelector('[data-testid="member-panel-scrim"]')!);
    assert.equal(panelEl(), null, 'a scrim press closes');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  } finally { cleanup(); }
});

test('focus moves into the panel on open and returns to the trigger on close', () => {
  const { container, cleanup } = renderCatalog(<SectionBlock def={pageDef()} />);
  try {
    const trigger = triggerIn(container)!;
    act(() => { trigger.focus(); });
    press(trigger);
    assert.ok(panelEl()!.contains(document.activeElement), 'focus moves into the panel');
    pressEscape();
    assert.equal(panelEl(), null);
    assert.ok(document.activeElement === trigger, 'focus returns to the trigger');
  } finally { cleanup(); }
});

test('following a reference link inside the panel closes it first, then navigates', () => {
  const calls: string[] = [];
  const navigation = {
    resolve: (name: string) => ({ pageId: name }),
    open: (pageId: string) => { calls.push(`${pageId}:panelOpen=${panelEl() !== null}`); },
  };
  const { container, cleanup } = renderCatalog(<SectionBlock def={pageDef()} navigation={navigation as never} />);
  try {
    press(triggerIn(container)!);
    const link = [...panelEl()!.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === 'Icon');
    assert.ok(link, 'the resolvable Composition name is a link inside the panel');
    press(link!);
    assert.deepEqual(calls, ['Icon:panelOpen=true'], 'navigation requested once, from inside the open panel');
    assert.equal(panelEl(), null, 'the panel is closed after following the link');
  } finally { cleanup(); }
});

test('a page with nothing for the card gets no "Notes and API" control', () => {
  const bare = { id: 'Bare', description: 'Nothing to add.' } as never;
  const { container, cleanup } = renderCatalog(<SectionBlock def={bare} />);
  try {
    assert.ok((container.textContent || '').includes('Nothing to add.'));
    assert.equal(triggerIn(container), undefined);
    assert.equal(container.textContent?.includes('Guidance'), false, 'and no placeholder card either');
  } finally { cleanup(); }
});

test('a token page keeps its short Quick reference inline, with no panel control', () => {
  const def = { id: 'Colors', description: 'Raw colors.', path: 'src/colors.ts', tokenGallery: true, previewWidths: 'full', render: () => <div>swatches</div> } as never;
  const { container, cleanup } = renderCatalog(<SectionBlock def={def} />);
  try {
    assert.ok((container.textContent || '').includes('Quick reference'));
    assert.ok((container.textContent || '').includes('src/colors.ts'));
    assert.equal(triggerIn(container), undefined);
  } finally { cleanup(); }
});

test('a plain page\'s api shows in the panel after Props, under the page\'s apiLabel, not inline', () => {
  const def = pageDef({ api: 'struct Chip: View {}', apiLabel: 'Swift API' });
  const { container, cleanup } = renderCatalog(<SectionBlock def={def} />);
  try {
    assert.equal((container.textContent || '').includes('struct Chip: View {}'), false, 'the excerpt is not inline');
    const trigger = [...container.querySelectorAll('[aria-haspopup="dialog"]')].find((el) => (el.textContent || '').startsWith('Notes and Swift API'));
    assert.ok(trigger, 'the control uses apiLabel');
    press(trigger!);
    const text = normalize(panelEl()!.textContent);
    assert.ok(text.includes('Notes and Swift API'), 'the panel kicker uses apiLabel');
    assert.ok(text.includes('struct Chip: View {}'), 'the panel shows the excerpt');
    assert.ok(text.indexOf('struct Chip: View {}') > text.indexOf('What it says.'), 'the excerpt follows Props');
  } finally { cleanup(); }
});

test('a plain page without api keeps the "Notes and API" label and shows no excerpt; a family page ignores a page-level api', () => {
  assert.equal((pageDef() as { api?: string }).api, undefined);
  const family = defineCatalogPage({
    id: 'Suite', group: 'Components', description: 'The suite.', whole: 'Suite', api: 'struct Hidden {}',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: [] }],
    members: [{ id: 'Suite', source: 's.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'The whole.' }],
  } as never);
  const built = buildCatalogSections([{ ...family, file: 'Suite.catalog.tsx' }], [], []).sections[0] as { api?: string };
  assert.equal(built.api, undefined);
});

test('a token page\'s api is not shown inline in its Quick reference card', () => {
  const def = pageDef({ api: 'struct Hidden: View {}', tokenGallery: true, render: () => <div>Token specimen</div> });
  assert.equal((def as { tokenGallery?: boolean }).tokenGallery, true, 'the fixture is a token page');
  const { container, cleanup } = renderCatalog(<ReferenceDetails def={def} />);
  try {
    const text = container.textContent || '';
    assert.ok(text.includes('Quick reference'), 'the card itself still renders');
    assert.equal(text.includes('struct Hidden: View {}'), false, 'the excerpt is not rendered');
  } finally { cleanup(); }
});
