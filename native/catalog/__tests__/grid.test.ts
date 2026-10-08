import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisItems, axisProp, grid, remainingStates, validateComparison } from '../comparison.ts';

const ROWS = [{ key: 'primary', label: 'Primary' }, { key: 'ghost', label: 'Ghost' }];
const COLUMNS = [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }];

test('grid() with plain arrays builds every row × column cell from cell()', () => {
  const def = grid('Variant', 'State', ROWS, COLUMNS, (row, column) => `${row}/${column}`);
  assert.equal(def.rowLabel, 'Variant');
  assert.equal(def.columnLabel, 'State');
  assert.deepEqual(def.rows, ROWS);
  assert.deepEqual(def.columns, COLUMNS);
  assert.deepEqual(def.cells, [
    { rowKey: 'primary', columnKey: 'default', node: 'primary/default' },
    { rowKey: 'primary', columnKey: 'disabled', node: 'primary/disabled' },
    { rowKey: 'ghost', columnKey: 'default', node: 'ghost/default' },
    { rowKey: 'ghost', columnKey: 'disabled', node: 'ghost/disabled' },
  ]);
  assert.equal(def.size, undefined);
});

test('grid() with a bound rows axis still builds every cell, from the bound axis\'s own items', () => {
  const boundRows = { prop: 'variant', items: ROWS };
  const def = grid('Variant', 'State', boundRows, COLUMNS, (row, column) => `${row}/${column}`, 'compact');
  assert.deepEqual(def.rows, boundRows);
  assert.equal(def.cells.length, 4);
  assert.deepEqual(def.cells[0], { rowKey: 'primary', columnKey: 'default', node: 'primary/default' });
  assert.equal(def.size, 'compact');
});

test('axisItems returns a plain array unchanged, and a bound axis\'s own items', () => {
  assert.deepEqual(axisItems(ROWS), ROWS);
  assert.deepEqual(axisItems({ prop: 'variant', items: ROWS }), ROWS);
});

test('axisProp is undefined for a plain array and the prop name for a bound axis', () => {
  assert.equal(axisProp(ROWS), undefined);
  assert.equal(axisProp({ prop: 'variant', items: ROWS }), 'variant');
});

test('validateComparison still finds a duplicate row key when the row axis is bound', () => {
  const def = {
    rowLabel: 'Variant',
    columnLabel: 'State',
    rows: { prop: 'variant', items: [{ key: 'primary', label: 'Primary' }, { key: 'primary', label: 'Primary again' }] },
    columns: COLUMNS,
    cells: [],
  };
  const issues = validateComparison(def);
  assert.ok(issues.includes('Duplicate row key "primary".'));
});

test('validateComparison still applies the column-limit check when the column axis is bound', () => {
  const sixColumns = Array.from({ length: 6 }, (_, i) => ({ key: `c${i}`, label: `C${i}` }));
  const def = {
    rowLabel: 'Variant',
    columnLabel: 'Size',
    rows: ROWS,
    columns: { prop: 'size', items: sixColumns },
    cells: [],
    size: 'regular' as const,
  };
  const issues = validateComparison(def);
  assert.ok(issues.some((issue) => issue.includes('6 columns; at most 3 regular columns fit')));
});

test('remainingStates filters by key even when comparison.rows/columns are bound axes (not plain arrays)', () => {
  // Today's `remainingStates` reads `comparison.rows.map(...)`/`.columns.map(...)` directly — the
  // one caller `validateComparison`'s own fix (Step 4 below) doesn't touch, since it lives in a
  // different function. Once `rows`/`columns` can be `{ prop, items }`, that `.map` throws
  // "rows.map is not a function" for any page with both a bound grid and a states list — exactly
  // Button/Badge/Pill/Avatar after Task 2's migration (every one of them has both).
  const comparison = {
    rowLabel: 'Variant', columnLabel: 'State',
    rows: { prop: 'variant', items: ROWS }, columns: COLUMNS, cells: [],
  };
  const states = { items: [{ key: 'primary', label: 'Primary', node: null }, { key: 'extra', label: 'Extra', node: null }] };
  const result = remainingStates(states, comparison);
  assert.deepEqual(result?.items.map((i) => i.key), ['extra']);
});
