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

/** Every example is a real dialog inside a phone. `OverlayDemo` renders through `PhoneFrame`'s iframe,
 *  so the dialog's Modal stays inside its own cell; the trigger reopens it and the backdrop dismisses
 *  it. It starts open — closed, every example would be the same empty phone behind the same
 *  trigger. */
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
  description:
    'A card centred on screen over a dismissible backdrop, fading and scaling in, in its own Modal so it covers the whole screen, navigation included. It supplies only the card — white surface, large radius, shadow, 16px padding, at most 400px wide — and renders whatever children it is given; the title, body and actions are the caller\'s.',
  whenToUse:
    "A short, focused decision that interrupts the flow and needs an answer before going on. For longer or browsable content, or anything that wants a TopNav header and Dock footer, use BottomSheet, which slides up from the bottom edge instead. For a message that asks for no decision, use Toast (transient) or Banner (persistent).",
  a11y:
    'The backdrop is a Pressable with accessibilityRole="button" and accessibilityLabel="Dismiss"; tapping it calls `onDismiss`. The dialog renders inside React Native\'s Modal and passes `onDismiss` as its `onRequestClose`, so the Android hardware back button (handled, so it closes the dialog instead of navigating away behind it) and, on web, Escape call `onDismiss` too. On web this is verified in react-native-web\'s source: ModalContent listens for Escape on the document and calls `onRequestClose` while the Modal is active, marks the Modal aria-modal with role="dialog", and ModalFocusTrap keeps Tab inside the Modal (it wraps the content in focus brackets and moves focus back in when it leaves) and returns focus to the previously focused element, such as the trigger, when the Modal unmounts. On web the trap also moves focus to the first focusable element on opening. Escape does not work on iOS or Android: React Native\'s View has no key handler, so a hardware keyboard cannot dismiss the dialog there. Because the Modal is above the app, the dialog covers a tab bar or other navigation, which cannot be tapped while the dialog is open. The card sets accessibilityViewIsModal, which on iOS keeps VoiceOver inside it; the prop has no effect on Android or on web. NOT VERIFIED ON A DEVICE: that VoiceOver and TalkBack focus order starts in the dialog, and that Android hides the content behind it from TalkBack — both are expected from the platform\'s native modal presentation, but nothing here has been run on iOS or Android. The card has no alertdialog role of its own and is not labelled by its title. While it fades out it stops intercepting touches. The animation does not check the OS "reduce motion" setting.',
  notes: [
    'Renders its own React Native Modal (`transparent`, `animationType="none"`): the dialog covers the whole screen wherever it is placed, so callers do not wrap it in a Modal. The fade and scale are still Dialog\'s own, and the Modal stays mounted until the exit animation has finished.',
    'Sets `statusBarTranslucent` and `navigationBarTranslucent` (Android only; ignored on iOS and web) so the dialog\'s backdrop reaches the screen edges. Not verified on an Android device: the dialog\'s edges and padding under a 3-button or gesture navigation bar have not been checked.',
    'The dialog never closes itself — the backdrop and the Modal\'s `onRequestClose` only call `onDismiss`, and every button inside is wired by the caller.',
    '`visible` going false plays the exit animation, then unmounts the dialog.',
  ],
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
