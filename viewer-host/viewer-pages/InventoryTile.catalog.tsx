import React from 'react';
import { Text } from 'react-native';
import { defineCatalogPage, InventoryTile, CountStrip, CATALOG_COLOR, CATALOG_TEXT } from '@krapwoo/ds-viewer';

const sample = <Text style={{ ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.textMuted }}>A specimen</Text>;

export default defineCatalogPage({
  component: 'InventoryTile',
  group: 'Components',
  source: '../native/catalog/Inventory.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  propNotes: {
    target: "The page id, or a member's id, the tile stands for (a leading `#` is allowed). The link text is that page's or member's own title, never an id; a member with no title shows a readable name, and a target that resolves to nothing shows it as text.",
    specimen: "The node drawn on the specimen stage. Leave it out for a page target and that page's own first specimen is drawn, scaled to fit.",
  },
  description: "One member of an inventory: its real specimen on a specimen stage, and under it its title as a link to its page. Flat: no card around the tile and none inside it. The title is resolved the way every other link in the catalog resolves one, so renaming a page renames the link.",
  composedOf: [
    { component: 'SpecimenSurface', role: 'The stage the specimen sits on', relationship: 'built-in' },
    { component: 'OverviewThumbnail', role: "A page's own first specimen, when none is given", relationship: 'built-in' },
  ],
  whenToUse: 'Inside an `InventoryGroup`, for each member of a category. For a single reference to a page inside running text, use a Composition or `relatedPages` entry instead.',
  a11y: "The title link is the tile's one tab stop. The specimen is decoration: hidden from assistive technology and inert, so nothing in it takes focus or a click.",
  variants: {
    items: [
      { key: 'specimen', name: 'An explicit specimen', props: { surface: 'auto' }, node: <InventoryTile target="CountStrip" specimen={<CountStrip items={[{ label: 'Pages', value: 2 }, { label: 'Sizes', value: 3 }]} />} /> },
      { key: 'neutral', name: 'surface: neutral', props: { surface: 'neutral' }, node: <InventoryTile target="CountStrip" surface="neutral" specimen={sample} /> },
      { key: 'white', name: 'surface: white', props: { surface: 'white' }, node: <InventoryTile target="CountStrip" surface="white" specimen={sample} /> },
      { key: 'dark', name: 'surface: dark', props: { surface: 'dark' }, node: <InventoryTile target="CountStrip" surface="dark" specimen={<Text style={{ ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.surface }}>On dark</Text>} /> },
      { key: 'transparent', name: 'surface: transparent', props: { surface: 'transparent' }, node: <InventoryTile target="CountStrip" surface="transparent" specimen={sample} /> },
      { key: 'default', name: "No specimen: the page's own first specimen", node: <InventoryTile target="WarningBanner" /> },
      { key: 'hash', name: 'A #address', node: <InventoryTile target="#TokenGrid" /> },
      { key: 'readable', name: 'Nothing to resolve: a readable name', node: <InventoryTile target="ChatTactileButtonStyle" specimen={<Text style={{ ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted }}>Not a page here</Text>} /> },
    ],
  },
});
