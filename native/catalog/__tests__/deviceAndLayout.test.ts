import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeOverlayAddress, encodeOverlayAddress, findOverlayNode } from '../overlayViewport.ts';
import { DEVICE_FRAME, deviceFrameScale } from '../deviceFrame.ts';
import { overflowsCell, paintedExtent, shouldCenterFilledContent, visibleBoxes, type LayoutBox } from '../specimenSurfaceStyle.ts';
import { presentationBlocks } from '../comparison.ts';
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
