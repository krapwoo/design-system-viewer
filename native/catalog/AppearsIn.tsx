import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { USAGE_FILES_COLLAPSED, formatUseLocation, usageByArea, usageRowLabel, type UsageData, type UsageEntry } from './usage';

/** The widest an "Appears in" bar track gets; the label and count columns keep their own size. */
const BAR_TRACK_MAX_WIDTH = 240;
const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;

/** The "Appears in" block: how many times the component is used per product area (a decorative
 *  proportional bar and a count, most-used first), then the files that use it as `file:line`,
 *  collapsed to the first few with a "Show all N" control. Renders nothing for an entry with no
 *  uses, so a page without usage looks exactly as it did before. */
export function AppearsIn({ entry }: { entry: UsageEntry | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const rows = useMemo(() => (entry ? usageByArea(entry) : []), [entry]);
  if (!entry || entry.uses.length === 0) return null;

  const max = rows[0].count;
  const total = entry.uses.length;
  const collapsible = total > USAGE_FILES_COLLAPSED;
  const shown = collapsible && !expanded ? entry.uses.slice(0, USAGE_FILES_COLLAPSED) : entry.uses;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Appears in</Text>
      <View role="list" style={styles.rows}>
        {rows.map(({ area, count }) => (
          // The visible columns are hidden from assistive technology and replaced by one hidden text,
          // because screen readers in browse mode ignore an `aria-label` on a list item and read its
          // children instead.
          <View key={area} role="listitem" style={styles.row}>
            <Text {...ARIA_HIDDEN} style={styles.area} numberOfLines={1}>{area}</Text>
            <View {...ARIA_HIDDEN} style={styles.track}>
              <View style={[styles.bar, { width: `${Math.max(4, Math.round((100 * count) / max))}%` }]} />
            </View>
            <Text {...ARIA_HIDDEN} style={styles.count}>{count}</Text>
            <Text style={styles.srOnly}>{usageRowLabel(area, count)}</Text>
          </View>
        ))}
      </View>
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
  rows: { gap: CATALOG_SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.md },
  area: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.text, width: 120, flexShrink: 0 },
  // Capped so the bar doesn't stretch across a wide card; the count stays right after it.
  track: { flex: 1, minWidth: 0, maxWidth: BAR_TRACK_MAX_WIDTH, height: CATALOG_SPACE.sm, borderRadius: CATALOG_SPACE.xs, backgroundColor: CATALOG_COLOR.accentSubtle, overflow: 'hidden' },
  bar: { height: CATALOG_SPACE.sm, borderRadius: CATALOG_SPACE.xs, backgroundColor: CATALOG_COLOR.accent },
  // The usual visually-hidden text: still read by screen readers, takes no room.
  srOnly: { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', borderWidth: 0, whiteSpace: 'nowrap', clip: 'rect(0 0 0 0)' } as object,
  count: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text, minWidth: 32, textAlign: 'right' },
  subheading: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text, marginTop: CATALOG_SPACE.lg, marginBottom: CATALOG_SPACE.xs },
  files: { gap: CATALOG_SPACE.xs },
  file: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.textMuted },
  toggle: { alignSelf: 'flex-start', marginTop: CATALOG_SPACE.sm, paddingVertical: CATALOG_SPACE.xs, borderRadius: CATALOG_RADIUS.sm },
  toggleText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
});
