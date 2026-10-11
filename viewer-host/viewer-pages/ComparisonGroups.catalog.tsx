import React from 'react';
import { Text } from 'react-native';
import { ComparisonGroups, defineCatalogPage, type ListGroup } from '@krapwoo/ds-viewer';

const DEMO: ListGroup[] = [
  { key: 'circle', label: 'Circle', items: [{ key: 'sm', label: 'Small', node: <Text>●</Text> }, { key: 'lg', label: 'Large', node: <Text>⬤</Text> }] },
  { key: 'linear', label: 'Linear', items: [{ key: 'thin', label: 'Thin', node: <Text>▬</Text> }] },
];

// A row of four against a row of one: the long row sets the column count, so the short row ends in
// three blank cells rather than stretching its single example across the card.
const UNEVEN: ListGroup[] = [
  { key: 'circle', label: 'Circle', items: ['XS', 'S', 'M', 'L'].map((l) => ({ key: l.toLowerCase(), label: l, node: <Text>●</Text> })) },
  { key: 'linear', label: 'Linear', items: [{ key: 'thin', label: 'Thin', node: <Text>▬</Text> }] },
];

export default defineCatalogPage({
  group: 'Components',
  source: '../native/catalog/ComparisonGroups.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: 'Grouped rows: one row per variant, headed by the variant\'s name, holding that variant\'s own configurations. Each cell keeps its own caption because the rows do not share column meanings (a circle\'s size is not a bar\'s thickness). Cells share the card\'s width equally, and shorter rows end in blank cells; a card narrower than its minimum scrolls horizontally inside itself. Used by pages like Loading, whose circle sizes and linear thicknesses are genuinely different axes.',
  a11y: 'Each row is its own list, labelled with the page name and that variant\'s name, so the rows are never read as one flat sequence; the blank cells padding a short row are hidden from assistive technology.',
  variants: {
    // A whole grouped card per row: side by side, each would fall below its cell minimum.
    maxColumns: 1,
    items: [
      { key: 'rows', name: 'One row per variant', node: <ComparisonGroups groups={DEMO} size="regular" label="ComparisonGroupsDemo" /> },
      { key: 'uneven', name: 'A short row ends in blank cells', node: <ComparisonGroups groups={UNEVEN} size="compact" label="ComparisonGroupsUnevenDemo" /> },
    ],
  },
});
