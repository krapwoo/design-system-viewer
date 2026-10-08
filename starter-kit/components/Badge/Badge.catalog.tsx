import React from 'react';
import { defineCatalogPage, type ComparisonDef } from '@krapwoo/ds-viewer';
import { Badge } from './Badge';
import type { BadgeVariant } from './Badge.types';

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

// Badge: Tone × Icon layout. One icon per tone, matching the Variants examples.
const BADGE_TONES: { key: BadgeVariant; label: string; text: string; icon: React.ComponentProps<typeof Badge>['leadingIcon'] }[] = [
  { key: 'neutral', label: 'Neutral', text: 'Local', icon: 'pin' },
  { key: 'info', label: 'Info', text: 'Notice', icon: 'info-circle' },
  { key: 'positive', label: 'Positive', text: 'On time', icon: 'circle-check' },
  { key: 'warning', label: 'Warning', text: 'Delayed', icon: 'triangle-alert' },
  { key: 'negative', label: 'Negative', text: 'Suspended', icon: 'circle-slash' },
];
const BADGE_COMPARISON = grid(
  'Tone',
  'Icon',
  BADGE_TONES.map(({ key, label }) => ({ key, label })),
  [
    { key: 'label-only', label: 'Label only' },
    { key: 'leading-icon', label: 'Leading icon' },
    { key: 'trailing-icon', label: 'Trailing icon' },
    { key: 'icon-only', label: 'Icon-only' },
  ],
  (row, column) => {
    const tone = BADGE_TONES.find((t) => t.key === row)!;
    if (column === 'icon-only') return <Badge variant={tone.key} leadingIcon={tone.icon} accessibilityLabel={tone.text} />;
    return (
      <Badge
        variant={tone.key}
        label={tone.text}
        leadingIcon={column === 'leading-icon' ? tone.icon : undefined}
        trailingIcon={column === 'trailing-icon' ? tone.icon : undefined}
      />
    );
  },
  'compact',
);

export default defineCatalogPage({
  component: 'Badge',
  group: 'Surfaces',
  specimenSize: 'compact',
  comparison: BADGE_COMPARISON,
  description: 'A small status chip — five semantic variants, with optional leading/trailing icons or icon-only.',
  whenToUse: "Read-only and inline, not tappable — for one row's data point. For a tappable chip with a selected state, use Pill; for a message about the whole screen, use Toast or Banner.",
  a11y: 'A plain View with text; the label carries the meaning, so avoid encoding status by color alone.',
  variants: {
    items: [
      { key: 'neutral', name: 'Neutral', props: { variant: 'neutral' }, node: <Badge variant="neutral" label="Local" /> },
      { key: 'info', name: 'Info', props: { variant: 'info' }, node: <Badge variant="info" label="Notice" leadingIcon="info-circle" /> },
      { key: 'positive', name: 'Positive', props: { variant: 'positive' }, node: <Badge variant="positive" label="On time" leadingIcon="circle-check" /> },
      { key: 'warning', name: 'Warning', props: { variant: 'warning' }, node: <Badge variant="warning" label="Delayed" leadingIcon="triangle-alert" /> },
      { key: 'negative', name: 'Negative', props: { variant: 'negative' }, node: <Badge variant="negative" label="Suspended" leadingIcon="circle-slash" /> },
    ],
  },
  states: {
    items: [
      {
        key: 'leading-icon',
        name: 'Leading icon',
        node: <Badge variant="positive" label="On time" leadingIcon="circle-check" />,
      },
      {
        key: 'trailing-icon',
        name: 'Trailing icon',
        node: <Badge variant="positive" label="On time" trailingIcon="circle-check" />,
      },
      {
        key: 'icon-only',
        name: 'Icon-only',
        node: <Badge variant="info" leadingIcon="info-circle" accessibilityLabel="Notice" />,
      },
    ],
  },
});
