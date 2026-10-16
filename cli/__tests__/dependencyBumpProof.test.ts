// cli/__tests__/dependencyBumpProof.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeNpmLockfileBump, isSafePackageJsonBump } from '../dependencyBumpProof.ts';

function pkg(deps: Record<string, string>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ name: 'hermex', ...extra, dependencies: deps });
}

test('isSafePackageJsonBump: an exact-version bump to currentVersion is safe', () => {
  assert.equal(isSafePackageJsonBump(pkg({ '@krapwoo/ds-viewer': '0.3.0' }), pkg({ '@krapwoo/ds-viewer': '0.4.0' }), '0.4.0'), true);
});

test('isSafePackageJsonBump: a caret or tilde bump to currentVersion is safe', () => {
  assert.equal(isSafePackageJsonBump(pkg({ '@krapwoo/ds-viewer': '^0.3.0' }), pkg({ '@krapwoo/ds-viewer': '^0.4.0' }), '0.4.0'), true);
  assert.equal(isSafePackageJsonBump(pkg({ '@krapwoo/ds-viewer': '~0.3.0' }), pkg({ '@krapwoo/ds-viewer': '~0.4.0' }), '0.4.0'), true);
});

test('isSafePackageJsonBump: devDependencies is just as safe as dependencies', () => {
  const head = JSON.stringify({ name: 'hermex', devDependencies: { '@krapwoo/ds-viewer': '0.3.0' } });
  const working = JSON.stringify({ name: 'hermex', devDependencies: { '@krapwoo/ds-viewer': '0.4.0' } });
  assert.equal(isSafePackageJsonBump(head, working, '0.4.0'), true);
});

test('isSafePackageJsonBump: a bump to anything other than currentVersion is unsafe', () => {
  assert.equal(isSafePackageJsonBump(pkg({ '@krapwoo/ds-viewer': '0.3.0' }), pkg({ '@krapwoo/ds-viewer': '0.4.1' }), '0.4.0'), false);
});

test('isSafePackageJsonBump: a local/path/workspace spec is never safe, even naming currentVersion elsewhere', () => {
  for (const spec of ['file:../ds-viewer', 'link:../ds-viewer', 'workspace:*', 'portal:../ds-viewer', '../ds-viewer']) {
    assert.equal(isSafePackageJsonBump(pkg({ '@krapwoo/ds-viewer': '0.3.0' }), pkg({ '@krapwoo/ds-viewer': spec }), '0.4.0'), false, spec);
  }
});

test('isSafePackageJsonBump: a second, unrelated field changed alongside the bump is unsafe (mixed edit)', () => {
  const head = pkg({ '@krapwoo/ds-viewer': '0.3.0' });
  const working = pkg({ '@krapwoo/ds-viewer': '0.4.0' }, { description: 'new' });
  assert.equal(isSafePackageJsonBump(head, working, '0.4.0'), false);
});

test('isSafePackageJsonBump: moving the entry to a different section is unsafe (more than one leaf differs)', () => {
  const head = JSON.stringify({ name: 'hermex', dependencies: { '@krapwoo/ds-viewer': '0.3.0' } });
  const working = JSON.stringify({ name: 'hermex', devDependencies: { '@krapwoo/ds-viewer': '0.4.0' } });
  assert.equal(isSafePackageJsonBump(head, working, '0.4.0'), false);
});

test('isSafePackageJsonBump: a newly added entry (absent at HEAD) is unsafe, not just a changed value', () => {
  const head = JSON.stringify({ name: 'hermex', dependencies: {} });
  const working = JSON.stringify({ name: 'hermex', dependencies: { '@krapwoo/ds-viewer': '0.4.0' } });
  assert.equal(isSafePackageJsonBump(head, working, '0.4.0'), false);
});

