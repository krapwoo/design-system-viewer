import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

/** #64 B2 / #63 R1: one "On this page" jump chip, shared by a `tokenDefinition` page's category
 *  row and a group page's top-level-member row. `qualifier` is the small muted text after the
 *  title (a token page's own entry count, or a group page's "Part N of <Family>"/"+k parts").
 *  Exactly one of `href` (a real, keyboard-reachable anchor to the target's address — `role="link"`)
 *  or `onPress` (an in-page scroll, `role="button"`) is the common case; both may be set together
 *  (a real link that also runs its own handler, the same convention every other canonical link in
 *  this codebase already uses — see `catalogReferences.ts`'s `referenceLinkProps`). */
export interface JumpItem {
  /** React key — the chip's own target id (a token section id, or a group member id). */
  id: string;
  title: string;
  qualifier?: string;
  /** Overrides the default accessible name (`title`, or `"<title>, <qualifier>"` when a qualifier
   *  is set) — a token page's own chip keeps its established "N value(s)" wording this way. */
  accessibilityLabel?: string;
  href?: string;
  onPress?: (event?: { preventDefault?: () => void; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number }) => void;
  /** Makes the chip a toggle (a filter or sort choice): it reports `aria-pressed` and, when true,
   *  takes the accent look. Omitted: a plain jump chip, as before. Only meaningful without `href`. */
  selected?: boolean;
}

export function JumpChip({ title, qualifier, accessibilityLabel, href, onPress, selected }: Omit<JumpItem, 'id'>) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? (qualifier ? `${title}, ${qualifier}` : undefined)}
      // `href` renders a real `<a href="#Id">` on web (react-native-web leaves keyboard activation
      // of role="link" to the browser's own anchor handling) — the same convention
      // `catalogReferences.ts`'s link producers already establish.
      {...(href ? ({ href } as Record<string, unknown>) : null)}
      {...(selected !== undefined ? ({ 'aria-pressed': selected } as Record<string, unknown>) : null)}
      style={({ pressed }) => [styles.jumpChip, (pressed || hovered) && styles.jumpChipHover, selected && styles.jumpChipSelected, focused && styles.focusRing]}
    >
      <Text style={[styles.jumpChipTitle, selected && styles.jumpChipTitleSelected]}>{title}</Text>
      {qualifier ? <Text style={styles.jumpChipCount}>{qualifier}</Text> : null}
    </Pressable>
  );
}

/** #64 B2: a token page's category jump row, and (#63 R1) a group page's top-level-member jump
 *  row — one chip per item, in authored order. */
export function JumpRow({ items }: { items: readonly JumpItem[] }) {
  return (
    <View style={styles.jumpRow} accessibilityRole="list">
      {/* `role="list"` must own `listitem` children, so each chip sits in its own item. */}
      {items.map((item) => (
        <View key={item.id} role="listitem">
          <JumpChip title={item.title} qualifier={item.qualifier} accessibilityLabel={item.accessibilityLabel} href={item.href} onPress={item.onPress} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // #64 B2: the jump row's own chip/pill look — the catalog's existing chip/pill visual
  // (`CATALOG_COLOR.chip`, the same muted rounded pill `UpdatePanel.tsx`'s own status pills use),
  // never a new visual.
  jumpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.sm, marginBottom: CATALOG_LAYOUT.blockLabelGap },
  jumpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATALOG_SPACE.xs,
    paddingHorizontal: CATALOG_SPACE.sm,
    paddingVertical: 4,
    borderRadius: CATALOG_RADIUS.control,
    backgroundColor: CATALOG_COLOR.chip,
  },
  jumpChipHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  jumpChipSelected: { backgroundColor: CATALOG_COLOR.accentSubtle },
  jumpChipTitle: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  jumpChipTitleSelected: { color: CATALOG_COLOR.accent },
  jumpChipCount: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
});
