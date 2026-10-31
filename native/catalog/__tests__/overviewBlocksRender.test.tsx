// `CountStrip` and `WarningBanner`, the two building blocks for category overview pages: mounted
// through react-native-web. jsdom has no layout, so these pin structure, semantics and the styles
// that decide wrapping and colour, never pixel geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CountStrip, WarningBanner } = await import('../index.ts');
const { Text } = await import('react-native');
const { CATALOG_COLOR } = await import('../tokens.ts');

/** react-native-web writes static styles into the stylesheet of the document that was current at
 *  its first import (`warmup`'s); `renderCatalog` mounts into a fresh one, so copy the rules across
 *  to let `getComputedStyle` see what a browser would. */
function adoptStyles(): void {
  const css = [...warmup.window.document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)).join('\n');
  const style = window.document.createElement('style');
  style.textContent = css;
  window.document.head.appendChild(style);
}
const css = (el: Element, property: string) => window.getComputedStyle(el).getPropertyValue(property);

const STATS = [
  { label: 'Pages', value: 14 },
  { label: 'Variants', value: 62, sub: 'across all buttons' },
  { label: 'Status', value: 'Stable' },
];

test('CountStrip is a list with one item per stat: label, value, and the caption only when given', () => {
  const { container, cleanup } = renderCatalog(React.createElement(CountStrip, { items: STATS }));
  const list = container.querySelector('[role="list"]')!;
  assert.ok(list);
  const items = [...list.querySelectorAll('[role="listitem"]')];
  assert.deepEqual(items.map((item) => item.textContent), ['Pages14', 'Variants62across all buttons', 'StatusStable']);
  assert.equal(items[1].children.length, 3);
  assert.equal(items[0].children.length, 2, 'no empty caption row when a stat has no sub');
  cleanup();
});

test('CountStrip lays its cells out in a wrapping row of equal-basis, growing cells in the viewer\'s own colours', () => {
  const { container, cleanup } = renderCatalog(React.createElement(CountStrip, { items: STATS }));
  adoptStyles();
  const list = container.querySelector('[role="list"]')!;
  assert.equal(css(list, 'flex-wrap'), 'wrap');
  assert.equal(css(list, 'flex-direction'), 'row');
  const cells = [...list.querySelectorAll('[role="listitem"]')];
  for (const cell of cells) {
    assert.equal(css(cell, 'flex-grow'), '1');
    assert.equal(css(cell, 'flex-basis'), '150px');
  }
  assert.equal(css(cells[0], 'background-color'), 'rgb(250, 250, 250)'); // CATALOG_COLOR.surfaceMuted
  assert.equal(CATALOG_COLOR.surfaceMuted, '#fafafa');
  cleanup();
});

test('CountStrip warns in development when it has fewer than 2 or more than 6 stats, and still renders them', () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: unknown) => { warnings.push(String(message)); };
  (globalThis as Record<string, unknown>).__DEV__ = true;
  try {
    const one = renderCatalog(React.createElement(CountStrip, { items: [STATS[0]] }));
    assert.equal(one.container.querySelectorAll('[role="listitem"]').length, 1);
    one.cleanup();
    const seven = renderCatalog(React.createElement(CountStrip, { items: Array.from({ length: 7 }, (_, i) => ({ label: `S${i}`, value: i })) }));
    assert.equal(seven.container.querySelectorAll('[role="listitem"]').length, 7);
    seven.cleanup();
    const fine = renderCatalog(React.createElement(CountStrip, { items: STATS }));
    fine.cleanup();
  } finally {
    console.warn = original;
    delete (globalThis as Record<string, unknown>).__DEV__;
  }
  assert.deepEqual(warnings, ['[Catalog] CountStrip is designed for 2–6 stats, got 1.', '[Catalog] CountStrip is designed for 2–6 stats, got 7.']);
});

test('WarningBanner is a note named by its title, with the body under it and no dismiss control', () => {
  const { container, cleanup } = renderCatalog(React.createElement(WarningBanner, { title: 'Legacy buttons' }, 'Use the pages under Buttons for new work.'));
  const note = container.querySelector('[role="note"]')!;
  assert.ok(note);
  const labelledBy = note.getAttribute('aria-labelledby')!;
  assert.ok(labelledBy);
  assert.equal(container.querySelector(`[id="${labelledBy}"]`)?.textContent, 'Legacy buttons');
  assert.ok((note.textContent || '').endsWith('Use the pages under Buttons for new work.'));
  assert.equal(note.querySelectorAll('button, [role="button"], a').length, 0);
  assert.equal(container.querySelector('[role="alert"]'), null, 'a note, not an alert');
  cleanup();
});

test('WarningBanner is amber by default and accent blue for tone="info"', () => {
  const warn = renderCatalog(React.createElement(WarningBanner, { title: 'T' }, 'Body'));
  adoptStyles();
  let note = warn.container.querySelector('[role="note"]')!;
  assert.equal(css(note, 'background-color'), 'rgb(255, 244, 224)'); // warningSubtle #fff4e0
  assert.equal(css(note, 'border-top-color'), 'rgb(240, 207, 151)'); // warningBorder #f0cf97
  warn.cleanup();
  const info = renderCatalog(React.createElement(WarningBanner, { title: 'T', tone: 'info' }, 'Body'));
  adoptStyles();
  note = info.container.querySelector('[role="note"]')!;
  assert.equal(css(note, 'background-color'), 'rgb(233, 239, 255)'); // accentSubtle #e9efff
  info.cleanup();
});

test('WarningBanner renders element children as given, and styles a bare string body', () => {
  const rich = renderCatalog(React.createElement(WarningBanner, { title: 'T' }, React.createElement(Text, null, 'First'), React.createElement(Text, null, 'Second')));
  const note = rich.container.querySelector('[role="note"]')!;
  assert.deepEqual([...note.querySelectorAll('div, span')].map((el) => el.children.length === 0 ? el.textContent : null).filter(Boolean), ['T', 'First', 'Second']);
  rich.cleanup();
});

test('the package exports both blocks', async () => {
  const pkg = await import('../index.ts');
  assert.equal(typeof pkg.CountStrip, 'function');
  assert.equal(typeof pkg.WarningBanner, 'function');
});

test('CountStrip with two stats of the same label renders both without a duplicate-key error', () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
  try {
    const { container, cleanup } = renderCatalog(React.createElement(CountStrip, { items: [{ label: 'Pages', value: 1 }, { label: 'Pages', value: 2 }] }));
    assert.equal(container.querySelectorAll('[role="listitem"]').length, 2);
    cleanup();
  } finally {
    console.error = original;
  }
  assert.deepEqual(errors, []);
});
