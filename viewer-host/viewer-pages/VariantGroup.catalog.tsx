import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, VariantGroup } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../starter-kit/tokens';

const demo = StyleSheet.create({
  row: { flexDirection: 'row', gap: DS_SPACING[200] },
  chip: {
    paddingVertical: DS_SPACING[200],
    paddingHorizontal: DS_SPACING[300],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
  },
  chipText: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.regular },
});

/** Stand-in children: a small cluster of examples, the thing VariantGroup exists to label. */
function Examples() {
  return (
    <View style={demo.row}>
      {['Primary', 'Secondary'].map((l) => (
        <View key={l} style={demo.chip}><Text style={demo.chipText}>{l}</Text></View>
      ))}
    </View>
  );
}

export default defineCatalogPage({
  component: 'VariantGroup',
  group: 'Components',
  whenToUse: 'A label and one-line description above a single example inside an Examples card; both are optional, so omit them when the example speaks for itself. For a captioned set of examples that wrap into rows, ComparisonList already labels every cell.',
  source: '../native/catalog/VariantGroup.tsx',
  standalone: 'Examples on many pages use it; InventoryGroup builds on it, but it is not only a part of that.',
  hide: { props: true },
  description: 'Labels one example (or small cluster of examples) inside a freeform `render()` — a bold uppercase name plus a one-line description, sitting above whatever demo content is passed as children. Both labels are optional, and `align` decides whether the group centres its content or stacks it against the left edge. SectionBlock itself doesn\'t use this for `variants` clusters (those get their own card, titled directly); reach for it inside a `render()` that needs an inline sub-heading, e.g. a Colors gallery.',
  a11y: 'The name and description are plain text, not headings, so a group never injects a heading level into the page\'s outline; label the examples themselves if they need their own names.',
  variants: {
    items: [
      { key: 'full', name: 'Name and description', props: { align: 'center' }, node: <VariantGroup name="Usage" desc="wraps a row or stack of live examples"><Examples /></VariantGroup> },
      { key: 'nameOnly', name: 'Name only', node: <VariantGroup name="Usage"><Examples /></VariantGroup> },
      // Filled, so the group has room to show that it stacks against the left edge rather than
      // shrink-wrapping its content the way the centred variants do.
      { key: 'left', name: "align: 'left'", props: { align: 'left' }, fill: true, node: <VariantGroup name="Usage" desc="left-aligned, for a gallery column" align="left"><Examples /></VariantGroup> },
    ],
  },
});
