import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PhoneFrame } from './PhoneFrame';
import { CatalogButton } from './CatalogButton';
import { overlayTrigger } from './overlayDemoState';

// Not `StyleSheet.absoluteFill`: React Native 0.81's types reject spreading it.
const FILL = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

/**
 * A phone with a catalog button that opens an overlay: a sheet, a dialog, a toast. The overlay
 * (`children`) fills the device above the centred trigger and gets `{ open, close }`; keep it
 * mounted and drive its own `visible` from `open`, so its open and close animations play.
 */
export function OverlayDemo({
  triggerLabel,
  initiallyOpen = false,
  keepTrigger = false,
  children,
}: {
  triggerLabel: string | ((open: boolean) => string);
  initiallyOpen?: boolean;
  /** Keep the trigger visible while open, as a toggle. @default false */
  keepTrigger?: boolean;
  children: (state: { open: boolean; close: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const trigger = overlayTrigger(open, { triggerLabel, keepTrigger });
  return (
    <PhoneFrame>
      <View style={styles.screen}>
        {trigger.visible && (
          <CatalogButton label={trigger.label} onPress={() => setOpen((value) => (keepTrigger ? !value : true))} />
        )}
        <View style={FILL} pointerEvents="box-none">
          {children({ open, close: () => setOpen(false) })}
        </View>
      </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
