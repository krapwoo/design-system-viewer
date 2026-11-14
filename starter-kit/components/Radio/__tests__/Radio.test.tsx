// A radio's state is `checked`: ARIA has no `aria-selected` on role="radio".
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withKit } from '../../../../test/renderKit';
import { Radio } from '../Radio';

const radio = (root: HTMLElement) => root.querySelector<HTMLElement>('[role="radio"]')!;

describe('Radio state attributes', () => {
  it('selected reports aria-checked true, and no aria-selected', () => {
    withKit(<Radio selected onPress={() => {}} label="Uptown" />, ({ container }) => {
      assert.equal(radio(container).getAttribute('aria-checked'), 'true');
      assert.equal(radio(container).hasAttribute('aria-selected'), false);
    });
  });

  it('unselected reports aria-checked false (not omitted)', () => {
    withKit(<Radio selected={false} onPress={() => {}} label="Uptown" />, ({ container }) => {
      assert.equal(radio(container).getAttribute('aria-checked'), 'false');
      assert.equal(radio(container).hasAttribute('aria-selected'), false);
    });
  });

  it('disabled reports aria-disabled', () => {
    withKit(<Radio selected onPress={() => {}} label="Uptown" disabled />, ({ container }) => {
      assert.equal(radio(container).getAttribute('aria-disabled'), 'true');
    });
  });
});
