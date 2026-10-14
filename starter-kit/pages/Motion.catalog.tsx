import React from 'react';
import { View, Text, StyleSheet, Easing } from 'react-native';
import { defineCatalogPage, TokenRow, TokenRowGroup, MotionSpecimen } from '@krapwoo/ds-viewer';
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
  rowContent: { gap: DS_SPACING[400] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  previewLabel: { minWidth: 64, ...DS_TYPOGRAPHY.labelSm, color: DS_SEMANTIC.text.regular },
  previewValue: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
  durationBar: { height: 12, borderRadius: DS_RADIUS.small, backgroundColor: DS_SEMANTIC.emphasis.info },
  easingValue: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted, fontFamily: 'Menlo' },

  // A spring is a config object, not a step on a scale: six named fields that only mean anything
  // together. Laid out with the fields down the side and each spring token as its own column, so a
  // second spring adds a column instead of repeating all six names, and `damping` reads across
  // tokens on one line. The field vocabulary is fixed; the number of tokens is what grows.
  springRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS_SPACING[600],
    paddingVertical: DS_SPACING[400],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DS_SEMANTIC.border.light,
  },
  springRowLast: { borderBottomWidth: 0 },
  // Wide enough that `restDisplacementThreshold` sits on one line instead of breaking mid-word,
  // which is what the previous fixed 168px field did to it.
  springField: { width: 210, ...DS_TYPOGRAPHY.labelSm, color: DS_SEMANTIC.text.regular },
  springCell: { flex: 1, minWidth: 130 },
  springValue: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.regular },
  springNote: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
});

/** Every spring token on the page. One today — the shape is what lets a second arrive without
 *  redesigning the section. */
const SPRINGS: Record<string, typeof DS_MOTION_SPRING> = { snappy: DS_MOTION_SPRING };
const SPRING_NOTES: Record<string, string> = { snappy: DS_MOTION_SPRING_USE };
const SPRING_FIELDS = Object.keys(DS_MOTION_SPRING) as (keyof typeof DS_MOTION_SPRING)[];

function SpringTable() {
  const names = Object.keys(SPRINGS);
  const cells = (render: (name: string) => React.ReactNode) =>
    names.map((name) => (
      <View key={name} style={styles.springCell}>
        {render(name)}
      </View>
    ));
  return (
    <View>
      {/* A single spring needs no column header — the section title is already its name. */}
      {names.length > 1 ? (
        <View style={styles.springRow}>
          <Text style={styles.springField}>field</Text>
          {cells((name) => <Text style={styles.previewLabel}>{name}</Text>)}
        </View>
      ) : null}
      {SPRING_FIELDS.map((field) => (
        <View key={String(field)} style={styles.springRow}>
          <Text style={styles.springField}>{String(field)}</Text>
          {cells((name) => <Text style={styles.springValue}>{String(SPRINGS[name][field])}</Text>)}
        </View>
      ))}
      <View style={styles.springRow}>
        <Text style={styles.springField}>preview</Text>
        {cells((name) => (
          <MotionSpecimen kind="spring" spring={SPRINGS[name]} label="Animated.spring(value, DS_MOTION_SPRING)" />
        ))}
      </View>
      <View style={[styles.springRow, styles.springRowLast]}>
        <Text style={styles.springField}>when to use</Text>
        {cells((name) => <Text style={styles.springNote}>{SPRING_NOTES[name]}</Text>)}
      </View>
    </View>
  );
}

/** A millisecond scale: a bar for the relative length, then the real animation at that duration. */
function DurationRows({ steps, values, notes, label }: {
  steps: readonly string[];
  values: Record<string, number>;
  notes: Record<string, string>;
  label: (ms: number) => string;
}) {
  const max = Math.max(...steps.map((step) => values[step]));
  return (
    <TokenRowGroup>
      <View style={styles.tokenStack}>
        {steps.map((step, i) => (
          <TokenRow key={step} use={notes[step]} last={i === steps.length - 1} notePlacement="right">
            <View style={styles.rowContent}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{step}</Text>
                <View style={[styles.durationBar, { width: (values[step] / max) * 120 }]} />
                <Text style={styles.previewValue}>{values[step]}ms</Text>
              </View>
              <MotionSpecimen
                kind="timing"
                duration={values[step]}
                easing={Easing.bezier(...DS_MOTION_EASING.standard)}
                label={label(values[step])}
              />
            </View>
          </TokenRow>
        ))}
      </View>
    </TokenRowGroup>
  );
}

function EasingRows() {
  return (
    <TokenRowGroup>
      <View style={styles.tokenStack}>
        {DS_MOTION_EASING_STEPS.map((step, i) => (
          <TokenRow key={step} use={DS_MOTION_EASING_USE[step]} last={i === DS_MOTION_EASING_STEPS.length - 1} notePlacement="right">
            <View style={styles.rowContent}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>{step}</Text>
                <Text style={styles.easingValue}>cubic-bezier({DS_MOTION_EASING[step].join(', ')})</Text>
              </View>
              <MotionSpecimen
                kind="timing"
                duration={DS_MOTION_DURATION.base}
                easing={Easing.bezier(...DS_MOTION_EASING[step])}
                label={`${DS_MOTION_DURATION.base}ms · ${step}`}
              />
            </View>
          </TokenRow>
        ))}
      </View>
    </TokenRowGroup>
  );
}

export default defineCatalogPage({
  group: 'Tokens',
  description: 'Duration (one-shot transitions), loop duration (continuous, indeterminate loops like Loading/Shimmer), easing, and spring tokens for transitions/animations. Easings are cubic-bezier tuples, not Easing objects, so the token file stays free of any react-native import. The spring config is grounded in the metro-native app this template was extracted from, where the same values drive its BottomSheet\'s snap-point transitions.',
  tokenGallery: true,
  // A card per kind of token. Durations are a scale in milliseconds, easings are bezier curves and
  // a spring is a config object: four different things that read as one long box when they share a
  // single card. One column, because every section's rows want the full width.
  tokenColumns: 1,
  tokenSections: [
    {
      title: 'Duration',
      desc: 'one-shot transitions — reach for base (240ms) first',
      render: () => (
        <DurationRows
          steps={DS_MOTION_DURATION_STEPS}
          values={DS_MOTION_DURATION}
          notes={DS_MOTION_DURATION_USE}
          label={(ms) => `${ms}ms · standard easing`}
        />
      ),
    },
    {
      title: 'Loop duration',
      desc: 'continuous, indeterminate loops — a spinner or a shimmer pulse, not a one-shot transition',
      render: () => (
        <DurationRows
          steps={DS_MOTION_LOOP_DURATION_STEPS}
          values={DS_MOTION_LOOP_DURATION}
          notes={DS_MOTION_LOOP_DURATION_USE}
          label={(ms) => `${ms}ms · one cycle`}
        />
      ),
    },
    {
      title: 'Easing',
      desc: 'cubic-bezier curves — convert with Easing.bezier(...DS_MOTION_EASING.x)',
      render: () => <EasingRows />,
    },
    {
      title: 'Spring',
      desc: 'for Animated.spring(value, DS_MOTION_SPRING) — snap-point transitions, not fixed-duration timing',
      render: () => <SpringTable />,
    },
  ],
});
