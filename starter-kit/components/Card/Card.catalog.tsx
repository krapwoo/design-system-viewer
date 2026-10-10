import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Card } from './Card';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  cardTitle: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
  cardBody: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
});

export default defineCatalogPage({
  component: 'Card',
  group: 'Surfaces',
  description: 'The primary content surface — a rounded white card with a soft resting shadow. Pass children, or onPress to make the whole card a button.',
  whenToUse: 'A standalone, self-contained unit with its own shadow. For a row in a homogeneous stack of peers (with dividers between them), use ListItem inside a List instead.',
  a11y: 'When onPress is set, renders a Pressable with accessibilityRole="button" and a visible focus ring; a plain card is a non-interactive View.',
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'default',
        name: 'Default',
        node: (
          <Card>
            <Text style={styles.cardTitle}>Uptown & The Bronx</Text>
            <Text style={styles.cardBody}>Next train in 4 min · every 6–8 min</Text>
          </Card>
        ),
      },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'plain',
        name: 'Plain',
        node: (
          <Card>
            <Text style={styles.cardTitle}>Uptown & The Bronx</Text>
            <Text style={styles.cardBody}>Next train in 4 min · every 6–8 min</Text>
          </Card>
        ),
      },
      {
        key: 'pressable',
        name: 'Pressable',
        node: (
          <Card onPress={() => {}}>
            <Text style={styles.cardTitle}>Crosstown Bus M14</Text>
            <Text style={styles.cardBody}>Tap to view live arrivals</Text>
          </Card>
        ),
      },
      {
        key: 'disabled',
        name: 'Disabled',
        node: (
          <Card onPress={() => {}} disabled>
            <Text style={styles.cardTitle}>Franklin Ave Shuttle</Text>
            <Text style={styles.cardBody}>Temporarily unavailable</Text>
          </Card>
        ),
      },
    ],
  },
});
