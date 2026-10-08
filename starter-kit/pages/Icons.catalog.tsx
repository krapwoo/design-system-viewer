import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DividedStack, VariantGroup } from '@krapwoo/ds-viewer';
import { Icon } from '../icons/Icon.native';
import { ICON_PATHS, type IconName } from '../icons';
import { DS_ICON_SIZE, DS_ICON_SIZE_STEPS, DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../tokens';

const styles = StyleSheet.create({
  // Icons gallery — a size-comparison row, then a grid of every icon at a fixed size.
  iconSizeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: DS_SPACING[1200] },
  iconSizeItem: { alignItems: 'center', gap: DS_SPACING[200] },
  iconSizeLabel: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DS_SPACING[800] },
  iconGridItem: { width: 72, alignItems: 'center', gap: DS_SPACING[200] },
  iconGridLabel: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted, textAlign: 'center' },
});

function IconsGallery() {
  const names = Object.keys(ICON_PATHS) as IconName[];
  return (
    <DividedStack>
      <VariantGroup name="Sizes" desc="pair an icon with the text scale beside it" align="left">
        <View style={styles.iconSizeRow}>
          {DS_ICON_SIZE_STEPS.map((step) => (
            <View key={step} style={styles.iconSizeItem}>
              <Icon name="home" size={DS_ICON_SIZE[step]} />
              <Text style={styles.iconSizeLabel}>{step} · {DS_ICON_SIZE[step]}px</Text>
            </View>
          ))}
        </View>
      </VariantGroup>
      <VariantGroup name={`All icons (${names.length})`} desc="rendered at 24px" align="left">
        <View style={styles.iconGrid}>
          {names.map((name) => (
            <View key={name} style={styles.iconGridItem}>
              <Icon name={name} size={DS_ICON_SIZE.lg} />
              <Text style={styles.iconGridLabel} numberOfLines={1}>{name}</Text>
            </View>
          ))}
        </View>
      </VariantGroup>
    </DividedStack>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'Every icon available to the Icon component, plus the DS_ICON_SIZE steps it can be rendered at — pair an icon\'s size with the text scale beside it.',
  tokenGallery: true,
  render: () => <IconsGallery />,
});
