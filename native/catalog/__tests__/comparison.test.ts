import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMN_MIN_WIDTH,
  MATRIX_LAYOUT,
  cellKey,
  gridColumnLimit,
  gridWidthBounds,
  indexCells,
  listGeometry,
  presentationBlocks,
  remainingStates,
  validateComparison,
} from '../comparison.ts';
import { CATALOG_SPACE } from '../tokens.ts';

const valid = {
  rowLabel: 'Variant',
  columnLabel: 'State',
  rows: [{ key: 'primary', label: 'Primary' }, { key: 'ghost', label: 'Ghost' }],
  columns: [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
  cells: [
    { rowKey: 'primary', columnKey: 'default', node: 'P' },
    { rowKey: 'primary', columnKey: 'disabled', node: 'P-d' },
    { rowKey: 'ghost', columnKey: 'default', node: 'G' },
    { rowKey: 'ghost', columnKey: 'disabled', unavailableReason: 'Ghost has no disabled look' },
  ],
};

test('layout constants match the approved design', () => {
  assert.equal(MATRIX_LAYOUT.columnMaxWidth, 402);
  assert.equal(MATRIX_LAYOUT.rowHeaderWidth, 120);
  assert.equal(MATRIX_LAYOUT.rowMinHeight, 150);
  assert.equal(MATRIX_LAYOUT.cellPadding, 16);
  assert.equal(MATRIX_LAYOUT.cellPadding, CATALOG_SPACE.lg);
  assert.equal(MATRIX_LAYOUT.laptopContentWidth, 1280 - 264 - 2 * 32);
  assert.deepEqual(COLUMN_MIN_WIDTH, { compact: 160, regular: 240, wide: 402 });
});

test('gridColumnLimit derives how many columns fit a 1280px laptop', () => {
  assert.equal(gridColumnLimit('compact'), 5);
  assert.equal(gridColumnLimit('regular'), 3);
  assert.equal(gridColumnLimit('wide'), 2);
});

test('gridWidthBounds depends on column count and specimen size', () => {
  assert.deepEqual(gridWidthBounds(3, 'regular'), { minWidth: 840, maxWidth: 1326 });
  assert.deepEqual(gridWidthBounds(4, 'compact'), { minWidth: 760, maxWidth: 1728 });
});

test('listGeometry balances rows inside one card', () => {
  // Button "Other configurations": 6 regular items on a 1280px laptop -> 3 × 2, no blanks.
  assert.deepEqual(listGeometry(6, 952, 'regular'), { columns: 3, rows: 2, fillers: 0, cellWidth: 316, containerWidth: 950 });
  // Switch states: 4 compact items -> one row.
  assert.deepEqual(listGeometry(4, 952, 'compact'), { columns: 4, rows: 1, fillers: 0, cellWidth: 237, containerWidth: 950 });
  // Banner variants: 5 wide items -> 2 phone-width columns, 3 rows, one blank.
  assert.deepEqual(listGeometry(5, 952, 'wide'), { columns: 2, rows: 3, fillers: 1, cellWidth: 402, containerWidth: 806 });
  // Never wider than 402 per cell, even with room to spare.
  assert.deepEqual(listGeometry(2, 1600, 'compact'), { columns: 2, rows: 1, fillers: 0, cellWidth: 402, containerWidth: 806 });
  // Narrow container falls back to one column, never below the size minimum.
  assert.deepEqual(listGeometry(3, 200, 'regular'), { columns: 1, rows: 3, fillers: 0, cellWidth: 240, containerWidth: 242 });
  assert.deepEqual(listGeometry(0, 952, 'regular'), { columns: 0, rows: 0, fillers: 0, cellWidth: 0, containerWidth: 0 });
});

test('a complete comparison validates cleanly and indexes every cell', () => {
  assert.deepEqual(validateComparison(valid), []);
  const index = indexCells(valid);
  assert.equal(index.size, 4);
  assert.equal(index.get(cellKey('ghost', 'default'))?.node, 'G');
});

test('validateComparison reports structural and fit problems', () => {
  assert.deepEqual(validateComparison({ ...valid, rows: [], cells: [] }), [
    'Comparison needs at least one row and one column.',
  ]);
  const wide = {
    ...valid,
    size: 'wide',
    columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }],
    cells: ['primary', 'ghost'].flatMap((r) => ['a', 'b', 'c'].map((c) => ({ rowKey: r, columnKey: c, node: 'x' }))),
  };
  assert.deepEqual(validateComparison(wide), [
    'Grid has 3 columns; at most 2 wide columns fit a 1280px laptop. Swap the axes or use two lists.',
  ]);
  const broken = {
    ...valid,
    rows: [...valid.rows, { key: 'primary', label: 'Dup' }],
    cells: [
      { rowKey: 'primary', columnKey: 'default', node: 'P' },
      { rowKey: 'primary', columnKey: 'default', node: 'P again' },
      { rowKey: 'nope', columnKey: 'default', node: 'X' },
      { rowKey: 'ghost', columnKey: 'nope', node: 'X' },
      { rowKey: 'ghost', columnKey: 'default', node: 'G', unavailableReason: 'both' },
      { rowKey: 'ghost', columnKey: 'disabled' },
    ],
  };
  assert.deepEqual(validateComparison(broken), [
    'Duplicate row key "primary".',
    'Duplicate cell for row "primary" and column "default".',
    'Cell references undeclared row "nope".',
    'Cell references undeclared column "nope".',
    'Cell for row "ghost" and column "default" must provide exactly one of node or unavailableReason.',
    'Cell for row "ghost" and column "disabled" must provide exactly one of node or unavailableReason.',
    'Missing cell for row "primary" and column "disabled".',
  ]);
});

