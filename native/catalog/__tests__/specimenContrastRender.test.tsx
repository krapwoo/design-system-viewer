// `doctor --render`'s illegible-specimen-text check, run against real catalog cells. The browser
// script is evaluated in jsdom (which resolves react-native-web's styles but has no layout), so the
// two layout reads it makes — element and text-range rects — are stubbed to a fixed, visible box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
(globalThis as Record<string, unknown>).__DEV__ = false;

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { ComparisonList } = await import('../ComparisonList.tsx');
const { ComparisonGrid } = await import('../ComparisonGrid.tsx');
const { Text, View } = await import('react-native');
const { SPECIMEN_CONTRAST_SCRIPT, illegibleSpecimenIssues } = await import('../../../cli/render.ts');

type Found = { name: string; text: string; ratio: number; kind: 'light' | 'dark' };

/** react-native-web writes its static styles into the stylesheet of the document that was current
 *  when it first loaded (`warmup`'s); `renderCatalog` mounts into a fresh document, so the rules are
 *  copied across to let `getComputedStyle` see what a browser would. */
function adoptStyles(): void {
  const css = [...warmup.window.document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)).join('\n');
  const style = window.document.createElement('style');
  style.textContent = css;
  window.document.head.appendChild(style);
}

/** How far below the top of the page every box currently sits: a test moves it to stand in for a
 *  scroll, and 0 is the visible position. */
const layout = { shift: 0 };

/** Gives every element and text range a fixed box: jsdom has no layout. */
function stubLayout(): void {
  const win = window as unknown as {
    Element: { prototype: { getBoundingClientRect: () => unknown } };
    Range: { prototype: { getBoundingClientRect?: () => unknown } };
  };
  const box = () => ({ left: 0, top: layout.shift, right: 100, bottom: 20 + layout.shift, width: 100, height: 20, x: 0, y: layout.shift });
  win.Element.prototype.getBoundingClientRect = box;
  win.Range.prototype.getBoundingClientRect = box;
}

function runScript(): Found[] {
  stubLayout();
  adoptStyles();
  return Function('document', 'getComputedStyle', `return ${SPECIMEN_CONTRAST_SCRIPT};`)(window.document, window.getComputedStyle.bind(window)) as Found[];
}

/** Runs the real browser script over what `element` rendered. */
function measure(element: React.ReactElement): { found: Found[]; cleanup: () => void } {
  const { cleanup } = renderCatalog(element);
  return { found: runScript(), cleanup };
}

const sample = (color: string, extra: Record<string, unknown> = {}, label = 'Card content') =>
  React.createElement(Text, { style: { color, ...extra } }, label);

const list = (items: Array<{ key: string; label: string; node: React.ReactNode; surface?: 'dark' | 'white' | 'neutral' | 'transparent' }>) =>
  React.createElement(ComparisonList as never, { items, size: 'regular', label: 'SectionCard: Surface', surface: 'transparent', pageId: 'SectionCard' } as never);

test('white sample text on a light cell is reported, with its example name and ratio', () => {
  const { found, cleanup } = measure(list([{ key: 'light', label: 'Light', node: sample('#ffffff') }]));
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Light');
  assert.equal(found[0].text, 'Card content');
  assert.equal(found[0].ratio, 1);
  assert.equal(found[0].kind, 'light');
  cleanup();
});

test('the same text on a dark cell is quiet', () => {
  const { found, cleanup } = measure(list([{ key: 'dark', label: 'Dark', node: sample('#ffffff'), surface: 'dark' }]));
  assert.deepEqual(found, []);
  cleanup();
});

test('a translucent dark surface is composited onto the light cell behind it before measuring', () => {
  // 5% black over white is #f2f2f2: white text on it is ~1.1:1, which only the composited colour can
  // show — the raw rgba(0,0,0,0.05) would read as black, and white on black passes.
  const node = React.createElement(View, { style: { backgroundColor: 'rgba(0, 0, 0, 0.05)', padding: 8 } }, sample('#ffffff'));
  const { found, cleanup } = measure(list([{ key: 'veil', label: 'Veil', node }]));
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Veil');
  assert.ok(found[0].ratio >= 1 && found[0].ratio < 1.5, `ratio ${found[0].ratio}`);
  cleanup();
});

test('black text on a dark cell is reported as dark text', () => {
  const { found, cleanup } = measure(list([{ key: 'dark', label: 'Dark', node: sample('#000000'), surface: 'dark' }]));
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'dark');
  cleanup();
});

