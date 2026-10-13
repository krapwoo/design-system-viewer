import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { SurfaceScope } from './SurfaceScope';
import { InputField } from '../InputField';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  surfaceDemo: { height: 96, justifyContent: 'center', alignItems: 'center', padding: DS_SPACING[800] },
  surfaceText: { ...DS_TYPOGRAPHY.bodyMd, color: DS_SEMANTIC.text.regular },
  fieldDemo: { padding: DS_SPACING[800], gap: DS_SPACING[400] },
});

export default defineCatalogPage({
  component: 'SurfaceScope',
  group: 'Components',
  a11y: 'No semantics of its own: it renders a plain filled View and passes its tone down through context, so it adds nothing to the accessibility tree and neither groups nor labels what sits inside it.',
  specimenSize: 'regular',
  description:
    "Declares \"this subtree's background is tone\": renders a plain View filled with the matching token (surface.white or surface.main) and publishes that tone to everything inside it. Publishing is the half a token cannot do — DS_SEMANTIC.surface.* already holds the values, but a value cannot tell a descendant what it is sitting on.",
  whenToUse:
    "Wrap a screen (or any region) wherever its background isn't the default white. Reach for it whenever something inside needs to contrast with the background rather than assume white — that is what makes this a component rather than just the surface.* tokens it paints with.",
  composedOf: [
    { component: 'InputField', role: 'One of the components that reads the published tone, via useSurfaceTone(), to pick a fill that stays visible on it.', relationship: 'related' },
    { component: 'FieldContainer', role: 'The shared field chrome that actually does the reading, on behalf of every field built from it.', relationship: 'related' },
  ],
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'white',
        name: 'White',
        props: { tone: 'white' },
        node: (
          <SurfaceScope tone="white" style={styles.surfaceDemo}>
            <Text style={styles.surfaceText}>surface.white</Text>
          </SurfaceScope>
        ),
      },
      {
        key: 'muted',
        name: 'Muted',
        props: { tone: 'muted' },
        node: (
          <SurfaceScope tone="muted" style={styles.surfaceDemo}>
            <Text style={styles.surfaceText}>surface.main</Text>
          </SurfaceScope>
        ),
      },
    ],
  },
  states: {
    itemsFill: true,
    // The two cells above only show which token gets painted, which a swatch could do. These show
    // the part that needs a component: the same field, told nothing, picking a different fill
    // because of the scope it happens to be inside.
    items: [
      {
        key: 'field-on-white',
        name: 'A field inside tone="white"',
        node: (
          <SurfaceScope tone="white" style={styles.fieldDemo}>
            <InputField label="Name" value="Recessed fill" />
          </SurfaceScope>
        ),
      },
      {
        key: 'field-on-muted',
        name: 'The same field inside tone="muted"',
        node: (
          <SurfaceScope tone="muted" style={styles.fieldDemo}>
            <InputField label="Name" value="Opaque white" />
          </SurfaceScope>
        ),
      },
    ],
  },
});
