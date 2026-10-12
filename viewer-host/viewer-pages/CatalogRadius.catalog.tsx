import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenGrid, TokenTile, CATALOG_COLOR, CATALOG_RADIUS } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({ box: { width: 56, height: 56, backgroundColor: CATALOG_COLOR.surfaceMuted, borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong } });

// Notes from a usage scan of native/catalog (which components use each value).
const NOTES: Record<keyof typeof CATALOG_RADIUS, string> = {
  sm: 'Small chrome: the update banner\'s close button, sidebar rows, swatches, spacing bars.',
  control: 'Controls: the filter field, pager buttons, the motion Replay button.',
  md: 'Panels and frames: reference cards, the update page boxes, the phone frame.',
  card: 'Example cards: comparison lists, grids and grouped rows, token section cards.',
};

export default defineCatalogPage({
  title: 'Radius',
  group: 'Tokens',
  source: '../native/catalog/tokens.ts',
  tokenGallery: true,
  previewWidths: 'full',
  description: "The viewer's own corner radii (CATALOG_RADIUS).",
  render: () => (
    <TokenGrid>
      {(Object.keys(CATALOG_RADIUS) as (keyof typeof CATALOG_RADIUS)[]).map((name) => (
        <TokenTile key={name} name={name} value={`${CATALOG_RADIUS[name]}px`} note={NOTES[name]}>
          <View style={[demo.box, { borderRadius: CATALOG_RADIUS[name] }]} />
        </TokenTile>
      ))}
    </TokenGrid>
  ),
});
