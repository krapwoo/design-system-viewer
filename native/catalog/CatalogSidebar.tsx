import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent, NativeSyntheticEvent, ImageLoadEventData } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { logoLayout } from './logoLayout';
import { hashForId, nestGroups, OVERVIEW_PAGE_ID, searchResults, UPDATE_PAGE_ID, type MemberSearchEntry } from './catalogNavigation';
import type { NavGroup } from './types';
import { CatalogSearchInput } from './CatalogSearchInput';

const NO_PARENTS: ReadonlyMap<string, string> = new Map();

function webLinkProps(id: string, active: boolean) {
  return active ? { href: hashForId(id), 'aria-current': 'page' } : { href: hashForId(id) };
}

/** One nav link. Hover via onHoverIn/onHoverOut (react-native-web fires them; native never does);
 *  keyboard focus draws the catalog focus ring because react-native-web removes the browser's. */
/** In an embedded shell, a link's own navigation would change the host page's address; the shell
 *  handles the press itself, so the browser's default is cancelled. */
function pressHandler(onPress: () => void, keepDocumentUrl: boolean) {
  return (event?: { preventDefault?: () => void }) => {
    if (keepDocumentUrl) event?.preventDefault?.();
    onPress();
  };
}

/** The sidebar's own scroll view, so a row can find the list it sits in, and the id of the page whose
 *  row was last brought into view, so a row that re-mounts for the page already shown (clearing the
 *  filter) does not scroll again. Both are owned by `CatalogSidebar`. */
const SidebarScrollContext = createContext<{ scrollView: RefObject<ScrollView | null>; revealed: { current: string | undefined } } | null>(null);

/** Scrolls `scrollView`'s own scrollable node, and nothing above it, just far enough to show `row`.
 *  A row already inside the visible area moves nothing. Web only: native has no DOM rects. */
function revealInScroll(scrollView: ScrollView | null, row: HTMLElement | null): void {
  if (!scrollView || !row?.getBoundingClientRect) return;
  const node = (scrollView as unknown as { getScrollableNode?: () => HTMLElement | null }).getScrollableNode?.();
  if (!node?.getBoundingClientRect) return;
  const view = node.getBoundingClientRect();
  const box = row.getBoundingClientRect();
  if (box.top < view.top) node.scrollTop -= view.top - box.top;
  else if (box.bottom > view.bottom) node.scrollTop += box.bottom - view.bottom;
}

