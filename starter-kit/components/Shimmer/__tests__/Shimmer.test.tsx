// Ported from QQ's `Shimmer.test.tsx`. QQ mocks `useReduceMotion`; here the real hook runs against
// react-native-web's `AccessibilityInfo`, whose reduce-motion source the harness controls
// (`setReduceMotion` in test/domBootstrap.ts) — so the OS-setting path is exercised too.
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { settle, sleep, withKitAsync } from '../../../../test/renderKit';
import { setReduceMotion } from '../../../../test/domBootstrap';
// After renderKit/domBootstrap, which must be the first thing to load react-native-web.
import { Animated } from 'react-native';
import { Shimmer, SkeletonGroup, createRefCountedLoop, sharedPulseClock } from '../Shimmer';

/** The shimmer block's own element. */
const block = (root: HTMLElement) => root.firstElementChild as HTMLElement;
const background = (el: HTMLElement) => el.style.backgroundColor;
const PULSE_HIGH = 'rgba(0, 0, 0, 0.05)';

/** Background colour at three moments across one pulse cycle (1800ms). */
async function sampleBackground(el: HTMLElement): Promise<string[]> {
  const samples = [background(el)];
  for (const wait of [300, 400]) {
    await sleep(wait);
    samples.push(background(el));
  }
  return samples;
}

describe('Shimmer', () => {
  afterEach(() => setReduceMotion(false));

  it('animates by default (the background pulses between its low and high colour)', async () => {
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      const samples = await sampleBackground(block(container));
      assert.ok(new Set(samples).size > 1, `background never changed: ${samples.join(' | ')}`);
    });
  });


  it('a standalone shimmer is a busy progressbar named "Loading"', async () => {
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      assert.equal(block(container).getAttribute('role'), 'progressbar');
      assert.equal(block(container).getAttribute('aria-label'), 'Loading');
      assert.equal(block(container).getAttribute('aria-busy'), 'true');
    });
  });

  it('a standalone shimmer accepts a custom accessibilityLabel', async () => {
    await withKitAsync(<Shimmer accessibilityLabel="Loading trips" />, async ({ container }) => {
      await settle();
      assert.equal(block(container).getAttribute('aria-label'), 'Loading trips');
    });
  });

  it('shimmers inside a SkeletonGroup stay silent; the group announces once', async () => {
    const group = (
      <SkeletonGroup label="Loading profile">
        <Shimmer accessibilityLabel="ignored" />
        <Shimmer />
      </SkeletonGroup>
    );
    await withKitAsync(group, async ({ container }) => {
      await settle();
      const bars = container.querySelectorAll('[role="progressbar"]');
      assert.equal(bars.length, 1);
      assert.equal(bars[0].getAttribute('aria-label'), 'Loading profile');
      assert.equal(container.querySelectorAll('[aria-label="ignored"]').length, 0);
    });
  });

  it('with reduce-motion on, renders a static block at the pulse high colour instead', async () => {
    setReduceMotion(true);
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      const samples = await sampleBackground(block(container));
      assert.deepEqual(samples, [PULSE_HIGH, PULSE_HIGH, PULSE_HIGH]);
    });
  });

  it('with reduce-motion on, a standalone shimmer keeps its announcement', async () => {
    setReduceMotion(true);
    await withKitAsync(<Shimmer accessibilityLabel="Loading trips" />, async ({ container }) => {
      await settle();
      assert.equal(block(container).getAttribute('role'), 'progressbar');
      assert.equal(block(container).getAttribute('aria-label'), 'Loading trips');
    });
  });

  it('follows the OS setting changing while mounted', async () => {
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      await act(async () => { setReduceMotion(true); });
      await settle();
      // The animated block is swapped for a static one, so look the element up again.
      assert.equal(background(block(container)), PULSE_HIGH);
      await sleep(450);
      assert.equal(background(block(container)), PULSE_HIGH, 'still static after the animation would have moved');
    });
  });

  it('a shimmer exposes aria-busy to the web', async () => {
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      assert.equal(block(container).getAttribute('aria-busy'), 'true');
    });
  });

  it('a Shimmer mounted after an earlier one unmounted still pulses', async () => {
    // A skeleton shown, hidden once content loads, and shown again (another screen, a refresh).
    await withKitAsync(<Shimmer />, async () => { await settle(50); });
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      const samples = await sampleBackground(block(container));
      assert.ok(new Set(samples).size > 1, `background never changed: ${samples.join(' | ')}`);
    });
  });
});

// The pure counter: no timers, no React.
describe('createRefCountedLoop', () => {
  const make = () => {
    const calls: string[] = [];
    const loop = createRefCountedLoop(() => calls.push('start'), () => calls.push('stop'));
    return { calls, loop };
  };

  it('starts on the first user (0 → 1) and not again for later ones', () => {
    const { calls, loop } = make();
    loop.acquire();
    loop.acquire();
    assert.deepEqual(calls, ['start']);
    assert.equal(loop.count, 2);
  });

  it('stops only when the last user releases (1 → 0)', () => {
    const { calls, loop } = make();
    const a = loop.acquire();
    const b = loop.acquire();
    a();
    assert.deepEqual(calls, ['start']);
    b();
    assert.deepEqual(calls, ['start', 'stop']);
    assert.equal(loop.count, 0);
  });

  it('starts again after it has stopped (mount → unmount all → mount)', () => {
    const { calls, loop } = make();
    loop.acquire()();
    loop.acquire();
    assert.deepEqual(calls, ['start', 'stop', 'start']);
  });

  it('releasing twice does not release another user', () => {
    const { calls, loop } = make();
    const a = loop.acquire();
    loop.acquire();
    a();
    a();
    assert.equal(loop.count, 1);
    assert.deepEqual(calls, ['start']);
  });
});

// The real shared clock, wired to `Animated.loop`: one loop for any number of Shimmers, stopped when
// the last unmounts, started again by the next mount.
describe('sharedPulseClock', () => {
  it('runs one Animated.loop for any number of Shimmers, stops it on the last unmount, and restarts it', () => {
    const started: number[] = [];
    const stopped: number[] = [];
    let id = 0;
    const loopSpy = mock.method(Animated, 'loop', (() => {
      const mine = ++id;
      return { start: () => started.push(mine), stop: () => stopped.push(mine) };
    }) as never);
    try {
      assert.equal(sharedPulseClock.count, 0);
      const a = sharedPulseClock.acquire();
      const b = sharedPulseClock.acquire(); // two Shimmers together share ONE loop
      assert.equal(loopSpy.mock.callCount(), 1);
      assert.deepEqual(started, [1]);

      a();
      assert.deepEqual(stopped, []); // one still mounted → keeps pulsing
      b();
      assert.deepEqual(stopped, [1]); // last one gone → loop stopped

      const c = sharedPulseClock.acquire(); // navigate back: a fresh Shimmer mounts
      assert.deepEqual(started, [1, 2]); // …and the pulse runs again
      c();
      assert.deepEqual(stopped, [1, 2]);
      assert.equal(sharedPulseClock.count, 0);
    } finally {
      loopSpy.mock.restore();
    }
  });
});
