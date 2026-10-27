// A1/A2 mounted regression: the real `AppearsIn`, and the real `SectionBlock`/`FamilyPage`
// pipeline around it, rendered through react-native-web into jsdom. The same dynamic-import warmup
// `groupPageRender.test.tsx` documents in full: nothing that reaches `react-dom`/`react-native-web`
// may be imported before a real `window` exists.
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
const { AppearsIn } = await import('../AppearsIn.tsx');
const { SectionBlock } = await import('../SectionBlock.tsx');
const { FamilyPage } = await import('../FamilyPage.tsx');
const { GroupPage } = await import('../GroupPage.tsx');
const { buildCatalogSections, defineCatalogPage } = await import('../pageApi.ts');
type UsageEntry = import('../usage.ts').UsageEntry;
type UsageData = import('../usage.ts').UsageData;

/** react-native-web turns each style into atomic classes and injects their rules once, into the window
 *  that was current when it was first imported (the warmup window above) — read a property back there. */
function cssOf(el: Element, property: string): string {
  const classes = new Set((el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  for (const sheet of [...warmup.window.document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      const match = /^\.([\w-]+)\s*\{(.*)\}$/s.exec(rule.cssText);
      if (!match || !classes.has(match[1])) continue;
      const declaration = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+)`).exec(match[2]);
      if (declaration) return declaration[1].trim();
    }
  }
  return '';
}

function usesIn(area: string, count: number, prefix = area): UsageEntry['uses'] {
  return Array.from({ length: count }, (_, index) => ({ area, file: `${prefix}${index + 1}.swift`, line: index + 1 }));
}

const ENTRY: UsageEntry = { area: 'Chat', uses: [...usesIn('Bots', 2), ...usesIn('Chat', 5), ...usesIn('Settings', 1)] };

/** What a screen reader reads: the text of an element, skipping anything `aria-hidden`. */
function accessibleText(el: Element): string {
  if (el.getAttribute('aria-hidden') === 'true') return '';
  return [...el.childNodes].map((node) => (node.nodeType === 3 ? node.textContent || '' : accessibleText(node as Element))).join('');
}

/** The per-area rows: the list items that hold a (decorative) bar. */
function areaRows(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[role="listitem"]')].filter((el) => el.querySelector('[aria-hidden="true"]'));
}

function rowLabels(container: HTMLElement): string[] {
  return areaRows(container).map((el) => accessibleText(el).trim());
}

function fileLines(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="listitem"]')].filter((el) => !el.querySelector('[aria-hidden="true"]')).map((el) => (el.textContent || '').trim());
}

function buttonNamed(container: HTMLElement, text: string): HTMLElement | undefined {
  return [...container.querySelectorAll('[role="button"]')].find((el) => (el.textContent || '').trim() === text) as HTMLElement | undefined;
}

function click(el: HTMLElement): void {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
}

test('AppearsIn lists one row per area, most uses first, with the count', () => {
  const { container, cleanup } = renderCatalog(<AppearsIn entry={ENTRY} />);
  assert.match(container.textContent || '', /Appears in/);
  assert.deepEqual(rowLabels(container), ['Chat, 5 uses', 'Bots, 2 uses', 'Settings, 1 use']);
  const rows = areaRows(container);
  assert.deepEqual(rows.map((row) => (row.textContent || '').replace(/\s+/g, '')), ['Chat5Chat,5uses', 'Bots2Bots,2uses', 'Settings1Settings,1use'], 'visible name and count, plus the one spoken label');
  cleanup();
});

test('AppearsIn hides the visible columns and speaks one label per row, as text rather than an aria-label', () => {
  const { container, cleanup } = renderCatalog(<AppearsIn entry={ENTRY} />);
  const rows = areaRows(container);
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.hasAttribute('aria-label'), false, 'screen readers in browse mode ignore a list item\'s aria-label');
    const hidden = [...row.querySelectorAll('[aria-hidden="true"]')];
    assert.equal(hidden.length, 3, 'the area name, the bar track and the count are hidden');
    assert.equal(hidden.filter((el) => (el.textContent || '').trim() === '').length, 1, 'the bar carries no text');
  }
  assert.deepEqual(rows.map((row) => accessibleText(row).trim()), ['Chat, 5 uses', 'Bots, 2 uses', 'Settings, 1 use'], 'what is read: one label each, no doubled name or count');
  assert.equal(container.querySelectorAll('[role="list"]').length, 2, 'area rows and file lines are lists');
  cleanup();
});

test('AppearsIn caps each bar track at 240px so it does not stretch across the card', () => {
  const { container, cleanup } = renderCatalog(<AppearsIn entry={ENTRY} />);
  const tracks = areaRows(container).map((row) => [...row.querySelectorAll('[aria-hidden="true"]')].find((el) => (el.textContent || '').trim() === '')!);
  assert.equal(tracks.length, 3);
  for (const track of tracks) assert.equal(cssOf(track, 'max-width'), '240px');
  cleanup();
});

test('AppearsIn lists every file as file:line under "Files that use it · N"', () => {
  const entry: UsageEntry = { uses: [{ area: 'Bots', file: 'BotRoomView.swift', line: 152 }, { area: 'Chat', file: 'ChatView.swift' }] };
  const { container, cleanup } = renderCatalog(<AppearsIn entry={entry} />);
  assert.match(container.textContent || '', /Files that use it · 2/);
  assert.deepEqual(fileLines(container), ['BotRoomView.swift:152', 'ChatView.swift']);
  assert.equal(buttonNamed(container, 'Show all 2'), undefined, 'no control when nothing is collapsed');
  cleanup();
});

test('AppearsIn shows exactly 8 files at the boundary, with no control', () => {
  const { container, cleanup } = renderCatalog(<AppearsIn entry={{ uses: usesIn('Chat', 8) }} />);
  assert.equal(fileLines(container).length, 8);
  assert.equal([...container.querySelectorAll('[role="button"]')].length, 0);
  cleanup();
});

test('AppearsIn collapses 9 or more files to the first 8 and "Show all N" reveals them', () => {
  const { container, cleanup } = renderCatalog(<AppearsIn entry={{ uses: usesIn('Chat', 11, 'F') }} />);
  assert.match(container.textContent || '', /Files that use it · 11/);
  assert.deepEqual(fileLines(container), Array.from({ length: 8 }, (_, i) => `F${i + 1}.swift:${i + 1}`));
  const showAll = buttonNamed(container, 'Show all 11');
  assert.ok(showAll, 'a "Show all 11" control');
  assert.equal(showAll.getAttribute('aria-expanded'), 'false');

  click(showAll);
  assert.equal(fileLines(container).length, 11);
  assert.equal(fileLines(container)[10], 'F11.swift:11');
  assert.equal(buttonNamed(container, 'Show all 11'), undefined);
  const showFewer = buttonNamed(container, 'Show fewer');
  assert.ok(showFewer);
  assert.equal(showFewer.getAttribute('aria-expanded'), 'true');

  click(showFewer);
  assert.equal(fileLines(container).length, 8);
  cleanup();
});

test('AppearsIn renders nothing without an entry or with no uses', () => {
  for (const entry of [undefined, { area: 'Chat', uses: [] } as UsageEntry]) {
    const { container, cleanup } = renderCatalog(<AppearsIn entry={entry} />);
    assert.equal(container.textContent, '');
    cleanup();
  }
});

function standaloneDef() {
  const page = defineCatalogPage({
    id: 'Chip', group: 'Components', description: 'A chip.',
    variants: { items: [{ key: 'v', name: 'Default', node: <div>Chip specimen</div> }] },
  });
  return buildCatalogSections([page], [], []).sections[0];
}

test('a standalone page shows "Appears in" after its specimens, only when it has usage', () => {
  const def = standaloneDef();
  const usage: UsageData = { version: 1, components: { Chip: ENTRY } };
  const withUsage = renderCatalog(<SectionBlock def={def} usage={usage} />);
  const text = withUsage.container.textContent || '';
  assert.ok(text.indexOf('Chip specimen') > -1 && text.indexOf('Appears in') > text.indexOf('Chip specimen'), 'after the specimen');
  assert.deepEqual(rowLabels(withUsage.container), ['Chat, 5 uses', 'Bots, 2 uses', 'Settings, 1 use']);
  withUsage.cleanup();

  for (const props of [{}, { usage: null }, { usage: { version: 1, components: {} } as UsageData }]) {
    const without = renderCatalog(<SectionBlock def={def} {...props} />);
    assert.doesNotMatch(without.container.textContent || '', /Appears in/);
    without.cleanup();
  }
});

test('a standalone page matches usage by its component name as well as its id', () => {
  const page = defineCatalogPage({ id: 'ChipPage', component: 'Chip', group: 'Components', description: 'A chip.', variants: { items: [{ key: 'v', name: 'Default', node: <div>x</div> }] } });
  const def = buildCatalogSections([page], [{ name: 'Chip', file: 'Chip.tsx', props: [], inheritedFrom: [] }], []).sections[0];
  const { container, cleanup } = renderCatalog(<SectionBlock def={def} usage={{ version: 1, components: { Chip: ENTRY } }} />);
  assert.deepEqual(rowLabels(container), ['Chat, 5 uses', 'Bots, 2 uses', 'Settings, 1 use']);
  cleanup();
});

test('a family member gets its own "Appears in" block, matched by member id', () => {
  const page = defineCatalogPage({
    id: 'Card', group: 'Components', description: 'A card family.',
    members: [
      { id: 'Card', source: 'card.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'The card.' },
      {
        id: 'CardHeader', source: 'card.swift:9', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Card', description: 'The header.',
        variants: { items: [{ key: 'v', name: 'Default', node: <div>Header specimen</div> }] },
      },
    ],
    whole: 'Card', sections: [{ label: 'Anatomy', kind: 'blocks' as const, inWhole: true, members: ['CardHeader'] }],
  } as never);
  const def = buildCatalogSections([page], [], []).sections[0];
  const usage: UsageData = { version: 1, components: { CardHeader: { uses: usesIn('Chat', 2, 'H') } } };
  const { container, cleanup } = renderCatalog(<FamilyPage def={def} usage={usage} />);
  assert.equal(areaRows(container).length, 1);
  assert.deepEqual(rowLabels(container), ['Chat, 2 uses']);
  const text = container.textContent || '';
  assert.ok(text.indexOf('Appears in') > text.indexOf('Header specimen'), 'after the member specimen');
  cleanup();

  const none = renderCatalog(<FamilyPage def={def} />);
  assert.doesNotMatch(none.container.textContent || '', /Appears in/);
  none.cleanup();
});

test('a key naming the family page itself shows once, after its parts, and not again on the whole', () => {
  const page = defineCatalogPage({
    id: 'Card', group: 'Components', description: 'A card family.',
    members: [
      { id: 'CardWhole', source: 'card.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'The card.' },
      {
        id: 'CardHeader', source: 'card.swift:9', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'CardWhole', description: 'The header.',
        variants: { items: [{ key: 'v', name: 'Default', node: <div>Header specimen</div> }] },
      },
    ],
    whole: 'CardWhole', sections: [{ label: 'Anatomy', kind: 'blocks' as const, inWhole: true, members: ['CardHeader'] }],
  } as never);
  const def = buildCatalogSections([page], [], []).sections[0];
  const own = renderCatalog(<FamilyPage def={def} usage={{ version: 1, components: { Card: { uses: usesIn('Chat', 3) } } }} />);
  assert.deepEqual(rowLabels(own.container), ['Chat, 3 uses']);
  const ownText = own.container.textContent || '';
  assert.ok(ownText.indexOf('Header specimen') > -1 && ownText.indexOf('Appears in') > ownText.indexOf('Header specimen'), 'after the specimens, not under the page head');
  own.cleanup();

  const shared = renderCatalog(<FamilyPage def={def} usage={{ version: 1, components: { Card: { uses: usesIn('Chat', 3) }, CardWhole: { uses: usesIn('Bots', 2) } } }} />);
  assert.deepEqual(rowLabels(shared.container).sort(), ['Bots, 2 uses', 'Chat, 3 uses'], 'the page entry and the whole entry differ, so both show');
  shared.cleanup();
});

test('a key naming the group page itself shows after its members, not above the first one', () => {
  const page = defineCatalogPage({
    id: 'Widgets', group: 'Components', description: 'A group of widgets.',
    members: [
      {
        id: 'PlainWidget', source: 'plain.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'A plain widget.',
        variants: { items: [{ key: 'v1', name: 'Default', node: <div>Plain specimen</div> }] },
      },
    ],
  } as never);
  const def = buildCatalogSections([page], [], []).sections[0];
  const { container, cleanup } = renderCatalog(<GroupPage def={def} usage={{ version: 1, components: { Widgets: { uses: usesIn('Chat', 2) } } }} />);
  assert.deepEqual(rowLabels(container), ['Chat, 2 uses']);
  const text = container.textContent || '';
  assert.ok(text.indexOf('Plain specimen') > -1 && text.indexOf('Appears in') > text.indexOf('Plain specimen'), 'after the member\'s specimen');
  cleanup();
});
