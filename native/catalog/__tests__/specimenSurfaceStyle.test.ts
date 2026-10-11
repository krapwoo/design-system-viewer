import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SPECIMEN_SURFACE,
  SPECIMEN_CONTENT_CENTER_STYLE,
  SPECIMEN_CONTENT_FILL_STYLE,
  SPECIMEN_SURFACE_WIDTH_STYLE,
  specimenContentAlignItems,
  specimenContentBoundedStyle,
  specimenContentJustifyContent,
} from '../specimenSurfaceStyle.ts';

test('the example wrapper stretches to the cell width instead of shrink-wrapping to its content', () => {
  assert.equal(SPECIMEN_SURFACE_WIDTH_STYLE.alignSelf, 'stretch');
});

test('a non-fill specimen centers its content by default, unchanged', () => {
  assert.equal(SPECIMEN_CONTENT_CENTER_STYLE.alignItems, 'center');
  assert.equal(SPECIMEN_CONTENT_CENTER_STYLE.alignSelf, 'stretch');
});

test('a fill specimen stretches its content by default instead of centering it, so an auto-sized full-width child (e.g. NextTrainInfo\'s row) keeps its own measured width instead of collapsing to its intrinsic content size', () => {
  assert.equal(SPECIMEN_CONTENT_FILL_STYLE.alignItems, 'stretch');
  assert.equal(SPECIMEN_CONTENT_FILL_STYLE.alignSelf, 'stretch');
  assert.notEqual(SPECIMEN_CONTENT_FILL_STYLE.alignItems, SPECIMEN_CONTENT_CENTER_STYLE.alignItems, 'fill and non-fill specimens must not share the same alignItems — this was the regressed bug');
});

test('specimenContentAlignItems resolves the established default from fill alone when align is omitted', () => {
  assert.equal(specimenContentAlignItems(undefined, undefined), 'center');
  assert.equal(specimenContentAlignItems(false, undefined), 'center');
  assert.equal(specimenContentAlignItems(true, undefined), 'stretch');
});

test('specimenContentAlignItems lets an explicit align override fill either way — e.g. a capped-width fill specimen (PhoneFrame) that still wants its wrapper centered', () => {
  assert.equal(specimenContentAlignItems(true, 'center'), 'center');
  assert.equal(specimenContentAlignItems(false, 'center'), 'center');
  assert.equal(specimenContentAlignItems(true, 'start'), 'flex-start');
  assert.equal(specimenContentAlignItems(false, 'end'), 'flex-end');
});

test('cells fill automatically by default: only an example that would vanish on white gets a gray cell', () => {
  assert.equal(DEFAULT_SPECIMEN_SURFACE, 'auto');
});

// Controller-reproduced: all 20 Badge grid roots leaned left because their own alignSelf:
// 'flex-start' overrides a column wrapper's alignItems:'center' — alignItems only sets a child's
// *default* alignSelf, which an explicit alignSelf on the specimen's own root overrides outright.
// A row main axis fixes this: justifyContent decides horizontal placement directly and cannot be
// overridden by a child's alignSelf, which only ever targets the cross axis (vertical, here).
test('specimenContentJustifyContent maps align to the row main-axis position a specimen\'s own alignSelf cannot override, defaulting to center', () => {
  assert.equal(specimenContentJustifyContent(undefined), 'center');
  assert.equal(specimenContentJustifyContent('start'), 'flex-start');
  assert.equal(specimenContentJustifyContent('center'), 'center');
  assert.equal(specimenContentJustifyContent('end'), 'flex-end');
});

test('specimenContentBoundedStyle keeps the wrapper full-width and row-based, so justifyContent — not alignItems — decides horizontal placement regardless of the specimen\'s own alignSelf', () => {
  const centered = specimenContentBoundedStyle(undefined);
  assert.equal(centered.alignSelf, 'stretch', 'wrapper stays full width, so a percentage-width child still resolves against it');
  assert.equal(centered.flexDirection, 'row');
  assert.equal(centered.justifyContent, 'center');
  assert.equal(centered.alignItems, 'center', 'vertical cross-axis stays centered');

  assert.equal(specimenContentBoundedStyle('start').justifyContent, 'flex-start');
  assert.equal(specimenContentBoundedStyle('end').justifyContent, 'flex-end');
});
