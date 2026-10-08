import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DividedStack, VariantGroup, Swatch } from '@krapwoo/ds-viewer';
import { DS_PALETTE, DS_SEMANTIC, colorValueLabel, type PaletteName } from '../tokens';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  previewValue: { fontSize: 13, color: DS_SEMANTIC.text.muted },
});

const SEMANTIC_GROUPS: { name: string; desc: string; entries: [string, string][] }[] = [
  { name: 'Semantic · surface', desc: 'page and card backgrounds', entries: Object.entries(DS_SEMANTIC.surface) },
  { name: 'Semantic · text', desc: 'text colors', entries: Object.entries(DS_SEMANTIC.text) },
  { name: 'Semantic · border', desc: 'dividers and outlines', entries: Object.entries(DS_SEMANTIC.border) },
  { name: 'Semantic · interaction', desc: 'pressed/hover/focus overlays', entries: Object.entries(DS_SEMANTIC.interaction).filter(([name]) => name !== 'disabledOpacity') as [string, string][] },
  { name: 'Semantic · element', desc: 'dividers and backdrops', entries: Object.entries(DS_SEMANTIC.element) },
  { name: 'Semantic · emphasis', desc: 'saturated status accents', entries: Object.entries(DS_SEMANTIC.emphasis) },
  { name: 'Semantic · shade', desc: 'tinted status fills', entries: Object.entries(DS_SEMANTIC.shade) },
];

function ColorsGallery() {
  const paletteHues = Object.keys(DS_PALETTE) as PaletteName[];
  return (
    <DividedStack>
      {SEMANTIC_GROUPS.map((group) => (
        <VariantGroup key={group.name} name={group.name} desc={group.desc} align="left">
          <View style={styles.row}>
            {group.entries.map(([name, value]) => (
              <Swatch key={name} name={name} value={value} valueLabel={colorValueLabel(value)} width={100} />
            ))}
          </View>
        </VariantGroup>
      ))}
      <VariantGroup name="interaction.disabledOpacity" desc="not a color — opacity applied to a whole disabled tappable element" align="left">
        <Text style={styles.previewValue}>{DS_SEMANTIC.interaction.disabledOpacity}</Text>
      </VariantGroup>
      {paletteHues.map((hue) => (
        <VariantGroup key={hue} name={`Palette · ${hue}`} desc="raw ramp, 0 → 800" align="left">
          <View style={styles.row}>
            {Object.entries(DS_PALETTE[hue]).map(([step, value]) => (
              <Swatch key={step} name={`${hue}.${step}`} value={value} />
            ))}
          </View>
        </VariantGroup>
      ))}
    </DividedStack>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The color tokens the whole system is built from — saturated semantic accents and the raw grey ramp, each shown at its real value.',
  tokenGallery: true,
  render: () => <ColorsGallery />,
});
