import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;

/** Half the hit height a `compact` trigger adds around its text line to stay `controlSize` tall. */
const COMPACT_HIT_SLOP = (CATALOG_LAYOUT.controlSize - CATALOG_TEXT.icon.lineHeight) / 2;

/** The link-style trigger ("Notes and API ›") that opens a `SidePanel`. Pass `accessibilityLabel`
 *  when the visible label alone doesn't say what it opens (a page of many "Details" links).
 *  `compact` takes only its text line's height in the layout, so it sits one small gap under
 *  whatever it follows (a token tile's lines) instead of a control-sized box away. The box is still
 *  `controlSize` tall, so the tap target is: the text sits at the top of the box and a negative
 *  bottom margin pulls the layout back by the spare height, which hangs below the text and never
 *  over the line above (react-native-web ignores `hitSlop`). */
export function SidePanelTrigger({ label, open, onPress, accessibilityLabel, compact = false }: { label: string; open: boolean; onPress: () => void; accessibilityLabel?: string; compact?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      {...({ 'aria-expanded': open, 'aria-haspopup': 'dialog' } as Record<string, unknown>)}
      style={[styles.toggle, compact && styles.toggleCompact, focused && styles.focusRing]}
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
  // The text sits at the top of the box and the spare height hangs below it, so the box never covers
  // the line above (a note, a tile's lines). Below, the next tile or row draws over the overhang, so
  // the target that is really clickable is about 38px in a token grid (16px row gap) and about 34px in
  // a TokenRow (12px padding) — still above the 24px minimum target size.
  toggleCompact: { alignItems: 'flex-start', marginBottom: -COMPACT_HIT_SLOP * 2 },
  toggleLabel: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.accent },
  chevron: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.accent },
});
