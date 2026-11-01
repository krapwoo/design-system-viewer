// `MotionSpecimen`'s transition kind with Reduce Motion on: nothing animates, on mount or on Replay;
// the sample is shown as inserted, with a plain note. react-native-web decides Reduce Motion once, at
// its first import, from `window.matchMedia` — so it is reported on here, in a file of its own (the
// off case is `transitionSpecimenRender.test.tsx`), the same way `structuredTokenPageRender.test.tsx` does.
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
(warmup.window as unknown as { matchMedia: (query: string) => unknown }).matchMedia = (query: string) => ({
  matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
});
(globalThis as Record<string, unknown>).requestAnimationFrame = (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 0) as unknown as number;
(globalThis as Record<string, unknown>).cancelAnimationFrame = (id: number) => clearTimeout(id);

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { MotionSpecimen, TRANSITION_REDUCE_MOTION_NOTE, TRANSITION_HOLD_MS } = await import('../MotionSpecimen.tsx');
const { Animated } = await import('react-native');

async function pass(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
}

test('with Reduce Motion on, a transition never animates: it rests inserted, with a note, on mount and after Replay', async () => {
  const animated: string[] = [];
  const originals = { timing: Animated.timing, spring: Animated.spring, loop: Animated.loop };
  for (const fn of ['timing', 'spring', 'loop'] as const) {
    (Animated as Record<string, unknown>)[fn] = (...args: unknown[]) => { animated.push(fn); return (originals[fn] as (...a: unknown[]) => unknown)(...args); };
  }
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'combined', of: [{ type: 'opacity' }, { type: 'move', edge: 'bottom' }] }} label="Fixture" />);
  try {
    await pass(TRANSITION_HOLD_MS + 200);
    const sample = container.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    assert.match(sample.getAttribute('style') ?? '', /opacity: 1; transform: translateX\(0px\) translateY\(0px\) scale\(1\)/, 'the inserted look, not the removed one');
    assert.ok((container.textContent || '').includes(TRANSITION_REDUCE_MOTION_NOTE), 'a plain note says why');
    assert.match(TRANSITION_REDUCE_MOTION_NOTE, /Reduce Motion is on/);
    const replay = container.querySelector('[aria-label="Replay Fixture"]') as HTMLElement;
    await act(async () => { replay.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    await pass(TRANSITION_HOLD_MS + 200);
    assert.match(sample.getAttribute('style') ?? '', /opacity: 1; transform: translateX\(0px\) translateY\(0px\) scale\(1\)/, 'still inserted after Replay');
    assert.deepEqual(animated, [], 'no animation of any kind is started');
  } finally {
    cleanup();
    Object.assign(Animated, originals);
  }
});
