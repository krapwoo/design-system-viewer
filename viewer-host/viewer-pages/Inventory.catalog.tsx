import React from 'react';
import { Text } from 'react-native';
import { defineCatalogPage, Inventory, InventoryGroup, InventoryTile, CATALOG_COLOR, CATALOG_TEXT } from '@krapwoo/ds-viewer';

// Each tile stands for a page of this catalog, so its title is that page's own title and its link opens it.
const sample = (name: string) => <Text style={{ ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.textMuted }}>{name} specimen</Text>;
const tile = (name: string, tags?: string[]) => <InventoryTile key={name} target={name} tags={tags} specimen={sample(name)} />;

export default defineCatalogPage({
  component: 'Inventory',
  group: 'Components',
  source: '../native/catalog/Inventory.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: "A category overview's inventory with its filters: its `InventoryGroup`s under one row of chips that are the numbers. One chip for `All N`, one per group and one per tag a tile declares (`tags`), each with the count it will show. Pressing a chip shows exactly those tiles and hides the rest; pressing it again, or All, shows everything. Every count is read from the tiles the groups draw, so none can disagree with what is below it. A number that filters nothing belongs in the page's `WarningBanner`, not in a chip. It follows the token-page layout: a page whose `render` is an `Inventory` (a `WarningBanner` above it in a fragment is fine, nothing after it) draws the banner and the chips at page level and gives each group its own section, an uppercase title and description outside and the tiles in the group's own bordered box, built from the same parts as a token page's sections. Anywhere else (inside a section or an example, where a box already surrounds it) the chips and every group stay in that one box. `layout` overrides either way.",
  composedOf: [
    { component: 'JumpChip', role: 'Each chip: the same toggle chip a token page uses', relationship: 'built-in' },
    { component: 'InventoryGroup', role: 'Each group the chips count and filter', relationship: 'slot' },
  ],
  whenToUse: "On a category overview page, in place of bare `InventoryGroup`s, when the category has more than one group or a tag worth filtering by. With a single group and no tags there is nothing to choose between, so no chips are drawn. Pass `InventoryGroup`s directly, each holding its `InventoryTile`s directly: a group wrapped in a component of your own is drawn in full and neither counted nor filtered; a tile wrapped that way inside a group is counted and filtered as a tile with no tags.",
  a11y: 'The chips are buttons that report `aria-pressed`, in a group named "Filter the inventory"; Tab reaches them and Enter or Space presses one. A polite live region beside them says "Showing 3 of 12" after each change; it is drawn only while a filter narrows the list (under All it is visually hidden but still announced).',
  variants: {
    maxColumns: 1,
    items: [
      {
        key: 'sections',
        name: 'Sections (the token-page layout, the default at page level)',
        props: { layout: 'sections' },
        fill: true,
        node: (
          <Inventory layout="sections">
            <InventoryGroup title="Counts and notes" description="Blocks that say how much there is, or what to know first.">
              {[tile('CountStrip'), tile('WarningBanner', ['Used on overview pages'])]}
            </InventoryGroup>
            <InventoryGroup title="Token layouts" description="Blocks a token page is drawn with.">
              {[tile('TokenGrid', ['Used on overview pages']), tile('TokenTile'), tile('TokenRow')]}
            </InventoryGroup>
          </Inventory>
        ),
      },
      {
        key: 'inline',
        name: 'Inline (everything in the box it is placed in)',
        props: { layout: 'inline' },
        fill: true,
        node: (
          <Inventory layout="inline">
            <InventoryGroup title="Counts and notes" description="Blocks that say how much there is, or what to know first.">
              {[tile('CountStrip'), tile('WarningBanner', ['Used on overview pages'])]}
            </InventoryGroup>
            <InventoryGroup title="Token layouts" description="Blocks a token page is drawn with.">
              {[tile('TokenGrid', ['Used on overview pages']), tile('TokenTile'), tile('TokenRow')]}
            </InventoryGroup>
          </Inventory>
        ),
      },
    ],
  },
});
