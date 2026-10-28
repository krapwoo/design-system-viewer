import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the loader can import a catalog component that uses JSX, react-native and extensionless imports', async () => {
  // FamilyPage is the hardest case in the repo: JSX, a `react-native` import, and extensionless
  // relative imports (`./tokens`, `./SectionBlock`). If this imports, every lighter component will.
  const mod = await import('../../native/catalog/FamilyPage.tsx');
  assert.equal(typeof mod.FamilyPage, 'function', 'FamilyPage must be an importable component');
  const anatomy = await import('../../native/catalog/Anatomy.tsx');
  assert.equal(typeof anatomy.AnatomyPin, 'function', 'AnatomyPin (moved to Anatomy.tsx) must be importable');
});

test('a catalog component renders real DOM through react-native-web', async () => {
  const { PagerButton } = await import('../../native/catalog/SectionBlock.tsx');
  const { renderCatalog } = await import('../renderCatalog.tsx');
  const React = (await import('react')).default;
  const { container, cleanup } = renderCatalog(
    React.createElement(PagerButton as never, {
      direction: 'next',
      targetId: 'NextPage',
      onNavigate: () => {},
      labelOf: (id: string) => id,
    } as never),
  );
  const button = container.querySelector('[aria-label]');
  assert.ok(button, 'the component must render an accessible control into the DOM');
  assert.equal(button!.getAttribute('aria-label'), 'Next: NextPage', 'react-native-web must forward the accessibility label to the DOM');
  cleanup();
});
