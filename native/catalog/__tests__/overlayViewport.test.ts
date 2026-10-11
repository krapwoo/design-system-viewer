import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OVERLAY_ADDRESS_PARAM,
  comparisonCellItemKey,
  decodeOverlayAddress,
  encodeOverlayAddress,
  findOverlayNode,
  isFiniteOverlaySize,
  overlayAddressesEqual,
  overlayAddressFromSearch,
  overlayStageDimensions,
  overlayViewportHrefSuffix,
  resolveOverlayViewport,
} from '../overlayViewport.ts';
import type { SectionDef } from '../types.ts';

test('encodeOverlayAddress/decodeOverlayAddress round-trip', () => {
  const address = { pageId: 'Sheet', slot: 'variants' as const, itemKey: 'full-height' };
  assert.deepEqual(decodeOverlayAddress(encodeOverlayAddress(address)), address);
});

test('encodeOverlayAddress percent-encodes each segment so a key containing the delimiter still round-trips', () => {
  const address = { pageId: 'Weird.Page', slot: 'states' as const, itemKey: 'a.b' };
  assert.deepEqual(decodeOverlayAddress(encodeOverlayAddress(address)), address);
});

test('decodeOverlayAddress rejects malformed input instead of guessing', () => {
  assert.equal(decodeOverlayAddress('too.few'), undefined);
  assert.equal(decodeOverlayAddress('too.many.segments.here'), undefined);
  assert.equal(decodeOverlayAddress('Sheet.unknownSlot.key'), undefined);
  assert.equal(decodeOverlayAddress('.variants.key'), undefined);
  assert.equal(decodeOverlayAddress('Sheet.variants.'), undefined);
});

test('overlayAddressFromSearch reads the reserved query param, undefined when absent or malformed', () => {
  const address = { pageId: 'TimePickerModal', slot: 'variants' as const, itemKey: 'default' };
  const search = `?${OVERLAY_ADDRESS_PARAM}=${encodeOverlayAddress(address)}`;
  assert.deepEqual(overlayAddressFromSearch(search), address);
  assert.equal(overlayAddressFromSearch(''), undefined);
  assert.equal(overlayAddressFromSearch('?other=1'), undefined);
  assert.equal(overlayAddressFromSearch(`?${OVERLAY_ADDRESS_PARAM}=not-a-real-address`), undefined);
});

test('overlayAddressesEqual compares all three fields', () => {
  const a = { pageId: 'Sheet', slot: 'variants' as const, itemKey: 'full-height' };
  assert.equal(overlayAddressesEqual(a, { ...a }), true);
  assert.equal(overlayAddressesEqual(a, { ...a, itemKey: 'other' }), false);
  assert.equal(overlayAddressesEqual(a, { ...a, slot: 'states' }), false);
  assert.equal(overlayAddressesEqual(a, { ...a, pageId: 'Other' }), false);
});

test('overlayViewportHrefSuffix carries the overlay param plus the page\'s own routing hash', () => {
  const address = { pageId: 'Sheet', slot: 'variants' as const, itemKey: 'full-height' };
  const suffix = overlayViewportHrefSuffix(address);
  assert.equal(suffix, `?${OVERLAY_ADDRESS_PARAM}=${encodeOverlayAddress(address)}#Sheet`);
  // And it must itself decode back to the same address — the child document's own read of its
  // own query string has to agree with what the parent just built.
  assert.deepEqual(overlayAddressFromSearch(suffix), address);
});

test('overlayViewportHrefSuffix survives real URL query-string transport (one extra decode layer): dotted, percent-literal, and canonical comparison-key addresses all round-trip', () => {
  const cases = [
    { pageId: 'Weird.Page', slot: 'states' as const, itemKey: 'a.b' },
    { pageId: 'Percent%Page', slot: 'variants' as const, itemKey: '100%' },
    { pageId: 'Page%2E', slot: 'variants' as const, itemKey: 'key%25' },
    { pageId: 'Dotted', slot: 'comparison' as const, itemKey: comparisonCellItemKey('row.one', 'col.one') },
  ];
  for (const address of cases) {
    const url = new URL(`http://localhost/catalog${overlayViewportHrefSuffix(address)}`);
    assert.deepEqual(overlayAddressFromSearch(url.search), address);
    const decision = resolveOverlayViewport({ address, isWeb: true, currentSearch: url.search, pathname: '/catalog' });
    assert.equal(decision.mode, 'inline');
  }
});

