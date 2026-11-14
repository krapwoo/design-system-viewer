// Ported from QQ's `Shimmer.test.tsx`. QQ mocks `useReduceMotion`; here the real hook runs against
// react-native-web's `AccessibilityInfo`, whose reduce-motion source the harness controls
// (`setReduceMotion` in test/domBootstrap.ts) — so the OS-setting path is exercised too.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { settle, sleep, withKitAsync } from '../../../../test/renderKit';
import { setReduceMotion } from '../../../../test/domBootstrap';
import { Shimmer, SkeletonGroup } from '../Shimmer';

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

  // Must stay the FIRST test in this file: Shimmer's pulse clock is one module-level loop that starts on
  // the first mount and is never restarted (see the todo test at the end), so only the first Shimmer a
  // process mounts is guaranteed to animate.
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
      // `accessibilityState: { busy: true }` is not translated by react-native-web — see the todo below.
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

  it('a shimmer exposes aria-busy to the web', { todo: 'react-native-web 0.21 drops accessibilityState, so the busy state reaches no web screen reader' }, async () => {
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      assert.equal(block(container).getAttribute('aria-busy'), 'true');
    });
  });

  it('a Shimmer mounted after an earlier one unmounted still pulses', { todo: 'the shared pulse loop is stopped when the last Shimmer detaches, but `sharedProgressStarted` stays true, so it never restarts' }, async () => {
    // A skeleton shown, hidden once content loads, and shown again (another screen, a refresh).
    await withKitAsync(<Shimmer />, async () => { await settle(50); });
    await withKitAsync(<Shimmer />, async ({ container }) => {
      await settle();
      const samples = await sampleBackground(block(container));
      assert.ok(new Set(samples).size > 1, `background never changed: ${samples.join(' | ')}`);
    });
  });
});
