import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;

/** The link-style trigger ("Notes and API ›") that opens a `SidePanel`. */
export function SidePanelTrigger({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      {...({ 'aria-expanded': open, 'aria-haspopup': 'dialog' } as Record<string, unknown>)}
      style={[styles.toggle, focused && styles.focusRing]}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      {/* Always `›`: the content opens in a side panel, never expands in place. */}
      <Text {...ARIA_HIDDEN} style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATALOG_SPACE.xs,
    alignSelf: 'flex-start',
    minHeight: CATALOG_LAYOUT.controlSize,
    justifyContent: 'center',
  },
  toggleLabel: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.accent },
  chevron: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.accent },
});