test('faint platform colours are quiet: iOS tertiary label grey on white, system yellow on light grey', () => {
  const { found, cleanup } = measure(list([
    { key: 'a', label: 'Placeholder', node: sample('rgba(60, 60, 67, 0.3)', {}, 'Ask anything…') },
    { key: 'b', label: 'Warning', node: React.createElement(View, { style: { backgroundColor: '#f2f2f7', padding: 8 } }, sample('rgb(255, 204, 0)', {}, '⚠')) },
  ]));
  assert.deepEqual(found, []);
  cleanup();
});

test('a clearly coloured background is never the other appearance: white on saturated or pale yellow is quiet', () => {
  const fill = (bg: string, label: string) => ({ key: label, label, node: React.createElement(View, { style: { backgroundColor: bg, padding: 8 } }, sample('#ffffff', {}, '✓')) });
  const { found, cleanup } = measure(list([fill('#FFD700', 'Gold'), fill('#FFE066', 'Pale yellow')]));
  assert.deepEqual(found, []);
  cleanup();
});

test('a grey background is still the other appearance: white on system grey, black on dark grey', () => {
  const { found, cleanup } = measure(list([
    { key: 'a', label: 'Grey', node: React.createElement(View, { style: { backgroundColor: '#F2F2F7', padding: 8 } }, sample('#ffffff')) },
    { key: 'b', label: 'Dark grey', node: React.createElement(View, { style: { backgroundColor: '#1C1C1E', padding: 8 } }, sample('#000000')) },
  ]));
  assert.deepEqual(found.map((f) => [f.name, f.kind]), [['Grey', 'light'], ['Dark grey', 'dark']]);
  cleanup();
});

test('a tinted grey is still the other appearance: slate, a pale blue, a translucent blue wash', () => {
  const on = (bg: string, color: string, label: string) => ({ key: label, label, node: React.createElement(View, { style: { backgroundColor: bg, padding: 8 } }, sample(color)) });
  const { found, cleanup } = measure(list([
    on('#0F172A', '#000000', 'Slate'),
    on('#E0F2FE', '#ffffff', 'Sky'),
    on('rgba(0, 122, 255, 0.12)', '#ffffff', 'Wash'),
  ]));
  assert.deepEqual(found.map((f) => [f.name, f.kind]), [['Slate', 'dark'], ['Sky', 'light'], ['Wash', 'light']]);
  cleanup();
});

test('mid-grey text that is low-contrast but not extreme is quiet', () => {
  const { found, cleanup } = measure(list([{ key: 'a', label: 'Mid', node: React.createElement(View, { style: { backgroundColor: '#bbbbbb', padding: 8 } }, sample('#cccccc')) }]));
  assert.deepEqual(found, []);
  cleanup();
});

test('a nearly opaque dark surface over light passes: the composite is dark enough', () => {
  const node = React.createElement(View, { style: { backgroundColor: 'rgba(0, 0, 0, 0.9)', padding: 8 } }, sample('#ffffff'));
  const { found, cleanup } = measure(list([{ key: 'veil', label: 'Veil', node }]));
  assert.deepEqual(found, []);
  cleanup();
});

test('text hidden on purpose is skipped: opacity 0, visibility hidden, fully transparent text, disabled controls', () => {
  const hidden = [
    { key: 'a', label: 'Opacity', node: sample('#ffffff', { opacity: 0 }) },
    { key: 'b', label: 'Visibility', node: sample('#ffffff', { visibility: 'hidden' }) },
    { key: 'c', label: 'Transparent', node: sample('rgba(255, 255, 255, 0)') },
    { key: 'd', label: 'Disabled', node: React.createElement(View, { 'aria-disabled': true } as never, sample('#ffffff')) },
  ];
  const { found, cleanup } = measure(list(hidden));
  assert.deepEqual(found, []);
  cleanup();
});

test('text inside an image is skipped', () => {
  const { container, cleanup } = renderCatalog(list([{ key: 'svg', label: 'Svg', node: sample('#ffffff') }]));
  // Wrap the rendered text in an <svg> by moving it, since react-native-web has no svg primitive.
  const text = [...container.querySelectorAll('div')].find((el) => el.textContent === 'Card content' && el.children.length === 0)!;
  const svg = window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  text.parentElement!.replaceChild(svg, text);
  svg.appendChild(text);
  const found = runScript();
  assert.deepEqual(found, []);
  cleanup();
});

test('one finding per cell: the worst text, and a legible neighbour cell is not reported', () => {
  const two = React.createElement(View, null, sample('#cccccc', {}, 'Faint'), sample('#ffffff', {}, 'Invisible'));
  const { found, cleanup } = measure(list([
    { key: 'a', label: 'Two texts', node: two },
    { key: 'b', label: 'Fine', node: sample('#111111') },
  ]));
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Two texts');
  assert.equal(found[0].text, 'Invisible');
  cleanup();
});

