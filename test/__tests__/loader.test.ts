import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the loader can import a catalog component that uses JSX, react-native and extensionless imports', async () => {
  // FamilyPage is the hardest case in the repo: JSX, a `react-native` import, and extensionless
  // relative imports (`./tokens`, `./SectionBlock`). If this imports, every lighter component will.
  const mod = await import('../../native/catalog/FamilyPage.tsx');
  assert.equal(typeof mod.FamilyPage, 'function', 'FamilyPage must be an importable component');
  assert.equal(typeof mod.AnatomyPin, 'function', 'its named exports must come through too');
});
