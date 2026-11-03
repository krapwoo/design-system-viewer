// How an `InventoryTile` scales its specimen: a part tile (given a `specimen`) and a page tile (drawing its
// page's first specimen) go through the same `OverviewThumbnail`, so a specimen that fills a phone's
// width comes out at the same scale in both, and one that keeps its own size is drawn at real size.
// jsdom has no layout: the tile frame's width, the 402px cell and the painted boxes are stubbed by
// `data-testid` (the way `structuredTokenPageRender.test.tsx` stubs widths), and the scale is read off
// the stage's `transform`. The stubbed boxes are the unscaled ones, so layout is triggered once.
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

const { Inventory, InventoryGroup, InventoryTile } = await import('../Inventory.tsx');
const { ReferenceNavigationContext } = await import('../referenceNavigationContext.ts');
const { View, Text } = await import('react-native');

type ResizeEntry = { target: Element };
class FakeResizeObserver {
  static current: FakeResizeObserver | undefined;
  observed = new Set<Element>();
  constructor(private callback: (entries: ResizeEntry[]) => void) { FakeResizeObserver.current = this; }
  observe(node: Element) { this.observed.add(node); }
  unobserve(node: Element) { this.observed.delete(node); }
  disconnect() { this.observed.clear(); }
  triggerAll() { this.callback([...this.observed].map((target) => ({ target }))); }
}

const FRAME_HEIGHT = 104;
/** The painted width of each specimen at the reference width, by `data-testid`. */
const PAINTED: Record<string, number> = { row: 402, dot: 24, wide: 768, inset: 370, narrow: 200 };

function mount(element: React.ReactElement, frameWidth: number) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (dom.window as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  const inline = (el: Element, property: string) => new RegExp(`(?:^|;)\\s*${property}:\\s*([\\d.]+)px`).exec(el.getAttribute('style') ?? '')?.[1];
  Object.defineProperty(proto, 'offsetWidth', {
    configurable: true,
    get(this: Element) {
      if (inline(this, 'height') === String(FRAME_HEIGHT)) return frameWidth;
      return Number(inline(this, 'width') ?? 0);
    },
  });
  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    get(this: Element) { return inline(this, 'height') === String(FRAME_HEIGHT) ? FRAME_HEIGHT : 40; },
  });
  (dom.window.Element.prototype as unknown as Record<string, unknown>).getBoundingClientRect = function (this: Element) {
    const painted = PAINTED[this.getAttribute('data-testid') ?? ''];
    // A wrapper that stretches across its cell (SpecimenContent does) is as wide as the 402px cell.
    const stretched = /(?:^|;)\s*align-self:\s*stretch/.test(this.getAttribute('style') ?? '') ? Number(PAINTED.row) : undefined;
    const cell = Number(inline(this, 'width') ?? stretched ?? 0);
    const width = painted ?? cell;
    // Painted content is centred in the 402px (or wider) cell, as `SpecimenSurface` centres it.
    const left = painted === undefined ? 0 : (Number(PAINTED.row) - painted) / 2;
    return { left, right: left + width, top: 0, bottom: width > 0 ? 40 : 0, width, height: width > 0 ? 40 : 0, x: left, y: 0, toJSON() {} };
  };
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => { root.render(element); });
  return { container, cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); } };
}

async function layout() {
  await act(async () => { FakeResizeObserver.current?.triggerAll(); await new Promise((resolve) => setTimeout(resolve, 0)); });
}

