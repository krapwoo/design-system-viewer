import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenSections, CATALOG_COLOR, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({ body: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted } });
const line = (text: string) => () => <Text style={demo.body}>{text}</Text>;

const FAMILIES = [
  { title: 'Body', desc: 'Reading text', render: line('bodySm, bodyMd…') },
  { title: 'Label', desc: 'Controls and captions', render: line('labelSm, labelMd…') },
  { title: 'Title', desc: 'Screen and section headings', render: line('titleSm, titleMd…') },
];

export default defineCatalogPage({
  component: 'TokenSections',
  group: 'Components',
  source: '../native/catalog/TokenLayouts.tsx',
  // A column count is only observable in a cell wide enough to hold the columns: sections never
  // squeeze below 280px, so a phone-width cell would render every variant as one column.
  specimenSize: 'page',
  hide: { props: true },
  description: 'Titled cards, one per kind of token, side by side in up to `columns` columns. A narrow window drops a column rather than squeezing a card under 280px; a `wide` section takes a full row of its own. A page usually sets `tokenSections` and `tokenColumns` instead of rendering this directly.',
  whenToUse: 'A token page with several kinds of token (semantic colours vs palette) or families (type: label, body, title).',
  a11y: 'Each section title is text above its card, and each card keeps whatever semantics its own render() produces; the layout adds none.',
  variants: {
    // One per row, so the three-column example really has three columns.
    maxColumns: 1,
    items: [
      { key: 'one', name: 'One column', fill: true, node: <TokenSections columns={1} sections={FAMILIES.slice(0, 2)} /> },
      { key: 'two', name: 'Two columns', fill: true, node: <TokenSections columns={2} sections={FAMILIES} /> },
      // The wide section is the reason a page reaches for this rather than a plain grid.
      {
        key: 'wide',
        name: 'Three columns, with a wide section',
        fill: true,
        node: (
          <TokenSections
            columns={3}
            sections={[...FAMILIES, { title: 'Palette', desc: 'A wide section takes its own row', wide: true, render: line('Colour ramps…') }]}
          />
        ),
      },
    ],
  },
});
