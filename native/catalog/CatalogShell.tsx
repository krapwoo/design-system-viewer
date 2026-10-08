import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_MAX_CONTENT_WIDTH, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { CatalogSidebar } from './CatalogSidebar';
import { SectionBlock } from './SectionBlock';
import { groupLabelFor, hashForId, idFromHash, neighbors, orderedIds } from './catalogNavigation';
import type { NavGroup, PreviewWidths, SectionDef } from './types';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** Move focus to a page title after navigation without scrolling the page on web. */
function focusElement(node: View | null): void {
  if (!node) return;
  if (Platform.OS === 'web') {
    (node as unknown as { focus?: (options?: { preventScroll?: boolean }) => void }).focus?.({ preventScroll: true });
    return;
  }
  const handle = findNodeHandle(node);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}

/** Return the main column to the top. On web, react-native-web's ScrollView.scrollTo does not
 *  reliably move a nested overflow container, so set scrollTop on the real DOM node. */
function resetMainScroll(scrollView: ScrollView | null): void {
  if (!scrollView) return;
  if (Platform.OS === 'web') {
    const node = (scrollView as unknown as { getScrollableNode?: () => HTMLElement | null }).getScrollableNode?.();
    if (node) {
      node.scrollTop = 0;
      return;
    }
  }
  scrollView.scrollTo({ y: 0, animated: false });
}

/**
 * The whole catalog: a persistent, searchable sidebar plus ONE selected page. Selecting a page
 * replaces the main content (no long scrolling document, no scroll-spy). On web the page lives in
 * the URL fragment (`#Button`), so refresh, deep links, and back/forward work; unknown fragments
 * open the first page. Desktop and laptop screens only.
 */
export function CatalogShell<TId extends string>({
  appName,
  title,
  groups,
  sections,
  defaultPreviewWidths,
}: {
  /** Short product/app name — the sidebar logo and the breadcrumb root. */
  appName: string;
  /** What this catalog is (e.g. "Component Catalog") — the sidebar caption. */
  title: string;
  groups: NavGroup<TId>[];
  sections: SectionDef<TId>[];
  /** Preview widths for component pages without their own `previewWidths`. Default: `[402]`
   *  (phone width). Pass 'full' for a catalog whose previews are not phone components. */
  defaultPreviewWidths?: PreviewWidths;
}) {
  const sectionsById = useMemo(() => new Map(sections.map((def) => [def.id, def])), [sections]);
  const order = useMemo(() => orderedIds(groups, new Set(sectionsById.keys())), [groups, sectionsById]);
  const [active, setActive] = useState<TId | undefined>(() =>
    isWeb() ? idFromHash(window.location.hash, order) : order[0],
  );

  const scrollRef = useRef<ScrollView>(null);
  const headingRef = useRef<View>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const pushHistoryNext = useRef(false);
  const focusHeadingNext = useRef(false);

  const select = useCallback((id: TId) => {
    if (id === activeRef.current) {
      focusElement(headingRef.current);
      return;
    }
    pushHistoryNext.current = true;
    focusHeadingNext.current = true;
    setActive(id);
  }, []);

  // Back/forward and manual fragment edits.
  useEffect(() => {
    if (!isWeb()) return;
    const onHashChange = () => {
      const id = idFromHash(window.location.hash, order);
      if (id === undefined) return;
      if (id !== activeRef.current) {
        focusHeadingNext.current = true;
        setActive(id);
      } else if (window.location.hash !== hashForId(id)) {
        // An unknown fragment that falls back to the page already open: just correct the URL.
        window.history.replaceState(null, '', hashForId(id));
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [order]);

  // After every page change: sync the fragment, return to the top, and move focus when the user
  // navigated (never on first load).
  useEffect(() => {
    if (active === undefined) return;
    const push = pushHistoryNext.current;
    const focus = focusHeadingNext.current;
    pushHistoryNext.current = false;
    focusHeadingNext.current = false;
    if (isWeb()) {
      const expected = hashForId(active);
      if (window.location.hash !== expected) {
        if (push) window.location.hash = expected;
        else window.history.replaceState(null, '', expected);
      }
    }
    resetMainScroll(scrollRef.current);
    if (focus) focusElement(headingRef.current);
  }, [active]);

  const activeDef = active !== undefined ? sectionsById.get(active) : undefined;

  return (
    <View style={styles.root}>
      <CatalogSidebar logo={appName} caption={title} groups={groups} active={active} onPress={select} />
      <ScrollView ref={scrollRef} style={styles.main} contentContainerStyle={styles.mainContent}>
        {activeDef ? (
          <SectionBlock
            key={activeDef.id}
            def={activeDef}
            groupLabel={groupLabelFor(groups, activeDef.id)}
            breadcrumbRoot={appName}
            pager={{
              previousId: neighbors(order, activeDef.id).previous,
              nextId: neighbors(order, activeDef.id).next,
              onNavigate: select,
            }}
            headingRef={headingRef}
            defaultPreviewWidths={defaultPreviewWidths}
          />
        ) : (
          <Text style={styles.empty}>No catalog pages are available.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: CATALOG_COLOR.pageBackground },
  main: { flex: 1 },
  mainContent: {
    width: '100%',
    maxWidth: CATALOG_MAX_CONTENT_WIDTH,
    paddingTop: CATALOG_LAYOUT.mainPaddingTop,
    paddingHorizontal: CATALOG_LAYOUT.mainPaddingX,
    paddingBottom: CATALOG_SPACE['3xl'],
  },
  empty: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
});
