import React from 'react';
import { Text } from 'react-native';
import { ComparisonList, defineCatalogPage, type ListItem } from '@krapwoo/ds-viewer';

const DEMO: ListItem[] = [
  { key: 'a', label: 'A', node: <Text>A</Text> },
  { key: 'b', label: 'B', node: <Text>B</Text> },
  { key: 'c', label: 'C', node: <Text>C</Text> },
];

// Five cells: enough to wrap, leaving an uneven last row for the blank cells to complete.
const UNEVEN: ListItem[] = ['A', 'B', 'C', 'D', 'E'].map((l) => ({ key: l.toLowerCase(), label: l, node: <Text>{l}</Text> }));

export default defineCatalogPage({
  component: 'ComparisonList',
  internalProps: { size: "The page's specimen size, passed by SectionBlock's layout.", surface: "The page's specimenSurface, passed by SectionBlock." },
  group: 'Components',
  composedOf: [
    { component: 'SpecimenSurface', role: "Backs every example cell, so one page's `specimenSurface` fills each cell the same way.", relationship: 'built-in' },
    { component: 'SpecimenAddressProvider', role: "Wraps each example so a PhoneFrame inside it can reopen that one example in its own document.", relationship: 'built-in' },
    { component: 'SpecimenContent', role: "Caps, centres and measures the example inside its cell.", relationship: 'built-in' },
  ],
  whenToUse: 'One axis: a flat set of examples differing in a single respect, wrapped into balanced rows with a caption on each cell. For two props that combine, use ComparisonGrid; for a second axis that means something different per variant, use ComparisonGroups.',
  source: '../native/catalog/ComparisonList.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: 'One-axis examples inside ONE shared card. Cells wrap into balanced rows; each cell has its own caption strip so labels stay attached when rows wrap. Blank cells complete an uneven last row. The card fills the column it is given and its cells share that width equally; phone width caps the specimen inside a cell, not the cell. This is the layout behind every plain `variants`/`states` list in both catalogs that isn\'t a `comparison` grid.',
  a11y: 'The card is a labelled list and each example is one of its items; the blank cells that pad an uneven last row are hidden from assistive technology, so the list counts only real examples.',
  variants: {
    items: [
      { key: 'row', name: 'Three examples, wrapped to fit the cell', node: <ComparisonList items={DEMO} size="regular" label="ComparisonListDemo" /> },
      { key: 'uneven', name: 'Wrapped, with blank cells completing the last row', node: <ComparisonList items={UNEVEN} size="compact" label="ComparisonListUnevenDemo" /> },
      { key: 'capped', name: 'maxColumns: 2', node: <ComparisonList items={UNEVEN} size="compact" maxColumns={2} label="ComparisonListCappedDemo" /> },
    ],
  },
});
