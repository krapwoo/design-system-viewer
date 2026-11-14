// Test-only. jsdom has no layout engine, so `measureInWindow` reads a `getBoundingClientRect` that is
// all zeros, and react-native-web's `onLayout` needs a `ResizeObserver` jsdom does not have. This
// scripts both: a test says where each element sits in the window, and fires an element's `onLayout`
// handler with a size, exactly as the platform would after laying it out. Import `renderKit` before
// this module.
import { act } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

export interface Rect { x: number; y: number; width: number; height: number }

/** Makes `measureInWindow` report `rectOf(element)` for every element under `container`'s window
 *  (zeros where it returns undefined). Call right after rendering, before any timer fires: react-native-web
 *  reads the rect one `setTimeout(0)` after `measureInWindow` is called. */
export function scriptRects(container: HTMLElement, rectOf: (el: HTMLElement) => Rect | undefined): void {
  const view = container.ownerDocument.defaultView!;
  (view.HTMLElement.prototype as { getBoundingClientRect: () => unknown }).getBoundingClientRect = function (this: HTMLElement) {
    const { x, y, width, height } = rectOf(this) ?? { x: 0, y: 0, width: 0, height: 0 };
    return { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
  };
}

/** Fires `el`'s `onLayout` with a size. react-native-web keeps the handler on the DOM node and its
 *  ResizeObserver calls it; here the test is the observer. */
export async function fireLayout(el: Element, width: number, height: number): Promise<void> {
  const handler = (el as unknown as { __reactLayoutHandler?: (e: unknown) => void }).__reactLayoutHandler;
  if (!handler) throw new Error('element has no onLayout handler');
  await act(async () => handler({ nativeEvent: { layout: { x: 0, y: 0, width, height, left: 0, top: 0 } }, timeStamp: Date.now() }));
}

// react-native-web reads `window` for its `Dimensions` once, as it loads — the window `domBootstrap`
// installs — and listens for `resize` on that window.
const bootstrapWindow = window;

/** Sets the window size `useWindowDimensions` reports, before anything renders. jsdom's
 *  `documentElement.clientWidth` is 0, so without this every window is 0 wide. */
export function setWindowSize(width: number, height: number): void {
  Object.assign(Dimensions.get('window'), { width, height });
}

/** Resizes the window under a mounted tree: the same `resize` event a browser fires, which
 *  react-native-web turns into a `Dimensions` change that `useWindowDimensions` re-renders on. */
export async function resizeWindow(container: HTMLElement, width: number, height: number): Promise<void> {
  const root = container.ownerDocument.documentElement;
  Object.defineProperty(root, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(root, 'clientHeight', { configurable: true, value: height });
  await act(async () => { bootstrapWindow.dispatchEvent(new bootstrapWindow.Event('resize')); });
}

/** The rules react-native-web generated for `pointerEvents`: the element's own, and its children's. */
function pointerRules(el: Element): { own: string; children: string }[] {
  const { textContent } = (StyleSheet as unknown as { getSheet(): { textContent: string } }).getSheet();
  return (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter((cls) => cls.startsWith('r-pointerEvents'))
    .map((cls) => ({
      own: textContent.match(new RegExp(`\\.${cls}\\{pointer-events:([a-z]+)`))?.[1] ?? '',
      children: textContent.match(new RegExp(`\\.${cls}>\\* \\{pointer-events:([a-z]+)`))?.[1] ?? '',
    }));
}

/** True for an element drawn with `pointerEvents="box-none"`: react-native-web turns the element's
 *  own pointer events off and its children's back on. */
export function isBoxNone(el: Element): boolean {
  return pointerRules(el).some((r) => r.own === 'none' && r.children === 'auto');
}

/** True for an element drawn with `pointerEvents="none"`: neither it nor its children take touches. */
export function isPointerNone(el: Element): boolean {
  return pointerRules(el).some((r) => r.own === 'none' && r.children === 'none');
}
