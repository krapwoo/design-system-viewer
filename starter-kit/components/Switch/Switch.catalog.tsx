import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Switch } from './Switch';

function SwitchDemo() {
  const [value, setValue] = useState(true);
  return <Switch value={value} onValueChange={setValue} accessibilityLabel="Notifications" />;
}

function SwitchLabelDemo() {
  const [value, setValue] = useState(true);
  return <Switch value={value} onValueChange={setValue} label="Notifications" />;
}

export default defineCatalogPage({
  component: 'Switch',
  group: 'Components',
  specimenSize: 'regular',
  description: 'A boolean on/off toggle. The thumb slides and the track crossfades colour, sharing SegmentedToggle/UnderlineTabs\' own slide-animation hook for a consistent motion feel.',
  whenToUse: 'A setting that takes effect immediately, no separate save step. For recording a fact a future action (like a form submit) will act on, use Checkbox; for one-of-many exclusive selection, use Radio.',
  a11y: 'Renders a Pressable with accessibilityRole="switch" and accessibilityState.checked — pass accessibilityLabel to say what it controls.',
  variants: {
    items: [{ key: 'default', name: 'Default (tap to toggle)', node: <SwitchDemo /> }],
  },
  states: {
    items: [
      { key: 'off', name: 'Off', node: <Switch value={false} onValueChange={() => {}} accessibilityLabel="Notifications" /> },
      { key: 'on', name: 'On', node: <Switch value={true} onValueChange={() => {}} accessibilityLabel="Notifications" /> },
      { key: 'label', name: 'With label', props: { label: true }, node: <SwitchLabelDemo /> },
      { key: 'disabled', name: 'Disabled', node: <Switch value={true} onValueChange={() => {}} disabled accessibilityLabel="Notifications" /> },
    ],
  },
});
