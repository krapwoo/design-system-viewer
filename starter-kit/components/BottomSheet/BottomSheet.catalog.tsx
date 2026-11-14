import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, OverlayDemo } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { Dock } from '../Dock';
import { TopNav } from '../TopNav';
import { BottomSheet } from './BottomSheet';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  // No padding here — BottomSheet's own content area already supplies the standard 16px.
  cardTitle: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
  cardBody: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
});

const EXTRA_PARAGRAPHS = [
  'Board at the front car for a faster transfer at Union Sq.',
  'This line runs express between 96 St and 168 St during rush hours, skipping local stops in between. Weekend service runs local along the full route, with some stations closed for planned maintenance.',
  'Elevators are available at 168 St, 137 St, and 125 St — check the map for accessible entrances before you travel.',
];

/** Every example is a real sheet inside a phone. The sheet renders in React Native's `Modal`, which on
 *  the web would otherwise cover the whole catalog page; `OverlayDemo` renders through `PhoneFrame`,
 *  which opens each example in its own device-sized iframe document, so the Modal lands inside the
 *  phone. The trigger reopens the sheet and the backdrop dismisses it. The sheet starts open — closed, every example would be the same empty
 *  phone behind the same trigger, and what each one is named for (header, footer, scrolling) would
 *  be invisible. */
function Sheet({
  header,
  footer,
  /** Extra paragraphs; enough of them and the content area passes 90% height and starts scrolling. */
  paragraphs = 0,
}: {
  header?: (close: () => void) => React.ReactNode;
  footer?: (close: () => void) => React.ReactNode;
  paragraphs?: number;
}) {
  return (
    // Open from the start: closed, every example is the same empty phone behind the same trigger,
    // and what each one is named for — the header, the footer, the scrolling — is invisible.
    <OverlayDemo triggerLabel="Open sheet" initiallyOpen>
      {({ open, close }) => (
        <BottomSheet visible={open} onDismiss={close} header={header?.(close)} footer={footer?.(close)}>
          <View>
            <Text style={styles.cardTitle}>Uptown &amp; The Bronx</Text>
            <Text style={styles.cardBody}>Next train in 4 min · every 6–8 min.</Text>
            {EXTRA_PARAGRAPHS.slice(0, paragraphs).map((line) => (
              <Text key={line} style={styles.cardBody}>{line}</Text>
            ))}
          </View>
        </BottomSheet>
      )}
    </OverlayDemo>
  );
}

const topNav = (close: () => void) => (
  <TopNav
    title="Trip details"
    trailing={<Button variant="secondary" size="small" showIcon showLabel={false} iconName="clear" accessibilityLabel="Close" onPress={close} />}
  />
);
const dock = (close: () => void) => (
  <Dock>
    <Button label="Confirm" onPress={close} />
  </Dock>
);

export default defineCatalogPage({
  component: 'BottomSheet',
  group: 'Components',
  standalone: 'A reusable kit component in its own right; Dropdown is just the only kit component that uses it.',
  // Every example is a phone. At the default size two blocks share the row and each cell falls to
  // 270px, which squeezes the frame until the sheet's own text is barely readable — 'wide' keeps a
  // 402px minimum, the width the sheet is actually used at.
  specimenSize: 'wide',
  composedOf: [
    { component: 'TopNav', role: "The header slot, typically a TopNav with a close or back action.", relationship: 'slot' },
    { component: 'Dock', role: "The footer slot, typically a Dock with the sheet's primary actions; a Dock footer gets its shadow once the content scrolls.", relationship: 'slot' },
  ],
  description:
    'A sheet that slides up over a dismissible backdrop, in its own Modal so it covers the whole screen, navigation included. Height is driven by its content (not fixed snap points) up to 90% of the available height, then the content area scrolls. Compose header with TopNav and footer with Dock.',
  whenToUse: 'For longer, browsable content, or anything that benefits from a TopNav/Dock header-footer structure. For a short, focused decision that interrupts the flow, use Dialog.',
  a11y:
    'The backdrop is a Pressable with accessibilityRole="button" and accessibilityLabel="Dismiss"; tapping it calls `onDismiss`. The sheet renders inside React Native\'s Modal and passes `onDismiss` as its `onRequestClose`, so the Android hardware back button (handled, so it closes the sheet instead of navigating away behind it) and, on web, Escape call `onDismiss` too. On web this is verified in react-native-web\'s source: ModalContent listens for Escape on the document and calls `onRequestClose` while the Modal is active, marks the Modal aria-modal with role="dialog", and ModalFocusTrap keeps Tab inside the Modal (it wraps the content in focus brackets and moves focus back in when it leaves) and returns focus to the previously focused element, such as the trigger, when the Modal unmounts. On web the trap also moves focus to the first focusable element on opening. Escape does not work on iOS or Android: React Native\'s View has no key handler, so a hardware keyboard cannot dismiss the sheet there. Because the Modal is above the app, the sheet covers a tab bar or other navigation, which cannot be tapped while the sheet is open. The sheet container sets accessibilityViewIsModal, which on iOS keeps VoiceOver inside the sheet; the prop has no effect on Android or on web. NOT VERIFIED ON A DEVICE: that VoiceOver and TalkBack focus order starts in the sheet, and that Android hides the content behind it from TalkBack — both are expected from the platform\'s native modal presentation, but nothing here has been run on iOS or Android. The drag handle is purely visual — no drag-to-dismiss gesture is wired up, and the handle has no accessibility role or label. Header and footer content carry their own accessibility (TopNav\'s title is accessibilityRole="header").',
  notes: [
    'Renders its own React Native Modal (`transparent`, `animationType="none"`): the sheet covers the whole screen wherever it is placed, so callers no longer wrap it in a Modal. The slide and fade are still BottomSheet\'s own, and the Modal stays mounted until the exit animation has finished.',
    'Open only one sheet at a time. Stacked Modals are fragile on iOS, and a second sheet traps the user between two backdrops. `useInsideBottomSheetWarning` is exported for components that open their own sheet (Dropdown); it console.warns in development when called inside an already-open sheet.',
    'Sets `statusBarTranslucent` and `navigationBarTranslucent` (Android only; ignored on iOS and web) so the sheet reaches the screen edges and Dock\'s `useSafeAreaInsets` padding applies to the same full-screen window. Not verified on an Android device: the inset values a Dock reads inside the Modal, and the sheet\'s edges under a 3-button or gesture navigation bar, have not been checked.',
    'A Dock passed as `footer` has its `elevated` prop driven automatically from whether the content area overflows.',
  ],
  variants: {
    items: [
      // Both slots empty: the sheet is only as tall as its content, above its own drag handle.
      { key: 'content-only', name: 'Content only', node: <Sheet /> },
      { key: 'header', name: 'With a TopNav header', node: <Sheet header={topNav} /> },
      { key: 'header-footer', name: 'Header and a Dock footer', node: <Sheet header={topNav} footer={dock} /> },
    ],
  },
  states: {
    items: [
      // Past 90% of the phone's height the content area scrolls, which is what turns on the Dock
      // footer's shadow — overflowing it is the only way to see that happen.
      { key: 'scrolling', name: 'Content long enough to scroll', node: <Sheet header={topNav} footer={dock} paragraphs={3} /> },
    ],
  },
});
