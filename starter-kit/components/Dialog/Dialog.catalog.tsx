import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, OverlayDemo } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { ButtonGroup } from '../ButtonGroup';
import { Dialog } from './Dialog';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  cardTitle: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
  cardBody: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
  dialogActions: { marginTop: DS_SPACING[800] },
});

/** Every example is a real dialog inside a phone, so the backdrop covers the screen it belongs to
 *  rather than the catalog page. `OverlayDemo` supplies the phone and the trigger. */
function Demo({ title, body, actions }: { title: string; body?: string; actions: (close: () => void) => React.ReactNode }) {
  return (
    // Open from the start: a closed dialog is just a trigger, so the card each example is named
    // for would never be on screen.
    <OverlayDemo triggerLabel="Open dialog" initiallyOpen>
      {({ open, close }) => (
        <Dialog visible={open} onDismiss={close}>
          <Text style={styles.cardTitle}>{title}</Text>
          {body ? <Text style={styles.cardBody}>{body}</Text> : null}
          <View style={styles.dialogActions}>{actions(close)}</View>
        </Dialog>
      )}
    </OverlayDemo>
  );
}

export default defineCatalogPage({
  component: 'Dialog',
  group: 'Components',
  // Every example is a phone. The default size left 283px for a 375px device, rendering it at 75%
  // — small enough that the dialog's own body text stopped being the size a reader sees.
  specimenSize: 'wide',
  composedOf: [
    { component: 'ButtonGroup', role: "Lays out the dialog's actions; a dialog's own children decide this, not Dialog.", relationship: 'related' },
  ],
  description: 'A card centred on screen over a dismissible backdrop — fades and scales in, distinct from BottomSheet\'s bottom-anchored slide. Named Dialog (not Modal) to avoid shadowing React Native\'s own built-in Modal.',
  whenToUse: 'A short, focused decision that interrupts the flow (confirm/cancel, a single form). For anything longer, browsable, or that needs its own internal scrolling, use BottomSheet.',
  a11y: 'The backdrop is a Pressable with accessibilityRole="button" and accessibilityLabel="Dismiss"; content you pass as children carries its own accessibility.',
  variants: {
    items: [
      {
        key: 'confirm',
        name: 'A confirmation, two actions',
        node: (
          <Demo
            title="Delete this trip?"
            body="This can't be undone."
            actions={(close) => (
              <ButtonGroup>
                <Button label="Cancel" variant="tertiary" onPress={close} />
                <Button label="Delete" onPress={close} />
              </ButtonGroup>
            )}
          />
        ),
      },
      {
        key: 'acknowledge',
        name: 'One action to acknowledge',
        node: (
          <Demo
            title="Trip saved"
            body="You'll find it under Saved trips."
            actions={(close) => <Button label="Got it" onPress={close} />}
          />
        ),
      },
      {
        // Title alone: Dialog adds no body of its own, so a question that needs no explanation
        // keeps the card to two lines.
        key: 'title-only',
        name: 'Title and actions only',
        node: (
          <Demo
            title="Discard changes?"
            actions={(close) => (
              <ButtonGroup>
                <Button label="Keep editing" variant="tertiary" onPress={close} />
                <Button label="Discard" onPress={close} />
              </ButtonGroup>
            )}
          />
        ),
      },
    ],
  },
});
