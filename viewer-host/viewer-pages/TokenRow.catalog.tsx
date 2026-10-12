import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenRow } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY, DS_RADIUS } from '../../starter-kit/tokens';

const demo = StyleSheet.create({
  tokenStack: { gap: DS_SPACING[800] },
  spacingRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  spacingLabel: { width: 48, ...DS_TYPOGRAPHY.labelXs, color: DS_SEMANTIC.text.regular },
  spacingBar: { height: 12, borderRadius: DS_RADIUS.xs, backgroundColor: DS_SEMANTIC.emphasis.info },
  spacingValue: { fontSize: DS_TYPOGRAPHY.bodyXs.fontSize, color: DS_SEMANTIC.text.muted },
});

/** One spacing token's sample: its step, a bar at its real width, and the value. */
function Sample({ step, px }: { step: string; px: number }) {
  return (
    <View style={demo.spacingRow}>
      <Text style={demo.spacingLabel}>{step}</Text>
      <View style={[demo.spacingBar, { width: px }]} />
      <Text style={demo.spacingValue}>{`${px}px`}</Text>
    </View>
  );
}

export default defineCatalogPage({
  component: 'TokenRow',
  group: 'Components',
  source: '../native/catalog/TokenRow.tsx',
  // A row with its note beside the sample needs its 280px sample plus room for the note, wider
  // than a phone's content width: 'page' cells are at least 512px and do not cap their specimen.
  specimenSize: 'page',
  hide: { props: true },
  description: 'Wraps one token\'s rendered example with a grounded "when to use this" note, and a bottom divider so a stack of rows reads as a list — the shared shape behind every row in the Spacing and Type Scale galleries, in both this catalog and the starter kit\'s. The row\'s own content is freeform children; pass `last` on the final row in a stack to drop its divider, and `notePlacement="right"` to put the note beside a narrow sample (`sampleWidth`, default 280).',
  whenToUse: 'A token whose note is worth as much as its sample. When the sample alone carries the meaning and the notes are short, a TokenGrid of tiles reads denser.',
  a11y: 'The step, the value and the note are all real text, so a token is readable without seeing the bar. The divider is a plain view and announces nothing.',
  variants: {
    items: [
      {
        key: 'below',
        name: 'Note below the sample',
        fill: true,
        props: { notePlacement: 'below' },
        node: (
          <View style={demo.tokenStack}>
            <TokenRow use="The default: a full-width note under the sample, for a sentence that needs the room.">
              <Sample step="800" px={16} />
            </TokenRow>
            <TokenRow use="Rows stack into a list, each divided from the next." last>
              <Sample step="1200" px={24} />
            </TokenRow>
          </View>
        ),
      },
      {
        key: 'right',
        name: 'Note beside the sample',
        fill: true,
        props: { notePlacement: 'right' },
        node: (
          <View style={demo.tokenStack}>
            <TokenRow use="Beside a narrow sample, so each token reads as one line." notePlacement="right">
              <Sample step="400" px={8} />
            </TokenRow>
            <TokenRow use="The sample keeps sampleWidth; the note takes the rest of the row." notePlacement="right" last>
              <Sample step="600" px={12} />
            </TokenRow>
          </View>
        ),
      },
      // `last` is the row's one piece of manual bookkeeping — DividedStack exists to avoid it.
      { key: 'last', name: 'last: no divider beneath', fill: true, node: <TokenRow use="Nothing follows, so the row drops its divider." last><Sample step="1600" px={32} /></TokenRow> },
    ],
  },
});
