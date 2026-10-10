import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIMEN_SURFACE_WIDTH_STYLE } from '../specimenSurfaceStyle.ts';

test('SpecimenSurface stretches to its parent width instead of shrink-wrapping to its content', () => {
  assert.equal(SPECIMEN_SURFACE_WIDTH_STYLE.alignSelf, 'stretch');
});
