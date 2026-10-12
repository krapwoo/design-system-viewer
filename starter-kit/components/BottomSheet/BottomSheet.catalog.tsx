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

/** Every example is a real sheet inside a phone: the trigger opens it, the backdrop dismisses it.
 *  `OverlayDemo` supplies the phone, so the sheet's absolute overlay stays in its own cell. */
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
  composedOf: [
    { component: 'TopNav', role: "The header slot, typically a TopNav with a close or back action.", relationship: 'slot' },
    { component: 'Dock', role: "The footer slot, typically a Dock with the sheet's primary actions; a Dock footer gets its shadow once the content scrolls.", relationship: 'slot' },
  ],
  description: 'A sheet that slides up over a dismissible backdrop. Height is driven by its content (not fixed snap points) up to 90% of the available height, then the content area scrolls. Compose header with TopNav and footer with Dock.',
  whenToUse: 'For longer, browsable content, or anything that benefits from a TopNav/Dock header-footer structure. For a short, focused decision that interrupts the flow, use Dialog.',
  a11y: 'The backdrop is a Pressable with accessibilityRole="button" and accessibilityLabel="Dismiss"; header/content/footer carry their own accessibility (e.g. TopNav\'s title as accessibilityRole="header").',
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