function NavItem<TId extends string>({ id, label, active, onPress, keepDocumentUrl = false }: { id: TId; label: string; active: boolean; onPress: () => void; keepDocumentUrl?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<unknown>(null);
  const sidebarScroll = useContext(SidebarScrollContext);
  // The open page's row, nested or not, is brought into view when it becomes the open page, not when
  // its row merely re-mounts (clearing a filter does): a long sidebar otherwise leaves it below the
  // fold. Only the sidebar's own list is moved, and only as far as needed: `scrollIntoView` would
  // also scroll every scrollable ancestor, so a sidebar drawn inside a page (an embedded shell, an
  // Overview thumbnail) would drag that page's column along with it.
  useEffect(() => {
    if (!sidebarScroll || !active) return;
    if (sidebarScroll.revealed.current === id) return;
    sidebarScroll.revealed.current = id;
    revealInScroll(sidebarScroll.scrollView.current, ref.current as HTMLElement | null);
  }, [active]);
  return (
    <Pressable
      ref={ref as never}
      onPress={pressHandler(onPress, keepDocumentUrl)}
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
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

/** One member search hit (spec §5.3 "Search"): `<memberId> — in <familyTitle>`, opening that
 *  member's address. Shares the plain nav-row visual `NavItem` uses ("Use the existing row
 *  styles"); `href` is the member's own address so Enter activates it the same way every other
 *  link in the sidebar does. */
function MemberResultItem({ label, familyTitle, href, onPress, keepDocumentUrl = false }: { label: string; familyTitle: string; href: string; onPress: () => void; keepDocumentUrl?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={pressHandler(onPress, keepDocumentUrl)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      {...({ href } as Record<string, unknown>)}
      style={({ pressed }) => [styles.item, (pressed || hovered) && styles.itemHover, focused && styles.focusRing]}
    >
      <Text style={styles.label}>{`${label} — in ${familyTitle}`}</Text>
    </Pressable>
  );
}

/** #60's quiet Source reference entry (plan Task 2B, "the accepted A access model"): opens the
 *  catalog-wide picker modal, so — unlike every other row here — it is a real button, not a link
 *  (no `href`, no navigation of its own). Rendered outside `filtered`/`memberHits` so a filter that
 *  matches no page never hides it (`CatalogShell` only passes `sourceReference` at all once
 *  `hasReferenceNavigation` says the catalog has one). Reuses the plain nav-row visual `NavItem`
 *  already uses. */
function SourceReferenceEntry({ onPress }: { onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel="Open source reference"
      style={({ pressed }) => [styles.item, styles.sourceReferenceItem, (pressed || hovered) && styles.itemHover, focused && styles.focusRing]}
    >
      <Text style={styles.label}>Source reference</Text>
    </Pressable>
  );
}

function FooterLink({ label, kind, active, onPress, keepDocumentUrl = false }: { label: string; kind: 'update' | 'version'; active: boolean; onPress: () => void; keepDocumentUrl?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={pressHandler(onPress, keepDocumentUrl)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      {...({ href: hashForId(UPDATE_PAGE_ID), ...(active ? { 'aria-current': 'page' } : null) } as Record<string, unknown>)}
      style={({ pressed }) => [
        styles.footerLink,
        (pressed || hovered) && styles.footerLinkHover,
        active && styles.footerLinkActive,
        focused && styles.focusRing,
      ]}
    >
      {/* The dot marks an available update; the everyday version line is quiet. */}
      {kind === 'update' && <View style={styles.footerDot} />}
      <Text style={[styles.footerLabel, active && styles.footerLabelActive]}>{label}</Text>
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
  logoImageSource,
  caption,
  groups,
  parents,
  labels,
  memberIndex,
  memberSearchEntries,
  active,
  onPress,
  onSelectMember,
  footer,
  sourceReference,
  overview,
  keepDocumentUrl = false,
}: {
  logo: string;
  /** For a shell embedded in another page: links never change the document's address. */
  keepDocumentUrl?: boolean;
  /** Optional logo image, validated and bundled by `cli/workspace.ts` from the project's `logo`
   *  config field. Visual spec: docs/design/2026-10-08-ds-viewer-sidebar-logo-approved.html
   *  ("C · Adaptive", approved 2026-10-08) — a mark (aspect ratio ≤ 2) sits beside the name; a
   *  wordmark (> 2) replaces the name text, carrying it as its own accessible label instead. */
  logoImageSource?: ImageSourcePropType;
  caption: string;
  groups: NavGroup<TId>[];
  /** Pages listed under another page (child id → parent id, from `sidebarParents`): each sits
   *  indented under its parent, joined by connector lines. Omitted: a flat list. */
  parents?: ReadonlyMap<string, string>;
  /** Display titles by page id (`SectionDef.title`); pages without one show their id. */
  labels?: ReadonlyMap<string, string>;
  /** Every family page's own member ids/aliases, by page id (spec §5.3 "Search") — a page also
   *  matches the filter on any of these, not just its own id/title. */
  memberIndex?: ReadonlyMap<string, readonly string[]>;
  /** Every family member search candidate across the catalog (spec §5.3 "Search") — shown as its
   *  own "Members" group of hits, below the filtered pages, while the query is non-empty. */
  memberSearchEntries?: readonly MemberSearchEntry<TId>[];
  active: string | undefined;
  onPress: (id: TId) => void;
  /** Opens a member hit's address: activates its family page, then scrolls/opens/focuses the
   *  member itself (`CatalogShell`). */
  onSelectMember?: (pageId: TId, memberId: string) => void;
  /** The link below the nav list that opens the update page: the installed version (`'version'`),
   *  or the update notice with a dot (`'update'`, design §5's footer line). `active` is true while
   *  the update page itself is open — it gets the same active styling a selected nav item would. */
  footer?: { label: string; kind?: 'update' | 'version'; active: boolean; onPress: () => void };
  /** #60's catalog-wide Source reference entry: present only once `CatalogShell` has decided (via
   *  `hasReferenceNavigation`) that the catalog has at least one `'reference'` page. Omitted keeps
   *  the legacy sidebar unchanged. */
  sourceReference?: { onPress: () => void };
  /** The Overview entry, first in the list and above every group: present only when the catalog has
   *  usage data. Like the Source reference entry it sits outside the filter, so a filter that
   *  matches no page never hides it. `active` is true while the Overview page is open. */
  overview?: { active: boolean; onPress: () => void };
}) {
  const [query, setQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const scrollContext = useRef({ scrollView: scrollRef, revealed: { current: undefined as string | undefined } }).current;
  // Leaving the remembered page (to another row, to a page with no row, or while a filter hides its
  // row) forgets it, so coming back reveals it again. This runs after the rows' own effects, so a row
  // that has just revealed the new open page is not forgotten.
  useEffect(() => {
    if (scrollContext.revealed.current !== active) scrollContext.revealed.current = undefined;
  }, [active]);
  // A bundled local image (the only kind `cli/workspace.ts` ever produces — see its doc comment
  // above) already carries its own `width`/`height` on the required module object, both on native
  // and on react-native-web (confirmed by reading `AssetRegistry`/Metro's asset plugin output) — no
  // need to wait for a load event for the common case. `onLoad` below is kept only as a fallback for
  // a source with no static dimensions (e.g. a bare `{ uri }`); the mock prober stops rendering as
  // soon as either resolves an aspect.
  const staticSource = typeof logoImageSource === 'object' && logoImageSource !== null && !Array.isArray(logoImageSource)
    ? (logoImageSource as { width?: number; height?: number })
    : undefined;
  const staticAspect = staticSource?.width && staticSource?.height ? staticSource.width / staticSource.height : undefined;
  const [loadedAspect, setLoadedAspect] = useState<number | undefined>(undefined);
  const [logoFailed, setLogoFailed] = useState(false);
  const [nameWrapped, setNameWrapped] = useState(false);
  const filtered = nestGroups(groups, query, parents ?? NO_PARENTS, labels, memberIndex);
  const memberHits = memberSearchEntries ? searchResults(memberSearchEntries, query) : [];

  const logoAspect = staticAspect ?? loadedAspect;
  const attemptingLogo = Boolean(logoImageSource) && !logoFailed;
  const header = attemptingLogo ? logoLayout(logoAspect) : 'text';

  // Fallback only (see the comment above `staticSource`) — and native-only in practice: on web,
  // `ImageLoader.load`'s `onLoad` fires after `HTMLImageElement.decode()` resolves, by which point
  // Chrome has already nulled the underlying DOM event's `target`, so `native.source` below reads
  // `undefined` on react-native-web (confirmed empirically — `event.target` reads non-null only
  // when read synchronously inside `onload`, before any `await`) and this handler never sets
  // `loadedAspect` there. Native's real `Image` reports `source.{width,height}` on its `onLoad`
  // nativeEvent instead, which this still reads correctly. Kept rather than removed (Minor finding,
  // Fable's implementation review) because a non-bundled source with no static dimensions (e.g. a
  // bare `{ uri }`) is still possible on native, even though `cli/workspace.ts` only ever generates
  // a bundled `require()` today.
  const onLogoLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const native = e.nativeEvent as unknown as { source?: { width: number; height: number } };
    const width = native.source?.width;
    const height = native.source?.height;
    if (width && height) setLoadedAspect(width / height);
  };
  const onLogoError = () => setLogoFailed(true);
  // Wrap detection for the "mark" row: the name Text's own measured height, not `onTextLayout`
  // (react-native-web's `Text` doesn't implement it) and not a character-count heuristic (wraps at
  // a different length per name). More than one line of `CATALOG_TEXT.heading2` means it wrapped.
  const NAME_LINE_HEIGHT = CATALOG_TEXT.heading2.lineHeight;
  const onNameLayout = (e: LayoutChangeEvent) => {
    setNameWrapped(e.nativeEvent.layout.height > NAME_LINE_HEIGHT * 1.5);
  };

  return (
    <View role="navigation" aria-label="Catalog pages" style={styles.sidebar}>
      <SidebarScrollContext.Provider value={scrollContext}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {/* Invisible — exists only so a configured logo's `onLoad`/`onError` can fire at all
              while `header` is still `'text'` (the aspect isn't known yet). Once `logoAspect`
              resolves (or the image fails), `header` switches and this prober stops rendering. */}
          {attemptingLogo && logoAspect === undefined && (
            <Image source={logoImageSource} style={styles.logoProbe} onLoad={onLogoLoad} onError={onLogoError} />
          )}
          {header === 'wordmark' && (
            <>
              <Image
                source={logoImageSource}
                accessibilityRole="image"
                accessibilityLabel={logo}
                resizeMode="contain"
                style={[styles.wordmark, { width: Math.min(CATALOG_LAYOUT.logoWordmarkHeight * (logoAspect ?? 0), 228) }]}
                onLoad={onLogoLoad}
                onError={onLogoError}
              />
              <Text style={[styles.subtitle, styles.subtitleAfterWordmark]}>{caption}</Text>
            </>
          )}
          {header === 'mark' && (
            <View style={[styles.inlineHeader, nameWrapped && styles.inlineHeaderTop]}>
              <Image source={logoImageSource} resizeMode="contain" style={styles.mark} onLoad={onLogoLoad} onError={onLogoError} />
              <View style={styles.inlineText}>
                <Text style={styles.logo} onLayout={onNameLayout}>{logo}</Text>
                <Text style={styles.subtitle}>{caption}</Text>
              </View>
            </View>
          )}
          {header === 'text' && (
            <>
              <Text style={styles.logo}>{logo}</Text>
              <Text style={styles.subtitle}>{caption}</Text>
            </>
          )}
        </View>

        <CatalogSearchInput value={query} onChangeText={setQuery} placeholder="Filter components…" />

        {overview && <NavItem id={OVERVIEW_PAGE_ID} label="Overview" active={overview.active} onPress={overview.onPress} keepDocumentUrl={keepDocumentUrl} />}

        {/* Outside `filtered`/`memberHits`: a filter that matches no page must not hide this. */}
        {sourceReference && <SourceReferenceEntry onPress={sourceReference.onPress} />}

        {/* Preserve omitted-metadata catalogs; only source-enabled empty lists suppress an
            unfiltered no-match message. A genuine filtered search still reports no matches. */}
        {(!sourceReference || query.trim() !== '') && filtered.length === 0 && memberHits.length === 0 && <Text style={styles.empty}>No matches</Text>}
        {/* V2c item 10: pages first, member hits below them — matching `memberSearchEntries`'s own
            doc comment ("below the filtered pages") and the spec's "the sidebar lists family pages
            only, never members" emphasis. */}
        {filtered.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.ids.map((id) => {
              const nested = group.children.get(id) ?? [];
              const label = labels?.get(id) ?? id;
              return (
                <View key={id}>
                  <NavItem id={id} label={label} active={active === id} onPress={() => onPress(id)} keepDocumentUrl={keepDocumentUrl} />
                  {nested.length > 0 && (
                    // The pages stay links in order; the list tells a screen reader they belong to
                    // the row above ("<parent> pages, list, 3 items").
                    <View role="list" aria-label={`${label} pages`} style={styles.children}>
                      {nested.map((childId, index) => (
                        <View key={childId} role="listitem" style={styles.childRow}>
                          <View style={styles.connectorColumn}>
                            {index === nested.length - 1 ? (
                              <View style={styles.connectorElbow} />
                            ) : (
                              <>
                                <View style={styles.connectorSpine} />
                                <View style={styles.connectorTick} />
                              </>
                            )}
                          </View>
                          <View style={styles.childItem}>
                            <NavItem id={childId} label={labels?.get(childId) ?? childId} active={active === childId} onPress={() => onPress(childId)} keepDocumentUrl={keepDocumentUrl} />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        {memberHits.length > 0 && (
          <View>
            <Text style={styles.groupLabel}>Members</Text>
            {memberHits.map((hit) => (
              <MemberResultItem
                key={`${hit.pageId}:${hit.memberId}`}
                label={hit.label}
                familyTitle={hit.familyTitle}
                href={hashForId(hit.memberId)}
                onPress={() => onSelectMember?.(hit.pageId, hit.memberId)}
                keepDocumentUrl={keepDocumentUrl}
              />
            ))}
          </View>
        )}
      </ScrollView>
      </SidebarScrollContext.Provider>
      {footer && (
        <View style={styles.footerContainer}>
          <FooterLink label={footer.label} kind={footer.kind ?? 'update'} active={footer.active} onPress={footer.onPress} keepDocumentUrl={keepDocumentUrl} />
        </View>
      )}
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
  header: { marginBottom: 20 },
  logo: { ...CATALOG_TEXT.heading2, color: CATALOG_COLOR.text },
  subtitle: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginTop: 2 },
  subtitleAfterWordmark: { marginTop: CATALOG_LAYOUT.logoCaptionGap },
  mark: { width: CATALOG_LAYOUT.logoMark, height: CATALOG_LAYOUT.logoMark },
  wordmark: { height: CATALOG_LAYOUT.logoWordmarkHeight, alignSelf: 'flex-start' },
  logoProbe: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  inlineHeader: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.md },
  inlineHeaderTop: { alignItems: 'flex-start' },
  inlineText: { flex: 1, minWidth: 0 },
  empty: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, paddingHorizontal: CATALOG_LAYOUT.navItemPaddingX, paddingVertical: 8 },
  sourceReferenceItem: { marginBottom: CATALOG_SPACE.sm },
  footerContainer: {
    borderTopWidth: 1,
    borderTopColor: CATALOG_COLOR.borderHairline,
    paddingHorizontal: CATALOG_LAYOUT.sidebarPaddingX,
    paddingVertical: CATALOG_SPACE.md,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATALOG_SPACE.sm,
    minHeight: CATALOG_LAYOUT.controlSize,
    paddingHorizontal: 10,
    borderRadius: CATALOG_RADIUS.sm,
  },
  footerLinkHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  footerLinkActive: { backgroundColor: CATALOG_COLOR.accentSubtle },
  footerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CATALOG_COLOR.accent, flexShrink: 0 },
  footerLabel: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  footerLabelActive: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
  groupLabel: {
    ...CATALOG_TEXT.microLabel,
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
  // Nested pages: the connector column draws, in the sidebar's divider colour, a spine down the
  // children with a tick into each, and an 8px rounded turn into the last one.
  children: { marginLeft: CATALOG_LAYOUT.navItemPaddingX + 2 },
  childRow: { flexDirection: 'row', alignItems: 'stretch' },
  connectorColumn: { width: 16, pointerEvents: 'none' },
  connectorSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, backgroundColor: CATALOG_COLOR.borderHairline },
  connectorTick: { position: 'absolute', left: 0, top: '50%', width: 12, height: 1, backgroundColor: CATALOG_COLOR.borderHairline },
  connectorElbow: { position: 'absolute', left: 0, top: 0, height: '50%', width: 12, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: CATALOG_COLOR.borderHairline, borderBottomLeftRadius: 8 },
  childItem: { flex: 1, minWidth: 0 },
  itemHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  itemActive: { backgroundColor: CATALOG_COLOR.accentSubtle },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  label: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
  labelActive: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.accent },
});
