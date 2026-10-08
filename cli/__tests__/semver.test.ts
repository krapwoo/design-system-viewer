// cli/__tests__/semver.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, isBreakingUpgrade, parseVersion } from '../semver.ts';

test('parseVersion reads major.minor.patch', () => {
  assert.deepEqual(parseVersion('0.4.0'), { major: 0, minor: 4, patch: 0, prerelease: undefined });
});

test('parseVersion keeps a prerelease tag separate from the numeric parts', () => {
  assert.deepEqual(parseVersion('0.3.1-e2e-spike'), { major: 0, minor: 3, patch: 1, prerelease: 'e2e-spike' });
});

test('parseVersion throws on a string with no numeric major.minor.patch', () => {
  assert.throws(() => parseVersion('latest'), /Not a version/);
});

test('compareVersions orders by major, then minor, then patch', () => {
  assert.equal(compareVersions(parseVersion('0.3.0'), parseVersion('0.4.0')), -1);
  assert.equal(compareVersions(parseVersion('0.4.1'), parseVersion('0.4.0')), 1);
  assert.equal(compareVersions(parseVersion('1.0.0'), parseVersion('0.9.9')), 1);
  assert.equal(compareVersions(parseVersion('0.4.0'), parseVersion('0.4.0')), 0);
});

test('isBreakingUpgrade is true only when the major version increases', () => {
  assert.equal(isBreakingUpgrade(parseVersion('0.4.0'), parseVersion('1.0.0')), true);
  assert.equal(isBreakingUpgrade(parseVersion('0.4.0'), parseVersion('0.5.0')), false);
  assert.equal(isBreakingUpgrade(parseVersion('1.2.0'), parseVersion('1.3.0')), false);
});
