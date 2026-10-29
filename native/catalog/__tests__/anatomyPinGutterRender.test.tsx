// An anatomy picture's pins ride on the specimen's right edge, in a `ANATOMY_PIN_GUTTER`-wide
// column. With a preview width the picture frame reserves that gutter on both sides; without one
// (no `previewWidths` on the page or the catalog) the picture keeps its own measured width, and the
// gutter must still be inside what is measured — otherwise the pins hang outside the picture column
// and into the legend beside it, and the side-by-side decision never counts them. jsdom has no
// layout, so this reads the reserved space off the styles between the pin column and the measured
// wrapper.
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

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { AnatomyBox, AnatomySpecimen } = await import('../Anatomy.tsx');
const { ANATOMY_PIN_GUTTER } = await import('../familyModel.ts');
const { ANATOMY_PINS_WRAPPER_TEST_ID } = await import('../SpecimenSurface.tsx');
const { StyleSheet, Platform } = await import('react-native');

/** A style value on `el`: inline first (what these wrappers use), else the atomic class rules
 *  react-native-web generated. */
function styleValue(el: Element, property: string): number {
  const inline = (el as HTMLElement).style.getPropertyValue(property);
  if (inline) return parseFloat(inline) || 0;
  const rules = StyleSheet.getSheet().textContent.split('\n');
  for (const cls of (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
    for (const rule of rules) {
      const m = rule.match(new RegExp(`^\\.${cls}\\{(.*)\\}$`));
      const d = m?.[1].split(';').map((x) => x.split(':')).find(([name]) => name === property);
      if (d) return parseFloat(d[1]) || 0;
    }
  }
  return 0;
}

/** Space reserved on `side` between the pin column's positioning box and the measured wrapper. */
function reserved(side: 'left' | 'right', from: Element, to: Element): number {
  let total = 0;
  for (let el: Element | null = from; el; el = el.parentElement) {
    if (el !== from) total += styleValue(el, `padding-${side}`);
    total += styleValue(el, `margin-${side}`);
    if (el === to) break;
  }
  return total;
}

function mount(previewWidth?: number) {
  const anatomy = {
    picture: <AnatomySpecimen pins={<span data-testid="pin" />}><span>content</span></AnatomySpecimen>,
    groups: [{ label: 'In this picture', items: [{ other: 'Chip', description: 'A chip.' }] }],
  };
  return renderCatalog(
    <AnatomyBox anatomy={anatomy} byId={new Map()} outline={new Map()} resolvesAddress={() => false} previewWidth={previewWidth} />,
  );
}

for (const [name, width] of [['without a preview width', undefined], ['with a preview width', 402]] as const) {
  test(`${name}: the pin gutter is inside the measured picture column, on both sides`, () => {
    const { container, cleanup } = mount(width);
    try {
      const measured = container.querySelector('[data-testid="anatomy-picture-measure"]');
      const pinsBox = container.querySelector(`[data-testid="${ANATOMY_PINS_WRAPPER_TEST_ID}"]`);
      assert.ok(measured && pinsBox, 'expected the measured picture wrapper and the pin column');
      assert.ok(reserved('right', pinsBox!, measured!) >= ANATOMY_PIN_GUTTER, 'pins would hang outside the picture column on the right');
      assert.ok(reserved('left', pinsBox!, measured!) >= ANATOMY_PIN_GUTTER, 'the gutter is mirrored on the left, so the specimen stays centred');
    } finally { cleanup(); }
  });
}

// The gutter is reserved by the specimen wrapper itself, and only on web without a preview width.
// Native (which keeps the measured picture) and a preview-width picture are left as they were.
function specimenPadding(width: number | undefined, os: 'web' | 'ios') {
  const original = Platform.OS;
  (Platform as { OS: string }).OS = os;
  const { container, cleanup } = mount(width);
  try {
    const specimen = container.querySelector('[data-testid="anatomy-specimen"]')!;
    assert.ok(specimen, 'expected the specimen wrapper');
    return { left: styleValue(specimen, 'padding-left'), right: styleValue(specimen, 'padding-right'), width: styleValue(specimen, 'width') };
  } finally { cleanup(); (Platform as { OS: string }).OS = original; }
}

test('web without a preview width: the specimen reserves the gutter on both sides', () => {
  const s = specimenPadding(undefined, 'web');
  assert.equal(s.left, ANATOMY_PIN_GUTTER);
  assert.equal(s.right, ANATOMY_PIN_GUTTER);
});

test('native without a preview width: the specimen adds no padding', () => {
  const s = specimenPadding(undefined, 'ios');
  assert.equal(s.left, 0);
  assert.equal(s.right, 0);
});

test('with a preview width: the specimen is exactly that wide and adds no padding', () => {
  const s = specimenPadding(402, 'web');
  assert.equal(s.width, 402);
  assert.equal(s.left, 0);
  assert.equal(s.right, 0);
});
