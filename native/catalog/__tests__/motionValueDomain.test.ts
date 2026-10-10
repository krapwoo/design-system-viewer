import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionReplayLabel, motionTranslatesDirectly, motionValueTarget } from '../motionValueDomain.ts';

test('distance domain targets the pixel distance itself and translates directly', () => {
  assert.equal(motionValueTarget('distance', 160), 160);
  assert.equal(motionTranslatesDirectly('distance'), true);
});

test('unit domain targets 1 and must interpolate to reach the pixel distance', () => {
  assert.equal(motionValueTarget('unit', 160), 1);
  assert.equal(motionTranslatesDirectly('unit'), false);
});

test('each Replay button gets a distinct accessible name from its label, or from its value when unlabeled', () => {
  assert.equal(motionReplayLabel({ kind: 'timing', duration: 150, label: '150ms · standard easing' }), 'Replay 150ms · standard easing');
  assert.equal(motionReplayLabel({ kind: 'timing', duration: 240 }), 'Replay 240ms timing');
  assert.equal(motionReplayLabel({ kind: 'spring' }), 'Replay spring');
});
