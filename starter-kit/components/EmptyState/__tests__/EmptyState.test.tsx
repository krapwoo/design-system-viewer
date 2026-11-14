// Ported from QQ's `EmptyState.test.tsx`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { withKit } from '../../../../test/renderKit';
import { EmptyState } from '../EmptyState';

const empty = <EmptyState title="No trips yet" description="Plan one." action={{ label: 'Start', onPress: () => {} }} />;

describe('EmptyState accessibility', () => {
  it('the title is a heading', () => {
    withKit(empty, ({ container }) => {
      const headings = container.querySelectorAll('[role="heading"]');
      assert.equal(headings.length, 1);
      assert.equal(headings[0].textContent, 'No trips yet');
    });
  });

  // QQ: 'the icon avatar sits inside a wrapper hidden from assistive tech on iOS and Android'. The
  // wrapper carries `accessibilityElementsHidden` and `importantForAccessibility`, which are iOS/Android
  // props that react-native-web does not translate — the DOM has no wrapper to find. Skipped; what the
  // web does with that avatar is the todo test below.

  it('no unnamed image is exposed to assistive tech', { todo: 'on web the icon avatar is a role="img" with no name and no aria-hidden: the iOS/Android hiding props do not reach the DOM' }, () => {
    withKit(empty, ({ container }) => {
      const exposedUnnamed = Array.from(container.querySelectorAll('[role="img"]')).filter(
        (img) => !img.hasAttribute('aria-label') && !img.closest('[aria-hidden="true"]'),
      );
      assert.equal(exposedUnnamed.length, 0);
    });
  });

  it('the action is still a labelled button', () => {
    withKit(empty, ({ container }) => {
      const buttons = container.querySelectorAll('[role="button"]');
      assert.equal(buttons.length, 1);
      assert.equal(buttons[0].getAttribute('aria-label'), 'Start');
      // QQ also asserts hitSlop === { top: 4, bottom: 4 }; react-native-web renders no hitSlop (see
      // Button.test.tsx), so that half is skipped.
    });
  });
});
