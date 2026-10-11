import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_TYPE } from './tokens';

/** The viewer's own button, for catalog chrome and demo triggers (not an app component). Same look
 *  as the update page's buttons. */
export const CatalogButton = forwardRef<View, {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  accessibilityLabel?: string;
}>(function CatalogButton({ label, onPress, variant = 'primary', accessibilityLabel }, ref) {
  const [focused, setFocused] = useState(false);
  const primary = variant === 'primary';
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
        focused && styles.focus,
      ]}
    >
      <Text style={[styles.label, primary ? styles.labelPrimary : styles.labelSecondary]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { height: CATALOG_LAYOUT.controlSize, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  primary: { backgroundColor: CATALOG_COLOR.text },
  primaryPressed: { opacity: 0.85 },
  secondary: { borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, backgroundColor: CATALOG_COLOR.surface },
  secondaryPressed: { backgroundColor: CATALOG_COLOR.surfacePressed },
  // Same ring as the sidebar's: an outline, so focusing never shifts the layout.
  focus: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
  label: { fontSize: CATALOG_TYPE.md, fontWeight: '700' },
  labelPrimary: { color: '#ffffff' },
  labelSecondary: { color: CATALOG_COLOR.text },
});
