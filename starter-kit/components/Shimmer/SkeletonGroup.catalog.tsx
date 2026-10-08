import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Shimmer, SkeletonGroup } from './Shimmer';
import { DS_SPACING } from '../../tokens';

const styles = StyleSheet.create({
  shimmerLines: { flex: 1, gap: DS_SPACING[400] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
});

export default defineCatalogPage({
  component: 'SkeletonGroup',
  group: 'Sub-Parts',
  description: 'An accessibility wrapper for a composite skeleton — several Shimmers standing in for one real element (e.g. a list row: an avatar + a two-line label). It announces the whole thing as one "Loading" region and silences the individual blocks, so a screen reader says "Loading" once instead of once per Shimmer. Adds no layout of its own — pass your own flexDirection/gap via style.',
  whenToUse: 'Wrap 2+ Shimmers that together stand in for one element. A single lone Shimmer already announces on its own and needs no wrapper.',
  a11y: 'Carries accessibilityRole="progressbar" + accessibilityLabel (default "Loading") + accessibilityState={{ busy: true }} for the whole region; provides a context that makes every descendant Shimmer drop its own announcement. Net effect: one "Loading" announcement per skeleton, not one per block.',
  // No visual variants/states — it's a transparent a11y wrapper. The one example shows the
  // composite it wraps; Props + Accessibility document its contract.
  hide: { states: true },
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'composite',
        name: 'Wrapping a composite skeleton',
        node: (
          <SkeletonGroup style={styles.previewRow}>
            <Shimmer variant="circle" size={40} />
            <View style={styles.shimmerLines}>
              <Shimmer variant="text" width={160} />
              <Shimmer variant="text" width={112} />
            </View>
          </SkeletonGroup>
        ),
      },
    ],
  },
});
