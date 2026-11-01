import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryMaxColumns, inventoryStageSurface, inventoryTargetId, readableName, INVENTORY_MAX_COLUMNS } from '../inventoryModel.ts';

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
