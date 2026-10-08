import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenRow } from '@krapwoo/ds-viewer';
import { DS_RADIUS, DS_RADIUS_STEPS, DS_RADIUS_USE, DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../tokens';

const styles = StyleSheet.create({
  tokenStack: { gap: DS_SPACING[800] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  previewLabel: { minWidth: 64, ...DS_TYPOGRAPHY.labelSm, color: DS_SEMANTIC.text.regular },
  previewValue: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
  radiusBox: { width: 40, height: 40, backgroundColor: DS_SEMANTIC.emphasis.info, borderWidth: StyleSheet.hairlineWidth, borderColor: DS_SEMANTIC.border.light },
});

function RadiusGallery() {
  return (
    <View style={styles.tokenStack}>
      {DS_RADIUS_STEPS.map((step, i) => (
        <TokenRow key={step} use={DS_RADIUS_USE[step]} last={i === DS_RADIUS_STEPS.length - 1}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>{step}</Text>
            <View style={[styles.radiusBox, { borderRadius: DS_RADIUS[step] }]} />
            <Text style={styles.previewValue}>{DS_RADIUS[step]}px</Text>
          </View>
        </TokenRow>
      ))}
    </View>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The corner-radius scale, each step with a grounded "when to use this" note from DS_RADIUS_USE. Reference steps directly — DS_RADIUS.medium, never a raw 12 — the key union is typo-safe by itself.',
  tokenGallery: true,
  render: () => <RadiusGallery />,
});
