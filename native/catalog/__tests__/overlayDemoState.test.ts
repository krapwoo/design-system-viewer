import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlayTrigger } from '../overlayDemoState.ts';

test('the trigger hides while the overlay is open, unless keepTrigger', () => {
  assert.deepEqual(overlayTrigger(false, { triggerLabel: 'Open sheet' }), { visible: true, label: 'Open sheet' });
  assert.deepEqual(overlayTrigger(true, { triggerLabel: 'Open sheet' }), { visible: false, label: 'Open sheet' });
  assert.deepEqual(overlayTrigger(true, { triggerLabel: 'Toggle', keepTrigger: true }), { visible: true, label: 'Toggle' });
});

test('a function label follows the open state (toggle demos)', () => {
  const triggerLabel = (open: boolean) => (open ? 'Hide toast' : 'Show toast');
  assert.equal(overlayTrigger(false, { triggerLabel, keepTrigger: true }).label, 'Show toast');
  assert.equal(overlayTrigger(true, { triggerLabel, keepTrigger: true }).label, 'Hide toast');
});
