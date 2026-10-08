// cli/__tests__/kitRoot.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveKitRoot } from '../kitRoot.ts';

test('resolveKitRoot uses the explicit starterKit.root when set', () => {
  const root = resolveKitRoot({ starterKit: { version: '0.4.0', root: 'apps/mobile/src/ds' }, components: ['apps/mobile/src/ds/components/*/index.ts'] });
  assert.equal(root, 'apps/mobile/src/ds');
});

test('resolveKitRoot infers the root from the first components glob when root is absent (a 0.2/0.3 config)', () => {
  const root = resolveKitRoot({ starterKit: { version: '0.3.0' }, components: ['src/ds/components/*/index.ts'] });
  assert.equal(root, 'src/ds');
});

test('resolveKitRoot returns undefined when the project has no starterKit at all (not a kit project)', () => {
  const root = resolveKitRoot({ starterKit: undefined, components: ['src/components/*/index.ts'] });
  assert.equal(root, undefined);
});

test('resolveKitRoot returns undefined when starterKit is set but components is empty', () => {
  const root = resolveKitRoot({ starterKit: { version: '0.4.0' }, components: [] });
  assert.equal(root, undefined);
});
