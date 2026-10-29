// Mounted regression: a SwiftUI spring handed to `MotionSpecimen` reaches `Animated.spring` as the
// converted stiffness/damping/mass physics, and the stiffness/damping/mass form reaches it unchanged.
// Same dynamic-import warmup `notesPanelRender.test.tsx` documents. Reduce motion is reported off
// (`matches: false`, the reverse of `structuredTokenPageRender.test.tsx`) so Replay really calls
// `Animated.spring`; jsdom has no `requestAnimationFrame`, so a no-op stands in and nothing steps.
import { test, mock } from 'node:test';
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
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
});
(globalThis as Record<string, unknown>).requestAnimationFrame = () => 0;
(globalThis as Record<string, unknown>).cancelAnimationFrame = () => {};

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { MotionSpecimen, MOTION_SPRING_MAX_MS } = await import('../MotionSpecimen.tsx');
const { Animated } = await import('react-native');

type SpringConfig = { stiffness?: number; damping?: number; mass?: number; overshootClamping?: boolean; restDisplacementThreshold?: number };

/** Mounts a spring specimen, presses Replay, and returns the config `Animated.spring` last received. */
async function replayedSpringConfig(spring: Record<string, number | boolean>): Promise<SpringConfig> {
  const seen: SpringConfig[] = [];
  const original = Animated.spring;
  (Animated as { spring: unknown }).spring = (value: unknown, config: SpringConfig) => {
    seen.push(config);
    return original(value as never, config as never);
  };
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="spring" spring={spring} label="Fixture spring" />);
  try {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const replay = container.querySelector('[aria-label="Replay Fixture spring"]') as HTMLElement;
    assert.ok(replay, 'expected the Replay button');
    seen.length = 0;
    act(() => { replay.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    assert.equal(seen.length, 1, 'Replay plays one spring');
    return seen[0];
  } finally {
    cleanup();
    (Animated as { spring: unknown }).spring = original;
  }
}

test('a SwiftUI response/dampingFraction spring is converted to stiffness/damping with mass 1', async () => {
  const config = await replayedSpringConfig({ response: 0.5, dampingFraction: 1 });
  assert.ok(Math.abs(config.stiffness! - 157.91) < 0.01, `stiffness ${config.stiffness}`);
  assert.ok(Math.abs(config.damping! - 25.13) < 0.01, `damping ${config.damping}`);
  assert.equal(config.mass, 1);
});

test('a SwiftUI duration/bounce spring is converted too', async () => {
  const config = await replayedSpringConfig({ duration: 0.5, bounce: 0.3 });
  assert.ok(Math.abs(config.stiffness! - 157.91) < 0.01, `stiffness ${config.stiffness}`);
  assert.ok(Math.abs(config.damping! - 17.59) < 0.01, `damping ${config.damping}`);
});

test('the stiffness/damping/mass form reaches Animated.spring unchanged', async () => {
  const config = await replayedSpringConfig({ stiffness: 200, damping: 20, mass: 2 });
  assert.deepEqual({ stiffness: config.stiffness, damping: config.damping, mass: config.mass }, { stiffness: 200, damping: 20, mass: 2 });
});

test('a SwiftUI spring keeps its non-physics fields (overshootClamping, rest thresholds)', async () => {
  const config = await replayedSpringConfig({ response: 0.5, dampingFraction: 0.7, overshootClamping: true, restDisplacementThreshold: 0.001 });
  assert.equal(config.overshootClamping, true);
  assert.equal(config.restDisplacementThreshold, 0.001);
  assert.ok(Math.abs(config.stiffness! - 157.91) < 0.01);
});

test('an out-of-range SwiftUI spring throws while rendering, whether or not reduce motion is on', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    for (const reduce of [false, true]) {
      (window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (query: string) => ({
        matches: reduce, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
      });
      assert.throws(() => renderCatalog(<MotionSpecimen kind="spring" spring={{ response: -1, dampingFraction: 1 }} />), RangeError, `reduce motion ${reduce}`);
      assert.throws(() => renderCatalog(<MotionSpecimen kind="spring" spring={{ duration: 0.5, bounce: 2 }} />), RangeError, `reduce motion ${reduce}`);
    }
  } finally {
    console.error = originalError;
    (window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (query: string) => ({
      matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    });
  }
});

test('a spring that barely settles is stopped after the maximum', async () => {
  const stops: number[] = [];
  const original = Animated.spring;
  (Animated as { spring: unknown }).spring = (value: unknown, config: unknown) => {
    const anim = original(value as never, config as never);
    const stop = anim.stop.bind(anim);
    anim.stop = () => { stops.push(Date.now()); stop(); };
    return anim;
  };
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="spring" spring={{ response: 0.5, dampingFraction: 0.001 }} label="Forever" />);
  try {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const replay = container.querySelector('[aria-label="Replay Forever"]') as HTMLElement;
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      act(() => { replay.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
      const before = stops.length;
      mock.timers.tick(MOTION_SPRING_MAX_MS - 1);
      assert.equal(stops.length, before, 'still playing just before the maximum');
      mock.timers.tick(1);
      assert.equal(stops.length, before + 1, 'stopped at the maximum');
    } finally { mock.timers.reset(); }
  } finally {
    cleanup();
    (Animated as { spring: unknown }).spring = original;
  }
});
