import React, { forwardRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

/** The viewer's own button, for catalog chrome and demo triggers (not an app component): a rounded
 *  rectangle, primary in the accent blue, secondary outlined. `disabled` greys it and stops the
 *  press; `busy` keeps its own colours while the action it started is still running, with a
 *  spinner before the label. */
export const CatalogButton = forwardRef<View, {
  label: string;
  /** Optional, because a permanently unavailable button still renders (see `disabled`). */
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  /** Not pressable, and visibly unavailable. */
  disabled?: boolean;
  /** Pressed already, still working: a spinner and a muted label. Also stops a second press. */
  busy?: boolean;
  accessibilityLabel?: string;
}>(function CatalogButton({ label, onPress, variant = 'primary', disabled = false, busy = false, accessibilityLabel }, ref) {
  const [focused, setFocused] = useState(false);
  const primary = variant === 'primary';
  // Busy stops the press like disabled does — the action is already running — but keeps the
  // button's own colours, because it is working rather than unavailable.
  const off = disabled || busy;
  return (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && !off && (primary ? styles.primaryPressed : styles.secondaryPressed),
        disabled && styles.disabled,
        focused && styles.focus,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={CATALOG_COLOR.textMuted} /> : null}
      <Text
        style={[
          styles.label,
          primary ? styles.labelPrimary : styles.labelSecondary,
          busy && styles.labelBusy,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // A rounded rectangle (owner decision 2026-10-11); primary in the catalog's accent blue.
  // A row, so `busy` can put a spinner before the label without the label moving.
  base: {
    height: CATALOG_LAYOUT.controlSize,
    paddingHorizontal: 18,
    borderRadius: CATALOG_RADIUS.control,
    flexDirection: 'row',
    gap: CATALOG_SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  primary: { backgroundColor: CATALOG_COLOR.accent },
  primaryPressed: { opacity: 0.85 },
  secondary: { borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, backgroundColor: CATALOG_COLOR.surface },
  secondaryPressed: { backgroundColor: CATALOG_COLOR.surfacePressed },
  // One flat grey for both variants, so a disabled primary and a disabled secondary read the same:
  // what stops the press is the state, not which button it is.
  disabled: { backgroundColor: CATALOG_COLOR.controlDisabled, borderColor: CATALOG_COLOR.controlDisabled },
  // Same ring as the sidebar's: an outline, so focusing never shifts the layout.
  focus: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
  label: { ...CATALOG_TEXT.bodyStrong },
  labelPrimary: { color: '#ffffff' },
  labelSecondary: { color: CATALOG_COLOR.text },
  labelBusy: { color: CATALOG_COLOR.textMuted },
  labelDisabled: { color: CATALOG_COLOR.controlDisabledText },
});
