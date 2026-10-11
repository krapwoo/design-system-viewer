import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenGrid, TokenTile, CATALOG_COLOR, CATALOG_RADIUS } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  box: { width: 56, height: 56, backgroundColor: CATALOG_COLOR.accentSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.accent },
});

export default defineCatalogPage({
  component: 'TokenGrid',
  group: 'Components',
  source: '../native/catalog/TokenLayouts.tsx',
  previewWidths: 'full',
  description: "Equal tiles in as many columns as fit (`minTileWidth`, default 140; `maxColumns` caps them). Each TokenTile shows a small preview, the token's name, its value and an optional grounded note.",
  whenToUse: 'Tokens with a small self-contained preview: radius, shadow, control height, a single colour. For a narrow sample with a long note, use TokenRow with notePlacement="right".',
  a11y: 'Plain text and views; the name and value are real text.',
  render: () => (
    <TokenGrid>
      {(Object.entries(CATALOG_RADIUS) as [string, number][]).map(([name, value]) => (
        <TokenTile key={name} name={name} value={`${value}px`}>
          <View style={[demo.box, { borderRadius: value }]} />
        </TokenTile>
      ))}
    </TokenGrid>
  ),
});
