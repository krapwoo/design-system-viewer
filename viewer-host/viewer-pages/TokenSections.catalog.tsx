import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenSections, CATALOG_COLOR, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({ body: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted } });

export default defineCatalogPage({
  component: 'TokenSections',
  group: 'Components',
  source: '../native/catalog/TokenLayouts.tsx',
  previewWidths: 'full',
  description: 'Titled cards, one per kind of token, side by side in up to `columns` columns. A narrow window drops a column rather than squeezing a card under 280px; a `wide` section takes a full row. A page usually sets `tokenSections` and `tokenColumns` instead of rendering this directly.',
  whenToUse: 'A token page with several kinds of token (semantic colours vs palette) or families (type: label, body, title).',
  a11y: 'Each section title is text above its card.',
  render: () => (
    <TokenSections
      columns={3}
      sections={[
        { title: 'Body', desc: 'Reading text', render: () => <Text style={demo.body}>bodySm, bodyMd…</Text> },
        { title: 'Label', desc: 'Controls and captions', render: () => <Text style={demo.body}>labelSm, labelMd…</Text> },
        { title: 'Title', desc: 'Screen and section headings', render: () => <Text style={demo.body}>titleSm, titleMd…</Text> },
        { title: 'Palette', desc: 'A wide section takes its own row', wide: true, render: () => <Text style={demo.body}>Colour ramps…</Text> },
      ]}
    />
  ),
});
