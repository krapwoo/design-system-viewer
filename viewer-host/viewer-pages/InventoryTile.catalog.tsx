import React from 'react';
import { Text, View } from 'react-native';
import { defineCatalogPage, InventoryTile, CountStrip, WarningBanner, CATALOG_COLOR, CATALOG_TEXT } from '@krapwoo/ds-viewer';

const sample = <Text style={{ ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.textMuted }}>A specimen</Text>;

const dot = <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: CATALOG_COLOR.accent }} />;

export default defineCatalogPage({
  component: 'InventoryTile',
  group: 'Components',
  source: '../native/catalog/Inventory.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  propNotes: {
    target: "The page id, or a member's id, the tile stands for (a leading `#` is allowed). The link text is that page's or member's own title, never an id; a member with no title shows a readable name, and a target that resolves to nothing shows it as text.",
    tags: "Named sets the tile belongs to (`['Draws its own shape']`). An enclosing `Inventory` turns each into a filter chip with a count; the tile itself draws nothing for them.",
    specimen: "The node drawn on the specimen stage. Leave it out for a page target and that page's own first specimen is drawn, scaled to fit. A specimen that fills a screen's width is laid out on the 402px reference and scaled down to the tile, exactly as a page tile is; one that keeps its own size is drawn at real size.",
    fixedSize: "`true` (or the specimen's widest side in px) for a specimen whose size does not depend on the screen's width: an avatar, badge, dot, icon, a button sized to its label. A group whose tiles are all `fixedSize` uses narrower tiles and more columns. It only sizes the grid; the scale a specimen is drawn at is always measured, on web only (elsewhere a tile scales the full cell width (402px by default), so a fixed-size specimen comes out smaller than real size).",
    fill: "Stretch the specimen to that width, as a `fill`/`itemsFill` specimen does on its page. A root with no width of its own (a `width: '100%'` panel) needs it, or it collapses to nothing. Off unless set: the target page's `fill` belongs to its first specimen, not to this part, so a badge on a filled row's page stays badge-sized. A page tile always follows its page. Drawn at the full width, capped at a phone's content width (370px, in a cell no wider than a phone; a wider `width` fills it) and centred, as on the page.",
    width: "The width the specimen is laid out at before it is scaled to the tile. Default 402; a member of a page that previews wider uses that page's first preview width.",
  },
  description: "One member of an inventory: its real specimen on a specimen stage, and under it its title as a link to its page. Flat: no card around the tile and none inside it. The title is resolved the way every other link in the catalog resolves one, so renaming a page renames the link. A tile whose page documents a style (`pageKind: 'style'`) also shows a small \"Style\" badge, and its link is named \"<title>, style\".",
  composedOf: [
    { component: 'SpecimenSurface', role: 'The stage the specimen sits on, and the "No specimen" stage', relationship: 'built-in' },
    { component: 'StyleBadge', role: 'The "Style" badge, when the tile\'s page documents a style', relationship: 'built-in' },
    { component: 'OverviewThumbnail', role: "Draws the specimen, given or the page's own first one, measured and scaled to fit the tile", relationship: 'built-in' },
  ],
  whenToUse: 'Inside an `InventoryGroup`, for each member of a category. For a single reference to a page inside running text, use a Composition or `relatedPages` entry instead.',
  a11y: "The title link is the tile's one tab stop. The specimen is decoration: hidden from assistive technology and inert, so nothing in it takes focus or a click.",
  variants: {
    items: [
      { key: 'specimen', name: 'An explicit specimen', props: { surface: 'auto' }, fill: true, node: <InventoryTile target="CountStrip" specimen={<CountStrip items={[{ label: 'Pages', value: 2 }, { label: 'Sizes', value: 3 }]} />} /> },
      { key: 'neutral', name: 'surface: neutral', props: { surface: 'neutral' }, fill: true, node: <InventoryTile target="CountStrip" surface="neutral" specimen={sample} /> },
      { key: 'white', name: 'surface: white', props: { surface: 'white' }, fill: true, node: <InventoryTile target="CountStrip" surface="white" specimen={sample} /> },
      { key: 'dark', name: 'surface: dark', props: { surface: 'dark' }, fill: true, node: <InventoryTile target="CountStrip" surface="dark" specimen={<Text style={{ ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.surface }}>On dark</Text>} /> },
      { key: 'transparent', name: 'surface: transparent', props: { surface: 'transparent' }, fill: true, node: <InventoryTile target="CountStrip" surface="transparent" specimen={sample} /> },
      { key: 'screen-wide', name: 'A screen-wide specimen, on the 402px reference like its page tile', fill: true, node: <InventoryTile target="WarningBanner" specimen={<WarningBanner title="One primary per surface">A screen has one primary button. Give every other action a lower variant.</WarningBanner>} /> },
      { key: 'fixed', name: 'A fixed-size specimen, at real size', props: { fixedSize: 24 }, fill: true, node: <InventoryTile target="CountStrip" fixedSize={24} specimen={dot} /> },
      { key: 'default', name: "No specimen: the page's own first specimen", fill: true, node: <InventoryTile target="WarningBanner" /> },
      { key: 'hash', name: 'A #address', fill: true, node: <InventoryTile target="#TokenGrid" /> },
      { key: 'readable', name: 'Nothing to resolve: a readable name', fill: true, node: <InventoryTile target="ChatTactileButtonStyle" specimen={<Text style={{ ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted }}>Not a page here</Text>} /> },
    ],
  },
});
