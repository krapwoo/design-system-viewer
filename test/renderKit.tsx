// `renderCatalog` plus the globals a starter-kit component expects from its host app. Metro defines
// `__DEV__` and a browser defines `requestAnimationFrame`; Node defines neither, and react-native-web
// reaches for both (`Animated.timing` calls `requestAnimationFrame` as soon as an effect starts one).
// Like `renderCatalog`, this proves structure — roles, ARIA, text, which elements exist — never
// geometry or real animation timing.
// Import this module BEFORE any react-native component: see domBootstrap.ts.
import './domBootstrap';
import type React from 'react';
import { act } from 'react';
import { StyleSheet } from 'react-native';
import { renderCatalog } from './renderCatalog';

const g = globalThis as Record<string, unknown>;
g.__DEV__ = true;
if (typeof g.requestAnimationFrame !== 'function') {
  // `unref`: an endless `Animated.loop` (Shimmer's shared pulse) must not keep the test process alive.
  g.requestAnimationFrame = (callback: (time: number) => void) => setTimeout(() => callback(performance.now()), 16).unref();
  g.cancelAnimationFrame = (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle);
}

export interface KitRender {
  /** The React root's own container. */
  container: HTMLElement;
  /** react-native-web's `Modal` portals into `document.body`, outside `container` — so anything a
   *  Modal renders is only reachable from here. */
  body: HTMLElement;
  cleanup: () => void;
}

export function renderKit(element: React.ReactElement): KitRender {
  const { container, cleanup } = renderCatalog(element);
  return { container, body: container.ownerDocument.body, cleanup };
}

/** Renders `element`, hands the result to `check`, and always unmounts — so a failing assertion
 *  cannot leave an animation loop or a portal alive for the next test. */
export function withKit<T>(element: React.ReactElement, check: (rendered: KitRender) => T): T {
  const rendered = renderKit(element);
  try {
    return check(rendered);
  } finally {
    rendered.cleanup();
  }
}

/** `withKit` for a check that awaits (clicks, animations): unmounts only after the check settles. */
export async function withKitAsync(element: React.ReactElement, check: (rendered: KitRender) => Promise<void>): Promise<void> {
  const rendered = renderKit(element);
  try {
    await check(rendered);
  } finally {
    rendered.cleanup();
  }
}

/** Lets pending promises and state updates land — e.g. `AccessibilityInfo.isReduceMotionEnabled()`
 *  resolves a microtask after mount, then the component re-renders. */
export async function settle(ms = 0): Promise<void> {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
}

/** The declarations react-native-web generated for an element's atomic classes: property -> value.
 *  Lets a test say "no animation is applied" or "the background is transparent" about real CSS. */
export function declaredStyle(el: Element): Record<string, string> {
  // `getSheet` exists on react-native-web's StyleSheet only, so React Native's types do not know it.
  const { textContent } = (StyleSheet as unknown as { getSheet(): { textContent: string } }).getSheet();
  const rules = textContent.split('\n');
  const out: Record<string, string> = {};
  for (const cls of (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
    for (const rule of rules) {
      const match = rule.match(new RegExp(`^\\.${cls}\\{(.*)\\}$`));
      if (!match) continue;
      for (const declaration of match[1].split(';').filter(Boolean)) {
        const colon = declaration.indexOf(':');
        out[declaration.slice(0, colon)] = declaration.slice(colon + 1);
      }
    }
  }
  return out;
}

/** Waits in real time for an animation to advance. Animations update components from timers, outside
 *  any `act()`, which React warns about when it believes it is inside a test environment — so the
 *  flag is lowered for the wait and restored after (`settle` is the `act`-wrapped way to wait). */
export async function sleep(ms: number): Promise<void> {
  g.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  } finally {
    g.IS_REACT_ACT_ENVIRONMENT = true;
  }
}

/** Polls until `condition` holds, failing with `message` after `timeoutMs`. For real (rAF-timed)
 *  animations, whose end is observable only by waiting for it. */
export async function waitFor(condition: () => boolean, message: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${message}`);
    await sleep(10);
  }
}
