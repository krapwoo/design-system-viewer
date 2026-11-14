// Ported from QQ's `BottomSheet.test.tsx`. QQ mocks `Modal` and `Animated.timing` and inspects the props
// handed to them. Here the real react-native-web `Modal` and `Animated` run: the Modal is the
// `[aria-modal="true"]` element it portals into `document.body`, Escape/back is the keyup its
// `onRequestClose` listens for, and the exit animation is driven in real time.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { act } from 'react';
// renderKit first: react-native-web reads `window` once, as it loads (see test/domBootstrap.ts).
import { declaredStyle, settle, sleep, waitFor, withKitAsync } from '../../../../test/renderKit';
import { Animated, Text } from 'react-native';
import { DS_MOTION_DURATION } from '../../../tokens';
import { BottomSheet, animateSheet } from '../BottomSheet';

const content = <Text>content</Text>;
const modals = (body: HTMLElement) => Array.from(body.querySelectorAll<HTMLElement>('[aria-modal="true"]'));
const pressEscape = () => document.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));

describe('BottomSheet owns its Modal', () => {
  it('renders one transparent Modal with animationType="none" around the sheet', async () => {
    await withKitAsync(<BottomSheet visible onDismiss={() => {}}>{content}</BottomSheet>, async ({ body }) => {
      await settle();
      const [modal, ...rest] = modals(body);
      assert.equal(rest.length, 0, 'exactly one Modal');
      assert.equal(modal.getAttribute('role'), 'dialog');
      assert.equal(declaredStyle(modal)['background-color'], 'rgba(0,0,0,0.00)', 'transparent, not the opaque default');
      // `animationType="none"` leaves react-native-web's own wrapper without a CSS animation (a
      // "fade"/"slide" Modal would carry `animation-name` there) — the sheet's own motion is its own.
      for (let el = modal.parentElement; el && el !== body; el = el.parentElement) {
        assert.equal(declaredStyle(el)['animation-name'], undefined, 'no Modal-level animation');
      }
      assert.ok(modal.textContent!.includes('content'));
    });
  });

  it("wires the Modal's onRequestClose (Android back, web Escape) to onDismiss", async () => {
    let dismissed = 0;
    await withKitAsync(<BottomSheet visible onDismiss={() => { dismissed++; }}>{content}</BottomSheet>, async () => {
      await settle();
      await act(async () => { pressEscape(); });
      assert.equal(dismissed, 1);
    });
  });

  // QQ: 'asks for translucent status and navigation bars so ... reaches the screen edges on Android'.
  // `statusBarTranslucent` and `navigationBarTranslucent` are Android-only Modal props that
  // react-native-web ignores — nothing reaches the DOM to assert on. Skipped.

  it('renders no Modal while the sheet has never been visible', async () => {
    await withKitAsync(<BottomSheet visible={false} onDismiss={() => {}}>{content}</BottomSheet>, async ({ body }) => {
      await settle();
      assert.equal(modals(body).length, 0);
    });
  });

  it('tapping the backdrop calls onDismiss', async () => {
    let dismissed = 0;
    await withKitAsync(<BottomSheet visible onDismiss={() => { dismissed++; }}>{content}</BottomSheet>, async ({ body }) => {
      await settle();
      const backdrop = body.querySelector<HTMLElement>('[aria-label="Dismiss"]')!;
      await act(async () => { backdrop.click(); });
      assert.equal(dismissed, 1);
    });
  });
});

describe('BottomSheet keeps its Modal mounted through the exit animation', () => {
  const FAST = DS_MOTION_DURATION.fast;
  afterEach(() => settle());

  it('does not report exited when the close animation starts, only when it finishes', async () => {
    let exited = 0;
    const progress = new Animated.Value(1);
    animateSheet(progress, false, () => { exited++; });
    assert.equal(exited, 0);
    await sleep(FAST / 3);
    assert.equal(exited, 0, 'still mid-animation');
    await waitFor(() => exited > 0, 'the close animation to finish');
    assert.equal(exited, 1);
    assert.equal((progress as unknown as { __getValue(): number }).__getValue(), 0, 'closed towards 0');
  });

  it('does not report exited when the close is interrupted (the sheet reopened mid-exit)', async () => {
    let exited = 0;
    const progress = new Animated.Value(1);
    const stop = animateSheet(progress, false, () => { exited++; });
    await sleep(FAST / 3);
    stop();
    await sleep(FAST);
    assert.equal(exited, 0);
    assert.ok((progress as unknown as { __getValue(): number }).__getValue() > 0, 'never reached closed');
  });

  it('never reports exited for an open animation, even when it finishes', async () => {
    let exited = 0;
    const progress = new Animated.Value(0);
    animateSheet(progress, true, () => { exited++; });
    await waitFor(() => (progress as unknown as { __getValue(): number }).__getValue() === 1, 'the open animation to finish');
    await sleep(50);
    assert.equal(exited, 0);
  });

  it('returns a cleanup that stops the animation', async () => {
    const progress = new Animated.Value(0);
    const read = () => (progress as unknown as { __getValue(): number }).__getValue();
    const stop = animateSheet(progress, true, () => {});
    await sleep(FAST / 3);
    stop();
    const stoppedAt = read();
    assert.ok(stoppedAt > 0 && stoppedAt < 1, `stopped part-way, at ${stoppedAt}`);
    await sleep(FAST);
    assert.equal(read(), stoppedAt, 'no further movement after cleanup');
  });

  // Not in QQ: the same guarantee through the component — visible=false keeps the Modal until the
  // exit animation has played, then removes it.
  it('the component keeps its Modal through the exit, then unmounts it', async () => {
    const handle: { setVisible: (visible: boolean) => void } = { setVisible: () => {} };
    function Harness() {
      const [visible, setVisible] = useState(true);
      handle.setVisible = setVisible;
      return <BottomSheet visible={visible} onDismiss={() => {}}>{content}</BottomSheet>;
    }
    await withKitAsync(<Harness />, async ({ body }) => {
      await settle();
      assert.equal(modals(body).length, 1);
      await act(async () => { handle.setVisible(false); });
      assert.equal(modals(body).length, 1, 'still mounted while the exit plays');
      await waitFor(() => modals(body).length === 0, 'the Modal to unmount after the exit');
    });
  });
});
