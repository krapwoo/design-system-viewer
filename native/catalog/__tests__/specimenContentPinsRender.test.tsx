import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// `SpecimenContent`'s browser measurement, mounted, around an anatomy specimen's pin column: jsdom has
// no layout, so each element's `getBoundingClientRect` is stubbed from a table and a real
// `ResizeObserver` stand-in (see anatomyWidthRender.test.tsx) fires `onLayout`. This proves what the
// measurement does with those rectangles — which elements it reads and which it ignores — not
// browser geometry.
const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { View } = await import('react-native');
const { AnatomySpecimen } = await import('../Anatomy.tsx');
const { SpecimenContent, ANATOMY_PIN_LAYER_TEST_ID } = await import('../SpecimenSurface.tsx');

type ResizeCallback = (entries: { target: Element }[]) => void;
class FakeResizeObserver {
  static current: FakeResizeObserver | undefined;
  private observed = new Set<Element>();
  constructor(private callback: ResizeCallback) {
    FakeResizeObserver.current = this;
  }
  observe(node: Element) { this.observed.add(node); }
  unobserve(node: Element) { this.observed.delete(node); }
  disconnect() { this.observed.clear(); }
  trigger(node: Element) {
    if (this.observed.has(node)) this.callback([{ target: node }]);
  }
}

type Rect = { left: number; right: number };
const CELL: Rect = { left: 0, right: 402 };
const NONE: Rect = { left: 0, right: 0 };

/** Mounts `element` on a fresh window whose elements measure as `rects(el)`, then replays a resize
 *  of `measured(container)` and returns what the measurement did. */
async function measure(element: React.ReactElement, rects: (el: Element) => Rect, measured: (container: HTMLElement) => Element) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.Element = dom.window.Element;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (dom.window as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
  dom.window.Element.prototype.getBoundingClientRect = function (this: Element) {
    const rect = rects(this);
    return { ...rect, width: rect.right - rect.left, top: 0, bottom: 0, height: 0, x: rect.left, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => { root.render(element); });
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  (globalThis as Record<string, unknown>).__DEV__ = true;
  try {
    const node = measured(container);
    Object.defineProperty(node, 'offsetWidth', { value: CELL.right, configurable: true });
    Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
    await act(async () => {
      FakeResizeObserver.current?.trigger(node);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  } finally {
    console.warn = originalWarn;
    delete (globalThis as Record<string, unknown>).__DEV__;
  }
  return { container, warnings, cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); } };
}

const testId = (el: Element) => el.getAttribute('data-testid');
const cutOff = (warnings: string[]) => warnings.filter((w) => w.includes('cut off'));

/** A full-width child plus a pin layer that sticks out past the cell on the right. */
const withLayer = (layerTestId: string) => (
  <View testID="host">
    <SpecimenContent>
      <View testID="body"><span>body</span></View>
      <View testID={layerTestId}><span>pin</span></View>
    </SpecimenContent>
  </View>
);
const layerRects = (layerTestId: string) => (el: Element): Rect => {
  const id = testId(el);
  if (id === 'host' || el.parentElement?.getAttribute('data-testid') === 'host') return CELL;
  if (id === 'body') return CELL;
  if (id === layerTestId || el.parentElement && testId(el.parentElement) === layerTestId) return { left: 402, right: 432 };
  return id === null && el.textContent === 'body' ? CELL : NONE;
};

test('the pin layer is left out of the overflow measurement: pins sticking out of the cell do not warn', async () => {
  const run = await measure(withLayer(ANATOMY_PIN_LAYER_TEST_ID), layerRects(ANATOMY_PIN_LAYER_TEST_ID), (c) => c.querySelector('[data-testid="host"]')!.firstElementChild!);
  assert.deepEqual(cutOff(run.warnings), []);
  run.cleanup();
});

test('the same tree without the pin layer\'s test id is measured, and its overflow warns', async () => {
  const run = await measure(withLayer('some-other-layer'), layerRects('some-other-layer'), (c) => c.querySelector('[data-testid="host"]')!.firstElementChild!);
  assert.equal(cutOff(run.warnings).length, 1, `expected the overflow warning, got ${JSON.stringify(run.warnings)}`);
  run.cleanup();
});

test('in fill mode the pins wrapper does not hide a genuinely narrow root: it is centred like a variant cell', async () => {
  const element = (
    <AnatomySpecimen fill pins={<span>pin</span>}>
      <View testID="narrow-root"><span>skeleton</span></View>
    </AnatomySpecimen>
  );
  const rects = (el: Element): Rect => {
    const id = testId(el);
    if (id === 'anatomy-specimen' || el.parentElement && testId(el.parentElement) === 'anatomy-specimen') return CELL; // the box and its content node
    if (id === 'anatomy-specimen-pins') return CELL; // a fill wrapper always stretches
    if (id === 'narrow-root') return { left: 0, right: 200 };
    if (id === ANATOMY_PIN_LAYER_TEST_ID || el.parentElement && testId(el.parentElement) === ANATOMY_PIN_LAYER_TEST_ID) return { left: 402, right: 432 };
    return el.textContent === 'skeleton' ? { left: 0, right: 200 } : NONE;
  };
  const run = await measure(element, rects, (c) => c.querySelector('[data-testid="anatomy-specimen"]')!.firstElementChild!);
  const content = run.container.querySelector('[data-testid="anatomy-specimen"]')!.firstElementChild as HTMLElement;
  assert.equal(content.style.alignItems, 'center', 'the 200px root is centred in the 402px cell');
  run.cleanup();
});
