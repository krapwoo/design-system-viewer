import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_TYPE } from './tokens';

/** The viewer's own button, for catalog chrome and demo triggers (not an app component). Same look
 *  as the update page's buttons. */
export function CatalogButton({
  label,
  onPress,
  variant = 'primary',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  const primary = variant === 'primary';
  return (
    <Pressable
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
}

const styles = StyleSheet.create({
  base: { height: CATALOG_LAYOUT.controlSize, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  primary: { backgroundColor: CATALOG_COLOR.text },
  primaryPressed: { opacity: 0.85 },
  secondary: { borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, backgroundColor: CATALOG_COLOR.surface },
  secondaryPressed: { backgroundColor: CATALOG_COLOR.surfacePressed },
  focus: { borderWidth: 3, borderColor: CATALOG_COLOR.focusRing },
  label: { fontSize: CATALOG_TYPE.md, fontWeight: '700' },
  labelPrimary: { color: '#ffffff' },
  labelSecondary: { color: CATALOG_COLOR.text },
});
