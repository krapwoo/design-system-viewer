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
  description:
    'Loading placeholders that breathe while content loads. `text` stands in for one line of text (an element with 3 lines gets 3 stacked `text` Shimmers, not one tall one), `circle` is always for a circular element, and `container` covers everything else (Card, Banner, image, …) — sized to match the real element it replaces, not an arbitrary block. When several stand in for one element, wrap them in `SkeletonGroup`.',
  whenToUse:
    'Content whose shape is known and is still loading — the skeleton mirrors the layout that will replace it. For an indeterminate wait with no known layout (a button mid-request, a full-screen wait), use Loading. A composite skeleton (several Shimmers standing in for one element) goes inside a SkeletonGroup so it announces "Loading" once, not once per block; a single lone Shimmer needs no wrapper.',
  a11y:
    'A standalone Shimmer is exposed as accessibilityRole="progressbar" with `aria-busy` and an accessibilityLabel that defaults to "Loading"; pass `accessibilityLabel` to name it for what is loading (the default is English text and is not localised). Inside a SkeletonGroup each Shimmer drops its role, label and busy state (so `accessibilityLabel` is ignored there), and the group carries a single progressbar role, `aria-busy`, and a `label` (default "Loading") for the whole skeleton. With the OS "reduce motion" setting on, the pulse is replaced by a static block at the pulse\'s `high` colour, so the placeholder still reads as one; the setting is followed live if it changes. It is read asynchronously and starts as off, so a Shimmer mounted before the read resolves renders animated first and switches to static once it does. The pulse is also a low-contrast wash (2–5% black), so it is not a visible loading cue on its own.',
  notes: [
    'Every Shimmer reads one shared module-level clock, so shimmers on screen together always pulse in lockstep, whatever time each mounted.',
    '`SkeletonGroup` and `Breathing` (the pulsing block Shimmer is built from) are exported alongside Shimmer.',
    'Text lines default to 16px tall (SHIMMER_TEXT_HEIGHT) and full width; containers to 80px tall at the medium radius, the same radius Card uses.',
  ],
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
