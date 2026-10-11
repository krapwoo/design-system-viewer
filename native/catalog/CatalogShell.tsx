import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_MAX_CONTENT_WIDTH, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { CatalogSidebar } from './CatalogSidebar';
import { SectionBlock } from './SectionBlock';
import { UpdatePanel } from './UpdatePanel';
import { DS_VIEWER_SECRET_HEADER, footerLink, groupLabelFor, hashForId, neighbors, orderedIds, resolveActiveFromHash, shouldShowMajorBanner, UPDATE_PAGE_ID } from './catalogNavigation';
import { findOverlayNode, overlayAddressFromSearch } from './overlayViewport';
import type { NavGroup, PreviewWidths, SectionDef, UpdateNotice, VersionStatus } from './types';

/** `active` can be a real page id, or the reserved update-page id — never both a generic `TId`
 *  constraint and a hardcoded string literal type at once, which is why this is its own alias. */
type ShellPageId<TId extends string> = TId | typeof UPDATE_PAGE_ID;

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

/** The approved mockup's exact copy shape: `"⚠ DS Viewer <version> is available — includes
 *  breaking changes · Migration guide · Review update"`, dismissible with an `×` labeled "Dismiss
 *  for <version>". The release's own GitHub page stands in for a dedicated migration-guide URL,
 *  which this plan's design text does not otherwise name.
 *
 *  Important finding, Fable correction pass: both links now carry a real `href` — `role="link"`
 *  with only `onPress` (as `CatalogSidebar.tsx`'s own finding already documents) never activates on
 *  Enter under react-native-web unless the element is a genuine anchor. `role="status"` (not
 *  `"alert"`, the mockup's own choice) — a non-urgent notice should not interrupt assistive tech. */
function MajorBanner({ update, onReviewUpdate, onDismiss }: { update: UpdateNotice; onReviewUpdate: () => void; onDismiss: () => void }) {
  const releaseUrl = `https://github.com/krapwoo/design-system-viewer/releases/tag/v${update.latest}`;
  return (
    <View style={bannerStyles.banner} role="status">
      <Text style={bannerStyles.text}>
        {'⚠ '}
        <Text style={bannerStyles.bold}>{`DS Viewer ${update.latest} is available`}</Text>
        {' — includes breaking changes · '}
        <Text
          role="link"
          style={bannerStyles.link}
          {...({ href: releaseUrl, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } as Record<string, unknown>)}
        >
          Migration guide
        </Text>
        {' · '}
        <Text role="link" style={bannerStyles.link} onPress={onReviewUpdate} {...({ href: hashForId(UPDATE_PAGE_ID) } as Record<string, unknown>)}>
          Review update
        </Text>
      </Text>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={`Dismiss for ${update.latest}`} style={bannerStyles.close}>
        <Text style={bannerStyles.closeGlyph}>×</Text>
      </Pressable>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATALOG_SPACE.md,
    backgroundColor: CATALOG_COLOR.warningSubtle,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.warningBorder,
    borderRadius: CATALOG_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  text: { flex: 1, fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.warning },
  bold: { fontWeight: '700' },
  link: { color: CATALOG_COLOR.warning, fontWeight: '700', textDecorationLine: 'underline' },
  close: { width: 32, height: 32, borderRadius: CATALOG_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 18, color: CATALOG_COLOR.warning },
});

/**
 * The whole catalog: a persistent, searchable sidebar plus ONE selected page. Selecting a page
 * replaces the main content (no long scrolling document, no scroll-spy). On web the page lives in
 * the URL fragment (`#Button`), so refresh, deep links, and back/forward work; unknown fragments
 * open the first page. Desktop and laptop screens only.
 */
