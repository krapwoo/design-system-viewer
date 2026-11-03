// Pins in an anatomy picture never overlap and keep clear of the specimen. jsdom has no layout, so
// this gives the elements a layout of its own (a pin's `data-top` plus any `translateY` the viewer
// has applied, 22px tall, in a pin lane that starts `ANATOMY_PIN_EDGE_GAP` right of a 240px
// specimen) the way a browser would report it, and reads back what the viewer did about it. The
// real numbers are measured in a browser (see the slice report).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { createRoot } = await import('react-dom/client');
const { AnatomySpecimen, ANATOMY_PIN_LEADER_TEST_ID } = await import('../Anatomy.tsx');
const { ANATOMY_PIN_EDGE_GAP, ANATOMY_PIN_LANE, ANATOMY_PIN_STACK_GAP } = await import('../familyModel.ts');
const { StyleSheet } = await import('react-native');

const PIN_HEIGHT = 22;

/** Mounts a specimen whose pins `wanted` (px from the specimen's top) in a window whose layout is faked. */
function mount(wanted: number[], options: { height?: number; badge?: boolean; rtl?: boolean } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.IS_REACT_ACT_ENVIRONMENT = true;
  g.getComputedStyle = () => ({ direction: options.rtl ? 'rtl' : 'ltr' });
  const proto = dom.window.Element.prototype as unknown as { getBoundingClientRect: () => object };
  proto.getBoundingClientRect = function (this: Element) {
    const testId = this.getAttribute('data-testid');
    const box = (top: number, left: number, height: number, width: number) => ({ top, left, bottom: top + height, right: left + width, height, width });
    if (testId === 'anatomy-pin-layer') return box(0, 240 + ANATOMY_PIN_EDGE_GAP, options.height ?? 130, ANATOMY_PIN_LANE);
    if (testId === 'pin-badge') {
      // The ↗ badge: 14px, its top 7px above the pin's own.
      const pin = this.closest('[data-testid="anatomy-pin"]') as HTMLElement;
      const shifted = /translateY\((-?[\d.]+)px\)/.exec(pin.style.transform)?.[1];
      return box(Number(pin.getAttribute('data-top')) + Number(shifted ?? 0) - 7, 240 + ANATOMY_PIN_EDGE_GAP + ANATOMY_PIN_LANE - 15, 14, 14);
    }
    if (testId === 'anatomy-pin') {
      const shifted = /translateY\((-?[\d.]+)px\)/.exec((this as HTMLElement).style.transform)?.[1];
      return box(Number(this.getAttribute('data-top')) + Number(shifted ?? 0), 240 + ANATOMY_PIN_EDGE_GAP + ANATOMY_PIN_LANE - 22, PIN_HEIGHT, 22);
    }
    return box(0, 0, 0, 0);
  };
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => {
    root.render(
      <AnatomySpecimen pins={<>{wanted.map((top, i) => <span key={i} data-testid="anatomy-pin" data-top={top}>{options.badge ? <i data-testid="pin-badge" /> : null}</span>)}</>}>
        <span>content</span>
      </AnatomySpecimen>,
    );
  });
  const pinTops = () => [...container.querySelectorAll('[data-testid="anatomy-pin"]')].map((el) => (el.getBoundingClientRect() as unknown as { top: number }).top);
  return {
    container,
    pinTops,
    leaders: () => container.querySelectorAll(`[data-testid="${ANATOMY_PIN_LEADER_TEST_ID}"]`),
    layer: container.querySelector('[data-testid="anatomy-pin-layer"]')!,
    // react-native-web reports a view's `onLayout` through a ResizeObserver, calling the handler it keeps on the node.
    layout: () => { act(() => { (container.querySelector('[data-testid="anatomy-pin-layer"]') as unknown as { __reactLayoutHandler: (e: object) => void }).__reactLayoutHandler({ nativeEvent: { layout: {} } }); }); },
    cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); },
  };
}

test('pins whose targets are within a pin height of each other are spread apart, never overlapping', () => {
  const wanted = [0, 10, 22, 30, 36, 100];
  const { pinTops, leaders, cleanup } = mount(wanted);
  try {
    const tops = pinTops();
    const sorted = [...tops].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - (sorted[i - 1] + PIN_HEIGHT) >= ANATOMY_PIN_STACK_GAP, `pins ${i - 1} and ${i} keep ${ANATOMY_PIN_STACK_GAP}px apart: ${tops}`);
    assert.deepEqual(tops.map((t, i) => t === sorted[i]), tops.map(() => true), 'the lane keeps the order of the targets');
    assert.ok(leaders().length >= 4, 'each moved pin gets a leader line back to what it points at');
  } finally { cleanup(); }
});

