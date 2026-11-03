import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, Swatch, type TokenSection } from '@krapwoo/ds-viewer';
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

const swatchRow = (entries: [string, string][], width?: number) => (
  <View style={styles.row}>
    {entries.map(([name, value]) => (
      <Swatch key={name} name={name} value={value} valueLabel={width ? colorValueLabel(value) : undefined} width={width} />
    ))}
  </View>
);

// One section per kind of colour, as a token page draws them: the title and description outside, the
// swatches in the section's own box.
const COLOR_SECTIONS: TokenSection[] = [
  ...SEMANTIC_GROUPS.map((group) => ({ title: group.name, desc: group.desc, render: () => swatchRow(group.entries, 100) })),
  {
    title: 'interaction.disabledOpacity',
    desc: 'not a color — opacity applied to a whole disabled tappable element',
    render: () => <Text style={styles.previewValue}>{DS_SEMANTIC.interaction.disabledOpacity}</Text>,
  },
  ...(Object.keys(DS_PALETTE) as PaletteName[]).map((hue) => ({
    title: `Palette · ${hue}`,
    desc: 'raw ramp, 0 → 800',
    render: () => swatchRow(Object.entries(DS_PALETTE[hue]).map(([step, value]) => [`${hue}.${step}`, value] as [string, string])),
  })),
];

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The color tokens the whole system is built from — saturated semantic accents and the raw grey ramp, each shown at its real value.',
  tokenGallery: true,
  tokenColumns: 1,
  tokenSections: COLOR_SECTIONS,
});
