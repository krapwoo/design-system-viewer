import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { USAGE_FILES_COLLAPSED, formatUseLocation, type UsageEntry } from './usage';

/** The "Appears in" block: the files that use the component as `file:line`, collapsed to the first
 *  few with a "Show all N" control. Renders nothing for an entry with no uses, so a page without
 *  usage looks exactly as it did before. */
export function AppearsIn({ entry }: { entry: UsageEntry | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  if (!entry || entry.uses.length === 0) return null;

  const total = entry.uses.length;
  const collapsible = total > USAGE_FILES_COLLAPSED;
  const shown = collapsible && !expanded ? entry.uses.slice(0, USAGE_FILES_COLLAPSED) : entry.uses;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Appears in</Text>
      <Text style={styles.subheading}>{`Files that use it · ${total}`}</Text>
      <View role="list" style={styles.files}>
        {shown.map((use, index) => (
          <Text key={`${index}:${formatUseLocation(use)}`} role="listitem" style={styles.file}>{formatUseLocation(use)}</Text>
        ))}
      </View>
      {collapsible && (
        <Pressable
          onPress={() => setExpanded((open) => !open)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          {...({ 'aria-expanded': expanded } as Record<string, unknown>)}
          style={[styles.toggle, focused && styles.focusRing]}
        >
          <Text style={styles.toggleText}>{expanded ? 'Show fewer' : `Show all ${total}`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_LAYOUT.panelPadding,
    marginBottom: CATALOG_LAYOUT.blockGap,
  },
  heading: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text, marginBottom: CATALOG_SPACE.md },
  subheading: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text, marginBottom: CATALOG_SPACE.xs },
  files: { gap: CATALOG_SPACE.xs },
  file: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.textMuted },
  toggle: { alignSelf: 'flex-start', marginTop: CATALOG_SPACE.sm, paddingVertical: CATALOG_SPACE.xs, borderRadius: CATALOG_RADIUS.sm },
  toggleText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
});
