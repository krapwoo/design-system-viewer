import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SPECIMEN_SURFACE,
  SPECIMEN_CONTENT_CENTER_STYLE,
  SPECIMEN_CONTENT_FILL_STYLE,
  SPECIMEN_SURFACE_WIDTH_STYLE,
  specimenContentAlignItems,
  specimenContentBoundedStyle,
  specimenContentJustifyContent,
  shouldCenterFilledContent,
} from '../specimenSurfaceStyle.ts';

test('narrow paint inside a full-width fluid root does not collapse a filled specimen', () => {
  assert.equal(shouldCenterFilledContent(213, 370, 370), false);
  assert.equal(shouldCenterFilledContent(160, 370, 160), true, 'a genuinely narrow fixed-width root still centers');
  assert.equal(shouldCenterFilledContent(213, 370, 369.5), false, 'layout rounding must not collapse a fluid root');
  assert.equal(shouldCenterFilledContent(160, 370, 0), false, 'unmeasured roots do not opt into centering');
});

test('SpecimenContent supplies the root layout width to automatic centering', () => {
  const source = readFileSync(new URL('../SpecimenSurface.tsx', import.meta.url), 'utf8');
  assert.match(source, /const rootWidth = Math\.max\(0, \.\.\.tree\.children\.map\(\(child\) => child\.right - child\.left\)\);/);
  assert.match(source, /shouldCenterFilledContent\(visible, wrapperWidth, rootWidth\)/);
});

test('automatic centering never overrides a later explicit alignment or uncapped layout', () => {
  const source = readFileSync(new URL('../SpecimenSurface.tsx', import.meta.url), 'utf8');
  assert.match(source, /const alignItems = capped && align === undefined && centerNarrow \? 'center' : specimenContentAlignItems\(fill, align\);/);
  assert.match(source, /useEffect\(\(\) => \{\s*setCenterNarrow\(false\);\s*\}, \[fill, capped, align\]\);/);
});

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
