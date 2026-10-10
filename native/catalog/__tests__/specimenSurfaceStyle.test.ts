import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SPECIMEN_SURFACE, SPECIMEN_SURFACE_WIDTH_STYLE } from '../specimenSurfaceStyle.ts';

test('the example wrapper stretches to the cell width instead of shrink-wrapping to its content', () => {
  assert.equal(SPECIMEN_SURFACE_WIDTH_STYLE.alignSelf, 'stretch');
});

test('cells fill automatically by default: only an example that would vanish on white gets a gray cell', () => {
  assert.equal(DEFAULT_SPECIMEN_SURFACE, 'auto');
});
