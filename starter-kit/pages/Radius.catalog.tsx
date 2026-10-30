import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenDetails, TokenGrid, TokenTile } from '@krapwoo/ds-viewer';
import { DS_RADIUS, DS_RADIUS_STEPS, DS_RADIUS_USE, DS_SEMANTIC } from '../tokens';

// Where DS_RADIUS is declared, for each tile's "Details ›" panel: a path from the kit's root (the
// folder `init` copies it into), with no line number, which would drift the day scales.ts changes.
const RADIUS_SOURCE = 'tokens/scales.ts';

const styles = StyleSheet.create({
  // Square, so the corner is read as a corner rather than as the end of a bar. Large enough that
  // 4px and 8px are still telling apart at a glance.
  radiusBox: {
    width: 64,
    height: 64,
    backgroundColor: DS_SEMANTIC.emphasis.info,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS_SEMANTIC.border.light,
  },
});

function RadiusGallery() {
  return (
    // Tiles, not rows: a radius preview is small and self-contained, so the steps belong side by
    // side where `xs` can be compared against `large` directly — which is the only way to read a
    // scale. A row each would put them 100px apart vertically and leave the right half of every
    // row empty.
    <TokenGrid minTileWidth={150}>
      {DS_RADIUS_STEPS.map((step) => (
        // The tile shows the specimen and its value; where it is defined and when to use it sit in
        // "Details ›", so a tile stays as short as its neighbours however long the note is.
        <TokenTile
          key={step}
          name={step}
          value={`${DS_RADIUS[step]}px`}
          action={<TokenDetails title={step} kicker="Corner radius" expression={`DS_RADIUS.${step}`} source={RADIUS_SOURCE} usageSummary={DS_RADIUS_USE[step]} />}
        >
          <View style={[styles.radiusBox, { borderRadius: DS_RADIUS[step] }]} />
        </TokenTile>
      ))}
    </TokenGrid>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The corner-radius scale, each step with its value and a Details › panel holding its source and the "when to use this" note from DS_RADIUS_USE. Reference steps directly — DS_RADIUS.medium, never a raw 12 — the key union is typo-safe by itself.',
  tokenGallery: true,
  render: () => <RadiusGallery />,
});
