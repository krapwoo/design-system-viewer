// Ported from QQ's `Button.test.tsx`. The pure `getStandardHitSlop` tests port as-is.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withKit } from '../../../../test/renderKit';
import { DS_A11Y_MIN_TOUCH_TARGET, DS_SPACING } from '../../../tokens';
import { Button, getStandardHitSlop } from '../Button';

describe('getStandardHitSlop', () => {
  // small: paddingVertical 8, 16pt line, 2×2pt border => 36pt visual height.
  it('lifts a small label button (36pt) to the 44pt minimum, vertically only', () => {
    const slop = getStandardHitSlop(DS_SPACING[400], 16);
    assert.deepEqual(slop, { top: 4, bottom: 4 });
    assert.ok(36 + slop!.top + slop!.bottom >= DS_A11Y_MIN_TOUCH_TARGET);
  });

  it('needs no hitSlop for medium (46pt) or large (56pt)', () => {
    assert.equal(getStandardHitSlop(DS_SPACING[600], 18), undefined);
    assert.equal(getStandardHitSlop(DS_SPACING[800], 20), undefined);
  });
});

// QQ's 'Button hitSlop wiring' (3 tests) asserts the `hitSlop` prop each Button hands its Pressable.
// react-native-web's Pressable accepts `hitSlop` and puts nothing in the DOM for it — no attribute,
// no extra element — so there is no rendered output to assert on. Skipped rather than faked:
//   - small label-only and small icon+label buttons get the 4pt vertical slop
//   - medium and large label buttons need none
//   - ghost and icon-only keep their own (pre-existing) slop
// The numbers themselves are covered above; the wiring is only covered on QQ's side.

// react-native-web reads only `aria-*` (never the `accessibilityState` object), so the state has to
// arrive as these props for a web screen reader to hear it.
describe('Button state attributes', () => {
  const button = (root: HTMLElement) => root.querySelector<HTMLElement>('[role="button"]')!;

  it('enabled reports aria-busy false and is not marked aria-disabled', () => {
    withKit(<Button label="Save" onPress={() => {}} />, ({ container }) => {
      // react-native-web's Pressable writes aria-disabled only when it is true.
      assert.notEqual(button(container).getAttribute('aria-disabled'), 'true');
      assert.equal(button(container).getAttribute('aria-busy'), 'false');
    });
  });

  it('disabled reports aria-disabled', () => {
    withKit(<Button label="Save" onPress={() => {}} disabled />, ({ container }) => {
      assert.equal(button(container).getAttribute('aria-disabled'), 'true');
    });
  });

  it('loading reports aria-busy, and is disabled while it loads', () => {
    withKit(<Button label="Save" onPress={() => {}} loading />, ({ container }) => {
      assert.equal(button(container).getAttribute('aria-busy'), 'true');
      assert.equal(button(container).getAttribute('aria-disabled'), 'true');
    });
  });
});
