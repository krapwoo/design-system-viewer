import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DividedStack, TokenDetails, TokenGrid, TokenTile, VariantGroup } from '@krapwoo/ds-viewer';
import { AnimatedChevron } from '../components/AnimatedChevron';
import { InputClearButton } from '../components/InputClearButton';
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
  chevronPair: { flexDirection: 'row', gap: DS_SPACING[800] },
  // A TokenGrid sizes its tiles from its own width, so it must fill the group rather than shrink to fit.
  tileGrid: { alignSelf: 'stretch' },
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
      {/* Two small icon components live here, as tiles, instead of on pages of their own: the page
          lists them in `documents`, and each tile is bound to its component with `documents=…`, so
          a link, an anatomy pin or a search hit for the component opens this page at its tile. */}
      <VariantGroup name="Icon components" desc="small components that draw an icon, documented here rather than on pages of their own" align="left">
        <View style={styles.tileGrid}>
        <TokenGrid minTileWidth={200}>
          <TokenTile
            documents="AnimatedChevron"
            name="Animated chevron"
            value="AnimatedChevron"
            note="Flips between down (collapsed) and up (expanded) in place. Banner's collapsible header uses it."
            action={<TokenDetails title="Animated chevron" kicker="Icon component" source="components/AnimatedChevron/AnimatedChevron.tsx:24" />}
          >
            <View style={styles.chevronPair}>
              <AnimatedChevron expanded={false} size={DS_ICON_SIZE.lg} />
              <AnimatedChevron expanded size={DS_ICON_SIZE.lg} />
            </View>
          </TokenTile>
          <TokenTile
            documents="InputClearButton"
            name="Clear button"
            value="InputClearButton"
            note="The × InputField and SearchField show once a field holds a value. 24px, padded to a 44pt touch target."
            action={<TokenDetails title="Clear button" kicker="Icon component" source="components/InputClearButton/InputClearButton.tsx:26" />}
          >
            <InputClearButton onPress={() => {}} />
          </TokenTile>
        </TokenGrid>
        </View>
      </VariantGroup>
    </DividedStack>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  documents: [
    { component: 'AnimatedChevron', title: 'Animated chevron' },
    { component: 'InputClearButton', title: 'Clear button' },
  ],
  description: 'Every icon available to the Icon component, plus the DS_ICON_SIZE steps it can be rendered at — pair an icon\'s size with the text scale beside it. Also documents the two small icon components, AnimatedChevron and InputClearButton.',
  tokenGallery: true,
  render: () => <IconsGallery />,
});
