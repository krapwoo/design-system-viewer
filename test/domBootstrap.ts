// react-native-web decides `canUseDOM` once, when it is first imported (`typeof window !== 'undefined'`).
// `renderCatalog` only installs jsdom per render — after every import has run — so anything RNW gates
// on that flag (its `Modal` portal, for one) would render nothing. Importing this module FIRST gives
// RNW a window at load time; `renderCatalog` then replaces it with a fresh one for each render.
import { JSDOM } from 'jsdom';

// react-native-web's `AccessibilityInfo.isReduceMotionEnabled` reads `matchMedia('(prefers-reduced-motion:
// reduce)')` ONCE at import, and reports `true` when the browser has no `matchMedia` at all (jsdom has
// none). This one exists so reduce-motion is `false` by default and a test can flip it — set `matches`,
// then call `emitReduceMotionChange` — exactly the signal a real OS setting change produces.
type ChangeListener = (event: { matches: boolean }) => void;
const listeners = new Set<ChangeListener>();
export const reduceMotionMedia = {
  matches: false,
  addEventListener: (_type: string, listener: ChangeListener) => { listeners.add(listener); },
  removeEventListener: (_type: string, listener: ChangeListener) => { listeners.delete(listener); },
};
export function setReduceMotion(enabled: boolean): void {
  reduceMotionMedia.matches = enabled;
  for (const listener of [...listeners]) listener({ matches: enabled });
}

const g = globalThis as Record<string, unknown>;
if (typeof g.window === 'undefined') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  (dom.window as unknown as Record<string, unknown>).matchMedia = () => reduceMotionMedia;
  g.window = dom.window;
  g.document = dom.window.document;
}

// DOM classes RNW reads as bare globals (`root instanceof ShadowRoot`, `node.nodeType === Node.…`,
// `el instanceof HTMLElement`). Resolved lazily against the CURRENT window, so an `instanceof` check
// sees the same window's classes as the elements `renderCatalog` just created.
for (const name of ['ShadowRoot', 'Node', 'Element', 'HTMLElement', 'Event', 'KeyboardEvent']) {
  if (!(name in g)) {
    Object.defineProperty(g, name, { configurable: true, get: () => (g.window as Record<string, unknown>)[name] });
  }
}