// Minor finding, successor review: the HEAD spec must itself name a version strictly older than
// currentVersion — a same-version range edit (HEAD "^0.4.0" -> working "0.4.0" at currentVersion
// "0.4.0") must not be accepted as a previously-finished bump.
test('isSafePackageJsonBump: a HEAD spec already at currentVersion is unsafe, even though the working spec is an accepted registry form', () => {
  assert.equal(isSafePackageJsonBump(pkg({ '@krapwoo/ds-viewer': '^0.4.0' }), pkg({ '@krapwoo/ds-viewer': '0.4.0' }), '0.4.0'), false);
});

test('isSafePackageJsonBump: a genuine forward bump (HEAD older than currentVersion) is still safe', () => {
  assert.equal(isSafePackageJsonBump(pkg({ '@krapwoo/ds-viewer': '^0.3.0' }), pkg({ '@krapwoo/ds-viewer': '0.4.0' }), '0.4.0'), true);
});

test('isSafePackageJsonBump: malformed JSON on either side is unsafe', () => {
  const valid = pkg({ '@krapwoo/ds-viewer': '0.4.0' });
  assert.equal(isSafePackageJsonBump('{ not json', valid, '0.4.0'), false);
  assert.equal(isSafePackageJsonBump(valid, '{ not json', '0.4.0'), false);
});

function lockV3(version: string, deps: Record<string, string> = {}): string {
  return JSON.stringify({
    name: 'hermex',
    lockfileVersion: 3,
    packages: {
      '': { name: 'hermex', dependencies: { '@krapwoo/ds-viewer': version, ...deps } },
      'node_modules/@krapwoo/ds-viewer': { version, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${version}.tgz`, integrity: `sha512-${version}` },
    },
  });
}

test('isSafeNpmLockfileBump: a v3 lockfile bumped only in the root declaration and the package entry is safe', () => {
  assert.equal(isSafeNpmLockfileBump(lockV3('0.3.0'), lockV3('0.4.0'), '0.4.0'), true);
});

// Minor finding, successor review: the v2/v3 lockfile's root declaration must likewise require the
// HEAD spec to be strictly older than currentVersion.
test('isSafeNpmLockfileBump: a v3 root declaration already at currentVersion at HEAD is unsafe, even though the working value is an accepted registry form', () => {
  function lockV3RootOnly(rootVersion: string, entryVersion: string): string {
    return JSON.stringify({
      name: 'hermex',
      lockfileVersion: 3,
      packages: {
        '': { name: 'hermex', dependencies: { '@krapwoo/ds-viewer': `^${rootVersion}` } },
        'node_modules/@krapwoo/ds-viewer': { version: entryVersion, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${entryVersion}.tgz`, integrity: `sha512-${entryVersion}` },
      },
    });
  }
  assert.equal(isSafeNpmLockfileBump(lockV3RootOnly('0.4.0', '0.3.0'), lockV3('0.4.0'), '0.4.0'), false);
});

function lockV2WithLegacyMirror(version: string): string {
  return JSON.stringify({
    name: 'hermex',
    lockfileVersion: 2,
    packages: {
      '': { name: 'hermex', dependencies: { '@krapwoo/ds-viewer': version } },
      'node_modules/@krapwoo/ds-viewer': { version, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${version}.tgz`, integrity: `sha512-${version}` },
    },
    dependencies: { '@krapwoo/ds-viewer': { version, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${version}.tgz`, integrity: `sha512-${version}` } },
  });
}

test('isSafeNpmLockfileBump: a v2 lockfile\'s legacy mirror tree is redacted too', () => {
  assert.equal(isSafeNpmLockfileBump(lockV2WithLegacyMirror('0.3.0'), lockV2WithLegacyMirror('0.4.0'), '0.4.0'), true);
});

test('isSafeNpmLockfileBump: a v2 legacy mirror entry resolving a version other than currentVersion is unsafe, even though packages[...] matches', () => {
  const head = JSON.parse(lockV2WithLegacyMirror('0.3.0'));
  const working = JSON.parse(lockV2WithLegacyMirror('0.4.0'));
  (working.dependencies['@krapwoo/ds-viewer'] as { version: string }).version = '0.4.1';
  assert.equal(isSafeNpmLockfileBump(JSON.stringify(head), JSON.stringify(working), '0.4.0'), false);
});

