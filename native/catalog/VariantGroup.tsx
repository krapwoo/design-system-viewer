import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_TEXT, CATALOG_COLOR } from './tokens';

/** Labels one example (or small group of examples) inside a section's Examples card — a bold
 *  uppercase name plus a one-line description stacked below it, sitting above whatever demo content
 *  is passed as children. Both are optional — omit for a plain, label-less group when the examples
 *  are self-explanatory. Centered by default; pass `align="left"` for content that reads better
 *  left-aligned (e.g. a wide token swatch grid). */
export function VariantGroup({
  name,
  desc,
  align = 'center',
  children,
}: {
  name?: string;
  desc?: string;
  align?: 'center' | 'left';
  children: React.ReactNode;
}) {
  const centered = align === 'center';
  const hasLabel = !!name || !!desc;
  return (
    <View style={[styles.group, centered ? styles.groupCenter : styles.groupLeft]}>
      {hasLabel && (
        <>
          {!!name && <Text style={[styles.name, centered && styles.textCenter]}>{name}</Text>}
          {!!desc && <Text style={[styles.desc, centered && styles.textCenter]}>{desc}</Text>}
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 6px sits between CATALOG_SPACE.xs (4) and .sm (8) — no scale step lands on it, so it's a literal
  // value here (same reasoning as SectionBlock's exampleItem gap).
  group: { gap: 6 },
  groupCenter: { alignItems: 'center' },
  groupLeft: { alignItems: 'flex-start' },
  name: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.text },
  desc: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  textCenter: { textAlign: 'center' },
});
