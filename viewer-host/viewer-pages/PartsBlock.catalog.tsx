import React from 'react';
import { Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, PartsBlock, defineCatalogPage } from '@krapwoo/ds-viewer';
import type { PartEntry, ReferenceNavigation } from '@krapwoo/ds-viewer';

const pill = (label: string) => (
  <View style={{ backgroundColor: CATALOG_COLOR.accent, paddingHorizontal: CATALOG_SPACE.lg, paddingVertical: CATALOG_SPACE.md, borderRadius: CATALOG_SPACE.xl }}>
    <Text style={{ ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.surface }}>{label}</Text>
  </View>
);

// A stand-in for the catalog: two pages that exist, and any other name does not resolve. Inside a
// real catalog `CatalogShell` supplies this, so a part opens its page.
const PAGES: Record<string, { title: string; label: string }> = {
  Button: { title: 'Button', label: 'Save' },
  Banner: { title: 'Banner', label: 'Heads up' },
};
const navigation: ReferenceNavigation = {
  resolve: (name) => (PAGES[name] ? { pageId: name } : undefined),
  open: () => undefined,
  page: (pageId) => ({ title: PAGES[pageId].title, source: { node: pill(PAGES[pageId].label) } }),
};

const parts = (...entries: Array<[string, string, 'built-in' | 'slot']>): PartEntry[] =>
  entries.map(([component, role, relationship]) => ({ entry: { component, role, relationship } }));

export default defineCatalogPage({
  component: 'PartsBlock',
  group: 'Components',
  standalone: 'Exported on its own, so a catalog can list the components a screen is built from outside SectionBlock.',
  whenToUse: 'The "Parts" block: the components a page is built from, shown on the page itself. SectionBlock and FamilyPage render one themselves from the page\'s composedOf, so use it directly only when composing a page yourself.',
  source: '../native/catalog/PartsBlock.tsx',
  composedOf: [{ component: 'OverviewCard', role: 'The card for each part that has its own page.', relationship: 'built-in' }],
  specimenSize: 'page',
  hide: { props: true },
  description: 'A card for each entry that resolves to another page (a live thumbnail of that page\'s first specimen, its title, and the entry\'s role as a one-line caption), then a plain row, name and role, for each that does not, so nothing declared is hidden. Cards share one height and wrap to the width. It renders nothing for no entries. The pages here are stand-ins, not a real catalog\'s.',
  a11y: 'A region labelled by its heading. Each card has one tab stop, its title link; the thumbnails are hidden from assistive technology.',
  variants: {
    maxColumns: 1,
    items: [
      { key: 'mixed', name: 'Two parts with pages, one without', node: <PartsBlock navigation={navigation} parts={parts(['Button', 'The primary action.', 'built-in'], ['Banner', 'Fills the top slot.', 'slot'], ['Spinner', 'Shown while loading.', 'built-in'])} /> },
      { key: 'family', name: 'Titled for a family page', node: <PartsBlock navigation={navigation} title="Uses these components" parts={parts(['Button', 'The primary action.', 'built-in'])} /> },
      { key: 'plain', name: 'No catalog to resolve against: plain rows only', node: <PartsBlock parts={parts(['Button', 'The primary action.', 'built-in'], ['Spinner', 'Shown while loading.', 'built-in'])} /> },
    ],
  },
});