/** The scale each tile's stage was given, and the width its cell is laid out at. */
function drawn(container: HTMLElement): { scale: number; cell: number }[] {
  return [...container.querySelectorAll('[aria-hidden="true"] > div')].flatMap((frame) => {
    const stage = frame.firstElementChild as HTMLElement | null;
    const transform = stage?.getAttribute('style')?.match(/transform:\s*([^;]+)/)?.[1] ?? '';
    const scale = /scale\(([\d.]+)\)/.exec(transform)?.[1] ?? /matrix\(([\d.]+),/.exec(transform)?.[1];
    const cell = /(?:^|;)\s*width:\s*([\d.]+)px/.exec(stage?.firstElementChild?.getAttribute('style') ?? '')?.[1];
    return scale === undefined ? [] : [{ scale: Number(scale), cell: Number(cell) }];
  });
}

const row = <View testID="row" style={{ width: '100%' }}><Text>a row</Text></View>;
const dot = <View testID="dot" style={{ width: 24, height: 24 }} />;
const wide = <View testID="wide" style={{ width: '100%' }}><Text>wide</Text></View>;

/** A stand-in navigation: page `Rows` (whose first specimen is a row), a member `RowPart` of it, a page `Dots`
 *  (a lone dot), and a page `Tablet` that previews at 768 with a member `TabletPart`. */
const navigation = {
  resolve: (name: string) => {
    if (name === 'Rows' || name === 'Dots' || name === 'Tablet' || name === 'Inset' || name === 'Narrow') return { pageId: name };
    if (name === 'RowPart') return { pageId: 'Rows', memberId: name };
    if (name === 'TabletPart') return { pageId: 'Tablet', memberId: name };
    return undefined;
  },
  open: () => {},
  page: (id: string) => ({
    Rows: { title: 'Rows', source: { node: row } },
    Dots: { title: 'Dots', source: { node: dot } },
    Tablet: { title: 'Tablet', source: { node: wide, width: 768, fill: true } },
    Inset: { title: 'Inset', source: { node: <View testID="inset" />, fill: true } },
    Narrow: { title: 'Narrow', source: { node: <View testID="narrow" />, fill: true } },
  } as Record<string, { title: string; source: { node: React.ReactNode; width?: number; fill?: boolean } }>)[id],
};
const inNav = (children: React.ReactNode) => <ReferenceNavigationContext.Provider value={navigation as never}>{children}</ReferenceNavigationContext.Provider>;

test('a phone-width specimen is drawn at the same scale in a part tile and in a page tile', async () => {
  const { container, cleanup } = mount(inNav(<><InventoryTile target="Rows" /><InventoryTile target="RowPart" specimen={row} /></>), 280);
  await layout();
  const [page, part] = drawn(container);
  cleanup();
  assert.ok(page && part, 'both tiles drew a specimen');
  assert.equal(page.cell, 402);
  assert.equal(part.cell, 402, 'the part tile lays its specimen out on the 402px reference too');
  assert.ok(Math.abs(page.scale - part.scale) / page.scale < 0.01, `page ${page.scale} vs part ${part.scale}`);
  assert.ok(Math.abs(part.scale - (280 - 16) / 402) < 0.001, `fits the tile: ${part.scale}`);
});

test('a fixed-size specimen is drawn at real size, in a part tile and in a page tile', async () => {
  const { container, cleanup } = mount(inNav(<><InventoryTile target="Dots" /><InventoryTile target="RowPart" specimen={dot} fixedSize={24} /></>), 280);
  await layout();
  const tiles = drawn(container);
  cleanup();
  assert.deepEqual(tiles.map((t) => t.scale), [1, 1], 'neither is shrunk because of the 402px cell');
});

test('a part tile of a page that previews wide is laid out at that width; `width` overrides it', async () => {
  const { container, cleanup } = mount(inNav(<><InventoryTile target="TabletPart" specimen={wide} /><InventoryTile target="RowPart" width={500} specimen={row} /><InventoryTile target="Nowhere" specimen={row} /></>), 280);
  await layout();
  const cells = drawn(container).map((t) => t.cell);
  cleanup();
  assert.deepEqual(cells, [768, 500, 402]);
});

test('a group of fixed-size tiles uses narrower tiles and more columns than a group of full-width ones', async () => {
  const slots = async (props: Record<string, unknown>) => {
    const { container, cleanup } = mount(inNav(
      <InventoryGroup title="G" description="d">
        {Array.from({ length: 6 }, (_, i) => <InventoryTile key={i} target="RowPart" specimen={dot} {...props} />)}
      </InventoryGroup>,
    ), 100);
    for (let i = 0; i < 3; i += 1) {
      const observer = FakeResizeObserver.current!;
      for (const node of observer.observed) {
        Object.defineProperty(node, 'offsetWidth', { value: 1200, configurable: true });
        Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
      }
      await act(async () => { observer.triggerAll(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
    const widths = [...container.querySelectorAll('div')]
      .filter((el) => el.querySelector('a') && el.children.length === 1 && /^width: [\d.]+px;?$/.test(el.getAttribute('style') ?? ''))
      .map((el) => Math.round(parseFloat((el.getAttribute('style') ?? '').replace('width: ', ''))));
    cleanup();
    return widths;
  };
  const full = await slots({});
  const fixed = await slots({ fixedSize: true });
  assert.equal(full.length, 6);
  assert.equal(fixed.length, 6);
  assert.equal(Math.round((1200 + 20) / (full[0] + 20)), 4, 'default: four across');
  assert.equal(Math.round((1200 + 20) / (fixed[0] + 20)), 6, 'fixed-size: six across');
});

test('one tile without `fixedSize` keeps a group of otherwise fixed-size tiles on the default grid', async () => {
  const widthOf = async (fixedSizes: (true | undefined)[]) => {
    const { container, cleanup } = mount(inNav(
      <InventoryGroup title="G" description="d">
        {fixedSizes.map((fixedSize, i) => <InventoryTile key={i} target="RowPart" specimen={dot} fixedSize={fixedSize} />)}
      </InventoryGroup>,
    ), 100);
    for (let i = 0; i < 3; i += 1) {
      const observer = FakeResizeObserver.current!;
      for (const node of observer.observed) {
        Object.defineProperty(node, 'offsetWidth', { value: 1200, configurable: true });
        Object.defineProperty(node, 'offsetHeight', { value: 10, configurable: true });
      }
      await act(async () => { observer.triggerAll(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
    const widths = [...container.querySelectorAll('div')]
      .filter((el) => el.querySelector('a') && el.children.length === 1 && /^width: [\d.]+px;?$/.test(el.getAttribute('style') ?? ''))
      .map((el) => Math.round(parseFloat((el.getAttribute('style') ?? '').replace('width: ', ''))));
    cleanup();
    return widths;
  };
  const mixed = await widthOf([true, true, true, true, true, undefined]);
  const full = await widthOf([true, true, true, true, true, true]);
  assert.equal(mixed.length, 6);
  assert.equal(Math.round((1200 + 20) / (mixed[0] + 20)), 4, 'five fixed-size tiles and one without: four across');
  assert.equal(Math.round((1200 + 20) / (full[0] + 20)), 6, 'all six fixed-size: six across');
});

test('a part tile stretches its specimen only when `fill` asks, never because its page draws its own first specimen filled', async () => {
  const { container, cleanup } = mount(inNav(<>
    <InventoryTile target="TabletPart" specimen={<View testID="inherit" />} />
    <InventoryTile target="RowPart" specimen={<View testID="own" />} fill />
    <InventoryTile target="TabletPart" specimen={<View testID="off" />} fill={false} />
  </>), 280);
  await layout();
  const parentDirection = (id: string) => /(?:^|;)\s*flex-direction:\s*([^;]+)/.exec(container.querySelector(`[data-testid="${id}"]`)?.parentElement?.getAttribute('style') ?? '')?.[1]?.trim();
  const got = { inherit: parentDirection('inherit'), own: parentDirection('own'), off: parentDirection('off') };
  cleanup();
  assert.equal(got.inherit, 'row', 'a badge on a filled row\'s page keeps its own size');
  assert.notEqual(got.own, 'row', '`fill` asks for it');
  assert.equal(got.off, 'row', '`fill={false}` keeps the specimen its own size');
});

test('a filled specimen is shown as the whole reference width, margins included, so it shares the scale of one that paints edge to edge', async () => {
  // `Inset` is drawn filled but paints only 370 of its 402px (its own side margins); `RowPart` paints all 402.
  const { container, cleanup } = mount(inNav(<><InventoryTile target="Inset" /><InventoryTile target="RowPart" specimen={row} /></>), 280);
  await layout();
  const [inset, edge] = drawn(container);
  cleanup();
  assert.ok(inset && edge, 'both tiles drew a specimen');
  assert.ok(Math.abs(inset.scale - edge.scale) / edge.scale < 0.01, `inset ${inset.scale} vs edge-to-edge ${edge.scale}`);
});

test('a filled specimen with a narrow fixed-width root is drawn at real size, not stretched to the 402px cell', async () => {
  // `Narrow` is a 200px root on a filled page. Taking the cell's extents for it would scale it by (280-16)/402.
  const { container, cleanup } = mount(inNav(<InventoryTile target="Narrow" />), 280);
  await layout();
  const [narrow] = drawn(container);
  cleanup();
  assert.equal(narrow.scale, 1, `a 200px root fits the 264px tile: ${narrow.scale}`);
});

test('a filled specimen is capped at a phone\'s content width and centred in a phone cell, and fills a wider cell or a page-width page', async () => {
  const wrapperStyle = (container: HTMLElement, id: string) => container.querySelector(`[data-testid="${id}"]`)?.parentElement?.getAttribute('style') ?? '';
  const { container, cleanup } = mount(inNav(<>
    <InventoryTile target="RowPart" specimen={<View testID="phone" />} fill />
    <InventoryTile target="TabletPart" specimen={<View testID="tablet" />} fill />
  </>), 280);
  await layout();
  const phone = wrapperStyle(container, 'phone');
  const tablet = wrapperStyle(container, 'tablet');
  cleanup();
  assert.match(phone, /max-width:\s*370px/);
  assert.doesNotMatch(tablet, /max-width:\s*370px/, 'a 768px cell is not a phone');
});

test('a root wider than its cell is shown whole, not cut to the cell', async () => {
  // `wide` paints 768px in a 402px cell. Replacing the box with the cell's extents would scale by (280-16)/402 and clip the overflow.
  const { container, cleanup } = mount(inNav(<InventoryTile target="RowPart" specimen={wide} />), 280);
  await layout();
  const [tile] = drawn(container);
  cleanup();
  assert.ok(Math.abs(tile.scale - (280 - 16) / 768) < 0.001, `fits the whole 768px: ${tile.scale}`);
});
