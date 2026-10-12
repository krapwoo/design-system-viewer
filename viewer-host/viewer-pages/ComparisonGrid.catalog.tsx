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

// Five columns: inside a compact page's column budget, past a regular one's — the same def shows
// both the fitting case and the horizontal scroll a wider grid falls back to.
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const WIDE: ComparisonDef = {
  rowLabel: 'Tone',
  columnLabel: 'Size',
  rows: [{ key: 'neutral', label: 'Neutral' }, { key: 'accent', label: 'Accent' }],
  columns: SIZES.map((s) => ({ key: s, label: s })),
  cells: ['neutral', 'accent'].flatMap((tone) =>
    SIZES.map((s) => ({ rowKey: tone, columnKey: s, node: <Text>{`${tone[0]}·${s}`}</Text> })),
  ),
};

export default defineCatalogPage({
  component: 'ComparisonGrid',
  internalProps: { size: "The page's specimen size, passed by SectionBlock's layout.", surface: "The page's specimenSurface, passed by SectionBlock." },
  group: 'Components',
  whenToUse: 'Two props that combine freely, where a column means the same thing in every row — so a cell genuinely reads as "this value of A with that value of B". If the second axis differs per variant the shared column headers would be lying; use ComparisonGroups. For a single axis, use ComparisonList.',
  source: '../native/catalog/ComparisonGrid.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: 'A grid of two props that combine freely, rendered as an accessible table inside one card. The card fills its container and the columns share that width equally, so a two-column grid is as wide as a five-column one; phone width (402px) caps the specimen inside a cell, not the column. Columns never shrink below the specimen size\'s minimum — below that the grid scrolls horizontally inside the card, never the page. This is the layout behind every `comparison`-based page in both catalogs (e.g. Button\'s Variant × State).',
  a11y: 'The card is a table labelled by its two axis names: the first row and the first column are headers, and every example sits in its own cell, so each one is announced with both of its axes.',
  variants: {
    // A whole grid card per row: two grids side by side would each fall below their column
    // minimum and scroll inside themselves.
    maxColumns: 1,
    items: [
      { key: 'combination', name: 'Variant × State, with an unavailable cell', node: <ComparisonGrid def={DEMO} size="regular" sectionId="ComparisonGridDemo" /> },
      { key: 'compact', name: 'Compact · five columns fit', node: <ComparisonGrid def={WIDE} size="compact" sectionId="ComparisonGridCompactDemo" /> },
      { key: 'scrolling', name: 'Wide · columns never below phone width', node: <ComparisonGrid def={DEMO} size="wide" sectionId="ComparisonGridWideDemo" /> },
    ],
  },
});
