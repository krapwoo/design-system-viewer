// A picture's pins are absolutely positioned, so they add no height: a column taller than a short
// specimen used to be cut off by the picture area. `AnatomySpecimen` now measures how far the pins
// reach past the specimen (web) and pads its block by the larger overhang on both sides. jsdom has
// no layout, so rects are stubbed by test id: the pin layer is exactly the specimen, and the pin
// column overhangs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act, Profiler, useState } from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { AnatomySpecimen } = await import('../Anatomy.tsx');
const { ANATOMY_PINS_WRAPPER_TEST_ID, ANATOMY_PIN_LAYER_TEST_ID } = await import('../SpecimenSurface.tsx');
const { StyleSheet } = await import('react-native');

type Box = { top: number; bottom: number };
type Rects = { getBoundingClientRect: () => DOMRect };
let specimenBox: Box = { top: 0, bottom: 0 };

/** `renderCatalog` builds a fresh JSDOM per render, so the stub goes on each window as it is
 *  installed: the pin layer is the specimen's box, a pin has its `data-box` ("top,bottom"), anything
 *  else has no height. */
let current = (globalThis as { window: unknown }).window;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  get: () => current,
  set: (next: { Element: { prototype: Rects } }) => {
    next.Element.prototype.getBoundingClientRect = function (this: Element) {
      const own = this.getAttribute('data-testid') === 'anatomy-pin-layer' ? `${specimenBox.top},${specimenBox.bottom}` : this.getAttribute('data-box') ?? '0,0';
      const [top, bottom] = own.split(',').map(Number);
      return { top, bottom, left: 0, right: 10, width: 10, height: bottom - top } as DOMRect;
    };
    current = next;
  },
});

function padding(el: Element, side: 'top' | 'bottom'): number {
  return cssPx(el, `padding-${side}`);
}

/** A px declaration on `el`: inline, else from the generated stylesheet's class rules. */
function cssPx(el: Element, property: string): number {
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

function mount(pins: [number, number][], specimen: Box) {
  specimenBox = specimen;
  const view = renderCatalog(
    <AnatomySpecimen pins={<>{pins.map(([top, bottom], n) => <span key={n} data-box={`${top},${bottom}`} />)}</>}>
      <span>chip</span>
    </AnatomySpecimen>,
  );
  const wrapper = view.container.querySelector(`[data-testid="${ANATOMY_PINS_WRAPPER_TEST_ID}"]`) as HTMLElement;
  return { ...view, wrapper };
}

test('a short specimen with a tall pin column gets a block at least as tall as the column, centred on the specimen', () => {
  {
    // Specimen 306-335 (29px), a 4-pin column 270-370 (100px): 36px over the top, 35px under.
    const view = mount([[270, 292], [296, 318], [322, 344], [348, 370]], { top: 306, bottom: 335 });
    const top = padding(view.wrapper, 'top');
    const bottom = padding(view.wrapper, 'bottom');
    assert.equal(top, bottom, 'padded equally, so the specimen stays centred in the block');
    assert.ok(29 + top + bottom >= 100, `block ${29 + top + bottom}px must hold the 100px column`);
    view.cleanup();
  }
});

test('pins that fit inside the specimen add no padding', () => {
  {
    const view = mount([[310, 330]], { top: 306, bottom: 335 });
    assert.equal(padding(view.wrapper, 'top'), 0);
    assert.equal(padding(view.wrapper, 'bottom'), 0);
    view.cleanup();
  }
});

test('the pin layer is offset by the same padding as the block, and a second layout pass settles with no further change', () => {
  // Specimen 306-335, 4-pin column 270-370: 36px over the top, 35px under, so the block pads 36px.
  const column: [number, number][] = [[270, 292], [296, 318], [322, 344], [348, 370]];
  let shift = 0;
  let bump = () => {};
  let commits = 0;
  function Harness() {
    const [, setTick] = useState(0);
    bump = () => setTick((n) => n + 1);
    specimenBox = { top: 306 + shift, bottom: 335 + shift };
    return (
      <Profiler id="specimen" onRender={() => { commits += 1; }}>
        <AnatomySpecimen pins={<>{column.map(([top, bottom], n) => <span key={n} data-box={`${top + shift},${bottom + shift}`} />)}</>}>
          <span>chip</span>
        </AnatomySpecimen>
      </Profiler>
    );
  }
  const view = renderCatalog(<Harness />);
  const wrapper = view.container.querySelector(`[data-testid="${ANATOMY_PINS_WRAPPER_TEST_ID}"]`) as HTMLElement;
  const layer = view.container.querySelector(`[data-testid="${ANATOMY_PIN_LAYER_TEST_ID}"]`) as HTMLElement;
  const pad = padding(wrapper, 'top');
  assert.equal(pad, 36);
  assert.equal(padding(wrapper, 'bottom'), pad);
  assert.equal(cssPx(layer, 'top'), pad, 'the pin layer starts below the padding, so it stays exactly the specimen');
  assert.equal(cssPx(layer, 'bottom'), pad, 'and ends above the bottom padding');

  // The browser now reports the specimen (and the pins riding on it) `pad` lower. The overhang is
  // unchanged, so a second pass must not change state: no re-render beyond the one that was asked for.
  shift = pad;
  commits = 0;
  act(() => { bump(); });
  assert.equal(commits, 1, 'one commit for the re-render itself, none from a measurement loop');
  assert.equal(padding(wrapper, 'top'), pad);
  assert.equal(padding(wrapper, 'bottom'), pad);
  assert.equal(cssPx(layer, 'top'), pad);
  assert.equal(cssPx(layer, 'bottom'), pad);
  view.cleanup();
});
