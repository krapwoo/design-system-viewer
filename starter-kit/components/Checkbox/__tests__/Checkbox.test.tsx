// react-native-web reads only `aria-*` (never the `accessibilityState` object), so the state has to
// arrive as these props for a web screen reader to hear it. (The kit's Checkbox has no mixed state.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withKit } from '../../../../test/renderKit';
import { Checkbox } from '../Checkbox';

const box = (root: HTMLElement) => root.querySelector<HTMLElement>('[role="checkbox"]')!;

describe('Checkbox state attributes', () => {
  it('checked reports aria-checked true', () => {
    withKit(<Checkbox checked onChange={() => {}} label="Agree" />, ({ container }) => {
      assert.equal(box(container).getAttribute('aria-checked'), 'true');
    });
  });

  it('unchecked reports aria-checked false (not omitted)', () => {
    withKit(<Checkbox checked={false} onChange={() => {}} label="Agree" />, ({ container }) => {
      assert.equal(box(container).getAttribute('aria-checked'), 'false');
    });
  });

  it('disabled reports aria-disabled', () => {
    withKit(<Checkbox checked onChange={() => {}} label="Agree" disabled />, ({ container }) => {
      assert.equal(box(container).getAttribute('aria-disabled'), 'true');
    });
  });
});