test('resolveOverlayViewport: off web, there is no child-document mechanism to offer, so it always renders inline', () => {
  const address = { pageId: 'Sheet', slot: 'variants' as const, itemKey: 'full-height' };
  assert.deepEqual(
    resolveOverlayViewport({ address, isWeb: false, currentSearch: '', pathname: '/' }),
    { mode: 'inline' },
  );
});

test('resolveOverlayViewport: on web with no address in the current document, frames this address at the current pathname', () => {
  const address = { pageId: 'Sheet', slot: 'variants' as const, itemKey: 'full-height' };
  const decision = resolveOverlayViewport({ address, isWeb: true, currentSearch: '', pathname: '/catalog' });
  assert.deepEqual(decision, { mode: 'frame', href: `/catalog${overlayViewportHrefSuffix(address)}` });
});

test('resolveOverlayViewport: on web, when this document is already the selected child for this exact address, renders inline instead of framing itself again (recursion guard)', () => {
  const address = { pageId: 'Sheet', slot: 'variants' as const, itemKey: 'full-height' };
  const currentSearch = `?${OVERLAY_ADDRESS_PARAM}=${encodeOverlayAddress(address)}`;
  assert.deepEqual(
    resolveOverlayViewport({ address, isWeb: true, currentSearch, pathname: '/catalog' }),
    { mode: 'inline' },
  );
});

test('resolveOverlayViewport: a different selected address in the current document still frames this one', () => {
  const address = { pageId: 'Sheet', slot: 'variants' as const, itemKey: 'full-height' };
  const other = { pageId: 'TimePickerModal', slot: 'variants' as const, itemKey: 'default' };
  const currentSearch = `?${OVERLAY_ADDRESS_PARAM}=${encodeOverlayAddress(other)}`;
  const decision = resolveOverlayViewport({ address, isWeb: true, currentSearch, pathname: '/catalog' });
  assert.equal(decision.mode, 'frame');
});

const sheetDef: SectionDef<string> = {
  id: 'Sheet',
  description: 'A sheet.',
  path: 'Sheet.tsx',
  variants: { items: [{ key: 'full-height', name: 'Full height', node: 'full-height-node' as unknown as never }] },
  states: { items: [{ key: 'with-footer', name: 'With footer', node: 'with-footer-node' as unknown as never }] },
  comparison: {
    rowLabel: 'Row',
    columnLabel: 'Column',
    rows: [{ key: 'r1', label: 'R1' }],
    columns: [{ key: 'c1', label: 'C1' }],
    cells: [{ rowKey: 'r1', columnKey: 'c1', node: 'cell-node' as unknown as never }],
  },
};

test('findOverlayNode resolves a variants item by key', () => {
  assert.equal(findOverlayNode([sheetDef], { pageId: 'Sheet', slot: 'variants', itemKey: 'full-height' }), 'full-height-node');
});

test('findOverlayNode resolves a states item by key', () => {
  assert.equal(findOverlayNode([sheetDef], { pageId: 'Sheet', slot: 'states', itemKey: 'with-footer' }), 'with-footer-node');
});

test('findOverlayNode resolves a comparison cell by its canonical comparisonCellItemKey', () => {
  assert.equal(findOverlayNode([sheetDef], { pageId: 'Sheet', slot: 'comparison', itemKey: comparisonCellItemKey('r1', 'c1') }), 'cell-node');
});

test('findOverlayNode returns undefined for an unknown page id (stale/removed page)', () => {
  assert.equal(findOverlayNode([sheetDef], { pageId: 'Missing', slot: 'variants', itemKey: 'full-height' }), undefined);
});

test('findOverlayNode returns undefined for an unknown item key (stale/renamed key)', () => {
  assert.equal(findOverlayNode([sheetDef], { pageId: 'Sheet', slot: 'variants', itemKey: 'missing' }), undefined);
});

