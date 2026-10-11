import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { TopNav } from './TopNav';
import { DS_SEMANTIC, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  cardTitle: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
});

export default defineCatalogPage({
  component: 'TopNav',
  group: 'Components',
  composedOf: [
    { component: 'Button', role: "The leading and trailing slots, typically small icon Buttons (back, close, an action).", relationship: 'slot' },
  ],
  description: 'A screen\'s top bar — fixed-width leading/trailing slots flanking a centered title (or custom center content). Slots reserve their layout space even when empty, so the title stays centered no matter which sides are populated.',
  a11y: 'The title renders with accessibilityRole="header". Slot content (typically icon-only Buttons) carries its own accessibilityLabel.',
  // No `variant` prop exists on TopNav — its "Variants" column just shows the one default look,
  // with both slots populated; the individual slot combinations live under "States".
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'default',
        name: 'Default',
        node: (
          <TopNav
            title="Trip planner"
            leading={<Button variant="secondary" size="small" showIcon showLabel={false} iconName="chevron-left" accessibilityLabel="Back" onPress={() => {}} />}
            trailing={<Button variant="secondary" size="small" showIcon showLabel={false} iconName="search" accessibilityLabel="Search" onPress={() => {}} />}
          />
        ),
      },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      { key: 'title-only', name: 'Title only', node: <TopNav title="Settings" /> },
      {
        key: 'leading-only',
        name: 'Leading only',
        node: (
          <TopNav
            title="Trip details"
            leading={<Button variant="secondary" size="small" showIcon showLabel={false} iconName="chevron-left" accessibilityLabel="Back" onPress={() => {}} />}
          />
        ),
      },
      {
        key: 'trailing-only',
        name: 'Trailing only',
        node: (
          <TopNav
            title="Saved trips"
            trailing={<Button variant="secondary" size="small" showIcon showLabel={false} iconName="add" accessibilityLabel="Add" onPress={() => {}} />}
          />
        ),
      },
      {
        key: 'custom-center',
        name: 'Custom center',
        node: (
          <TopNav
            leading={<Button variant="secondary" size="small" showIcon showLabel={false} iconName="clear" accessibilityLabel="Close" onPress={() => {}} />}
            center={<Text style={styles.cardTitle}>Custom center content</Text>}
          />
        ),
      },
    ],
  },
});
