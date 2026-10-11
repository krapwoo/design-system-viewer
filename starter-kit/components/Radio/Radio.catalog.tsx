import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Radio } from './Radio';
import { DS_SPACING } from '../../tokens';

const styles = StyleSheet.create({
  radioGroup: { gap: DS_SPACING[600], alignItems: 'flex-start' },
});

function RadioGroupDemo() {
  const [value, setValue] = useState('uptown');
  return (
    <View style={styles.radioGroup}>
      <Radio selected={value === 'uptown'} onPress={() => setValue('uptown')} label="Uptown & The Bronx" />
      <Radio selected={value === 'downtown'} onPress={() => setValue('downtown')} label="Downtown & Brooklyn" />
    </View>
  );
}

export default defineCatalogPage({
  component: 'Radio',
  group: 'Components',
  specimenSize: 'regular',
  description: 'A single circular selection control — a filled dot appears in the ring when selected. A group of mutually-exclusive Radios is just multiple instances sharing one selected value in the consumer.',
  whenToUse: 'One selection from a mutually-exclusive set — checking one should un-check another. For an independent on/off fact, use Checkbox; for a setting that takes effect immediately, use Switch.',
  a11y: 'Renders a Pressable with accessibilityRole="radio" and accessibilityState.selected; the optional label doubles as its accessibilityLabel.',
  variants: {
    items: [{ key: 'default', name: 'Default (tap to select)', node: <RadioGroupDemo /> }],
  },
  states: {
    items: [
      { key: 'unselected', name: 'Unselected', node: <Radio selected={false} onPress={() => {}} label="Uptown & The Bronx" /> },
      { key: 'selected', name: 'Selected', node: <Radio selected={true} onPress={() => {}} label="Uptown & The Bronx" /> },
      { key: 'disabled', name: 'Disabled', node: <Radio selected={true} onPress={() => {}} disabled label="Uptown & The Bronx" /> },
    ],
  },
});
