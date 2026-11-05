import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { PartOfLine } from '../../native/catalog/FamilyPage';

const partOf = { pageId: 'FamilyPage', title: 'FamilyPage', number: '3' };

export default defineCatalogPage({
  component: 'PartOfLine',
  title: 'Part-of line',
  group: 'Components',
  source: '../native/catalog/FamilyPage.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  description: 'A group member\'s "Part N of <Family>" line, shown when that member is also an external part of some family\'s outline. It links to the family page.',
  whenToUse: 'Reach for PartOfLine only from GroupPage\'s own rendering of a top-level member that has a `partOf`; never directly from a catalog page.',
  a11y: 'A plain line of text with one real link inside it, the same convention every other below-specimens link here uses. When the family page does not resolve it is plain text, never a dead link.',
  variants: {
    items: [
      { key: 'link', name: 'The family page resolves: a real link', node: <PartOfLine partOf={partOf} resolvesAddress={() => true} navigation={{ resolve: (name) => ({ pageId: name }), open: () => undefined, page: () => undefined }} /> },
      { key: 'plain', name: 'The family page does not resolve: plain text', node: <PartOfLine partOf={partOf} resolvesAddress={() => false} /> },
    ],
  },
});
