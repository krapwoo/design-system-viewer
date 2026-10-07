import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { filterGroups, hashForId } from './catalogNavigation';
import type { NavGroup } from './types';
import { CatalogSearchInput } from './CatalogSearchInput';

function webLinkProps(id: string, active: boolean) {
  return active ? { href: hashForId(id), 'aria-current': 'page' } : { href: hashForId(id) };
}

/** One nav link. Hover via onHoverIn/onHoverOut (react-native-web fires them; native never does);
 *  keyboard focus draws the catalog focus ring because react-native-web removes the browser's. */
function NavItem<TId extends string>({ id, active, onPress }: { id: TId; active: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
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
      // Web-only props React Native's types do not declare, passed through a cast:
      // • aria-current — react-native-web ignores `accessibilityState` (native-only), so the open
      //   page needs aria-current on web.
      // • href — renders a real <a href="#Id">. react-native-web leaves keyboard activation of
      //   role="link" to the browser, which only fires click on Enter for genuine anchors.
      {...(webLinkProps(id, active) as Record<string, unknown>)}
      style={({ pressed }) => [
        styles.item,
        (pressed || hovered) && styles.itemHover,
        active && styles.itemActive,
        focused && styles.focusRing,
      ]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{id}</Text>
    </Pressable>
  );
}

/**
 * Catalog navigation: app name, caption, a filter field, and one link per page under grouped
 * headings. Selecting a link opens that page (CatalogShell owns which page is shown). The filter
 * narrows this list only and never changes the open page.
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
  active: TId | undefined;
  onPress: (id: TId) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = filterGroups(groups, query);

  return (
    <View role="navigation" aria-label="Catalog pages" style={styles.sidebar}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>{logo}</Text>
        <Text style={styles.subtitle}>{caption}</Text>

        <CatalogSearchInput value={query} onChangeText={setQuery} placeholder="Filter components…" />

        {filtered.length === 0 && <Text style={styles.empty}>No matches</Text>}
        {filtered.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.ids.map((id) => (
              <NavItem key={id} id={id} active={active === id} onPress={() => onPress(id)} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: CATALOG_LAYOUT.sidebarWidth,
    backgroundColor: CATALOG_COLOR.surface,
    borderRightWidth: 1,
    borderRightColor: CATALOG_COLOR.borderHairline,
  },
  scroll: { flex: 1 },
  content: {
    paddingTop: CATALOG_LAYOUT.sidebarPaddingTop,
    paddingHorizontal: CATALOG_LAYOUT.sidebarPaddingX,
    paddingBottom: CATALOG_LAYOUT.sidebarPaddingTop,
  },
  logo: { fontSize: CATALOG_TYPE.brand, fontWeight: '800', color: CATALOG_COLOR.text },
  subtitle: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, marginTop: 2, marginBottom: 20 },
  empty: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, paddingHorizontal: CATALOG_LAYOUT.navItemPaddingX, paddingVertical: 8 },
  groupLabel: {
    fontSize: CATALOG_TYPE.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginTop: 22,
    marginBottom: 7,
    marginHorizontal: 8,
  },
  item: {
    minHeight: CATALOG_LAYOUT.controlSize,
    justifyContent: 'center',
    paddingVertical: CATALOG_LAYOUT.navItemPaddingY,
    paddingHorizontal: CATALOG_LAYOUT.navItemPaddingX,
    borderRadius: CATALOG_RADIUS.sm,
  },
  itemHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  itemActive: { backgroundColor: CATALOG_COLOR.accentSubtle },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  label: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
  labelActive: { color: CATALOG_COLOR.accent, fontWeight: '700' },
});
