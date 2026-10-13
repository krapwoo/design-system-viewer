import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeOverlayAddress, encodeOverlayAddress, findOverlayNode } from '../overlayViewport.ts';
import { DEVICE_FRAME, DEVICE_SCALE_WARN_BELOW, deviceFrameScale } from '../deviceFrame.ts';
import { FILLED_CONTENT_MAX_WIDTH, filledContentStyle, overflowsCell, paintedExtent, shouldCenterFilledContent, visibleBoxes, type LayoutBox } from '../specimenSurfaceStyle.ts';
import { COLUMN_MIN_WIDTH, gridMinWidth, listGeometry, presentationBlocks } from '../comparison.ts';
import type { SectionDef } from '../types.ts';

test('the device frame is a real phone viewport: iPhone SE, 375 × 667 points', () => {
  assert.deepEqual({ ...DEVICE_FRAME }, { name: 'iPhone SE', width: 375, height: 667 });
});

test('deviceFrameScale keeps the real 375-point layout and scales it down only to fit a narrower cell', () => {
  assert.equal(deviceFrameScale(402), 1);
  assert.equal(deviceFrameScale(375), 1);
  assert.equal(deviceFrameScale(300), 0.8);
  assert.equal(deviceFrameScale(0), 1, 'an unmeasured cell renders at full size rather than collapsing');
});

test('a page\'s render() preview is addressable, so a device frame inside it gets its own child document', () => {
  const address = { pageId: 'BottomSheet', slot: 'preview' as const, itemKey: 'preview' };
  assert.deepEqual(decodeOverlayAddress(encodeOverlayAddress(address)), address);
  const node = { marker: 'demo' };
  const sections = [{ id: 'BottomSheet', description: 'x', path: 'p', render: () => node }] as unknown as SectionDef<string>[];
  assert.equal(findOverlayNode(sections, address), node);
});

test('a filled example narrower than its cell (its own fixed width) is centred; one that fills the cell is left alone', () => {
  assert.equal(shouldCenterFilledContent(160, 370), true);
  assert.equal(shouldCenterFilledContent(370, 370), false);
  assert.equal(shouldCenterFilledContent(369.5, 370), false, 'sub-pixel rounding is not "narrower"');
  assert.equal(shouldCenterFilledContent(0, 370), false, 'nothing measured yet');
});

test('full-width (filled) examples wrap at most 3 across unless the page sets maxColumns itself', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, name: `K${i}`, node: null }));
  const base = { id: 'X', path: 'p', description: 'd', specimenSize: 'regular' as const };
  const [filled] = presentationBlocks({ ...base, states: { itemsFill: true, items } });
  assert.equal(filled.kind === 'list' && filled.maxColumns, 3);
  const [explicit] = presentationBlocks({ ...base, states: { itemsFill: true, maxColumns: 4, items } });
  assert.equal(explicit.kind === 'list' && explicit.maxColumns, 4);
  const [compact] = presentationBlocks({ ...base, specimenSize: 'compact', states: { items } });
  assert.equal(compact.kind === 'list' && 'maxColumns' in compact, false, 'small centred examples keep wrapping freely');
});

test('paintedExtent measures what is actually visible, not the full-width wrapper around it', () => {
  // A full-width tooltip wrapper (0–345) holding an 18-point trigger and a 120-point bubble.
  assert.equal(paintedExtent([{ left: 0, right: 345, painted: false }, { left: 0, right: 18, painted: true }, { left: -40, right: 80, painted: true }]), 120);
  assert.equal(paintedExtent([]), 0);
  // A visible element that spans the cell counts as full width (a real full-width example).
  assert.equal(paintedExtent([{ left: 0, right: 345, painted: true }]), 345);
});

test('overflowsCell flags an example wider than its cell, beyond rounding', () => {
  assert.equal(overflowsCell(171, 158), true);
  assert.equal(overflowsCell(158.6, 158), false);
  assert.equal(overflowsCell(0, 158), false);
});

test('visibleBoxes stops at a clipping or scrolling container: its own box counts, not the content it hides', () => {
  const tree: LayoutBox = {
    left: 0, right: 370, painted: false, clips: false, children: [
      // A horizontally scrolling row: 370 visible, 643 of content inside.
      { left: 0, right: 370, painted: false, clips: true, children: [{ left: 0, right: 643, painted: true, clips: false, children: [] }] },
    ],
  };
  assert.equal(paintedExtent(visibleBoxes(tree)), 370);
  assert.equal(overflowsCell(paintedExtent(visibleBoxes(tree)), 370), false);
});

test("a filled example (a field, a dropdown, a full-width button) is at most a phone's content width, centred, however wide its cell", () => {
  assert.equal(FILLED_CONTENT_MAX_WIDTH, 370);
  assert.deepEqual(filledContentStyle(), { width: '100%', maxWidth: 370, alignSelf: 'center' });
});

test("specimenSize 'page' is for components wider than a phone: cells at least 512px, sharing the row", () => {
  assert.equal(COLUMN_MIN_WIDTH.page, 512);
  // A 1280px laptop (952px content): 4 states → one per row, full width.
  assert.deepEqual(listGeometry(4, 952, 'page'), { columns: 1, rows: 4, fillers: 0, cellWidth: 950, containerWidth: 952 });
  // A 1728px window (~1200px content): 2 across, sharing the row equally.
  assert.deepEqual(listGeometry(4, 1200, 'page'), { columns: 2, rows: 2, fillers: 0, cellWidth: 599, containerWidth: 1200 });
  // Every size shares the container: phone width caps the specimen inside a cell, not the cell.
  assert.equal(listGeometry(2, 1200, 'regular').cellWidth, 599);
  assert.equal(listGeometry(2, 1200, 'regular').containerWidth, 1200);
  // A grid's columns always share the container; only its minimum depends on the size.
  assert.equal(gridMinWidth(2, 'page'), 120 + 2 * 512);
  assert.equal(gridMinWidth(2, 'regular'), 120 + 2 * 240);
});

test("'page' examples fill their cell by default, without the phone-width cap", () => {
  const items = [{ key: 'a', name: 'A', node: null }, { key: 'b', name: 'B', node: null, fill: false }];
  const [block] = presentationBlocks({ id: 'X', path: 'p', description: 'd', specimenSize: 'page', variants: { items } });
  assert.deepEqual(block.kind === 'list' && block.items.map((i) => i.fill), [true, false], 'an explicit fill: false still wins');
  assert.deepEqual(filledContentStyle(false), { width: '100%', alignSelf: 'center' });
  assert.deepEqual(filledContentStyle(), { width: '100%', maxWidth: 370, alignSelf: 'center' });
});

test('the device-scale warning threshold ignores rounding but catches a squeezed phone', () => {
  // A regular cell leaves 370px for a 375px device. Warning about a 1.3% reduction nobody can see
  // would train an author to ignore the warning.
  assert.ok(deviceFrameScale(370) >= DEVICE_SCALE_WARN_BELOW, 'a regular cell must not warn');
  assert.ok(deviceFrameScale(DEVICE_FRAME.width) >= DEVICE_SCALE_WARN_BELOW, 'an exact fit must not warn');

  // The real cases this exists for: a side-by-side block leaves ~283px, rendering the phone at 75%
  // — the difference between readable body text and not.
  assert.ok(deviceFrameScale(283) < DEVICE_SCALE_WARN_BELOW, '283px must warn');
  assert.ok(deviceFrameScale(220) < DEVICE_SCALE_WARN_BELOW, 'a deliberately narrow 220px cell must warn unless exempted');
  assert.equal(Math.round(deviceFrameScale(283) * 100), 75);
});
