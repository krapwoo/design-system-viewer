// `TokenGrid`'s development warning for a duplicated or out-of-order tile, mounted through
// react-native-web: the grid logs `[Catalog] TokenGrid order: …` (which `doctor --render` turns into a
// `token-grid-order` warning, see `cli/__tests__/render.test.ts`), and `order="authored"` turns off
// only the ordering check.
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
const { TokenGrid, TokenTile } = await import('../index.ts');
const { View } = await import('react-native');

/** Mounts a grid of tiles with these names and returns what it warned. */
function warningsFor(names: string[], props: { order?: 'ascending' | 'authored' } = {}): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: unknown) => { warnings.push(String(message)); };
  (globalThis as Record<string, unknown>).__DEV__ = true;
  try {
    const { cleanup } = renderCatalog(
      <TokenGrid {...props}>
        {names.map((name, i) => <TokenTile key={i} name={name}><View /></TokenTile>)}
      </TokenGrid>,
    );
    cleanup();
  } finally {
    console.warn = original;
    delete (globalThis as Record<string, unknown>).__DEV__;
  }
  // react-native-web also warns that jsdom has no ResizeObserver; only the catalog's own are of interest.
  return warnings.filter((warning) => warning.startsWith('[Catalog] '));
}

test('a TokenGrid in ascending order with unique names warns about nothing', () => {
  assert.deepEqual(warningsFor(['2pt', '4pt', '6pt', '17pt']), []);
});

test('a TokenGrid warns about a duplicated name, once', () => {
  const warnings = warningsFor(['4pt', '6pt', '6pt']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^\[Catalog\] TokenGrid order: two tiles are named "6pt"/);
});

test('a TokenGrid warns about a number that is smaller than the one before it', () => {
  const warnings = warningsFor(['6pt', '17pt', '4pt']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^\[Catalog\] TokenGrid order: "4pt" comes after "17pt"/);
});

test('order="authored" keeps a deliberate order without a warning, but a duplicate is still reported', () => {
  assert.deepEqual(warningsFor(['17pt', '6pt', '4pt'], { order: 'authored' }), []);
  assert.equal(warningsFor(['17pt', '6pt', '6pt'], { order: 'authored' }).length, 1);
});
