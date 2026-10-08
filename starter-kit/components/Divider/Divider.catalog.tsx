import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Divider } from './Divider';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  cardBody: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
  dividerDemo: { width: '100%', gap: DS_SPACING[400] },
});

export default defineCatalogPage({
  component: 'Divider',
  group: 'Layout',
  description: 'A 1px hairline separator at the divider token colour.',
  a11y: 'A plain, non-interactive View — purely decorative.',
  // No `variant` prop and no other real configuration exists on Divider — a single hairline is the
  // whole component, shown here between two lines of content to demonstrate real placement.
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'default',
        name: 'Default',
        node: (
          <View style={styles.dividerDemo}>
            <Text style={styles.cardBody}>Section one</Text>
            <Divider />
            <Text style={styles.cardBody}>Section two</Text>
          </View>
        ),
      },
    ],
  },
});
