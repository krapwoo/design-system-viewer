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
  group: 'Components',
  whenToUse:
    "Only when Shimmer's three shapes (text line, circle, container) cannot describe the skeleton — a pill-shaped chip, a custom radius, or a pulse in a different colour. Otherwise use Shimmer, which sizes and rounds itself and announces \"Loading\" by default; Breathing is silent unless you give it a role and label. Because every Breathing shares Shimmer's clock, the two can sit side by side and pulse in step.",
  specimenSize: 'regular',
  description:
    'The pulsing block that Shimmer is built from: a View whose background colour breathes between a low and a high value on one clock shared by every instance. It draws no shape of its own — the size, radius and layout all come from `style`.',
  a11y:
    'A bare Animated.View: no role, label or state unless you pass them. `accessibilityRole` accepts only "progressbar" and `accessibilityLabel` any string; both are passed straight to the View. So by default it is invisible to a screen reader — unlike a standalone Shimmer, which adds a "Loading" progressbar — and a skeleton built from Breathing needs its own announcement, most simply by wrapping it in a SkeletonGroup. It follows the OS "reduce motion" setting: while it is on, Breathing renders a static View at the `high` colour instead of an Animated.View, and `phase` and `low` have no effect. The setting is read asynchronously and starts as off, so a Breathing mounted before the read resolves renders animated first and switches to static once it does.',
  notes: [
    'All instances read one module-level clock, started by the first animated (not reduce-motion static) Breathing to mount and never stopped, so any that are on screen together pulse in lockstep. `phase` (0 to 1, the fraction of a cycle) shifts one instance against that clock.',
    'The default pulse is translucent black — 2% to 5% — so it reads as a wash over whatever surface it sits on. `low` and `high` replace it with any two colours.',
    "The colour is animated in JavaScript (`useNativeDriver` is false, since colour interpolation can't run natively).",
  ],
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
