import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inventoryChips, inventoryGroupName, inventoryMaxColumns, inventoryShownCount, inventoryStageSurface, inventoryTargetId, inventoryTileShown,
  readableName, sameInventoryFilter, inventoryStatusVisible, inventoryGrid, INVENTORY_ALL, INVENTORY_MAX_COLUMNS, INVENTORY_MIN_TILE_WIDTH,
  INVENTORY_FIXED_MIN_TILE_WIDTH, INVENTORY_FIXED_MAX_COLUMNS,
} from '../inventoryModel.ts';

test('three or five tiles lay out three across; every other count may use all four', () => {
  assert.equal(INVENTORY_MAX_COLUMNS, 4);
  assert.equal(inventoryMaxColumns(3), 3);
  assert.equal(inventoryMaxColumns(5), 3);
  for (const count of [1, 2, 4, 6, 7, 8, 9, 10, 11]) assert.equal(inventoryMaxColumns(count), 4, `${count} tiles`);
});

test('a smaller maximum is never raised by the odd-count rule', () => {
  assert.equal(inventoryMaxColumns(5, 2), 2);
  assert.equal(inventoryMaxColumns(3, 2), 2);
  assert.equal(inventoryMaxColumns(6, 3), 3);
});

test('a target may be written with a leading #', () => {
  assert.equal(inventoryTargetId('#PrimaryButton'), 'PrimaryButton');
  assert.equal(inventoryTargetId('PrimaryButton'), 'PrimaryButton');
});

test('readableName splits camel case into sentence case', () => {
  assert.equal(readableName('ChatTactileButtonStyle'), 'Chat tactile button style');
  assert.equal(readableName('primaryButton'), 'Primary button');
  assert.equal(readableName('Button'), 'Button');
  assert.equal(readableName('HTTPClientView'), 'HTTP client view');
  assert.equal(readableName('Icon24Filled'), 'Icon24 filled');
  assert.equal(readableName('toolbar_item-label'), 'Toolbar item label');
  assert.equal(readableName(''), '');
});

test('every inventory tile sits on the same grey stage: auto means the stage, an explicit surface is kept', () => {
  assert.equal(inventoryStageSurface('auto'), 'neutral');
  for (const surface of ['neutral', 'white', 'dark', 'transparent'] as const) assert.equal(inventoryStageSurface(surface), surface);
});

const SHAPE = [
  { title: 'Shared styles', tiles: [{ tags: ['Draws its own shape'] }, { tags: ['Draws its own shape', 'Legacy'] }, {}] },
  { title: 'Empty', tiles: [] },
  { title: 'Own styles', tiles: [{ tags: ['Draws its own shape'] }] },
];

test('chips are All, each non-empty group, then each tag in first-seen order, counted from the same tiles', () => {
  assert.deepEqual(inventoryChips(SHAPE).map((c) => [c.key, c.label, c.count]), [
    ['all', 'All', 4], ['group:Shared styles', 'Shared styles', 3], ['group:Own styles', 'Own styles', 1],
    ['tag:Draws its own shape', 'Draws its own shape', 3], ['tag:Legacy', 'Legacy', 1],
  ]);
});

test('a chip\'s count is exactly how many tiles its filter leaves showing', () => {
  for (const chip of inventoryChips(SHAPE)) assert.equal(inventoryShownCount(chip.filter, SHAPE), chip.count, chip.label);
});

test('a tag listed twice on one tile counts that tile once; a group and a tag of the same name are different chips', () => {
  const chips = inventoryChips([{ title: 'Legacy', tiles: [{ tags: ['Legacy', 'Legacy'] }] }]);
  assert.deepEqual(chips.map((c) => [c.key, c.count]), [['all', 1], ['group:Legacy', 1], ['tag:Legacy', 1]]);
});

test('groups sharing a title are one chip with their tiles added, and a tag named like a group is labelled as a tag', () => {
  const chips = inventoryChips([{ title: 'Legacy', tiles: [{ tags: ['Legacy'] }, {}] }, { title: 'Legacy', tiles: [{}] }, { title: 'New', tiles: [{}] }]);
  assert.deepEqual(chips.map((c) => [c.key, c.label, c.count]), [
    ['all', 'All', 4], ['group:Legacy', 'Legacy', 3], ['group:New', 'New', 1], ['tag:Legacy', 'Legacy (tag)', 1],
  ]);
  assert.equal(new Set(chips.map((c) => c.key)).size, chips.length, 'keys are unique');
});

test('a tile is shown by All, by its own group, and by a tag it carries, and by nothing else', () => {
  assert.equal(inventoryTileShown(INVENTORY_ALL, 'A', undefined), true);
  assert.equal(inventoryTileShown({ kind: 'group', title: 'A' }, 'A', undefined), true);
  assert.equal(inventoryTileShown({ kind: 'group', title: 'A' }, 'B', ['x']), false);
  assert.equal(inventoryTileShown({ kind: 'tag', tag: 'x' }, 'B', ['x', 'y']), true);
  assert.equal(inventoryTileShown({ kind: 'tag', tag: 'x' }, 'B', undefined), false);
  assert.equal(sameInventoryFilter({ kind: 'tag', tag: 'x' }, { kind: 'tag', tag: 'x' }), true);
  assert.equal(sameInventoryFilter({ kind: 'tag', tag: 'x' }, { kind: 'group', title: 'x' }), false);
});

test('a group names itself with its count, or "shown of total" while a filter hides some', () => {
  assert.equal(inventoryGroupName('Shared styles', 12, 12), 'Shared styles · 12');
  assert.equal(inventoryGroupName('Shared styles', 3, 12), 'Shared styles · 3 of 12');
});

test('the "Showing N of M" line is drawn only while a filter narrows the list', () => {
  assert.equal(inventoryStatusVisible(INVENTORY_ALL), false, 'under All it says nothing worth reading');
  assert.equal(inventoryStatusVisible({ kind: 'group', title: 'Capsules' } as never), true);
});

test('a group of only fixed-size tiles gets narrower tiles and more columns; one full-width tile keeps the default grid', () => {
  const standard = { minTileWidth: INVENTORY_MIN_TILE_WIDTH, maxColumns: INVENTORY_MAX_COLUMNS };
  assert.deepEqual(inventoryGrid([], 8), standard);
  assert.deepEqual(inventoryGrid([undefined, undefined], 8), standard);
  assert.deepEqual(inventoryGrid([true, undefined, true], 8), standard, 'one tile that is not fixed-size');
  assert.deepEqual(inventoryGrid([true, false], 8), standard);
  assert.deepEqual(inventoryGrid([true, true], 8), { minTileWidth: INVENTORY_FIXED_MIN_TILE_WIDTH, maxColumns: INVENTORY_FIXED_MAX_COLUMNS });
});

test('fixed-size tiles that give their size are as wide as the widest plus its inset, between the compact and the default width', () => {
  assert.equal(inventoryGrid([40, 24], 8).minTileWidth, INVENTORY_FIXED_MIN_TILE_WIDTH, 'small ones use the compact width');
  assert.equal(inventoryGrid([200, 24, true], 8).minTileWidth, 216, 'the widest decides');
  assert.equal(inventoryGrid([500], 8).minTileWidth, INVENTORY_MIN_TILE_WIDTH, 'never wider than a default tile');
  assert.equal(inventoryMaxColumns(5, INVENTORY_FIXED_MAX_COLUMNS), 3, 'the odd-count rule still holds');
  assert.equal(inventoryMaxColumns(6, INVENTORY_FIXED_MAX_COLUMNS), 6);
});
