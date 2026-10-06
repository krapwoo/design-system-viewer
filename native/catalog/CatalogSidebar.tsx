import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS } from './tokens';
import { sortIds, type NavGroup } from './types';
import { CatalogSearchInput } from './CatalogSearchInput';

/**
 * One nav link. Tracks its own hover state via `onHoverIn`/`onHoverOut` (real events on web,
 * simply never fired on native touch devices, so hover styling only ever shows up where it makes
 * sense) rather than reading `hovered` off Pressable's style-callback — this project's Pressable
 * types (targeting native) don't expose that field, even though react-native-web's runtime does.
 */
function NavItem<TId extends string>({ id, active, onPress }: { id: TId; active: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  // Keyboard focus shows the same highlight as hover/press — react-native-web suppresses the
  // browser's default outline on Pressable, so without this a keyboard user tabbing the sidebar
  // gets no visible focus position at all.
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.item, (pressed || hovered || focused) && styles.itemPressed]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{id}</Text>
    </Pressable>
  );
}

/**
 * Sticky sidebar: app name/subtitle, a filter box, and one Pressable nav link per section id,
 * grouped under labeled headings (e.g. "Components" / "Tokens"). Generic over `TId` — the host
 * app supplies its own section-id union and groups; this component never needs to know what a
 * "Button" or a "Colors" page actually is.
 */
export function CatalogSidebar<TId extends string>({
  logo,
  caption,
  groups,
  active,
  onPress,
}: {
  logo: string;
  caption: string;
  groups: NavGroup<TId>[];
  active: TId;
  onPress: (id: TId) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  return (
    <View style={styles.sidebar}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>{logo}</Text>
        <Text style={styles.subtitle}>{caption}</Text>

        <CatalogSearchInput value={query} onChangeText={setQuery} placeholder="Filter components…" />

        {(() => {
          // Filter to the query, then order through the shared `sortIds` — the same helper
          // CatalogShell uses for the main column's render order and scroll-spy, so this list's
          // visual order can never drift from where a click actually scrolls to.
          const filtered = groups.map(g => ({
            ...g,
            ids: sortIds(q ? g.ids.filter(id => id.toLowerCase().includes(q)) : g.ids),
          }));
          const hasMatches = filtered.some(g => g.ids.length > 0);
          return (
            <>
              {!hasMatches && <Text style={styles.empty}>No matches</Text>}
              {filtered.map(g => g.ids.length > 0 && (
                <View key={g.label}>
                  <View style={styles.groupLabelRow}>
                    <Text style={styles.groupLabel}>{g.label}</Text>
                  </View>
                  {g.ids.map(id => (
                    <NavItem key={id} id={id} active={active === id} onPress={() => onPress(id)} />
                  ))}
                </View>
              ))}
            </>
          );
        })()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: CATALOG_COLOR.surface,
    borderRightWidth: 1,
    borderRightColor: CATALOG_COLOR.borderHairline,
    // Sticky on web so the sidebar stays put while the main column scrolls. RN's ViewStyle type has
    // no equivalent for these two (there's no native "sticky" or viewport-unit height), so they need
    // an escape hatch — kept as narrow, explicitly-typed casts rather than `as any` on the property so
    // a typo here (e.g. "stickey") would still be caught, even though the final assignment can't be.
    position: 'sticky' as unknown as ViewStyle['position'],
    top: 0,
    height: '100vh' as unknown as ViewStyle['height'],
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: CATALOG_SPACE.lg, paddingTop: 28, paddingBottom: CATALOG_SPACE['3xl'] },
  logo: { fontSize: CATALOG_TYPE.lg, fontWeight: '700', color: CATALOG_COLOR.text },
  subtitle: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, marginTop: 2, marginBottom: 20 },
  empty: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, paddingHorizontal: 10, paddingVertical: CATALOG_SPACE.sm },
  groupLabelRow: {
    marginTop: CATALOG_SPACE.lg, marginBottom: CATALOG_SPACE.xs,
    paddingHorizontal: 10,
  },
  groupLabel: {
    fontSize: CATALOG_TYPE.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7,
    color: CATALOG_COLOR.text,
  },
  item: { borderRadius: CATALOG_RADIUS.sm, marginBottom: 2 },
  itemPressed: { backgroundColor: CATALOG_COLOR.surfacePressed },
  label: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, paddingVertical: 6, paddingHorizontal: 10 },
  labelActive: { color: CATALOG_COLOR.accent },
});