function lockV1(version: string): string {
  return JSON.stringify({ name: 'hermex', lockfileVersion: 1, dependencies: { '@krapwoo/ds-viewer': { version, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${version}.tgz`, integrity: `sha512-${version}` } } });
}

test('isSafeNpmLockfileBump: a v1 lockfile\'s single entry (root declaration and lock entry in one) is safe', () => {
  assert.equal(isSafeNpmLockfileBump(lockV1('0.3.0'), lockV1('0.4.0'), '0.4.0'), true);
});

test('isSafeNpmLockfileBump: a resolved version other than currentVersion is unsafe', () => {
  assert.equal(isSafeNpmLockfileBump(lockV3('0.3.0'), lockV3('0.4.1'), '0.4.0'), false);
});

test('isSafeNpmLockfileBump: an unrelated package\'s entry also changing is unsafe', () => {
  const head = JSON.parse(lockV3('0.3.0'));
  const working = JSON.parse(lockV3('0.4.0'));
  working.packages['node_modules/other-pkg'] = { version: '2.0.0' };
  assert.equal(isSafeNpmLockfileBump(JSON.stringify(head), JSON.stringify(working), '0.4.0'), false);
});

test('isSafeNpmLockfileBump: an unsupported lockfileVersion is unsafe', () => {
  const head = JSON.stringify({ lockfileVersion: 4, packages: {} });
  const working = JSON.stringify({ lockfileVersion: 4, packages: {} });
  assert.equal(isSafeNpmLockfileBump(head, working, '0.4.0'), false);
});

test('isSafeNpmLockfileBump: a lockfileVersion mismatch between HEAD and working is unsafe', () => {
  assert.equal(isSafeNpmLockfileBump(lockV1('0.3.0'), lockV3('0.4.0'), '0.4.0'), false);
});

test('isSafeNpmLockfileBump: malformed JSON on either side is unsafe', () => {
  assert.equal(isSafeNpmLockfileBump('{ not json', lockV3('0.4.0'), '0.4.0'), false);
  assert.equal(isSafeNpmLockfileBump(lockV3('0.3.0'), '{ not json', '0.4.0'), false);
});

function lockV3MismatchedEntry(rootVersion: string, entryVersion: string): string {
  return JSON.stringify({
    name: 'hermex',
    lockfileVersion: 3,
    packages: {
      '': { name: 'hermex', dependencies: { '@krapwoo/ds-viewer': rootVersion } },
      'node_modules/@krapwoo/ds-viewer': { version: entryVersion, resolved: `https://registry.npmjs.org/@krapwoo/ds-viewer/-/ds-viewer-${entryVersion}.tgz`, integrity: `sha512-${entryVersion}` },
    },
  });
}

test('isSafeNpmLockfileBump: a v2/v3 node_modules entry resolving a version other than currentVersion is unsafe, even when the root declaration matches currentVersion', () => {
  assert.equal(isSafeNpmLockfileBump(lockV3('0.3.0'), lockV3MismatchedEntry('0.4.0', '0.4.1'), '0.4.0'), false);
});

test('isSafeNpmLockfileBump: a v1 entry resolving a version other than currentVersion is unsafe, even if nothing else in the lockfile differs', () => {
  assert.equal(isSafeNpmLockfileBump(lockV1('0.3.0'), lockV1('0.9.9'), '0.4.0'), false);
});

test('isSafeNpmLockfileBump: missing packages["" ] root or the package\'s own entry is unsafe', () => {
  const noRoot = JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/@krapwoo/ds-viewer': { version: '0.4.0' } } });
  assert.equal(isSafeNpmLockfileBump(lockV3('0.3.0'), noRoot, '0.4.0'), false);
  const noEntry = JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { '@krapwoo/ds-viewer': '0.4.0' } } } });
  assert.equal(isSafeNpmLockfileBump(lockV3('0.3.0'), noEntry, '0.4.0'), false);
});