test('a comparison grid cell is measured too, named row × column', () => {
  const def = {
    rowLabel: 'Row', columnLabel: 'Column',
    rows: [{ key: 'r1', label: 'Row one' }],
    columns: [{ key: 'c1', label: 'Column one' }],
    cells: [{ rowKey: 'r1', columnKey: 'c1', node: sample('#ffffff') }],
  };
  const { found, cleanup } = measure(React.createElement(ComparisonGrid as never, { def, size: 'regular', sectionId: 'SectionCard', surface: 'transparent' } as never));
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Row one × Column one');
  cleanup();
});

test('illegibleSpecimenIssues words the finding as a warning with the page, example, text and ratio', () => {
  const [issue] = illegibleSpecimenIssues({ id: 'SectionCard', file: 'SectionCard.catalog.tsx' }, [{ name: 'Dark', text: 'Card content', ratio: 1.2, kind: 'dark' }]);
  assert.equal(issue.id, 'specimen-text-illegible');
  assert.equal(issue.severity, 'warning');
  assert.equal(issue.page, 'SectionCard');
  assert.equal(issue.message, "Text 'Card content' in 'SectionCard' · Dark is dark text on a dark background (1.2:1).");
  assert.match(issue.fix, /surface/);
  const [light] = illegibleSpecimenIssues({ id: 'SectionCard' }, [{ name: 'Light', text: 'Hi', ratio: 1, kind: 'light' }]);
  assert.equal(light.message, "Text 'Hi' in 'SectionCard' · Light is light text on a light background (1.0:1).");
});

// ---- content painted behind the text by a sibling ----

/** jsdom has no `elementsFromPoint`. Boxes are all stubbed to one rectangle, so geometry cannot pick
 *  the stack; instead it is the document in reverse order (later paints on top), limited to what a
 *  browser would put at the text's centre: the cell's specimen, its descendants and its ancestors,
 *  not the caption beside it. Like Chromium, it leaves out `pointer-events: none` elements. */
function stackAtPoint(): () => void {
  const doc = window.document as unknown as { elementsFromPoint?: () => Element[] };
  doc.elementsFromPoint = () => {
    const specimen = window.document.querySelector('[role=listitem]')!.children[1];
    return [...window.document.querySelectorAll('*')]
      .filter((e) => specimen.contains(e) || e.contains(specimen))
      .filter((e) => window.getComputedStyle(e).pointerEvents !== 'none')
      .reverse();
  };
  return () => { delete doc.elementsFromPoint; };
}

function measureStacked(element: React.ReactElement): { found: Found[]; cleanup: () => void } {
  const { cleanup } = renderCatalog(element);
  const restore = stackAtPoint();
  const found = runScript();
  return { found, cleanup: () => { restore(); cleanup(); } };
}

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

test('white text over a sibling image (ImageBackground: an absolute-fill Image, then the children) is quiet', () => {
  const photo = React.createElement(View, { style: { ...fill, backgroundImage: 'url(photo.jpg)' } });
  const node = React.createElement(View, { style: { padding: 8 } }, photo, sample('#ffffff', {}, 'On a photo'));
  const { found, cleanup } = measureStacked(list([{ key: 'photo', label: 'Photo', node }]));
  assert.deepEqual(found, []);
  cleanup();
});

test('white text over a sibling <img> is quiet', () => {
  const photo = React.createElement('img', { src: 'photo.jpg', alt: '', style: { ...fill } });
  const node = React.createElement(View, { style: { padding: 8 } }, photo, sample('#ffffff', {}, 'On a photo'));
  const { found, cleanup } = measureStacked(list([{ key: 'photo', label: 'Photo', node }]));
  assert.deepEqual(found, []);
  cleanup();
});

test('white text over a dark absolutely positioned overlay sibling is quiet', () => {
  const scrim = React.createElement(View, { style: { ...fill, backgroundColor: 'rgba(0, 0, 0, 0.8)' } });
  const node = React.createElement(View, { style: { padding: 8 } }, scrim, sample('#ffffff', {}, 'On a scrim'));
  const { found, cleanup } = measureStacked(list([{ key: 'scrim', label: 'Scrim', node }]));
  assert.deepEqual(found, []);
  cleanup();
});

