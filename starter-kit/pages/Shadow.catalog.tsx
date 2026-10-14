import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenGrid, TokenTile } from '@krapwoo/ds-viewer';
import { DS_RADIUS, DS_SEMANTIC, DS_SHADOW, DS_SHADOW_USE, DS_SPACING, type ShadowToken } from '../tokens';

const styles = StyleSheet.create({
  // A shadow is cast *onto* something. On the catalog's own white card the elevated surface is
  // white on white and the token reads as an empty space, so each tile gives it a tinted backdrop
  // to fall on — the same reason a product screen sits a card on a page colour, not on paper.
  stage: {
    backgroundColor: DS_SEMANTIC.surface.main,
    borderRadius: DS_RADIUS.small,
    paddingVertical: DS_SPACING[800],
    alignItems: 'center',
  },
  surface: {
    width: 76,
    height: 48,
    borderRadius: DS_RADIUS.medium,
    backgroundColor: DS_SEMANTIC.surface.white,
  },
});

function ShadowGallery() {
  const steps = Object.keys(DS_SHADOW) as ShadowToken[];
  return (
    // Tiles: an elevation preview is small and self-contained, and seeing `resting` beside
    // `bottomSheet` is the only way to judge how much stronger one lift is than another.
    <TokenGrid minTileWidth={170}>
      {steps.map((step) => (
        <TokenTile key={step} name={step} note={DS_SHADOW_USE[step]}>
          <View style={styles.stage}>
            <View style={[styles.surface, DS_SHADOW[step]]} />
          </View>
        </TokenTile>
      ))}
    </TokenGrid>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'Elevation tokens as ready-to-spread React Native style objects (shadowColor/Offset/Opacity/Radius + Android elevation).',
  tokenGallery: true,
  render: () => <ShadowGallery />,
});
