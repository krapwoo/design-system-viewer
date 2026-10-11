import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { defineCatalogPage, Swatch, CATALOG_COLOR } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  stack: { gap: 12 },
  tokenUse: { fontSize: 12, color: CATALOG_COLOR.textMuted },
});

function ColorsGallery() {
  // `code` is a font-family name, not a color — shown separately below instead of as a broken swatch.
  const colorEntries = Object.entries(CATALOG_COLOR).filter(([key]) => key !== 'code');
  return (
    <View style={demo.stack}>
      <View style={demo.row}>
        {colorEntries.map(([name, value]) => (
          <Swatch key={name} name={name} value={value} width={116} />
        ))}
      </View>
      <Text style={demo.tokenUse}>
        code — {CATALOG_COLOR.code} (the monospace font for prop names/types/file-path chips).
      </Text>
    </View>
  );
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  tokenGallery: true,
  description: 'The catalog chrome\'s own color set — a neutral greyscale plus one accent, used only for the catalog\'s own UI (sidebar, headings, prop tables, cards). Deliberately independent of the host app\'s DS palette.',
  render: () => <ColorsGallery />,
});