export function CatalogShell<TId extends string>({
  appName,
  logoImageSource,
  title,
  groups,
  sections,
  defaultPreviewWidths,
  update,
  versionStatus,
  updateEndpoint,
}: {
  /** Short product/app name — the sidebar logo and the breadcrumb root. */
  appName: string;
  /** Optional logo image, validated and bundled by `cli/workspace.ts` from the project's `logo`
   *  config field. See `CatalogSidebar`'s own doc comment for the approved layout rule. */
  logoImageSource?: ImageSourcePropType;
  /** What this catalog is (e.g. "Component Catalog") — the sidebar caption. */
  title: string;
  groups: NavGroup<TId>[];
  sections: SectionDef<TId>[];
  /** Preview widths for component pages without their own `previewWidths`. Default: `[402]`
   *  (phone width). Pass 'full' for a catalog whose previews are not phone components. */
  defaultPreviewWidths?: PreviewWidths;
  /** Design §5's update notice — `null`/`undefined` when no update is known (disabled, offline,
   *  or already up to date; the viewer treats all three identically: no footer, no banner, no
   *  update page content). */
  update?: UpdateNotice | null;
  /** The installed version, whether automatic checks are on (and why), and the last check —
   *  `dev` writes it at startup (`.ds-viewer/version.json`), and the shell refreshes it from the
   *  local endpoint. With it, the sidebar always shows a version line and the update page offers
   *  **Check now** and the automatic-check switch. Without it (an older generated workspace), the
   *  footer appears only when an update is known, as before. */
  versionStatus?: VersionStatus | null;
  /** The local endpoint's base URL and per-run secret — `dev` generates both (Task 18) and
   *  `writeWorkspace`'s generated entry file bakes them in (Task 17). Absent in a build that
   *  disables the endpoint entirely — `UpdatePanel` degrades to showing the plan/notice with no
   *  **Update now** button when this is missing. */
  updateEndpoint?: { baseUrl: string; secret: string };
}) {
  // A `BoundedOverlayViewport`'s own child document (design §5): render ONLY the one authored
  // node this document's URL addresses, with no sidebar/breadcrumb/title/pager — never the whole
  // page, since that page's other examples (and this same example's own viewport wrapper, now
  // recognizing itself as the selected address) would otherwise render alongside it for nothing.
  // Read once per mount, like `active`'s own initial read below: this mode is only ever entered by
  // a fresh document load, never a same-document transition.
  const overlayAddress = useMemo(() => (isWeb() ? overlayAddressFromSearch(window.location.search) : undefined), []);
  const overlayNode = useMemo(() => (overlayAddress ? findOverlayNode(sections, overlayAddress) : undefined), [overlayAddress, sections]);

  const sectionsById = useMemo(() => new Map(sections.map((def) => [def.id, def])), [sections]);
  const labels = useMemo(() => new Map(sections.filter((def) => def.title).map((def) => [def.id as string, def.title as string])), [sections]);
  const order = useMemo(() => orderedIds(groups, new Set(sectionsById.keys())), [groups, sectionsById]);
  const [active, setActive] = useState<ShellPageId<TId> | undefined>(() =>
    isWeb() ? resolveActiveFromHash(window.location.hash, order) : order[0],
  );

  const scrollRef = useRef<ScrollView>(null);
  const headingRef = useRef<View>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const pushHistoryNext = useRef(false);
  const focusHeadingNext = useRef(false);

  const select = useCallback((id: ShellPageId<TId>) => {
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
      const id = resolveActiveFromHash(window.location.hash, order);
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

  const activeDef = active !== undefined && active !== UPDATE_PAGE_ID ? sectionsById.get(active) : undefined;

  // The live version status: starts from what `dev` wrote at startup, then follows the local
  // endpoint (a reload after **Check now** must not fall back to the startup snapshot).
  const [liveStatus, setLiveStatus] = useState<VersionStatus | null>(versionStatus ?? null);
  useEffect(() => {
    if (!updateEndpoint || !isWeb()) return;
    let cancelled = false;
    fetch(`${updateEndpoint.baseUrl}/version`, { headers: { [DS_VIEWER_SECRET_HEADER]: updateEndpoint.secret } })
      .then((res) => (res.ok ? (res.json() as Promise<VersionStatus>) : undefined))
      .then((next) => {
        if (next && !cancelled) setLiveStatus(next);
      })
      .catch(() => {
        // The startup snapshot stays; the endpoint may be restarting.
      });
    return () => {
      cancelled = true;
    };
  }, [updateEndpoint]);
  // With a live status, it is the truth (it includes a **Check now** result); otherwise the
  // startup notice, as before.
  const effectiveUpdate: UpdateNotice | null = liveStatus ? liveStatus.update : update ?? null;

  const [dismissedMajor, setDismissedMajor] = useState<string | null>(() =>
    isWeb() ? window.localStorage.getItem('ds-viewer-dismissed-major') : null,
  );
  const dismissMajorBanner = useCallback(() => {
    if (!effectiveUpdate) return;
    if (isWeb()) window.localStorage.setItem('ds-viewer-dismissed-major', effectiveUpdate.latest);
    setDismissedMajor(effectiveUpdate.latest);
  }, [effectiveUpdate]);
  const link = footerLink(effectiveUpdate, liveStatus);
  const footer = link ? { ...link, active: active === UPDATE_PAGE_ID, onPress: () => select(UPDATE_PAGE_ID) } : undefined;
  // Design: the banner shows on every *normal* page; once you're already looking at the update
  // page there is nothing left for "Review update" to do, so it's hidden there (confirmed against
  // the approved mockup's own `frame()`: the banner only ever renders when `!isPanel`).
  const showBanner = active !== UPDATE_PAGE_ID && shouldShowMajorBanner(effectiveUpdate, dismissedMajor);

  if (overlayAddress) {
    return (
      <View style={styles.overlayDocumentRoot}>
        {overlayNode ?? <Text style={styles.overlayUnavailable}>This example is no longer available.</Text>}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CatalogSidebar logo={appName} logoImageSource={logoImageSource} caption={title} groups={groups} labels={labels} active={active} onPress={select} footer={footer} />
      <ScrollView ref={scrollRef} style={styles.main} contentContainerStyle={styles.mainContent}>
        {active === UPDATE_PAGE_ID ? (
          <UpdatePanel
            update={effectiveUpdate}
            versionStatus={liveStatus}
            onVersionStatus={setLiveStatus}
            endpoint={updateEndpoint}
            appName={appName}
            headingRef={headingRef}
          />
        ) : activeDef ? (
          <SectionBlock
            key={activeDef.id}
            def={activeDef}
            groupLabel={groupLabelFor(groups, activeDef.id)}
            breadcrumbRoot={appName}
            // The approved mockup's own `PAGE_BG` order: crumb, then banner, then title — the
            // banner used to render above the breadcrumb instead (Important finding, Fable
            // correction pass).
            banner={showBanner && effectiveUpdate ? <MajorBanner update={effectiveUpdate} onReviewUpdate={() => select(UPDATE_PAGE_ID)} onDismiss={dismissMajorBanner} /> : undefined}
            pager={{
              previousId: neighbors(order, activeDef.id).previous,
              nextId: neighbors(order, activeDef.id).next,
              onNavigate: select,
              labelOf: (id) => labels.get(id) ?? id,
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
  // A `BoundedOverlayViewport` child document's own root: no sidebar/chrome, just the one
  // addressed node — sized by whatever that node itself renders, not the catalog's own layout.
  overlayDocumentRoot: { flex: 1 },
  overlayUnavailable: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted, padding: CATALOG_SPACE.lg },
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
