import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { UnderlineTabs, type UnderlineTabOption } from './UnderlineTabs';

/** Each example owns its own selection, so the underline really slides when a tab is pressed. */
function Demo({ options, initial }: { options: UnderlineTabOption[]; initial?: string }) {
  const [value, setValue] = useState(initial ?? options[0].value);
  return <UnderlineTabs value={value} onChange={setValue} options={options} />;
}

const LABELS: UnderlineTabOption[] = [
  { value: 'all', label: 'All' },
  { value: 'nearby', label: 'Nearby' },
  { value: 'favorites', label: 'Favorites' },
];
const WITH_ICON: UnderlineTabOption[] = [
  { value: 'all', label: 'All' },
  // A leading icon beside tabs that have none: the row still aligns on one baseline.
  { value: 'nearby', label: 'Nearby', iconName: 'pin' },
  { value: 'favorites', label: 'Favorites' },
];
const WITH_BADGE: UnderlineTabOption[] = [
  { value: 'all', label: 'All' },
  { value: 'nearby', label: 'Nearby', iconName: 'pin' },
  { value: 'favorites', label: 'Favorites', badge: 2 },
];

export default defineCatalogPage({
  component: 'UnderlineTabs',
  group: 'Components',
  description: 'A quieter tab switcher — left-aligned labels over a hairline rule, with a sliding underline indicator. Same options/value/onChange API as SegmentedToggle.',
  whenToUse: "Quiet, secondary navigation within a screen that already has a clear primary focus. For a prominent, primary choice, use SegmentedToggle.",
  a11y: 'Each tab is a Pressable label; the underline is a visual indicator only, so selection is also conveyed by the active label weight.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'labels', name: 'Labels only', node: <Demo options={LABELS} /> },
      { key: 'icon', name: 'A leading icon on one tab', node: <Demo options={WITH_ICON} /> },
      { key: 'badge', name: 'A badge on a tab', node: <Demo options={WITH_BADGE} /> },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      // The underline's position is the selection, so show it at both ends of the row.
      { key: 'first', name: 'First tab selected', node: <Demo options={LABELS} initial="all" /> },
      { key: 'last', name: 'Last tab selected', node: <Demo options={LABELS} initial="favorites" /> },
    ],
  },
});
