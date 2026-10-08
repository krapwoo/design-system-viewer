import React from 'react';
import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
import { Badge } from './Badge';
import type { BadgeVariant } from './Badge.types';

// Badge: Tone × Icon layout. One icon per tone, matching the Variants examples.
const BADGE_TONES: { key: BadgeVariant; label: string; text: string; icon: React.ComponentProps<typeof Badge>['leadingIcon'] }[] = [
  { key: 'neutral', label: 'Neutral', text: 'Local', icon: 'pin' },
  { key: 'info', label: 'Info', text: 'Notice', icon: 'info-circle' },
  { key: 'positive', label: 'Positive', text: 'On time', icon: 'circle-check' },
  { key: 'warning', label: 'Warning', text: 'Delayed', icon: 'triangle-alert' },
  { key: 'negative', label: 'Negative', text: 'Suspended', icon: 'circle-slash' },
];
// `rows` is bound to Badge's own `variant` prop (design §4) — written as its own literal array
// (not `BADGE_TONES.map(...)`) so `doctor`'s static reader can check it without evaluating a
// function call; `BADGE_TONES` above still drives the real rendering in `cell` below.
const BADGE_ROWS = {
  prop: 'variant',
  items: [
    { key: 'neutral', label: 'Neutral' },
    { key: 'info', label: 'Info' },
    { key: 'positive', label: 'Positive' },
    { key: 'warning', label: 'Warning' },
    { key: 'negative', label: 'Negative' },
  ],
} as const;
const BADGE_COMPARISON = grid(
  'Tone',
  'Icon',
  BADGE_ROWS,
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
