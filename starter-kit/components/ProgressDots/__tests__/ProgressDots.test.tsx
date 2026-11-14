// react-native-web 0.21 drops `accessibilityValue`; the `aria-value*` props reach the DOM and native.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withKit } from '../../../../test/renderKit';
import { ProgressDots } from '../ProgressDots';

describe('ProgressDots value attributes', () => {
  it('reports its position as aria-valuemin / aria-valuemax / aria-valuenow', () => {
    withKit(<ProgressDots active={1} total={5} />, ({ container }) => {
      const bar = container.querySelector<HTMLElement>('[role="progressbar"]')!;
      assert.equal(bar.getAttribute('aria-valuemin'), '1');
      assert.equal(bar.getAttribute('aria-valuemax'), '5');
      assert.equal(bar.getAttribute('aria-valuenow'), '2');
      assert.equal(bar.getAttribute('aria-label'), 'Step 2 of 5');
    });
  });
});
