import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { InputClearButton } from './InputClearButton';

export default defineCatalogPage({
  component: 'InputClearButton',
  group: 'Sub-Parts',
  description: 'The clear (×) button InputField and SearchField both show once a field is active and holds a value — a filled circle-x icon sized to reach the 44pt touch target via hitSlop, not visual size.',
  a11y: 'A Pressable with accessibilityRole="button" and the given (or default "Clear field") accessibilityLabel; hitSlop of 10 on every side pads its 24×24 visual size out to the 44pt minimum.',
  variants: {
    items: [{ key: 'default', name: 'Default', node: <InputClearButton onPress={() => {}} /> }],
  },
  states: {
    items: [
      { key: 'custom-label', name: 'Custom accessibility label', node: <InputClearButton onPress={() => {}} accessibilityLabel="Clear search" /> },
    ],
  },
});
