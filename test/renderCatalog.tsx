// Renders a catalog component the way a consumer's browser does: react-native-web primitives into
// a DOM. jsdom has no layout engine, so this proves structure (which element wraps what, what text
// and roles exist) and never geometry — `getBoundingClientRect()` is all zeros here. Anything about
// position or size still needs the rendered browser pass in `cli/render.ts`.
import React from 'react';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

export function renderCatalog(element: React.ReactElement): { container: HTMLElement; cleanup: () => void } {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  // Node 22 defines a global `navigator` with no setter, so a plain assignment throws
  // ("Cannot set property navigator of #<Object> which has only a getter").
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  const container = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(container);
  act(() => { root.render(element); });
  return {
    container,
    cleanup: () => { act(() => { root.unmount(); }); dom.window.close(); },
  };
}
