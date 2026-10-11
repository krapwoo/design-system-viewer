import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { SegmentedToggle } from './SegmentedToggle';

function SegmentedToggleDemo() {
  const [value, setValue] = useState('map');
  return (
    <SegmentedToggle
      value={value}
      onChange={setValue}
      options={[
        { value: 'map', label: 'Map', iconName: 'map' },
        { value: 'list', label: 'List', iconName: 'menu' },
        { value: 'saved', label: 'Saved', iconName: 'bell', badge: 3 },
        // Label-only segment (no iconName) — the layout every other option's icon would otherwise hide.
        { value: 'settings', label: 'Settings' },
      ]}
    />
  );
}

export default defineCatalogPage({
  component: 'SegmentedToggle',
  group: 'Components',
  // Phone width plus a small phone, where long labels truncate.
  previewWidths: [402, 320],
  description: 'A row of mutually-exclusive options on a recessed track, with a white thumb that slides to the selected segment. Two or more options.',
  whenToUse: 'A filled, heavier-weight control for a primary, prominent choice on the screen. For quieter secondary navigation, use UnderlineTabs.',
  a11y: 'The row is accessibilityRole="tablist"; each segment is a "tab" with accessibilityState.selected reflecting the current value.',
  render: () => <SegmentedToggleDemo />,
});
