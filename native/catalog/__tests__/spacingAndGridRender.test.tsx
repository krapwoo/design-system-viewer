// Spacing and grid fixes: a banner keeps `CATALOG_SPACE.lg` below itself, a token tile's
// "Details ›" sits one small step under its tile, a `TokenRow`'s columns sit together instead of
// spreading across the card, and a transition specimen's stage stretches to its tile. jsdom has no
// layout engine, so these read the styles react-native-web generated for each element; the pixel
// gaps they produce are measured in a real browser (see the slice report), not here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });
(warmup.window as unknown as { matchMedia: (query: string) => unknown }).matchMedia = (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
});

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { WarningBanner, BANNER_MARGIN } = await import('../WarningBanner.tsx');
const { StructuredTokenPage } = await import('../StructuredTokenPage.tsx');
const { TokenRow } = await import('../TokenRow.tsx');
const { TokenTile } = await import('../TokenLayouts.tsx');
const { TokenDetails } = await import('../TokenDetails.tsx');
const { MotionSpecimen, TRANSITION_STAGE_MAX_WIDTH, transitionStageWidth } = await import('../MotionSpecimen.tsx');
const { CATALOG_SPACE, CATALOG_LAYOUT, CATALOG_TEXT } = await import('../tokens.ts');
const { StyleSheet, Text, View } = await import('react-native');

