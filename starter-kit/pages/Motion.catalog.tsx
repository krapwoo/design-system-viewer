import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DividedStack, VariantGroup, TokenRow } from '@krapwoo/ds-viewer';
import {
  DS_MOTION_DURATION,
  DS_MOTION_DURATION_STEPS,
  DS_MOTION_DURATION_USE,
  DS_MOTION_EASING,
  DS_MOTION_EASING_STEPS,
  DS_MOTION_EASING_USE,
  DS_MOTION_SPRING,
  DS_MOTION_SPRING_USE,
  DS_MOTION_LOOP_DURATION,
  DS_MOTION_LOOP_DURATION_STEPS,
  DS_MOTION_LOOP_DURATION_USE,
  DS_RADIUS,
  DS_SEMANTIC,
  DS_SPACING,
  DS_TYPOGRAPHY,
} from '../tokens';

const styles = StyleSheet.create({
  tokenStack: { gap: DS_SPACING[800] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  previewLabel: { minWidth: 64, ...DS_TYPOGRAPHY.labelSm, color: DS_SEMANTIC.text.regular },
  previewValue: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
  durationBar: { height: 12, borderRadius: DS_RADIUS.small, backgroundColor: DS_SEMANTIC.emphasis.info },
  // Spring config — a wrapping grid of key/value fields, since DS_MOTION_SPRING has 6 fields, too
  // many to lay out as a single previewRow.
  springGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DS_SPACING[600] },
  springField: { width: 168, gap: DS_SPACING[100] },
  easingValue: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted, fontFamily: 'Menlo' },
});

function MotionGallery() {
  const maxDuration = Math.max(...Object.values(DS_MOTION_DURATION));
  const maxLoopDuration = Math.max(...Object.values(DS_MOTION_LOOP_DURATION));
  return (
    <DividedStack>
      <VariantGroup name="Duration" desc="one-shot transitions — reach for base (240ms) first" align="left">
        <View style={styles.tokenStack}>
          {DS_MOTION_DURATION_STEPS.map((step, i) => (
            <TokenRow key={step} use={DS_MOTION_DURATION_USE[step]} last={i === DS_MOTION_DURATION_STEPS.length - 1}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{step}</Text>
                <View style={[styles.durationBar, { width: (DS_MOTION_DURATION[step] / maxDuration) * 120 }]} />
                <Text style={styles.previewValue}>{DS_MOTION_DURATION[step]}ms</Text>
              </View>
            </TokenRow>
          ))}
        </View>
      </VariantGroup>
      <VariantGroup name="Loop duration" desc="continuous, indeterminate loops — a spinner or a shimmer pulse, not a one-shot transition" align="left">
        <View style={styles.tokenStack}>
          {DS_MOTION_LOOP_DURATION_STEPS.map((step, i) => (
            <TokenRow key={step} use={DS_MOTION_LOOP_DURATION_USE[step]} last={i === DS_MOTION_LOOP_DURATION_STEPS.length - 1}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{step}</Text>
                <View style={[styles.durationBar, { width: (DS_MOTION_LOOP_DURATION[step] / maxLoopDuration) * 120 }]} />
                <Text style={styles.previewValue}>{DS_MOTION_LOOP_DURATION[step]}ms</Text>
              </View>
            </TokenRow>
          ))}
        </View>
      </VariantGroup>
      <VariantGroup name="Easing" desc="cubic-bezier curves — convert with Easing.bezier(...DS_MOTION_EASING.x)" align="left">
        <View style={styles.tokenStack}>
          {DS_MOTION_EASING_STEPS.map((step, i) => (
            <TokenRow key={step} use={DS_MOTION_EASING_USE[step]} last={i === DS_MOTION_EASING_STEPS.length - 1}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{step}</Text>
                <Text style={styles.easingValue}>cubic-bezier({DS_MOTION_EASING[step].join(', ')})</Text>
              </View>
            </TokenRow>
          ))}
        </View>
      </VariantGroup>
      <VariantGroup name="Spring" desc="for Animated.spring(value, DS_MOTION_SPRING) — snap-point transitions, not fixed-duration timing">
        <View style={styles.tokenStack}>
          <TokenRow use={DS_MOTION_SPRING_USE} last>
            <View style={styles.springGrid}>
              {(Object.entries(DS_MOTION_SPRING) as [string, number | boolean][]).map(([key, value]) => (
                <View key={key} style={styles.springField}>
                  <Text style={styles.previewLabel}>{key}</Text>
                  <Text style={styles.previewValue}>{String(value)}</Text>
                </View>
              ))}
            </View>
          </TokenRow>
        </View>
      </VariantGroup>
    </DividedStack>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'Duration (one-shot transitions), loop duration (continuous, indeterminate loops like Loading/Shimmer), easing, and spring tokens for transitions/animations. Easings are cubic-bezier tuples, not Easing objects, so the token file stays free of any react-native import. The spring config is grounded in the metro-native app this template was extracted from, where the same values drive its BottomSheet\'s snap-point transitions.',
  tokenGallery: true,
  render: () => <MotionGallery />,
});
