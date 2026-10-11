import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { Toast } from './Toast';
import { DS_SPACING } from '../../tokens';

const styles = StyleSheet.create({
  // Toast demo — floats the toast near the top of the PhoneFrame, the same way a real screen would
  // position it (Toast itself renders no absolute overlay; that's always the call site's job).
  toastDemoOverlay: { position: 'absolute', top: DS_SPACING[800], left: DS_SPACING[600], right: DS_SPACING[600] },
});

// Drives Toast's `visible` prop directly (rather than the usual mount/unmount-the-whole-component
// pattern) so this demo actually exercises the slide-in-from-top/fade animation, not just the two
// static end states.
function ToastDemo() {
  const [visible, setVisible] = useState(true);
  return (
    <PhoneFrame>
      <Button label={visible ? 'Hide toast' : 'Show toast'} onPress={() => setVisible((v) => !v)} />
      <View style={styles.toastDemoOverlay} pointerEvents="box-none">
        <Toast message="Trip saved" variant="success" visible={visible} />
      </View>
    </PhoneFrame>
  );
}

export default defineCatalogPage({
  component: 'Toast',
  group: 'Components',
  specimenSize: 'regular',
  description: 'A transient confirmation bar. Without a variant it renders the dark surface with inverse text; a variant shifts to a pastel status color.',
  whenToUse: "Transient and self-contained, floating over the screen, expected to go away on its own or via its own action. For a persistent, in-flow message about a standing condition, use Banner.",
  a11y: 'Rendered with accessibilityRole="alert" so screen readers announce it when it appears.',
  // Confirmed from Toast.tsx's own JSX, not inferred from its imports: it renders a Button itself
  // (not a caller-supplied child) whenever `action` is set. Toast.tsx also renders an Icon for its
  // status glyph, but Icon has no catalog page/known component name of its own to confirm against
  // yet, so that entry is left out rather than logging an unknown-component warning.
  composedOf: [
    { component: 'Button', role: 'Renders the optional action button when action is set.', relationship: 'built-in' },
  ],
  variants: {
    itemsFill: true,
    items: [
      { key: 'base', name: 'Base (no variant)', node: <Toast message="Changes saved" /> },
      { key: 'success', name: 'Success', props: { variant: 'success' }, node: <Toast message="Trip saved" variant="success" /> },
      { key: 'informational', name: 'Informational', props: { variant: 'informational' }, node: <Toast message="New app version available" variant="informational" /> },
      { key: 'warning', name: 'Warning', props: { variant: 'warning' }, node: <Toast message="Signal delays reported" variant="warning" /> },
      { key: 'negative', name: 'Negative', props: { variant: 'negative' }, node: <Toast message="Failed to save trip" variant="negative" /> },
      { key: 'neutral', name: 'Neutral', props: { variant: 'neutral' }, node: <Toast message="3 new updates" variant="neutral" /> },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'action',
        name: 'With action',
        node: <Toast message="Trip removed" action={{ label: 'Undo', onPress: () => {} }} />,
      },
      {
        key: 'visible-toggle',
        name: 'Slide-in animation (toggle)',
        node: <ToastDemo />,
      },
    ],
  },
});