/** The rules react-native-web generated for an element's atomic classes: property -> value. */
function declared(el: Element): Record<string, string> {
  const rules = StyleSheet.getSheet().textContent.split('\n');
  const out: Record<string, string> = {};
  for (const cls of (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
    for (const rule of rules) {
      const m = rule.match(new RegExp(`^\\.${cls}\\{(.*)\\}$`));
      if (m) for (const d of m[1].split(';').filter(Boolean)) { const i = d.indexOf(':'); out[d.slice(0, i)] = d.slice(i + 1); }
    }
  }
  return out;
}
const px = (n: number) => `${n}px`;

test('a banner keeps CATALOG_SPACE.lg below itself and none above (the parent owns that), in either tone', () => {
  assert.equal(BANNER_MARGIN, CATALOG_SPACE.lg);
  for (const tone of ['warning', 'info'] as const) {
    const { container, cleanup } = renderCatalog(<WarningBanner tone={tone} title="Heads up">Body.</WarningBanner>);
    try {
      const style = declared(container.querySelector('[role="note"]') as Element);
      assert.equal(style['margin-top'], undefined, `${tone}: margins don't collapse, so a top margin would add to the parent's gap`);
      assert.equal(style['margin-bottom'], px(CATALOG_SPACE.lg), `${tone}: below`);
    } finally { cleanup(); }
  }
});

test('the token page\'s "No … tokens yet" note is the same banner, so it keeps the same space above the jump row', () => {
  const entry = (id: string) => ({ id, name: id, kind: 'spacing' as const, value: { provenance: 'inline' as const, resolution: { status: 'resolved' as const, value: { amount: 8, unit: 'pt' as const } } } });
  const definition = { kind: 'spacing', showNoTokensNote: true, sections: [{ id: 'a', title: 'A', entries: [entry('x')] }, { id: 'b', title: 'B', entries: [entry('y')] }] };
  const { container, cleanup } = renderCatalog(<StructuredTokenPage definition={definition as never} />);
  try {
    const note = container.querySelector('[role="note"]') as HTMLElement;
    assert.ok(note, 'the note is drawn');
    assert.ok((note.textContent ?? '').includes('No spacing tokens yet'));
    const style = declared(note);
    assert.equal(style['margin-top'], undefined);
    assert.equal(style['margin-bottom'], px(CATALOG_SPACE.lg));
    // Not inside the section stack: that stack's own gap would add to the banner's space.
    const parent = declared(note.parentElement as Element);
    assert.equal(parent['row-gap'] ?? parent.gap, undefined, 'the banner and jump row sit outside the gapped stack');
  } finally { cleanup(); }
});

test('a token\'s Details link is drawn at its text height, one small gap under its tile, with a control-sized tap target', () => {
  const { container, cleanup } = renderCatalog(<TokenDetails title="8pt" source="Theme.swift:1" />);
  try {
    const trigger = container.querySelector('[aria-label="Details for 8pt"]') as HTMLElement;
    const style = declared(trigger);
    const slop = (CATALOG_LAYOUT.controlSize - CATALOG_TEXT.icon.lineHeight) / 2;
    assert.equal(style['min-height'], px(CATALOG_LAYOUT.controlSize), 'the tap target stays control-sized');
    assert.equal(style['margin-top'], undefined, 'the box never reaches up over the line above');
    assert.equal(style['align-items'], 'flex-start', 'the text sits at the top of the box');
    assert.equal(style['margin-bottom'], px(-2 * slop), 'and the spare height hangs below, given back to the layout');
  } finally { cleanup(); }
  const tile = renderCatalog(
    <TokenTile name="8pt" value="8"><View /></TokenTile>,
  );
  try {
    const rows = [...tile.container.querySelectorAll('div')].map((el) => declared(el)).filter((s) => s['row-gap'] !== undefined || s.gap !== undefined);
    assert.ok(rows.some((s) => (s['row-gap'] ?? s.gap) === px(CATALOG_SPACE.xs)), 'a tile spaces its own lines by CATALOG_SPACE.xs, which the link now matches');
  } finally { tile.cleanup(); }
});

test('a right-placed TokenRow keeps its columns together: gap lg, wrapping, the note sized to its text', () => {
  const { container, cleanup } = renderCatalog(
    <TokenRow use="Card padding" notePlacement="right" action={<Text>Details</Text>}><View style={{ width: 24, height: 12 }} /></TokenRow>,
  );
  try {
    const note = [...container.querySelectorAll('div')].find((el) => el.textContent === 'Card padding' && el.children.length === 0) as HTMLElement;
    assert.ok(note, 'the note');
    const row = note.parentElement as HTMLElement;
    const rowStyle = declared(row);
    assert.equal(rowStyle['flex-wrap'], 'wrap', 'wraps rather than overflowing a narrow card');
    assert.equal(rowStyle['column-gap'], px(CATALOG_SPACE.lg));
    const noteStyle = declared(note);
    assert.equal(noteStyle['flex-grow'] ?? '0', '0', 'the note does not grow to fill the card, so Details follows it');
    assert.equal(noteStyle['flex-shrink'], '1', 'but it shrinks and wraps its text on a narrow card');
    // In a wrapping row an item is placed by its one-line width, so an uncapped long note would drop
    // under the sample; the cap keeps it beside it, wrapping its own text.
    assert.equal(noteStyle['max-width'], '60ch', 'a long note is capped so it stays beside its sample');
  } finally { cleanup(); }
});

test('a token page puts the jump row\'s old gap back above the first section, so the row-to-section space is unchanged', () => {
  const entry = (id: string) => ({ id, name: id, kind: 'spacing' as const, value: { provenance: 'inline' as const, resolution: { status: 'resolved' as const, value: { amount: 8, unit: 'pt' as const } } } });
  const definition = { kind: 'spacing', sections: [{ id: 'a', title: 'A', entries: [entry('x')] }, { id: 'b', title: 'B', entries: [entry('y')] }] };
  const { container, cleanup } = renderCatalog(<StructuredTokenPage definition={definition as never} />);
  try {
    const stack = [...container.querySelectorAll('div')].find((el) => { const d = declared(el); return (d['row-gap'] ?? d.gap) === px(CATALOG_SPACE.xl) && d['margin-top'] !== undefined; }) as HTMLElement;
    assert.ok(stack, 'the section stack');
    assert.equal(declared(stack)['margin-top'], px(CATALOG_SPACE.xl));
  } finally { cleanup(); }
});

test('a transition specimen stretches to its column, up to a maximum, and its stage is as wide as that column', () => {
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'opacity' }} label="opacity" />);
  try {
    const stage = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    const wrap = stage.parentElement as HTMLElement;
    const wrapStyle = declared(wrap);
    assert.equal(wrapStyle['align-self'], 'stretch', 'takes its column\'s width instead of a fixed 200px');
    assert.equal(wrapStyle['max-width'], '100%', 'and never past its cell, whatever its label says');
    assert.equal(stage.style.width, px(200), 'until it is measured the stage is its default 200px (then the measured column width)');
  } finally { cleanup(); }
});

test('a transition\'s caption, footer and notes never set the stage\'s width: each wraps within the stage', () => {
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'move', edge: 'leading' }} label="move" />);
  try {
    const stage = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    const lines = [...(stage.parentElement as HTMLElement).children].filter((el) => el !== stage);
    assert.ok(lines.length >= 2, 'the caption and the footer');
    for (const line of lines) assert.equal((line as HTMLElement).style.maxWidth, px(200), `${line.textContent}`);
  } finally { cleanup(); }
});

test('the stage is as wide as its measured column, capped, and keeps its default until a column is measured', () => {
  assert.equal(transitionStageWidth(287.4), 287);
  assert.equal(transitionStageWidth(TRANSITION_STAGE_MAX_WIDTH + 300), TRANSITION_STAGE_MAX_WIDTH);
  assert.equal(transitionStageWidth(0), undefined);
});
