import React from 'react';
import { StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Breathing } from './Shimmer';
import { DS_RADIUS, DS_SEMANTIC } from '../../tokens';

const styles = StyleSheet.create({
  block: { width: 160, height: 16, borderRadius: DS_RADIUS.small },
});

export default defineCatalogPage({
  component: 'Breathing',
  group: 'Feedback',
  description:
    "The shared animated primitive behind Shimmer — a solid block that breathes between a low and high colour on one shared, module-level clock, so every Breathing/Shimmer instance on screen stays phase-locked instead of drifting out of sync. Exported so a custom composite skeleton can reuse the same pulse directly instead of going through Shimmer's fixed text/circle/container shapes.",
  a11y: 'Renders a plain Animated.View with no role by default — pass accessibilityRole="progressbar" and accessibilityLabel yourself, the same way Shimmer does internally for its own standalone (non-grouped) blocks.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'default', name: 'Default', node: <Breathing style={styles.block} /> },
      {
        key: 'custom-colors',
        name: 'Custom colours',
        props: { low: DS_SEMANTIC.shade.info, high: DS_SEMANTIC.emphasis.info },
        node: <Breathing style={styles.block} low={DS_SEMANTIC.shade.info} high={DS_SEMANTIC.emphasis.info} />,
      },
    ],
  },
});
