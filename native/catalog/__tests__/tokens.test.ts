import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_TYPE, CATALOG_TYPE_USE } from '../tokens.ts';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('colors match the approved visual system', () => {
  assert.deepEqual(
    { ...CATALOG_COLOR },
    {
      text: '#181818',
      textMuted: '#666666',
      border: '#e4e4e4',
      borderHairline: '#dddddd',
      borderStrong: '#d7d7d7',
      borderSubtle: '#eeeeee',
      surface: '#ffffff',
      surfaceMuted: '#fafafa',
      surfacePressed: '#f1f3f8',
      pageBackground: '#f6f6f4',
      chip: '#eeeeee',
      accent: '#174dc6',
      accentSubtle: '#e9efff',
      focusRing: '#c9d7ff',
      code: 'Menlo',
    },
  );
});

test('type, radius, and layout values match the approved references', () => {
  assert.equal(CATALOG_TYPE.xs, 10);
  assert.equal(CATALOG_TYPE.tableHeader, 11);
  assert.equal(CATALOG_TYPE.sm, 12);
  assert.equal(CATALOG_TYPE.panelHeading, 13);
  assert.equal(CATALOG_TYPE.md, 14);
  assert.equal(CATALOG_TYPE.brand, 17);
  assert.equal(CATALOG_TYPE.pageTitle, 28);
  assert.deepEqual({ ...CATALOG_RADIUS }, { sm: 8, control: 9, md: 12, card: 14 });
  assert.equal(CATALOG_LAYOUT.sidebarWidth, 264);
  assert.equal(CATALOG_LAYOUT.controlSize, 44);
  assert.deepEqual(Object.keys(CATALOG_TYPE_USE).sort(), Object.keys(CATALOG_TYPE).sort());
});

test('text colors meet WCAG AA on every catalog surface', () => {
  const surfaces = [CATALOG_COLOR.surface, CATALOG_COLOR.surfaceMuted, CATALOG_COLOR.pageBackground, CATALOG_COLOR.surfacePressed, CATALOG_COLOR.chip];
  for (const background of surfaces) {
    assert.ok(contrast(CATALOG_COLOR.text, background) >= 4.5, `text on ${background}`);
    assert.ok(contrast(CATALOG_COLOR.textMuted, background) >= 4.5, `textMuted on ${background}`);
    assert.ok(contrast(CATALOG_COLOR.accent, background) >= 4.5, `accent on ${background}`);
  }
  assert.ok(contrast(CATALOG_COLOR.accent, CATALOG_COLOR.accentSubtle) >= 4.5, 'active nav label');
  assert.ok(contrast('#777777', CATALOG_COLOR.pageBackground) < 4.5, 'the reference gray really fails');
});
