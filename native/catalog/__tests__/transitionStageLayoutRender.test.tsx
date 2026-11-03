// A transition specimen's stage takes the width its wrapper is measured at (up to a cap), mounted:
// the same fake `ResizeObserver` as `anatomyWidthRender.test.tsx`, so react-native-web's `onLayout`
// fires and the stage is re-laid at the measured width. jsdom has no layout, so this proves that
// `onLayout` is wired to the stage, never browser geometry (that is measured in a real browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

// The specimen reads the Reduce Motion setting through `matchMedia` of the window it was imported under.
(warmup.window as unknown as { matchMedia: (query: string) => unknown }).matchMedia = (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
});

const { MotionSpecimen, TRANSITION_STAGE_MAX_WIDTH } = await import('../MotionSpecimen.tsx');

class FakeResizeObserver {
  static current: FakeResizeObserver | undefined;
  private observed = new Set<Element>();
  constructor(private callback: (entries: { target: Element }[]) => void) { FakeResizeObserver.current = this; }
  observe(node: Element) { this.observed.add(node); }
  unobserve(node: Element) { this.observed.delete(node); }
  disconnect() { this.observed.clear(); }
  trigger(node: Element) { if (this.observed.has(node)) this.callback([{ target: node }]); }
}

function mount(element: React.ReactElement) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (dom.window as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;

  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => { root.render(element); });
  return { container, cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); } };
}

async function resize(node: Element, width: number) {
  Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
  await act(async () => {
    FakeResizeObserver.current?.trigger(node);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test('the stage starts at 200px, takes the width its wrapper is measured at, and stops at the cap', async () => {
  const { container, cleanup } = mount(<MotionSpecimen kind="transition" transition={{ type: 'opacity' }} label="opacity" />);
  try {
    const stage = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    const wrap = stage.parentElement as HTMLElement;
    assert.equal(stage.style.width, '200px');
    await resize(wrap, 320);
    assert.equal(stage.style.width, '320px', 'a 320px column gives a 320px stage');
    await resize(wrap, TRANSITION_STAGE_MAX_WIDTH + 300);
    assert.equal(stage.style.width, `${TRANSITION_STAGE_MAX_WIDTH}px`, 'capped');
    // The caption follows the stage, so it can never be what widens the wrapper.
    const caption = [...wrap.children].find((el) => (el.textContent ?? '').startsWith('Assumed')) as HTMLElement;
    assert.equal(caption.style.maxWidth, `${TRANSITION_STAGE_MAX_WIDTH}px`);
  } finally { cleanup(); }
});
