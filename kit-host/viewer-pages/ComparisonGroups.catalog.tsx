import React from 'react';
import { Text } from 'react-native';
import { ComparisonGroups, defineCatalogPage, type ListGroup } from '@krapwoo/ds-viewer';

const DEMO: ListGroup[] = [
  { key: 'circle', label: 'Circle', items: [{ key: 'sm', label: 'Small', node: <Text>●</Text> }, { key: 'lg', label: 'Large', node: <Text>⬤</Text> }] },
  { key: 'linear', label: 'Linear', items: [{ key: 'thin', label: 'Thin', node: <Text>▬</Text> }] },
];

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Grouped rows: one row per variant, headed by the variant\'s name, holding that variant\'s own configurations. Each cell keeps its own caption because the rows do not share column meanings (a circle\'s size is not a bar\'s thickness). Shorter rows end in blank cells; a card wider than its container scrolls horizontally inside itself. Used by pages like Loading, whose circle sizes and linear thicknesses are genuinely different axes.',
  render: () => <ComparisonGroups groups={DEMO} size="regular" label="ComparisonGroupsDemo" />,
});
