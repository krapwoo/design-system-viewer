import React from 'react';
import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
import { Pill } from './Pill';

// Pill: Selection × State.
// `rows` is bound to Pill's own `variant` prop (design §4); the second item's key is
// `'not_selected'` (underscore), matching `PillVariant` exactly — not `'not-selected'`, which is
// only this page's own label-ish spelling and would fail `doctor`'s "item key must be a real
// option" check.
const PILL_COMPARISON = grid(
  'Selection',
  'State',
  {
    prop: 'variant',
    items: [
      { key: 'selected', label: 'Selected' },
      { key: 'not_selected', label: 'Not selected' },
    ],
  },
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
  composedOf: [
    { component: 'Loading', role: "The spinner shown instead of the label and icon while loading is true.", relationship: 'built-in' },
  ],
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
