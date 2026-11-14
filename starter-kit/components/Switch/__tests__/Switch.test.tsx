// react-native-web reads only `aria-*`, never the `accessibilityState` object.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withKit } from '../../../../test/renderKit';
import { Switch } from '../Switch';

const control = (root: HTMLElement) => root.querySelector<HTMLElement>('[role="switch"]')!;

describe('Switch state attributes', () => {
  it('on reports aria-checked true', () => {
    withKit(<Switch value onValueChange={() => {}} label="Notifications" />, ({ container }) => {
      assert.equal(control(container).getAttribute('aria-checked'), 'true');
    });
  });

  it('off reports aria-checked false (not omitted)', () => {
    withKit(<Switch value={false} onValueChange={() => {}} label="Notifications" />, ({ container }) => {
      assert.equal(control(container).getAttribute('aria-checked'), 'false');
    });
  });

  it('disabled reports aria-disabled', () => {
    withKit(<Switch value onValueChange={() => {}} label="Notifications" disabled />, ({ container }) => {
      assert.equal(control(container).getAttribute('aria-disabled'), 'true');
    });
  });
});
