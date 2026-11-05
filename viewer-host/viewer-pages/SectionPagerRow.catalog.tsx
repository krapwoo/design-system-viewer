import React from 'react';
import { defineCatalogPage, SectionPagerRow } from '@krapwoo/ds-viewer';

const labelOf = (id: string) => id;

export default defineCatalogPage({
  component: 'SectionPagerRow',
  title: 'Section pager row',
  group: 'Components',
  source: '../native/catalog/SectionBlock.tsx',
  specimenSize: 'regular',
  composedOf: [{ component: 'PagerButton', role: 'The previous and next buttons.', relationship: 'built-in' }],
  description: "The previous/next row at the top of a page, shared by SectionBlock, FamilyPage and GroupPage so a host page never builds its own pair of pager buttons.",
  whenToUse: 'Reuse SectionPagerRow for the previous/next row at the top of any whole-page layout that has a `pager`; pass the same `SectionPager` shape FamilyPage and SectionBlock already take.',
  a11y: "Adds no wrapping semantics of its own; each button's accessible name (from PagerButton) already states the direction and the neighbouring page's title.",
  variants: {
    items: [
      { key: 'both', name: 'A page on each side', node: <SectionPagerRow pager={{ previousId: 'Button', nextId: 'Banner', onNavigate: () => {}, labelOf }} /> },
      { key: 'first', name: 'The first page: no previous', node: <SectionPagerRow pager={{ previousId: null, nextId: 'Banner', onNavigate: () => {}, labelOf }} /> },
    ],
  },
});
