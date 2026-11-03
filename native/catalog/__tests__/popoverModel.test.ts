// Where a `Popover` goes: below its anchor, flipped above or shifted sideways to stay in the window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_SPACE } from '../tokens.ts';
import { POPOVER_EDGE, POPOVER_GAP, POPOVER_MAX_WIDTH, popoverPosition } from '../popoverModel.ts';

const box = (left: number, top: number, width = 50, height = 44) => ({ left, top, right: left + width, bottom: top + height });
const size = { width: 320, height: 200 };
const screen = { width: 1280, height: 800 };

test('opens below the anchor, left edges aligned, a small gap under it', () => {
  assert.deepEqual(popoverPosition(box(100, 100), size, screen), { left: 100, top: 100 + 44 + POPOVER_GAP, placement: 'below' });
});

test('flips above the anchor when below would run past the window and above fits', () => {
  const anchor = box(100, 700);
  assert.deepEqual(popoverPosition(anchor, size, screen), { left: 100, top: 700 - POPOVER_GAP - 200, placement: 'above' });
});

test('stays below when neither side fits (above would leave the window)', () => {
  const tall = { width: 320, height: 760 };
  assert.equal(popoverPosition(box(100, 400), tall, screen).placement, 'below');
});

test('shifts sideways to stay the edge inside the window, on both sides', () => {
  assert.equal(popoverPosition(box(1200, 100), size, screen).left, 1280 - POPOVER_EDGE - 320, 'near the right edge');
  assert.equal(popoverPosition(box(2, 100), size, screen).left, POPOVER_EDGE, 'near the left edge');
});

test('on a narrow window it never overflows: the left edge is the edge, the width is the window less both edges', () => {
  const narrow = { width: 320, height: 640 };
  const width = Math.min(POPOVER_MAX_WIDTH, narrow.width - 2 * POPOVER_EDGE);
  assert.equal(width, 296);
  const { left } = popoverPosition(box(260, 20), { width, height: 220 }, narrow);
  assert.ok(left >= POPOVER_EDGE && left + width <= narrow.width - POPOVER_EDGE, `left ${left} + ${width} stays inside ${narrow.width}`);
});

test('the popover is at most 320px wide, with a 12px edge and a 4px gap', () => {
  assert.deepEqual([POPOVER_MAX_WIDTH, POPOVER_EDGE, POPOVER_GAP], [320, 12, 4]);
  assert.equal(POPOVER_EDGE, CATALOG_SPACE.md, 'the edge is the md step');
  assert.equal(POPOVER_GAP, CATALOG_SPACE.xs, 'the gap is the xs step');
});

test('L7: on a window too short for it on either side, the panel is moved up to end the edge above the window\'s bottom', () => {
  const short = { width: 1280, height: 300 };
  const tall = { width: 320, height: short.height - 2 * POPOVER_EDGE }; // as tall as maxHeight lets it be
  const { top, placement } = popoverPosition(box(100, 20), tall, short);
  assert.equal(placement, 'below');
  assert.equal(top + tall.height, short.height - POPOVER_EDGE, 'its bottom edge is the edge above the window\'s bottom');
  assert.ok(top >= POPOVER_EDGE);
  assert.equal(popoverPosition(box(100, 20), size, screen).top, 64 + POPOVER_GAP, 'a panel that fits is not moved');
});
