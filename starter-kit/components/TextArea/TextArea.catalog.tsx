import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { TextArea } from './TextArea';

function TextAreaDemo() {
  const [value, setValue] = useState('');
  return <TextArea value={value} onChangeText={setValue} placeholder="Describe the issue…" />;
}

export default defineCatalogPage({
  component: 'TextArea',
  group: 'Components',
  specimenSize: 'regular',
  composedOf: [
    { component: 'FieldContainer', role: "The field frame around the multi-line input.", relationship: 'built-in' },
  ],
  description: 'A multi-line input that grows with its content from a minimum height.',
  a11y: 'A multiline TextInput; pass accessibilityLabel via inputProps when there is no visible label beside it.',
  variants: {
    itemsFill: true,
    items: [{ key: 'default', name: 'Default', node: <TextAreaDemo /> }],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'disabled',
        name: 'Disabled',
        node: <TextArea value="This report has already been submitted." onChangeText={() => {}} editable={false} />,
      },
    ],
  },
});
