// react-native-web reads only `aria-*`, never the `accessibilityState` object, so `aria-selected`
// is what tells a web screen reader which tab is current.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withKit } from '../../../../test/renderKit';
import { SegmentedToggle } from '../SegmentedToggle';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const tabs = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));

describe('SegmentedToggle state attributes', () => {
  it('reports aria-selected true on the current option only', () => {
    withKit(<SegmentedToggle options={OPTIONS} value="b" onChange={() => {}} />, ({ container }) => {
      assert.deepEqual(tabs(container).map((t) => t.getAttribute('aria-selected')), ['false', 'true']);
    });
  });

  it('reports aria-selected false on every option when value matches none', () => {
    withKit(<SegmentedToggle options={OPTIONS} value="zzz" onChange={() => {}} />, ({ container }) => {
      assert.deepEqual(tabs(container).map((t) => t.getAttribute('aria-selected')), ['false', 'false']);
    });
  });
});
