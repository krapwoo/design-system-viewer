import React from 'react';
import { Text } from 'react-native';
import { ComparisonGrid, defineCatalogPage, type ComparisonDef } from '@krapwoo/ds-viewer';

const DEMO: ComparisonDef = {
  rowLabel: 'Variant',
  columnLabel: 'State',
  rows: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
  columns: [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
  cells: [
    { rowKey: 'a', columnKey: 'default', node: <Text>A</Text> },
    { rowKey: 'a', columnKey: 'disabled', node: <Text>A, disabled</Text> },
    { rowKey: 'b', columnKey: 'default', node: <Text>B</Text> },
    { rowKey: 'b', columnKey: 'disabled', unavailableReason: 'B has no disabled look' },
  ],
};

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'A grid of two props that combine freely, rendered as an accessible table inside one card. Columns grow with the window up to 402px and never shrink below the specimen size\'s minimum; a grid wider than its container scrolls horizontally inside the card, never the page. This is the layout behind every `comparison`-based page in both catalogs (e.g. Button\'s Variant × State).',
  render: () => <ComparisonGrid def={DEMO} size="regular" sectionId="ComparisonGridDemo" />,
});
