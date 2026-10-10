import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SPECIMEN_SURFACE, SPECIMEN_SURFACE_WIDTH_STYLE, specimenSurfaceHasInset } from '../specimenSurfaceStyle.ts';

test('SpecimenSurface stretches to its parent width instead of shrink-wrapping to its content', () => {
  assert.equal(SPECIMEN_SURFACE_WIDTH_STYLE.alignSelf, 'stretch');
});

test('no backdrop by default: a page opts in to a stage with specimenSurface', () => {
  assert.equal(DEFAULT_SPECIMEN_SURFACE, 'transparent');
});

test('a transparent surface adds no inset of its own, so the example sits exactly as it did before surfaces existed', () => {
  assert.equal(specimenSurfaceHasInset('transparent'), false);
  for (const kind of ['neutral', 'white', 'dark'] as const) assert.equal(specimenSurfaceHasInset(kind), true, kind);
});
