// Ported from QQ's `Pill.test.tsx`. Asserts on the react-native-web DOM: `accessibilityRole` is the
// element's `role`, `accessibilityLabel` its `aria-label`, and "is a Pressable" is observable as
// "focusable and reacts to a click".
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { withKit, withKitAsync } from '../../../../test/renderKit';
import { Pill } from '../Pill';

/** The pill's own container — the outermost element. */
const container = (root: HTMLElement) => root.firstElementChild as HTMLElement;

describe('Pill accessibility', () => {
  it('a selected pill with onPress is announced as a selected button', () => {
    withKit(<Pill label="Hiking" variant="selected" onPress={() => {}} />, ({ container: root }) => {
      const pill = container(root);
      assert.equal(pill.getAttribute('role'), 'button');
      assert.equal(pill.getAttribute('aria-label'), 'Hiking');
      assert.equal(pill.getAttribute('aria-selected'), 'true');
    });
  });

  it('a selected pill without onPress exposes its label, but no button role', () => {
    withKit(<Pill label="Hiking" variant="selected" />, ({ container: root }) => {
      const pill = container(root);
      assert.equal(pill.hasAttribute('role'), false);
      assert.equal(pill.getAttribute('aria-label'), 'Hiking');
    });
  });

  it('a selected pill honours accessibilityLabel over the visible label', () => {
    withKit(<Pill label="3" variant="selected" accessibilityLabel="3 filters" onPress={() => {}} />, ({ container: root }) => {
      assert.equal(container(root).getAttribute('aria-label'), '3 filters');
    });
  });

  it('a selected disabled or loading pill reports disabled/busy', () => {
    withKit(<Pill variant="selected" onPress={() => {}} disabled />, ({ container: root }) => {
      assert.equal(container(root).getAttribute('aria-disabled'), 'true');
      assert.equal(container(root).getAttribute('aria-busy'), 'false');
    });
    withKit(<Pill variant="selected" onPress={() => {}} loading />, ({ container: root }) => {
      assert.equal(container(root).getAttribute('aria-disabled'), 'true');
      assert.equal(container(root).getAttribute('aria-busy'), 'true');
    });
  });

  it('an unselected pill with onPress is still an unselected, focusable button', () => {
    withKit(<Pill label="Hiking" variant="not_selected" onPress={() => {}} />, ({ container: root }) => {
      const pill = container(root);
      assert.equal(pill.tagName, 'BUTTON');
      assert.equal(pill.getAttribute('role'), 'button');
      assert.equal(pill.getAttribute('tabindex'), '0');
      assert.equal(pill.getAttribute('aria-selected'), 'false');
    });
  });

  it('only the unselected pill is a Pressable', async () => {
    let unselectedPresses = 0;
    let selectedPresses = 0;
    const rendered = <>
      <Pill label="Off" variant="not_selected" onPress={() => { unselectedPresses++; }} />
      <Pill label="On" variant="selected" onPress={() => { selectedPresses++; }} />
    </>;
    await withKitAsync(rendered, async ({ container: root }) => {
      const [off, on] = Array.from(root.children) as HTMLElement[];
      assert.equal(on.hasAttribute('tabindex'), false, 'a selected pill is not keyboard-focusable');
      await act(async () => { on.click(); });
      await act(async () => { off.click(); });
    });
    assert.equal(unselectedPresses, 1);
    assert.equal(selectedPresses, 0);
  });

  it('a selected pill exposes aria-selected to the web', () => {
    withKit(<Pill label="Hiking" variant="selected" onPress={() => {}} />, ({ container: root }) => {
      assert.equal(container(root).getAttribute('aria-selected'), 'true');
    });
  });
});
