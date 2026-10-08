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

function TokenRowDemo() {
  return (
    <View style={demo.tokenStack}>
      <TokenRow use="This is the grounded 'when to use this' note, rendered below the value.">
        <View style={demo.spacingRow}>
          <Text style={demo.spacingLabel}>800</Text>
          <View style={[demo.spacingBar, { width: 16 }]} />
          <Text style={demo.spacingValue}>16px</Text>
        </View>
      </TokenRow>
      <TokenRow use="This row has last — no divider beneath it, since nothing follows." last>
        <View style={demo.spacingRow}>
          <Text style={demo.spacingLabel}>1200</Text>
          <View style={[demo.spacingBar, { width: 24 }]} />
          <Text style={demo.spacingValue}>24px</Text>
        </View>
      </TokenRow>
    </View>
  );
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Wraps one token\'s rendered example with a grounded "when to use this" note beneath it, and a bottom divider so a stack of rows reads as a list — the shared shape behind every row in the Spacing and Type Scale galleries, in both this catalog and the starter kit\'s. The row\'s own content is freeform children; pass `last` on the final row in a stack to drop its divider.',
  render: () => <TokenRowDemo />,
});
