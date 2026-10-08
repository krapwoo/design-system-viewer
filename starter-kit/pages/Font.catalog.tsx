import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DividedStack, VariantGroup, TypeScaleGallery } from '@krapwoo/ds-viewer';
import { DS_FONT_WEIGHT, DS_FONT_WEIGHT_USE, DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY, type FontWeightName } from '../tokens';

const styles = StyleSheet.create({
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  previewLabel: { minWidth: 64, ...DS_TYPOGRAPHY.labelSm, color: DS_SEMANTIC.text.regular },
  previewValue: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
  // Font page — the "is a typeface actually set" fact needs to read at a glance, not be buried in
  // the explanatory paragraph below it.
  typefaceStatus: { ...DS_TYPOGRAPHY.labelSm, color: DS_SEMANTIC.text.regular },
  typefaceNote: { marginTop: DS_SPACING[400] },
});

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The typeface in use, and the font-weight scale on its own — most components get their weight via a DS_TYPOGRAPHY token\'s embedded fontWeight rather than DS_FONT_WEIGHT directly.',
  tokenGallery: true,
  render: () => (
    <DividedStack>
      <VariantGroup name="Typeface" desc="which font family renders every token on this page" align="left">
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Font family</Text>
          <Text style={styles.typefaceStatus}>None set — falls back to the OS default</Text>
        </View>
        <Text style={[styles.previewValue, styles.typefaceNote]}>
          No custom typeface is loaded anywhere in this template — every DS_TYPOGRAPHY / DS_FONT_WEIGHT
          token renders in the OS default system font: San Francisco on iOS, Roboto on Android, the
          browser's system-ui stack on web (which is what you're seeing on this page right now). To
          use a custom font instead, load it (e.g. via expo-font's useFonts) and add a fontFamily
          field to each DS_TYPOGRAPHY token — none currently set one.
        </Text>
      </VariantGroup>
      <VariantGroup name="Weight" desc="DS_FONT_WEIGHT, in isolation" align="left">
        <TypeScaleGallery
          steps={Object.keys(DS_FONT_WEIGHT) as FontWeightName[]}
          sampleStyle={(name) => ({ fontSize: 16, fontWeight: DS_FONT_WEIGHT[name] })}
          meta={(name) => DS_FONT_WEIGHT[name]}
          useNotes={DS_FONT_WEIGHT_USE}
        />
      </VariantGroup>
    </DividedStack>
  ),
});
