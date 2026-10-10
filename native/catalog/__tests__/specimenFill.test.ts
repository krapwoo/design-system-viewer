import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendsIntoCell, contrastWithWhite, parseCssColor, type PaintedBox } from '../specimenFill.ts';

const white = { r: 255, g: 255, b: 255, a: 1 };
const box = (area: number, background: PaintedBox['background'], border: PaintedBox['border'] = null): PaintedBox => ({ area, background, border });

test('parseCssColor reads computed rgb()/rgba() and treats transparent as no colour', () => {
  assert.deepEqual(parseCssColor('rgb(255, 255, 255)'), white);
  assert.deepEqual(parseCssColor('rgba(0, 0, 0, 0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.equal(parseCssColor('rgba(0, 0, 0, 0)'), null);
  assert.equal(parseCssColor('transparent'), null);
  assert.equal(parseCssColor(''), null);
});

test('contrastWithWhite composites a translucent colour over the white cell first', () => {
  assert.equal(contrastWithWhite(white), 1);
  assert.ok(Math.abs(contrastWithWhite({ r: 0, g: 0, b: 0, a: 1 }) - 21) < 0.01);
  assert.ok(contrastWithWhite({ r: 0, g: 0, b: 0, a: 0.02 }) < 1.06);
});

test('a white card or neutral banner blends into the cell, even with a soft shadow (shadows are not edges)', () => {
  assert.equal(blendsIntoCell([box(30000, white)], 60000), true);
  assert.equal(blendsIntoCell([box(30000, { r: 250, g: 250, b: 250, a: 1 })], 60000), true);
});

test('a visible border, a coloured fill, or a light-gray tone keeps the cell white', () => {
  assert.equal(blendsIntoCell([box(30000, white, { r: 228, g: 228, b: 228, a: 1 })], 60000), false, '#e4e4e4 border');
  assert.equal(blendsIntoCell([box(30000, { r: 232, g: 244, b: 253, a: 1 })], 60000), false, 'info banner tint');
  // Pale tints are colour, not white, even when they're as bright as white (a positive banner's green).
  assert.equal(blendsIntoCell([box(30000, { r: 240, g: 255, b: 244, a: 1 })], 60000), false, 'positive banner tint (measured)');
  assert.equal(blendsIntoCell([box(30000, { r: 255, g: 245, b: 245, a: 1 })], 60000), false, 'negative banner tint (measured)');
  assert.equal(blendsIntoCell([box(30000, { r: 244, g: 244, b: 244, a: 1 })], 60000), false, '#f4f4f4 already shows');
  assert.equal(blendsIntoCell([box(30000, { r: 0, g: 0, b: 0, a: 1 })], 60000), false);
});

test('only the largest painted box decides, and small or absent boxes never turn a cell gray', () => {
  // A white button inside a large black frame (a "White" variant shown on a dark backdrop).
  assert.equal(blendsIntoCell([box(40000, { r: 0, g: 0, b: 0, a: 1 }), box(8000, white)], 60000), false);
  // Text-only examples (a tertiary button, a divider line) paint nothing big enough.
  assert.equal(blendsIntoCell([], 60000), false);
  assert.equal(blendsIntoCell([box(400, white)], 60000), false);
});
