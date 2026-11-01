import React from 'react';
import { Text } from 'react-native';
import { defineCatalogPage, InventoryGroup, InventoryTile, CATALOG_COLOR, CATALOG_TEXT } from '@krapwoo/ds-viewer';

// Each tile stands for a page of this catalog, so its title is that page's own title and its link opens it.
const MEMBERS = ['CountStrip', 'WarningBanner', 'TokenGrid', 'TokenTile', 'TokenRow'];
const sample = (name: string) => <Text style={{ ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.textMuted }}>{name} specimen</Text>;
const group = (count: number) => (
  <InventoryGroup title="Building blocks" description="Pieces of the viewer that category pages and token pages are drawn with.">
    {MEMBERS.slice(0, count).map((name) => <InventoryTile key={name} target={name} specimen={sample(name)} />)}
  </InventoryGroup>
);

export default defineCatalogPage({
  component: 'InventoryGroup',
  group: 'Components',
  source: '../native/catalog/Inventory.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: "One group of a category overview page's inventory: a title with its count in it (`Building blocks · 5`), a plain-English description, then its `InventoryTile`s as flat tiles in the same responsive grid as a `TokenGrid` (260px at least, up to four across). Three or five tiles sit three across, never four and an orphan. A group with no tiles renders nothing.",
  composedOf: [
    { component: 'VariantGroup', role: 'Title with its count, and the description', relationship: 'built-in' },
    { component: 'TokenGrid', role: 'The responsive grid the tiles sit in', relationship: 'built-in' },
    { component: 'InventoryTile', role: 'Each member of the group', relationship: 'slot' },
  ],
  whenToUse: "On a category overview page (Buttons, Inputs), one group per reviewed way of splitting the category. Under the category's `CountStrip` and any `WarningBanner`. Not for tokens: use a `TokenGrid` of `TokenTile`s.",
  a11y: 'The title and description are plain text. Each tile has one tab stop, its title link; the specimens are hidden from assistive technology and inert.',
  variants: {
    maxColumns: 1,
    items: [
      { key: 'three', name: 'Three tiles: three across', fill: true, node: group(3) },
      { key: 'four', name: 'Four tiles: four across', fill: true, node: group(4) },
      { key: 'five', name: 'Five tiles: three across, then two', fill: true, node: group(5) },
    ],
  },
});
