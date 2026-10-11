import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
import { Button } from './Button';
import type { ButtonVariant } from './Button.types';
import { DS_SEMANTIC } from '../../tokens';

const styles = StyleSheet.create({
  // `white` is documented as "solid light (for dark/photo backgrounds)" — invisible on this
  // catalog's own white card, so it needs a dark backdrop to read as a real button.
  darkBackdrop: {
    backgroundColor: DS_SEMANTIC.text.regular,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
});

// Button: Variant × State. `white` keeps the dark backdrop its variant requires.
// `rows` is bound to Button's own `variant` prop (design §4): each row key below is an actual
// `ButtonVariant` option, so `doctor` can tell when one is renamed or removed. `columns` names no
// single prop (disabled/loading are two separate booleans, not one "State" prop) and stays unbound
// — unbound axes are just as valid, and `doctor` never flags one.
const BUTTON_COMPARISON = grid(
  'Variant',
  'State',
  {
    prop: 'variant',
    items: [
      { key: 'primary', label: 'Primary' },
      { key: 'secondary', label: 'Secondary' },
      { key: 'tertiary', label: 'Tertiary' },
      { key: 'white', label: 'White' },
      { key: 'ghost', label: 'Ghost' },
    ],
  },
  [
    { key: 'default', label: 'Default' },
    { key: 'disabled', label: 'Disabled' },
    { key: 'loading', label: 'Loading' },
  ],
  (row, column) => {
    const button = (
      <Button
        label="Continue"
        variant={row as ButtonVariant}
        disabled={column === 'disabled'}
        loading={column === 'loading'}
        onPress={() => {}}
      />
    );
    return row === 'white' ? <View style={styles.darkBackdrop}>{button}</View> : button;
  },
);

export default defineCatalogPage({
  component: 'Button',
  group: 'Actions',
  composedOf: [
    { component: 'Loading', role: "The spinner that replaces the label and icon while loading is true.", relationship: 'built-in' },
  ],
  comparison: BUTTON_COMPARISON,
  description:
    'The primary tap target. Five visual weights, three sizes, optional leading/trailing icon, plus loading and icon-only modes.',
  whenToUse: 'An action — something happens on tap. For a tappable chip that just flips a persistent selected state, use Pill instead.',
  a11y: 'Renders a Pressable with accessibilityRole="button"; pass accessibilityLabel for icon-only buttons where the label is hidden.',
  variants: {
    items: [
      { key: 'primary', name: 'Primary', props: { variant: 'primary', size: 'large' }, node: <Button label="Primary" variant="primary" onPress={() => {}} /> },
      { key: 'secondary', name: 'Secondary', props: { variant: 'secondary', size: 'large' }, node: <Button label="Secondary" variant="secondary" onPress={() => {}} /> },
      { key: 'tertiary', name: 'Tertiary', props: { variant: 'tertiary', size: 'large' }, node: <Button label="Tertiary" variant="tertiary" onPress={() => {}} /> },
      {
        key: 'white',
        name: 'White',
        props: { variant: 'white', size: 'large' },
        node: (
          <View style={styles.darkBackdrop}>
            <Button label="White" variant="white" onPress={() => {}} />
          </View>
        ),
      },
      { key: 'ghost', name: 'Ghost', props: { variant: 'ghost', size: 'large' }, node: <Button label="Ghost" variant="ghost" onPress={() => {}} /> },
    ],
  },
  states: {
    items: [
      { key: 'with-icon', name: 'With icon', props: { iconPosition: 'leading' }, node: <Button label="Add stop" showIcon iconName="add" onPress={() => {}} /> },
      {
        key: 'trailing-icon',
        name: 'Trailing icon',
        props: { iconPosition: 'trailing' },
        node: <Button label="Continue" showIcon iconName="chevron-right" iconPosition="trailing" onPress={() => {}} />,
      },
      { key: 'icon-only', name: 'Icon-only', node: <Button label="Add stop" showIcon showLabel={false} iconName="add" onPress={() => {}} /> },
      { key: 'loading', name: 'Loading', node: <Button label="Loading" loading onPress={() => {}} /> },
      { key: 'disabled', name: 'Disabled', node: <Button label="Disabled" disabled onPress={() => {}} /> },
      { key: 'full-width', name: 'Full width', fill: true, node: <Button label="Confirm trip" fullWidth onPress={() => {}} /> },
      { key: 'medium', name: 'Medium size', props: { size: 'medium' }, node: <Button label="Add stop" size="medium" onPress={() => {}} /> },
      { key: 'small', name: 'Small size', props: { size: 'small' }, node: <Button label="Add stop" size="small" onPress={() => {}} /> },
    ],
  },
});
