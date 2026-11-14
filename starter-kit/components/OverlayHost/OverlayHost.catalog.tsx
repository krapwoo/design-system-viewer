import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { OverlayHost } from './OverlayHost';
import { Tooltip } from '../Tooltip';
import { Button } from '../Button';
import { Card } from '../Card';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  // Fills the phone edge to edge (PhoneFrame centres and shrinks its children otherwise).
  frame: { flex: 1, alignSelf: 'stretch' },
  screen: { flex: 1, padding: DS_SPACING[800], gap: DS_SPACING[800] },
  caption: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted },
  clipCard: { overflow: 'hidden', alignItems: 'flex-start' },
});

// Sample text for showing layout, not product wording. The label is the Tooltip catalog's own.
const LABEL = 'Tap to add a stop';
const CAPTION = 'The rest of the screen stays tappable under the overlay layer.';

/** A phone with an OverlayHost at its root and one thing drawn into the layer: a Tooltip whose trigger
 *  is inside a clipping Card. Tapping the button toggles the tip, and the caption's own touches are
 *  untouched: the layer is `box-none`. */
function Demo() {
  const [visible, setVisible] = useState(true);
  return (
    <PhoneFrame>
      <View style={styles.frame}>
        <OverlayHost>
          <View style={styles.screen}>
            <Card style={styles.clipCard}>
              <Tooltip visible={visible} label={LABEL}>
                <Button
                  variant="ghost"
                  size="medium"
                  showIcon
                  showLabel={false}
                  iconName="add"
                  accessibilityLabel="Add stop"
                  onPress={() => setVisible((v) => !v)}
                />
              </Tooltip>
            </Card>
            <ScrollView>
              <Text style={styles.caption}>{CAPTION}</Text>
            </ScrollView>
          </View>
        </OverlayHost>
      </View>
    </PhoneFrame>
  );
}

export default defineCatalogPage({
  component: 'OverlayHost',
  group: 'Components',
  specimenSize: 'wide',
  composedOf: [
    { component: 'Tooltip', role: 'Its only consumer today: renders its bubble into the host\'s layer so the bubble can never be clipped.', relationship: 'related' },
  ],
  description:
    'A wrapper mounted once near the app root, like SafeAreaProvider. It renders the app\'s content and, above it, one overlay layer: an absolutely filled View with `pointerEvents="box-none"`, so touches pass through wherever nothing is drawn. Components draw into that layer through context (`mount`, `update` and `unmount`, or the `OverlayPortal` component built on them), so what they draw sits outside every ancestor that clips, such as a ScrollView or a rounded card with `overflow: hidden`. Content is positioned in window coordinates, the kind `measureInWindow` returns; the host measures its own window origin and exposes it as `origin`, so a consumer subtracts it instead of assuming the host sits at (0, 0).',
  whenToUse:
    'Once, around the app\'s content, close to the root and inside SafeAreaProvider. Tooltip requires it to escape clipping: without one the bubble is drawn in place and warns once in development. It is deliberately not a Modal: it takes no focus, blocks no touches and covers nothing it is not asked to draw. For something that should cover the screen and take focus, use Dialog or BottomSheet, which render their own Modal. It is not a general popover or menu system: it has no placement, dismissal or stacking logic of its own.',
  a11y:
    'The host adds no semantics of its own: the layer is a plain View with `pointerEvents="box-none"`, no role and no label, and it is not a Modal, so it does not trap focus, hide the content behind it from screen readers or take screen-reader focus. What accessibility an overlay has is whatever its own content sets (Tooltip\'s bubble is a polite live region, not focusable). Overlay content is placed after the app content, so it comes last in the reading order on platforms that follow tree order. NOT VERIFIED ON A DEVICE: how TalkBack and VoiceOver order and announce content drawn in the layer relative to the content it belongs to.',
  notes: [
    'Mount exactly one near the root. A second, nested host would take over for everything below it, since the nearest one wins.',
    'The app content is wrapped in its own `flex: 1` View, so the layer is that View\'s later sibling and paints above any elevated or z-indexed descendant of the content (on Android, `zIndex` only orders siblings).',
    'The host root is `flex: 1`: give it a parent with a size, as with any root-level wrapper.',
    '`origin` is measured with `measureInWindow` on layout and whenever the window size changes. A host that moves without being resized or the window changing size (for example a translucent status bar appearing) is not re-measured until the next layout.',
    'Content registered through the host renders under the host in the tree, not under the component that asked for it, so React context from the requesting component\'s ancestors (other than the host\'s own) is not available to it.',
    'The layer fills the host, so overlay content is clipped only by the host\'s own edges: anything positioned outside the host may be cut off there on native.',
    '`useOverlayHost()` returns `null` outside a host so a consumer can fall back instead of throwing; `OverlayPortal` renders nothing there.',
  ],
  variants: {
    items: [{ key: 'default', name: 'Tooltip in a clipping Card (tap the button to toggle)', node: <Demo /> }],
  },
});
