import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Dropdown } from './Dropdown';
import { DS_SPACING } from '../../tokens';

const styles = StyleSheet.create({
  // Dropdown demo — fills PhoneFrame edge-to-edge (`flex:1` + `alignSelf:'stretch'` override
  // PhoneFrame's own `alignItems/justifyContent:'center'`, which centers-and-shrinks BottomSheetDemo's
  // trigger button just fine but would otherwise leave this wrapper short and centered too). The
  // picker's sheet renders in its own Modal, so it covers the whole device regardless of this box.
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
  group: 'Components',
  composedOf: [
    { component: 'FieldContainer', role: "The field frame around the label, value and chevron (the trigger).", relationship: 'built-in' },
    { component: 'BottomSheet', role: "The picker listing the options while the dropdown is open. BottomSheet renders its own Modal, so it covers the whole screen.", relationship: 'built-in' },
    { component: 'TopNav', role: "The sheet's header, titled with the field's label.", relationship: 'built-in' },
    { component: 'Button', role: "The icon-only Close button in the sheet header.", relationship: 'built-in' },
  ],
  description: 'A labelled field that opens a BottomSheet picker on tap — the "bottom sheet picker" interaction: tap the trigger, pick an option from the sheet, it closes.',
  whenToUse: 'The answer is one of a small, known set of choices — never free text. For free-text filtering, use SearchField; for a named field with a fixed identity, use InputField.',
  a11y:
    'The trigger is the shared FieldContainer Pressable with accessibilityRole="button", named "<label>, <selected option or placeholder>" (whichever parts exist), with `aria-disabled` and `aria-expanded` (true while the picker is open). Disabled, it stays an accessible button element announced as disabled rather than disappearing from the accessibility tree. In the picker each option is a Pressable with accessibilityRole="radio" and `aria-checked`, inside a View with accessibilityRole="radiogroup"; the selected option also gets a check icon and the info colour. The sheet header\'s close Button is named "Close", its title is the field label (TopNav marks it as a header), and the backdrop is a "Dismiss" button. The picker is a BottomSheet, which renders inside React Native\'s Modal and passes `onRequestClose` to close it: the Android hardware back button and, on web, Escape close the picker. On web, react-native-web\'s ModalFocusTrap keeps Tab inside the open picker and returns focus to the previously focused element, the trigger, when it closes (verified in its source). On iOS and Android there is no focus management of our own: nothing moves focus into the picker or back to the trigger. NOT VERIFIED ON A DEVICE: screen-reader focus order inside the picker and TalkBack hiding the content behind it, both expected from the platform\'s native modal presentation. With neither `label` nor a matching value or placeholder the trigger has an empty accessible name.',
  notes: [
    '`value` that matches no option shows the placeholder, as if nothing were selected.',
    "The picker's header title falls back to the built-in text \"Select an option\" when there is no `label`.",
    'The picker is a BottomSheet, which renders its own React Native Modal and keeps it mounted until its exit animation has finished; Dropdown adds no Modal of its own, so exactly one is in the tree while it is open.',
    'The trigger takes the full width of its parent and is at least 44pt tall, even without a label.',
  ],
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