test('a sibling that paints nothing (transparent, or an invisible image) does not hide plain white-on-light', () => {
  const clear = React.createElement(View, { style: { ...fill } });
  const hiddenPhoto = React.createElement('img', { src: 'photo.jpg', alt: '', style: { ...fill, opacity: 0 } });
  const node = React.createElement(View, { style: { padding: 8 } }, clear, hiddenPhoto, sample('#ffffff', {}, 'Plain'));
  const { found, cleanup } = measureStacked(list([{ key: 'plain', label: 'Plain', node }]));
  assert.equal(found.length, 1);
  assert.equal(found[0].text, 'Plain');
  cleanup();
});

test('white text over a pointerEvents="none" scrim sibling is quiet: the stack still sees it', () => {
  // A React Native scrim is usually `<View pointerEvents="none" style={[absoluteFill, ...]} />`, which
  // react-native-web draws as `pointer-events: none`, and Chromium's elementsFromPoint skips those.
  const scrim = React.createElement(View, { pointerEvents: 'none', style: { ...fill, backgroundColor: 'rgba(0, 0, 0, 0.6)' } });
  const node = React.createElement(View, { style: { padding: 8 } }, scrim, sample('#ffffff', {}, 'On a scrim'));
  const { found, cleanup } = measureStacked(list([{ key: 'scrim', label: 'Scrim', node }]));
  assert.deepEqual(found, []);
  assert.equal(window.document.getElementById('ds-viewer-contrast-probe'), null, 'the override style is removed afterwards');
  cleanup();
});

test('the cell is scrolled into view once, so a later text node is still measured against a fresh box', () => {
  // Both texts are white-ish on light, so both reach the stack check. The cell starts below the fold;
  // scrolling it to the middle moves every box into view. A scroll per text node would measure the
  // cell's box before the scroll and the second text's box after it, and drop the second text.
  const calls: Element[] = [];
  const two = React.createElement(View, null, sample('#f0f0f0', {}, 'First'), sample('#ffffff', {}, 'Second'));
  const { cleanup: dispose } = renderCatalog(list([{ key: 'a', label: 'Two', node: two }]));
  const proto = (window as unknown as { Element: { prototype: { scrollIntoView?: (this: Element) => void } } }).Element.prototype;
  proto.scrollIntoView = function (this: Element) { calls.push(this); layout.shift = 0; };
  layout.shift = 2000;
  const restore = stackAtPoint();
  const found = runScript();
  const specimen = window.document.querySelector('[role=listitem]')!.children[1];
  restore();
  delete proto.scrollIntoView;
  layout.shift = 0;
  dispose();
  assert.equal(calls.length, 1);
  assert.equal(calls[0], specimen);
  assert.equal(found.length, 1);
  assert.equal(found[0].text, 'Second');
});

test('plain white text on a light cell still fires when the page can answer elementsFromPoint', () => {
  const { found, cleanup } = measureStacked(list([{ key: 'light', label: 'Light', node: sample('#ffffff') }]));
  assert.equal(found.length, 1);
  cleanup();
});

test('an opaque ancestor background settles the colour: a painting element beneath it is not counted', () => {
  // The photo sits below the opaque panel in the stack, so it is not what the text is drawn on.
  const photo = React.createElement(View, { style: { ...fill, backgroundImage: 'url(photo.jpg)' } });
  const panel = React.createElement(View, { style: { backgroundColor: '#ffffff', padding: 8 } }, sample('#ffffff', {}, 'On panel'));
  const node = React.createElement(View, { style: { padding: 8 } }, photo, panel);
  const { found, cleanup } = measureStacked(list([{ key: 'panel', label: 'Panel', node }]));
  assert.equal(found.length, 1);
  assert.equal(found[0].text, 'On panel');
  cleanup();
});

// ---- the ratio never reads as the threshold ----

test('a ratio just under 1.5 is reported rounded down, never as 1.5', () => {
  // #3f3f3f on #585858 is 1.4802:1; rounding to nearest would print 1.5.
  const node = React.createElement(View, { style: { backgroundColor: '#585858', padding: 8 } }, sample('#3f3f3f', {}, 'Nearly'));
  const { found, cleanup } = measure(list([{ key: 'near', label: 'Near', node }]));
  assert.equal(found.length, 1);
  assert.equal(found[0].ratio, 1.4);
  cleanup();
});

test('the message floors a ratio too: 1.47 prints 1.4', () => {
  const [issue] = illegibleSpecimenIssues({ id: 'SectionCard' }, [{ name: 'Dark', text: 'Hi', ratio: 1.47, kind: 'dark' }]);
  assert.equal(issue.message, "Text 'Hi' in 'SectionCard' · Dark is dark text on a dark background (1.4:1).");
});
