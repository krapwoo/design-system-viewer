import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionColumns, tileGeometry, TOKEN_SECTION_MIN_WIDTH, TOKEN_LAYOUT_GAP } from '../tokenLayout.ts';

test('sectionColumns: honours the requested count when every column keeps its minimum width', () => {
  // 952px laptop content width: three 300px+ columns fit.
  assert.equal(sectionColumns(952, 3), 3);
  assert.equal(sectionColumns(952, 2), 2);
  assert.equal(sectionColumns(952, 1), 1);
});

test('sectionColumns: drops columns on a narrower area instead of squeezing sections', () => {
  const twoFit = TOKEN_SECTION_MIN_WIDTH * 2 + TOKEN_LAYOUT_GAP;
  assert.equal(sectionColumns(twoFit, 3), 2);
  assert.equal(sectionColumns(twoFit - 1, 3), 1);
  assert.equal(sectionColumns(0, 3), 1);
});

test('tileGeometry: as many equal tiles per row as keep the minimum width, filling the row exactly', () => {
  const { columns, tileWidth } = tileGeometry(952, 140);
  assert.equal(columns, 6);
  assert.equal(Math.round(tileWidth * columns + TOKEN_LAYOUT_GAP * (columns - 1)), 952);
  assert.deepEqual(tileGeometry(100, 140), { columns: 1, tileWidth: 100 });
  assert.equal(tileGeometry(952, 140, 4).columns, 4); // a maximum caps the count
});
