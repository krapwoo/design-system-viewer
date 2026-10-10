import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionTranslatesDirectly, motionValueTarget } from '../motionValueDomain.ts';

test('distance domain targets the pixel distance itself and translates directly', () => {
  assert.equal(motionValueTarget('distance', 160), 160);
  assert.equal(motionTranslatesDirectly('distance'), true);
});

test('unit domain targets 1 and must interpolate to reach the pixel distance', () => {
  assert.equal(motionValueTarget('unit', 160), 1);
  assert.equal(motionTranslatesDirectly('unit'), false);
});
