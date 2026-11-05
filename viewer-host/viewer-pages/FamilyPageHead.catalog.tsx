import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { FamilyPageHead } from '../../native/catalog/FamilyPage';

const pager = { previousId: 'Button', nextId: 'Banner', onNavigate: () => {}, labelOf: (id: string) => id };

export default defineCatalogPage({
  component: 'FamilyPageHead',
  title: 'Family page head',
  group: 'Components',
  source: '../native/catalog/FamilyPage.tsx',
  specimenSize: 'page',
  hide: { props: true },
  composedOf: [{ component: 'SectionPagerRow', role: 'The previous/next row beside the title.', relationship: 'built-in' }],
  description: 'The page head FamilyPage and GroupPage both render: breadcrumb, banner, title and description, a one-line explainer of the page kind, and the pager. Factored out once rather than duplicated between the two.',
  whenToUse: 'Reach for FamilyPageHead only when building a third page shape that needs this exact same head; FamilyPage and GroupPage already render it for you.',
  a11y: "Renders the page's aria-level 1 heading target, the same one every page's title uses.",
  variants: {
    items: [
      { key: 'family', name: 'A family page, with a pager', props: { kind: 'family' }, node: <FamilyPageHead kind="family" def={{ id: 'Example', title: 'Example', description: 'A made-up family page.' }} groupLabel="Components" breadcrumbRoot="Example catalog" pager={pager} /> },
      { key: 'group', name: 'A group page, with no pager', props: { kind: 'group' }, node: <FamilyPageHead kind="group" def={{ id: 'ExampleGroup', title: 'Example group', description: 'A made-up group page.' }} groupLabel="Components" breadcrumbRoot="Example catalog" /> },
    ],
  },
});
