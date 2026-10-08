import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logoLayout, LOGO_WORDMARK_MIN_ASPECT } from '../logoLayout.ts';

test('logoLayout falls back to "text" for an unknown or invalid aspect', () => {
  assert.equal(logoLayout(undefined), 'text');
  assert.equal(logoLayout(NaN), 'text');
  assert.equal(logoLayout(0), 'text');
  assert.equal(logoLayout(-1), 'text');
});

test('logoLayout is "mark" at and below the 2:1 threshold', () => {
  assert.equal(logoLayout(1), 'mark');
  assert.equal(logoLayout(2), 'mark');
});

test('logoLayout is "wordmark" above the 2:1 threshold', () => {
  assert.equal(logoLayout(2.01), 'wordmark');
  assert.equal(logoLayout(4.58), 'wordmark');
});

test('LOGO_WORDMARK_MIN_ASPECT is 2', () => {
  assert.equal(LOGO_WORDMARK_MIN_ASPECT, 2);
});