test('findOverlayNode returns undefined when the addressed slot has no items at all', () => {
  const noVariants: SectionDef<string> = { id: 'Empty', description: 'd', path: 'p.tsx' };
  assert.equal(findOverlayNode([noVariants], { pageId: 'Empty', slot: 'variants', itemKey: 'anything' }), undefined);
});

test('findOverlayNode resolves a comparison cell by the canonical comparisonCellItemKey, not an ambiguous colon split, when a row/column key itself contains a colon', () => {
  // Naive `itemKey.split(':')` is ambiguous here: both ('r:1', 'c') and ('r', '1:c') would split
  // out of "r:1:c". The canonical `comparisonCellItemKey` join (a null-byte separator) never has
  // this collision, so the address built from the real row/column keys must still resolve the one
  // cell that actually owns them.
  const colonDef: SectionDef<string> = {
    id: 'Weird',
    description: 'd',
    path: 'p.tsx',
    comparison: {
      rowLabel: 'Row',
      columnLabel: 'Column',
      rows: [{ key: 'r:1', label: 'R1' }, { key: 'r', label: 'R' }],
      columns: [{ key: 'c', label: 'C' }, { key: '1:c', label: '1C' }],
      cells: [
        { rowKey: 'r:1', columnKey: 'c', node: 'ambiguous-a' as unknown as never },
        { rowKey: 'r', columnKey: '1:c', node: 'ambiguous-b' as unknown as never },
      ],
    },
  };
  assert.equal(
    findOverlayNode([colonDef], { pageId: 'Weird', slot: 'comparison', itemKey: comparisonCellItemKey('r:1', 'c') }),
    'ambiguous-a',
  );
  assert.equal(
    findOverlayNode([colonDef], { pageId: 'Weird', slot: 'comparison', itemKey: comparisonCellItemKey('r', '1:c') }),
    'ambiguous-b',
  );
});

test('findOverlayNode resolves a comparison cell whose keys contain dots too (dots are also a reserved delimiter elsewhere in this module)', () => {
  const dotDef: SectionDef<string> = {
    id: 'Dotted',
    description: 'd',
    path: 'p.tsx',
    comparison: {
      rowLabel: 'Row',
      columnLabel: 'Column',
      rows: [{ key: 'row.one', label: 'Row one' }],
      columns: [{ key: 'col.one', label: 'Col one' }],
      cells: [{ rowKey: 'row.one', columnKey: 'col.one', node: 'dotted-cell' as unknown as never }],
    },
  };
  assert.equal(
    findOverlayNode([dotDef], { pageId: 'Dotted', slot: 'comparison', itemKey: comparisonCellItemKey('row.one', 'col.one') }),
    'dotted-cell',
  );
});

test('a comparison address round-trips through encode/decode even when comparisonCellItemKey embeds its own null-byte separator', () => {
  const address = { pageId: 'Sheet', slot: 'comparison' as const, itemKey: comparisonCellItemKey('r:1', 'c.2') };
  assert.deepEqual(decodeOverlayAddress(encodeOverlayAddress(address)), address);
});

test('isFiniteOverlaySize accepts only finite, strictly positive width and height', () => {
  assert.equal(isFiniteOverlaySize(280, 480), true);
  assert.equal(isFiniteOverlaySize(0, 480), false);
  assert.equal(isFiniteOverlaySize(280, 0), false);
  assert.equal(isFiniteOverlaySize(-1, 480), false);
  assert.equal(isFiniteOverlaySize(280, -1), false);
  assert.equal(isFiniteOverlaySize(NaN, 480), false);
  assert.equal(isFiniteOverlaySize(280, Infinity), false);
});

test('overlayStageDimensions makes width a maximum (fills and shrinks to the real owner) while height stays exact', () => {
  assert.deepEqual(overlayStageDimensions(280, 480), { width: '100%', maxWidth: 280, height: 480 });
  // A narrower real owner (240) is expressed by the owner's own width constraint, not by this
  // style — this style's job is only to stop declaring a fixed 280 that a 240px owner cannot
  // actually honor without clipping.
  assert.notEqual(overlayStageDimensions(280, 480).width, 280, 'width must not be a fixed pixel value — it must be allowed to shrink below the requested maximum');
});
