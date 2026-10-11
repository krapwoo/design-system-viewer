import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { UnderlineTabs } from './UnderlineTabs';

function UnderlineTabsDemo() {
  const [value, setValue] = useState('all');
  return (
    <UnderlineTabs
      value={value}
      onChange={setValue}
      options={[
        { value: 'all', label: 'All' },
        // Leading-icon tab — the layout every other option (icon-less) would otherwise hide.
        { value: 'nearby', label: 'Nearby', iconName: 'pin' },
        { value: 'favorites', label: 'Favorites', badge: 2 },
      ]}
    />
  );
}

export default defineCatalogPage({
  component: 'UnderlineTabs',
  group: 'Components',
  // Phone width plus a small phone, where long labels truncate.
  previewWidths: [402, 320],
  description: 'A quieter tab switcher — left-aligned labels over a hairline rule, with a sliding underline indicator. Same options/value/onChange API as SegmentedToggle.',
  whenToUse: "Quiet, secondary navigation within a screen that already has a clear primary focus. For a prominent, primary choice, use SegmentedToggle.",
  a11y: 'Each tab is a Pressable label; the underline is a visual indicator only, so selection is also conveyed by the active label weight.',
  render: () => <UnderlineTabsDemo />,
});
