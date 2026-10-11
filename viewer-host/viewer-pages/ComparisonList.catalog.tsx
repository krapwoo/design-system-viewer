import React from 'react';
import { Text } from 'react-native';
import { ComparisonList, defineCatalogPage, type ListItem } from '@krapwoo/ds-viewer';

const DEMO: ListItem[] = [
  { key: 'a', label: 'A', node: <Text>A</Text> },
  { key: 'b', label: 'B', node: <Text>B</Text> },
  { key: 'c', label: 'C', node: <Text>C</Text> },
];

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'One-axis examples inside ONE shared card. Cells wrap into balanced rows; each cell has its own caption strip so labels stay attached when rows wrap. Blank cells complete an uneven last row. Wide specimens use fixed 402px cells and the card hugs its columns. This is the layout behind every plain `variants`/`states` list in both catalogs that isn\'t a `comparison` grid.',
  render: () => <ComparisonList items={DEMO} size="regular" label="ComparisonListDemo" />,
});