test('pins with room are not moved and get no leader line', () => {
  const { pinTops, leaders, cleanup } = mount([0, 40, 90]);
  try {
    assert.deepEqual(pinTops(), [0, 40, 90]);
    assert.equal(leaders().length, 0);
  } finally { cleanup(); }
});

test('pins only a little too close move by a few px and keep no leader line', () => {
  // Two pins 2px apart (kit TripCard's) are pushed to 4px apart, a move too small to need a line.
  const { pinTops, leaders, cleanup } = mount([4, 28]);
  try {
    const [a, b] = pinTops();
    assert.equal(b - (a + PIN_HEIGHT), ANATOMY_PIN_STACK_GAP);
    assert.equal(leaders().length, 0);
  } finally { cleanup(); }
});

test('the pin lane starts a token-sized gap off the specimen, so a bracket or leader never touches it', () => {
  const { layer, cleanup } = mount([0]);
  try {
    const rules = StyleSheet.getSheet().textContent.split('\n');
    const value = (property: string) => {
      for (const cls of (layer.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
        for (const rule of rules) {
          const m = rule.match(new RegExp(`^\\.${cls}\\{(.*)\\}$`));
          const d = m?.[1].split(';').find((x) => x.startsWith(`${property}:`));
          if (d) return d.slice(property.length + 1);
        }
      }
    };
    assert.equal(value('margin-left'), `${ANATOMY_PIN_EDGE_GAP}px`);
    assert.equal(value('width'), `${ANATOMY_PIN_LANE}px`);
    assert.equal(value('left'), '100%');
  } finally { cleanup(); }
});

test('a crowd of pins near the specimen\'s top or bottom stays inside the specimen (M1)', () => {
  const height = 100;
  for (const wanted of [[0, 0, 0], [0, 6, 12], [100, 100, 100], [90, 96, 100]]) {
    const { pinTops, cleanup } = mount(wanted, { height });
    try {
      const tops = pinTops();
      tops.forEach((t, i) => assert.ok(t + PIN_HEIGHT / 2 >= 0 && t + PIN_HEIGHT / 2 <= height, `[${wanted}]: pin ${i} (centre ${t + PIN_HEIGHT / 2}) is inside the 0..${height} specimen`));
      const sorted = [...tops].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= PIN_HEIGHT + ANATOMY_PIN_STACK_GAP, `[${wanted}]: still apart ${tops}`);
    } finally { cleanup(); }
  }
});

test('pins that open a page leave room for their ↗ badge (L3)', () => {
  const { pinTops, cleanup } = mount([40, 44], { badge: true });
  try {
    const [a, b] = pinTops();
    // The lower pin\'s badge reaches 7px above its top: it must still clear the pin above by the stack gap.
    assert.ok(b - 7 - (a + PIN_HEIGHT) >= ANATOMY_PIN_STACK_GAP, `badge clears the pin above: ${a}, ${b}`);
  } finally { cleanup(); }
});

test('the lane spreads again when its layout changes without the specimen re-rendering (L2)', () => {
  const { pinTops, container, layout, cleanup } = mount([0, 60]);
  try {
    assert.deepEqual(pinTops(), [0, 60]);
    // A pin component re-rendered itself (context, state) and now wants a spot beside the first.
    container.querySelectorAll('[data-testid="anatomy-pin"]')[1].setAttribute('data-top', '10');
    layout();
    const [a, b] = pinTops();
    assert.ok(b - (a + PIN_HEIGHT) >= ANATOMY_PIN_STACK_GAP, `re-spread after a layout: ${a}, ${b}`);
  } finally { cleanup(); }
});

test('right-to-left text: pins still spread but no leader points the wrong way (L1)', () => {
  const { pinTops, leaders, cleanup } = mount([0, 10, 20, 30], { rtl: true });
  try {
    const sorted = [...pinTops()].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= PIN_HEIGHT + ANATOMY_PIN_STACK_GAP);
    assert.equal(leaders().length, 0);
  } finally { cleanup(); }
});
