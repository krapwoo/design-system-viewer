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
  component: 'Shimmer',
  group: 'Components',
  specimenSize: 'regular',
  description: 'Loading placeholders that breathe while content loads. `text` stands in for one line of text (an element with 3 lines gets 3 stacked `text` Shimmers, not one tall one), `circle` is always for a circular element, and `container` covers everything else (Card, Banner, image, …) — sized to match the real element it replaces, not an arbitrary block. When several stand in for one element, wrap them in `SkeletonGroup`.',
  whenToUse: 'A composite skeleton (several Shimmers standing in for one element) → wrap them in SkeletonGroup so it announces "Loading" once, not once per block. A single lone Shimmer needs no wrapper — it announces on its own.',
  a11y: 'A standalone Shimmer is exposed as accessibilityRole="progressbar" + accessibilityLabel="Loading". Inside a SkeletonGroup, each block goes silent and the group carries one busy "Loading" announcement for the whole skeleton — so a screen reader says "Loading" once, not once per block.',
  // One standalone example per `variant` enum value (`text` is the default, so it comes first),
  // plus the composed "Circle + text" usage — shown here too, not just under States, so Variants
  // reads as complete on its own.
  variants: {
    itemsFill: true,
    items: [
      { key: 'text', name: 'Text (one line)', props: { variant: 'text' }, node: <Shimmer variant="text" width={160} /> },
      { key: 'circle', name: 'Circle', props: { variant: 'circle' }, node: <Shimmer variant="circle" size={40} /> },
      {
        key: 'container',
        name: 'Container (matches Card)',
        props: { variant: 'container' },
        // Same radius Card itself renders at (DS_RADIUS.medium, via dimensionsForVariant) and a
        // plausible real Card content height — a container skeleton should reserve the same
        // layout space the real element will occupy, not an arbitrary block.
        node: <Shimmer variant="container" height={96} />,
      },
      {
        key: 'circle-and-text',
        name: 'Circle + text (2 lines)',
        // SkeletonGroup so the whole avatar+2-lines skeleton announces "Loading" once, not three
        // times (one per block) — it carries the caller's row layout itself.
        node: (
          <SkeletonGroup style={styles.previewRow}>
            <Shimmer variant="circle" size={40} />
            {/* Last line ~70% of the others' width — see ShimmerProps.variant's `'text'` doc. */}
            <View style={styles.shimmerLines}>
              <Shimmer variant="text" width={160} />
              <Shimmer variant="text" width={112} />
            </View>
          </SkeletonGroup>
        ),
      },
    ],
  },
  // Repeated here (not just in Variants) so States / Configurations is independently complete too.
  states: {
    itemsFill: true,
    items: [
      {
        key: 'circle-and-text',
        name: 'Circle + text (2 lines)',
        // SkeletonGroup so the whole avatar+2-lines skeleton announces "Loading" once, not three
        // times (one per block) — it carries the caller's row layout itself.
        node: (
          <SkeletonGroup style={styles.previewRow}>
            <Shimmer variant="circle" size={40} />
            {/* Last line ~70% of the others' width — see ShimmerProps.variant's `'text'` doc. */}
            <View style={styles.shimmerLines}>
              <Shimmer variant="text" width={160} />
              <Shimmer variant="text" width={112} />
            </View>
          </SkeletonGroup>
        ),
      },
      {
        key: 'three-lines',
        name: 'Three lines of text',
        node: (
          // Explicit px widths (not "100%") specifically so the last line's 70% ratio is a real,
          // checkable relationship to the other two, not two independent percentages. Wrapped in a
          // SkeletonGroup so all three lines announce as one "Loading" region.
          <SkeletonGroup style={styles.shimmerLines}>
            <Shimmer variant="text" width={200} />
            <Shimmer variant="text" width={200} />
            <Shimmer variant="text" width={140} />
          </SkeletonGroup>
        ),
      },
    ],
  },
});
