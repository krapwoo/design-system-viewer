import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DividedStack, CATALOG_SPACE } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_TYPOGRAPHY } from '../../starter-kit/tokens';

const demo = StyleSheet.create({
  mockText: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, fontStyle: 'italic' },
});

function DividedStackDemo() {
  return (
    <DividedStack gap={CATALOG_SPACE.lg}>
      <Text style={demo.mockText}>First item</Text>
      <Text style={demo.mockText}>Second item — has a divider above it, not below</Text>
      <Text style={demo.mockText}>Third item — the last one, no trailing divider</Text>
    </DividedStack>
  );
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Stacks children vertically with a hairline divider automatically inserted between each consecutive pair — never after the last. Unlike TokenRow\'s divider (which each row draws itself, needing a manually-computed `last` prop), this one is guaranteed by construction: wrap any list of items and the dividers place themselves.',
  render: () => <DividedStackDemo />,
});
