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
  group: 'Components',
  composedOf: [
    { component: 'Shimmer', role: 'Its children: the stacked Shimmers that stand in for one element, announced once as a single Loading region.', relationship: 'slot' },
  ],
  specimenSize: 'regular',
  description:
    'A wrapper for a composite skeleton — several Shimmers standing in for one real element — so it is announced as one loading region instead of once per block. It is a plain View: the layout (row, column, gap) comes from its `style`.',
  whenToUse:
    'Whenever two or more Shimmers stand in for one element (an avatar and its two text lines). A single lone Shimmer needs no wrapper; it announces itself. For an indeterminate wait with no known layout to mirror — a button mid-request, a full-screen wait — use Loading, not a skeleton at all.',
  a11y:
    'The group is a View with accessibilityRole="progressbar", `aria-busy` and an accessibilityLabel that defaults to "Loading" (the `label` prop; the default is English text and is not localised). A context flag makes every Shimmer inside drop its own progressbar role and label, so the whole skeleton is one announcement. The group does not set `accessible`, so whether a native screen reader treats it as a single element (rather than only reading the label) was not checked on a device. Breathing placed directly inside is already silent by default. The group itself has no motion; the Shimmer blocks it wraps follow the OS "reduce motion" setting and render static while it is on (a Breathing placed inside does the same).',
  // No visual variants/states — it's a transparent a11y wrapper. The one example shows the
  // composite it wraps; Props + Accessibility document its contract.
  hide: { states: true },
  notes: [
    'Only a Shimmer drops its announcement inside the group; a Breathing given its own `accessibilityRole` or `accessibilityLabel` would still speak.',
    '`label` is the accessible name for the whole region; it is not drawn.',
  ],
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
