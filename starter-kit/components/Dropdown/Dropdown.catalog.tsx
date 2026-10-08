import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Dropdown } from './Dropdown';
import { DS_SPACING } from '../../tokens';

const styles = StyleSheet.create({
  // Dropdown demo — fills PhoneFrame edge-to-edge (`flex:1` + `alignSelf:'stretch'` override
  // PhoneFrame's own `alignItems/justifyContent:'center'`, which centers-and-shrinks BottomSheetDemo's
  // trigger button just fine but would otherwise leave this wrapper short and centered too). Dropdown's
  // own BottomSheet is a sibling of its trigger in the same tree position, so its absolute overlay
  // fills *this* box — it needs to be the full frame, not a small box hugging just the trigger.
  dropdownFrameContent: { flex: 1, alignSelf: 'stretch', padding: DS_SPACING[800] },
});

const SAMPLE_DROPDOWN_OPTIONS = [
  { value: 'uptown', label: 'Uptown & The Bronx' },
  { value: 'downtown', label: 'Downtown & Brooklyn' },
  { value: 'crosstown', label: 'Crosstown' },
];

function DropdownDemo() {
  const [value, setValue] = useState('uptown');
  return (
    <PhoneFrame>
      <View style={styles.dropdownFrameContent}>
        <Dropdown
          label="Direction"
          value={value}
          onChange={setValue}
          placeholder="Choose a direction"
          options={SAMPLE_DROPDOWN_OPTIONS}
        />
      </View>
    </PhoneFrame>
  );
}

export default defineCatalogPage({
  component: 'Dropdown',
  group: 'Inputs',
  description: 'A labelled field that opens a BottomSheet picker on tap — the "bottom sheet picker" interaction: tap the trigger, pick an option from the sheet, it closes.',
  whenToUse: 'The answer is one of a small, known set of choices — never free text. For free-text filtering, use SearchField; for a named field with a fixed identity, use InputField.',
  a11y: 'The trigger is a Pressable (via FieldContainer) with accessibilityRole="button". Options render as accessibilityRole="radio" inside a "radiogroup", with accessibilityState.checked reflecting the current selection.',
  variants: {
    itemsFill: true,
    items: [{ key: 'default', name: 'Default (tap to open)', node: <DropdownDemo /> }],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'placeholder',
        name: 'Placeholder',
        node: <Dropdown label="Direction" placeholder="Choose a direction" options={SAMPLE_DROPDOWN_OPTIONS} onChange={() => {}} />,
      },
      {
        key: 'no-label',
        name: 'No label',
        node: <Dropdown value="uptown" options={SAMPLE_DROPDOWN_OPTIONS} onChange={() => {}} />,
      },
      {
        key: 'disabled',
        name: 'Disabled',
        node: <Dropdown label="Direction" value="uptown" options={SAMPLE_DROPDOWN_OPTIONS} onChange={() => {}} disabled />,
      },
    ],
  },
});
