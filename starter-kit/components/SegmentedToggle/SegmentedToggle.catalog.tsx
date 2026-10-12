import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { SegmentedToggle, type SegmentedToggleOption } from './SegmentedToggle';

/** Each example owns its own selection, so the thumb really slides when a segment is pressed. */
function Demo({ options, initial }: { options: SegmentedToggleOption[]; initial?: string }) {
  const [value, setValue] = useState(initial ?? options[0].value);
  return <SegmentedToggle value={value} onChange={setValue} options={options} />;
}

const TWO: SegmentedToggleOption[] = [
  { value: 'map', label: 'Map' },
  { value: 'list', label: 'List' },
];
const ICONS: SegmentedToggleOption[] = [
  { value: 'map', label: 'Map', iconName: 'map' },
  { value: 'list', label: 'List', iconName: 'menu' },
  { value: 'saved', label: 'Saved', iconName: 'bell' },
];
const MIXED: SegmentedToggleOption[] = [
  { value: 'map', label: 'Map', iconName: 'map' },
  { value: 'list', label: 'List', iconName: 'menu' },
  { value: 'saved', label: 'Saved', iconName: 'bell', badge: 3 },
  // Label-only, beside segments that have icons: the row keeps one height either way.
  { value: 'settings', label: 'Settings' },
];

export default defineCatalogPage({
  component: 'SegmentedToggle',
  group: 'Components',
  description: 'A row of mutually-exclusive options on a recessed track, with a white thumb that slides to the selected segment. Two or more options.',
  whenToUse: 'A filled, heavier-weight control for a primary, prominent choice on the screen. For quieter secondary navigation, use UnderlineTabs.',
  a11y: 'The row is accessibilityRole="tablist"; each segment is a "tab" with accessibilityState.selected reflecting the current value.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'two', name: 'Two options', node: <Demo options={TWO} /> },
      { key: 'icons', name: 'An icon per segment', node: <Demo options={ICONS} /> },
      { key: 'badge', name: 'A badge, and a label-only segment', node: <Demo options={MIXED} /> },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      // Where the thumb sits is the component's whole job, so show both ends of the track.
      { key: 'first', name: 'First segment selected', node: <Demo options={ICONS} initial="map" /> },
      { key: 'last', name: 'Last segment selected', node: <Demo options={ICONS} initial="saved" /> },
    ],
  },
});
