import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, VariantGroup } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_TYPOGRAPHY } from '../../starter-kit/tokens';

const demo = StyleSheet.create({
  mockText: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, fontStyle: 'italic' },
});

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Labels one example (or small cluster of examples) inside a freeform `render()` — a bold uppercase name plus a one-line description, sitting above whatever demo content is passed as children. SectionBlock itself doesn\'t use this for `variants` clusters (those get their own card, titled directly); reach for it inside a `render()` that needs an inline sub-heading, e.g. a Colors gallery.',
  render: () => (
    <VariantGroup name="Usage" desc="wraps a row or stack of live examples">
      <Text style={demo.mockText}>(e.g. a row of Button variants)</Text>
    </VariantGroup>
  ),
});
