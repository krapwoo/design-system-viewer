import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenRow } from '@krapwoo/ds-viewer';
import { DS_RADIUS, DS_SEMANTIC, DS_SHADOW, DS_SHADOW_USE, DS_SPACING, DS_TYPOGRAPHY, type ShadowToken } from '../tokens';

const styles = StyleSheet.create({
  tokenStack: { gap: DS_SPACING[800] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  previewLabel: { minWidth: 64, ...DS_TYPOGRAPHY.labelSm, color: DS_SEMANTIC.text.regular },
  shadowBox: { width: 56, height: 40, borderRadius: DS_RADIUS.medium, backgroundColor: DS_SEMANTIC.surface.white },
});

function ShadowGallery() {
  const steps = Object.keys(DS_SHADOW) as ShadowToken[];
  return (
    <View style={styles.tokenStack}>
      {steps.map((step, i) => (
        <TokenRow key={step} use={DS_SHADOW_USE[step]} last={i === steps.length - 1}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>{step}</Text>
            <View style={[styles.shadowBox, DS_SHADOW[step]]} />
          </View>
        </TokenRow>
      ))}
    </View>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'Elevation tokens as ready-to-spread React Native style objects (shadowColor/Offset/Opacity/Radius + Android elevation).',
  tokenGallery: true,
  render: () => <ShadowGallery />,
});
