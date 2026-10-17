import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_COLOR, CATALOG_FONT, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_TEXT, CATALOG_TEXT_USE, CATALOG_TYPE, CATALOG_TYPE_USE } from '../tokens.ts';

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
      controlDisabled: '#e6e6e6',
      controlDisabledText: '#8a8a8a',
      specimenStage: '#f2f2f2',
      pageBackground: '#f6f6f4',
      chip: '#eeeeee',
      accent: '#174dc6',
      accentSubtle: '#e9efff',
      focusRing: '#c9d7ff',
      treeLine: '#a9bdf0',
      codeSurface: '#1d1d1f',
      codeOnSurface: '#e8e8e8',
      code: 'Menlo, monospace',
      warning: '#8a4b00',
      warningSubtle: '#fff4e0',
      warningBorder: '#f0cf97',
      danger: '#b3261e',
      dangerSubtle: '#fdecea',
      dangerBorder: '#f2b8b5',
      success: '#1e6b3a',
      successSubtle: '#e8f5ec',
    },
  );
});

test('type, radius, and layout values match the approved references', () => {
  // Owner decision 2026-10-11: the catalog's type uses only these sizes.
  const SCALE = [10, 12, 14, 16, 18, 24, 28, 32, 40];
  for (const [name, size] of Object.entries(CATALOG_TYPE)) assert.ok(SCALE.includes(size), `${name}: ${size}`);
  assert.deepEqual([...new Set(Object.values(CATALOG_TYPE))].sort((a, b) => a - b), SCALE, 'every step of the scale has a token');
  assert.equal(CATALOG_TYPE.xs, 10);
  assert.equal(CATALOG_TYPE.tableHeader, 12);
  assert.equal(CATALOG_TYPE.sm, 12);
  assert.equal(CATALOG_TYPE.panelHeading, 12);
  assert.equal(CATALOG_TYPE.md, 14);
  assert.equal(CATALOG_TYPE.brand, 18);
  assert.equal(CATALOG_TYPE.pageTitle, 28);
  assert.deepEqual({ ...CATALOG_RADIUS }, { sm: 8, control: 9, md: 12, card: 14 });
  assert.equal(CATALOG_LAYOUT.sidebarWidth, 264);
  assert.equal(CATALOG_LAYOUT.controlSize, 44);
  assert.deepEqual(Object.keys(CATALOG_TYPE_USE).sort(), Object.keys(CATALOG_TYPE).sort());
});

test('CATALOG_COLOR.code stays in sync with CATALOG_FONT.code (one source of truth)', () => {
  assert.equal(CATALOG_COLOR.code, CATALOG_FONT.code);
  assert.equal(CATALOG_FONT.code, 'Menlo, monospace');
});

test('every CATALOG_TEXT role has a use note', () => {
  assert.deepEqual(Object.keys(CATALOG_TEXT_USE).sort(), Object.keys(CATALOG_TEXT).sort());
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

test('the 0.4 warning/danger/success tokens match the approved update-panel mockup exactly', () => {
  assert.equal(CATALOG_COLOR.warning, '#8a4b00');
  assert.equal(CATALOG_COLOR.warningSubtle, '#fff4e0');
  assert.equal(CATALOG_COLOR.warningBorder, '#f0cf97');
  assert.equal(CATALOG_COLOR.danger, '#b3261e');
  assert.equal(CATALOG_COLOR.dangerSubtle, '#fdecea');
  assert.equal(CATALOG_COLOR.dangerBorder, '#f2b8b5');
  assert.equal(CATALOG_COLOR.success, '#1e6b3a');
  assert.equal(CATALOG_COLOR.successSubtle, '#e8f5ec');
});

test('updateContentMaxWidth matches the approved mockup\'s .pagewrap (512px)', () => {
  assert.equal(CATALOG_LAYOUT.updateContentMaxWidth, 512);
});

test('CATALOG_TEXT roles match the owner-approved table', () => {
  assert.deepEqual(
    { ...CATALOG_TEXT },
    {
      pageTitle: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
      heading1: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
      heading2: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
      heading3: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
      icon: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
      body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
      bodyStrong: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
      caption: { fontSize: 12, fontWeight: '400', lineHeight: 18 },
      captionStrong: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
      label: { fontSize: 12, fontWeight: '700', lineHeight: 18, letterSpacing: 0.72, textTransform: 'uppercase' },
      micro: { fontSize: 10, fontWeight: '400', lineHeight: 14 },
      microLabel: { fontSize: 10, fontWeight: '700', lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
      code: { fontSize: 14, fontWeight: '400', lineHeight: 20, fontFamily: 'Menlo, monospace' },
      codeSmall: { fontSize: 12, fontWeight: '400', lineHeight: 18, fontFamily: 'Menlo, monospace' },
      codeSmallStrong: { fontSize: 12, fontWeight: '700', lineHeight: 18, fontFamily: 'Menlo, monospace' },
      codeMicro: { fontSize: 10, fontWeight: '400', lineHeight: 14, fontFamily: 'Menlo, monospace' },
    },
  );
  assert.equal(CATALOG_TEXT.label.letterSpacing, CATALOG_TEXT.label.fontSize * 0.06);
  assert.equal(CATALOG_TEXT.microLabel.letterSpacing, CATALOG_TEXT.microLabel.fontSize * 0.06);
});
