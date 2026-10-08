import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { InputField } from './InputField';

function InputFieldDemo() {
  const [value, setValue] = useState('');
  return (
    <InputField
      label="From"
      value={value}
      onChangeText={setValue}
      editable
      placeholder="Search a station"
    />
  );
}

export default defineCatalogPage({
  component: 'InputField',
  group: 'Inputs',
  description: 'A floating-label field. Resting: a centred, body-sized label with no border. Active (focused, or picker with active set) or filled: the label floats to a small top caption, row 2 shows the value/input, and a border fades in while active.',
  whenToUse: 'A named field with a fixed identity ("To", "Arrive by") across the interaction. For free-text search with no floating label, use SearchField; for one of a small known set of choices, use Dropdown.',
  a11y: 'The editable mode is a live TextInput; the picker mode is a Pressable row. Either mode shows a clear button while active (focused, or active for a picker) with a value set. Provide a meaningful label.',
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'default',
        name: 'Default',
        props: { label: 'To' },
        node: <InputField label="To" placeholder="Search a station" onPress={() => {}} />,
      },
      {
        key: 'icon-label',
        name: 'Icon label',
        props: { label: 'icon' },
        node: <InputField label="icon" labelIcon="flag" value="Custom stop" onPress={() => {}} />,
      },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      { key: 'editable', name: 'Editable', props: { label: 'From' }, node: <InputFieldDemo /> },
      {
        key: 'picker',
        name: 'Picker (filled)',
        node: <InputField label="To" value="Grand Central" placeholder="Search a station" onPress={() => {}} />,
      },
      {
        key: 'active',
        name: 'Active (external picker open)',
        node: <InputField label="To" value="Grand Central" placeholder="Search a station" active onPress={() => {}} />,
      },
      {
        key: 'optional',
        name: 'Optional label',
        props: { label: 'Name' },
        node: <InputField label="Name" placeholder="Nickname" optional onPress={() => {}} />,
      },
      {
        key: 'value-icon',
        name: 'Value with icon',
        props: { label: 'Walk time' },
        node: <InputField label="Walk time" value="8 min" valueIcon="footprints" />,
      },
      {
        key: 'value-accent',
        name: 'Accent value',
        props: { label: 'Arrive by' },
        node: <InputField label="Arrive by" value="9:12 AM" valueAccent />,
      },
      { key: 'disabled', name: 'Disabled', node: <InputField label="Arrive by" value="9:12 AM" disabled /> },
    ],
  },
});
