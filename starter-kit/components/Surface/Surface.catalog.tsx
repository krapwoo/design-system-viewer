import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Surface } from './Surface';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  surfaceDemo: { height: 96, justifyContent: 'center', alignItems: 'center', padding: DS_SPACING[800] },
  surfaceText: { ...DS_TYPOGRAPHY.bodyMd, color: DS_SEMANTIC.text.regular },
});

export default defineCatalogPage({
  component: 'Surface',
  group: 'Surfaces',
  // White or near-white component: a gray stage shows its edges.
  specimenSurface: 'neutral',
  description:
    "Declares \"this subtree's background is tone\" — renders a plain View filled with the matching token (surface.white or surface.main) and provides that tone to descendants via context, so a tone-aware component inside (e.g. FieldContainer/InputField) can automatically pick a fill that contrasts with it instead of assuming white.",
  whenToUse:
    "Wrap a screen (or any region) wherever its background isn't the default white — a page with a muted/grey background, for instance — so anything inside that needs to contrast with its background picks the right fill automatically.",
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'white',
        name: 'White',
        props: { tone: 'white' },
        node: (
          <Surface tone="white" style={styles.surfaceDemo}>
            <Text style={styles.surfaceText}>surface.white</Text>
          </Surface>
        ),
      },
      {
        key: 'muted',
        name: 'Muted',
        props: { tone: 'muted' },
        node: (
          <Surface tone="muted" style={styles.surfaceDemo}>
            <Text style={styles.surfaceText}>surface.main</Text>
          </Surface>
        ),
      },
    ],
  },
});
