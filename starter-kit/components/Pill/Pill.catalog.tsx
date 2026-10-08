import React from 'react';
import { defineCatalogPage, type ComparisonDef } from '@krapwoo/ds-viewer';
import { Pill } from './Pill';

// Grid comparisons: each cell is a real instance with exactly the props its row and column name.
// Never build these by multiplying `variants` with `states` — those are pre-rendered nodes and
// cannot combine.
function grid(
  rowLabel: string,
  columnLabel: string,
  rows: { key: string; label: string }[],
  columns: { key: string; label: string }[],
  cell: (row: string, column: string) => React.ReactNode,
  size?: ComparisonDef['size'],
): ComparisonDef {
  return {
    rowLabel,
    columnLabel,
    rows,
    columns,
    cells: rows.flatMap((row) => columns.map((column) => ({ rowKey: row.key, columnKey: column.key, node: cell(row.key, column.key) }))),
    size,
  };
}

// Pill: Selection × State.
const PILL_COMPARISON = grid(
  'Selection',
  'State',
  [
    { key: 'selected', label: 'Selected' },
    { key: 'not-selected', label: 'Not selected' },
  ],
  [
    { key: 'icon-text', label: 'Icon + Text' },
    { key: 'icon-only', label: 'Icon-only' },
    { key: 'disabled', label: 'Disabled' },
    { key: 'loading', label: 'Loading' },
  ],
  (row, column) => (
    <Pill
      label="Home"
      variant={row === 'selected' ? 'selected' : 'not_selected'}
      iconName="home"
      showText={column !== 'icon-only'}
      accessibilityLabel="Home"
      disabled={column === 'disabled'}
      loading={column === 'loading'}
      onPress={() => {}}
    />
  ),
  'compact',
);

export default defineCatalogPage({
  component: 'Pill',
  group: 'Actions',
  specimenSize: 'compact',
  comparison: PILL_COMPARISON,
  description: 'A compact selectable chip — selected/unselected states with an optional leading icon.',
  whenToUse: "A selection toggle, not an action — tapping it flips a persistent selected state. If tapping it should instead make something happen, use Button.",
  a11y: 'Pressable with accessibilityLabel; an icon-only pill (showText={false}) needs an explicit accessibilityLabel so it is announced.',
  variants: {
    items: [
      { key: 'selected', name: 'Selected', props: { variant: 'selected' }, node: <Pill label="Home" variant="selected" iconName="home" onPress={() => {}} /> },
      { key: 'not-selected', name: 'Not selected', props: { variant: 'not_selected' }, node: <Pill label="Work" variant="not_selected" iconName="briefcase" onPress={() => {}} /> },
    ],
  },
  states: {
    items: [
      {
        key: 'icon-text',
        name: 'Icon + Text',
        node: <Pill label="Nearby" variant="not_selected" iconName="pin" onPress={() => {}} />,
      },
      {
        key: 'icon-only',
        name: 'Icon-only',
        node: <Pill label="Saved" variant="not_selected" iconName="bell" showText={false} onPress={() => {}} />,
      },
      {
        key: 'disabled',
        name: 'Disabled',
        node: <Pill label="Sold out" variant="not_selected" iconName="clock" disabled onPress={() => {}} />,
      },
      {
        key: 'loading',
        name: 'Loading',
        node: <Pill label="Saving" variant="not_selected" iconName="clock" loading onPress={() => {}} />,
      },
    ],
  },
});
