import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { SearchField } from './SearchField';

function SearchFieldDemo() {
  const [value, setValue] = useState('');
  return <SearchField value={value} onChangeText={setValue} placeholder="Search stations" />;
}

export default defineCatalogPage({
  component: 'SearchField',
  group: 'Inputs',
  description: 'Single-line search input on the shared field chrome — leading search icon, a border that darkens on focus, and a clear button while active with text.',
  whenToUse: 'Free-text filtering/searching only — never a named field with a fixed value. For that, use InputField; for a small known set of choices, use Dropdown.',
  a11y: 'Forwards a ref to the underlying TextInput; all TextInputProps pass through, so pass accessibilityLabel/placeholder as needed.',
  variants: {
    itemsFill: true,
    items: [{ key: 'default', name: 'Default (type to see clear button)', node: <SearchFieldDemo /> }],
  },
  states: {
    itemsFill: true,
    items: [
      { key: 'empty', name: 'Empty', node: <SearchField value="" onChangeText={() => {}} placeholder="Search stations" /> },
      { key: 'filled', name: 'With value', node: <SearchField value="Union Sq" onChangeText={() => {}} /> },
      { key: 'disabled', name: 'Disabled', node: <SearchField value="" onChangeText={() => {}} placeholder="Search stations" disabled /> },
    ],
  },
});
