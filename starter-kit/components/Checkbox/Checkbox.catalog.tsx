import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Checkbox } from './Checkbox';

function CheckboxDemo() {
  const [checked, setChecked] = useState(true);
  return <Checkbox checked={checked} onChange={setChecked} label="Remember this trip" />;
}

export default defineCatalogPage({
  component: 'Checkbox',
  group: 'Components',
  specimenSize: 'regular',
  description: 'A square selection control — the box fills with the accent colour and a checkmark when checked.',
  whenToUse: 'An independent on/off fact about this one item — any number can be checked at once. For a setting that takes effect immediately, use Switch; for one-of-many exclusive selection, use Radio.',
  a11y: 'Renders a Pressable with accessibilityRole="checkbox" and accessibilityState.checked; the optional label doubles as its accessibilityLabel.',
  variants: {
    items: [{ key: 'default', name: 'Default (tap to toggle)', node: <CheckboxDemo /> }],
  },
  states: {
    items: [
      { key: 'unchecked', name: 'Unchecked', node: <Checkbox checked={false} onChange={() => {}} label="Remember this trip" /> },
      { key: 'checked', name: 'Checked', node: <Checkbox checked={true} onChange={() => {}} label="Remember this trip" /> },
      { key: 'no-label', name: 'No label', node: <Checkbox checked={true} onChange={() => {}} /> },
      { key: 'disabled', name: 'Disabled', node: <Checkbox checked={true} onChange={() => {}} disabled label="Remember this trip" /> },
    ],
  },
});
