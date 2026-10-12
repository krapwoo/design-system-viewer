import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenGrid, TokenTile, CATALOG_COLOR, CATALOG_RADIUS } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  box: { width: 56, height: 56, backgroundColor: CATALOG_COLOR.accentSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.accent },
});

const RADII = Object.entries(CATALOG_RADIUS) as [string, number][];
const tiles = (note?: (name: string) => string) =>
  RADII.map(([name, value]) => (
    <TokenTile key={name} name={name} value={`${value}px`} note={note?.(name)}>
      <View style={[demo.box, { borderRadius: value }]} />
    </TokenTile>
  ));

export default defineCatalogPage({
  component: 'TokenGrid',
  group: 'Components',
  source: '../native/catalog/TokenLayouts.tsx',
  // Tile counts per row are only observable in a cell wider than a few tiles.
  specimenSize: 'page',
  hide: { props: true },
  description: "Equal tiles in as many columns as fit (`minTileWidth`, default 140; `maxColumns` caps them). Each TokenTile shows a small preview, the token's name, its value and an optional grounded note. Every tile in a grid is the same width, so the previews line up down the columns.",
  whenToUse: 'Tokens with a small self-contained preview: radius, shadow, control height, a single colour. For a narrow sample with a long note, use TokenRow with notePlacement="right".',
  a11y: 'Plain text and views: the name and value are real text, so a token is readable without seeing its preview.',
  variants: {
    // One grid per row, so a capped grid is visibly different from an uncapped one.
    maxColumns: 1,
    items: [
      { key: 'fit', name: 'As many columns as fit', fill: true, node: <TokenGrid>{tiles()}</TokenGrid> },
      // A cap keeps a short scale reading as one deliberate row instead of spreading on a wide window.
      { key: 'capped', name: 'maxColumns: 3', fill: true, node: <TokenGrid maxColumns={3}>{tiles()}</TokenGrid> },
      { key: 'wide', name: 'A wider minTileWidth, with notes', fill: true, node: <TokenGrid minTileWidth={220}>{tiles((name) => `Used by the ${name} corner of cards and controls.`)}</TokenGrid> },
    ],
  },
});
