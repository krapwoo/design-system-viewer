import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, OverlayDemo } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { Dock } from '../Dock';
import { TopNav } from '../TopNav';
import { BottomSheet } from './BottomSheet';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  // BottomSheet/Dropdown demos render inside the shared `PhoneFrame` (./PhoneFrame.tsx) so their
  // absolute overlays stay contained instead of covering the whole catalog page. No padding here —
  // BottomSheet's own content area already supplies the standard 16px.
  sheetContent: {},
  cardTitle: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
  cardBody: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
});

function BottomSheetDemo() {
  return (
    <OverlayDemo triggerLabel="Open sheet">
      {({ open, close }) => (
        <BottomSheet
          visible={open}
          onDismiss={close}
          header={
            <TopNav
              title="Trip details"
              trailing={<Button variant="secondary" size="small" showIcon showLabel={false} iconName="clear" accessibilityLabel="Close" onPress={close} />}
            />
          }
          footer={
            <Dock>
              <Button label="Confirm" onPress={close} />
            </Dock>
          }
        >
          <View style={styles.sheetContent}>
            <Text style={styles.cardTitle}>Uptown & The Bronx</Text>
            <Text style={styles.cardBody}>Next train in 4 min · every 6–8 min.</Text>
            {/* Long enough to overflow the phone frame's fixed height — demonstrates the Dock footer's
                `elevated` shadow turning on automatically once this content area actually scrolls. */}
            <Text style={styles.cardBody}>Board at the front car for a faster transfer at Union Sq.</Text>
            <Text style={styles.cardBody}>
              This line runs express between 96 St and 168 St during rush hours, skipping local stops in
              between. Weekend service runs local along the full route, with some stations closed for
              planned maintenance.
            </Text>
            <Text style={styles.cardBody}>
              Elevators are available at 168 St, 137 St, and 125 St — check the map for accessible
              entrances before you travel.
            </Text>
          </View>
        </BottomSheet>
      )}
    </OverlayDemo>
  );
}

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
  render: () => <BottomSheetDemo />,
});