test('remainingStates drops states already shown as grid rows or columns', () => {
  const states = { items: [{ key: 'disabled', name: 'Disabled', node: 'd' }, { key: 'icon-only', name: 'Icon-only', node: 'i' }] };
  assert.equal(remainingStates(undefined, valid), undefined);
  assert.equal(remainingStates(states, undefined), states);
  assert.deepEqual(remainingStates(states, valid)?.items.map((item) => item.key), ['icon-only']);
  assert.equal(remainingStates({ items: [states.items[0]] }, valid), undefined);
});

test('presentationBlocks plans grid, list, preview, and empty blocks', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = { items: [{ key: 'a', name: 'A', node: 'a' }] };
  const wideVariants = { itemsFill: true, items: [{ key: 'a', name: 'A', node: 'a' }] };
  const states = { items: [{ key: 'disabled', name: 'Disabled', node: 'd' }, { key: 'icon', name: 'Icon', node: 'i', fill: true }] };
  const render = () => 'r';
  const summary = (def) => presentationBlocks(def).map((b) => [b.kind, b.title, b.size ?? null]);

  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, render }), [{ kind: 'preview', title: 'Tokens' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, fullWidthLabel: 'Palette', render }), [{ kind: 'preview', title: 'Palette' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true }), [{ kind: 'empty', title: 'Tokens', message: 'Nothing to preview.' }]);

  assert.deepEqual(summary({ ...base, variants, states, comparison: valid }), [
    ['grid', 'Variant × State', 'regular'],
    ['list', 'Other configurations', 'regular'],
  ]);
  assert.deepEqual(summary({ ...base, specimenSize: 'compact', comparison: valid }), [['grid', 'Variant × State', 'compact']]);
  assert.deepEqual(summary({ ...base, comparison: { ...valid, size: 'wide' }, specimenSize: 'compact' }), [['grid', 'Variant × State', 'wide']]);
  assert.deepEqual(summary({ ...base, variants }), [
    ['list', 'Variants', 'regular'],
    ['empty', 'States / configurations', null],
  ]);
  assert.deepEqual(summary({ ...base, variants: wideVariants, states }), [
    ['list', 'Variants', 'wide'],
    ['list', 'States / configurations', 'regular'],
  ]);
  assert.deepEqual(summary({ ...base, variants, specimenSize: 'compact' }).slice(0, 1), [['list', 'Variants', 'compact']]);
  assert.deepEqual(summary({ ...base, render }), [
    ['preview', 'Preview', null],
    ['empty', 'States / configurations', null],
  ]);
  assert.deepEqual(presentationBlocks(base), [
    { kind: 'empty', title: 'Variants', message: 'No variants documented.' },
    { kind: 'empty', title: 'States / configurations', message: 'No additional states or configurations documented.' },
  ]);
  assert.deepEqual(summary({ ...base, render, hide: { states: true } }), [['preview', 'Preview', null]]);
  assert.deepEqual(summary({ ...base, variants, states, hide: { variants: true } }), [['list', 'States / configurations', 'regular']]);
  assert.deepEqual(summary({ ...base, comparison: valid, states: { items: [states.items[0]] } }), [['grid', 'Variant × State', 'regular']]);

  const list = presentationBlocks({ ...base, variants: wideVariants })[0];
  assert.deepEqual(list.items, [{ key: 'a', label: 'A', node: 'a', fill: true }]);
});
