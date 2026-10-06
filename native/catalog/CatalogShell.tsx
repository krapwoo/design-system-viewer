import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE, CATALOG_MAX_CONTENT_WIDTH } from './tokens';
import { CatalogSidebar } from './CatalogSidebar';
import { SectionBlock } from './SectionBlock';
import { sortIds, type NavGroup, type SectionDef } from './types';

/**
 * The whole catalog page: sticky sidebar + scrollable main column, with scroll-spy (the sidebar
 * highlights whichever section is currently in view, and clicking a link scrolls to it). This is
 * the single top-level export most apps need — hand it your own `sections` (built from your own
 * components, using `SectionDef`) and `groups` (how to bucket them in the sidebar), and it owns
 * everything else: layout, scrolling, filtering, and each section's own Variants/States/
 * Props+Accessibility columns (or a single Tokens column for a `tokenGallery` section).
 */
export function CatalogShell<TId extends string>({
  appName,
  title,
  groups,
  sections,
}: {
  /** Short product/app name — shown as the sidebar's own logo (e.g. "Metro NYC"). */
  appName: string;
  /** What this catalog is (e.g. "Design System") — shown as the sidebar subtitle and as the
   *  large page heading in the main column. */
  title: string;
  groups: NavGroup<TId>[];
  sections: SectionDef<TId>[];
}) {
  const subtitle = `${appName} · ${sections.length} components & tokens`;
  const scrollRef = useRef<ScrollView>(null);
  // Ordered via the shared `sortIds` (the same helper the sidebar and `orderedGroups` below use) —
  // so `handleScroll`'s "last id whose recorded offset is above the scroll position" scan walks ids
  // in their true top-to-bottom page order. Left as `groups`' own raw (often non-alphabetical)
  // declaration order, it can pick the wrong "current" section: scrolling to a section near the end
  // of its group's declared-but-unsorted array can highlight an earlier-declared sibling instead.
  const allIds = groups.flatMap(g => sortIds(g.ids));
  // The sidebar groups + alphabetizes ids within each group (see CatalogSidebar) — the main column
  // mirrors that exact order here via the same shared `sortIds`, rather than trusting `sections`'
  // own flat declaration order, so the two can never drift apart again. A section left out of every
  // group's `ids` now disappears from the main column too (not just the sidebar), which makes that
  // mistake immediately visible.
  const sectionsById = new Map(sections.map(def => [def.id, def]));
  const orderedGroups = groups.map(g => ({
    label: g.label,
    defs: sortIds(g.ids)
      .map(id => sectionsById.get(id))
      .filter((def): def is SectionDef<TId> => def != null),
  }));
  const [active, setActive] = useState<TId>(sections[0]?.id);
  const offsets = useRef<Partial<Record<TId, number>>>({});
  // Scroll-spy should sit out a nav-click's own animated scroll — that animation fires the same
  // onScroll event dozens of times on its way to the target, and without this guard the sidebar
  // highlight races through every section it passes before landing on the clicked one. `onPress`
  // sets `active` directly and flips this flag on; `handleScroll` then ignores events (just
  // re-arming a short "settle" timer) until they stop arriving — which is when the animation has
  // actually finished, however long it took. (Native's `onScrollBeginDrag` would be a more precise
  // signal for *starting* to ignore, but react-native-web never fires it, so this timer-based
  // approach is what actually works on both platforms.)
  const isProgrammaticScroll = useRef(false);
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayout = useCallback((id: TId, y: number) => {
    offsets.current[id] = y;
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScroll.current) {
        if (settleTimeout.current != null) clearTimeout(settleTimeout.current);
        settleTimeout.current = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 120);
        return;
      }
      const y = e.nativeEvent.contentOffset.y + 80;
      let current: TId = allIds[0];
      for (const id of allIds) {
        const offset = offsets.current[id] ?? 0;
        if (offset <= y) current = id;
      }
      setActive(current);
    },
    // allIds is derived fresh from `groups` every render, but its contents are stable for the
    // lifetime of a given catalog — recreating this callback per render would just re-bind the
    // same ScrollView listener for no behavioral change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const scrollTo = useCallback((id: TId) => {
    isProgrammaticScroll.current = true;
    if (settleTimeout.current != null) clearTimeout(settleTimeout.current);
    settleTimeout.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 120);
    const y = Math.max(0, (offsets.current[id] ?? 0) - 32);
    // Web-only: ScrollView's own `scrollTo({ animated: true })` calls the underlying DOM node's
    // native `Element.scrollTo()` — which, for a nested `overflow: auto` container like this one,
    // doesn't reliably move the scroll position in this preview (confirmed: it silently no-ops
    // even with `behavior: 'auto'`, while assigning `.scrollTop` directly always works). Reach past
    // ScrollView's own imperative API to the real scrollable DOM node (react-native-web's
    // `getScrollableNode()` escape hatch, which returns an actual DOM element on web) and set
    // `scrollTop` directly instead. Gated on `Platform.OS === 'web'` because on real iOS/Android,
    // `getScrollableNode()` returns a plain native node handle (a number), not a DOM node — setting
    // `.scrollTop` on that would silently no-op at best or throw at worst, and native's own
    // `scrollTo` (the `else` branch) already works correctly there.
    if (Platform.OS === 'web') {
      const node = (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
      if (node) {
        node.scrollTop = y;
        setActive(id);
        return;
      }
    }
    scrollRef.current?.scrollTo({ y, animated: true });
    setActive(id);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <CatalogSidebar logo={appName} caption={title} groups={groups} active={active} onPress={scrollTo} />

        <ScrollView
          ref={scrollRef}
          style={styles.main}
          contentContainerStyle={styles.mainContent}
          onScroll={handleScroll}
          scrollEventThrottle={50}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.pageSubtitle}>{subtitle}</Text>

          <View style={styles.dividerLine} />

          {orderedGroups.map((group, gi) => group.defs.length > 0 && (
            // A React.Fragment (not a View) — every section's own View must stay a direct child of
            // the ScrollView's content so its onLayout `y` (relative to its *immediate* parent) is
            // still the section's true absolute scroll offset, not just its offset within a nested
            // per-group wrapper.
            <React.Fragment key={group.label}>
              {group.defs.map((def, i) => (
                <View key={def.id} onLayout={e => handleLayout(def.id, e.nativeEvent.layout.y)}>
                  <SectionBlock def={def} groupLabel={group.label} />
                  {i < group.defs.length - 1 && <View style={styles.sectionDivider} />}
                </View>
              ))}
              {gi < orderedGroups.length - 1 && <View style={styles.sectionDivider} />}
            </React.Fragment>
          ))}

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: CATALOG_COLOR.pageBackground,
    minHeight: '100%',
  },
  main: { flex: 1 },
  mainContent: {
    paddingHorizontal: 48,
    paddingTop: 48,
    paddingBottom: 80,
    // Wide enough for SectionBlock's own multi-column rows (up to 3: Variants, States,
    // Props+Accessibility) to actually reach their own CATALOG_MAX_CONTENT_WIDTH cap — a narrower
    // container here would just clip them regardless of what SectionBlock itself allows.
    maxWidth: CATALOG_MAX_CONTENT_WIDTH,
    width: '100%',
  },
  pageTitle: { fontSize: CATALOG_TYPE['3xl'], fontWeight: '800', color: CATALOG_COLOR.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted, marginTop: 6, marginBottom: CATALOG_SPACE.xl },
  dividerLine: { height: 1, backgroundColor: CATALOG_COLOR.borderHairline, marginBottom: 48 },
  sectionDivider: { height: 1, backgroundColor: CATALOG_COLOR.border, marginVertical: 48 },
});
