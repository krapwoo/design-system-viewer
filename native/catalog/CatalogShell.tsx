import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_MAX_CONTENT_WIDTH, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { CatalogSidebar } from './CatalogSidebar';
import { SectionBlock } from './SectionBlock';
import { FamilyPage } from './FamilyPage';
import { GroupPage } from './GroupPage';
import { UpdatePanel } from './UpdatePanel';
import { Overview } from './Overview';
import { DEFAULT_OVERVIEW_PREFS, tokenGroupIds, type OverviewPrefs } from './overviewModel';
import { ScrollRootContext } from './scrollRootContext';
import { SourceReferencePicker } from './SourceReferencePicker';
import {
  aliasTargets,
  DS_VIEWER_SECRET_HEADER,
  footerLink,
  groupLabelFor,
  hashForId,
  neighbors,
  orderedIds,
  OVERVIEW_PAGE_ID,
  overviewHash,
  resolveRoute,
  shouldShowMajorBanner,
  UPDATE_PAGE_ID,
  type MemberSearchEntry,
  type OverviewTab,
} from './catalogNavigation';
import { browsableIds, buildReferenceIndex, hasReferenceNavigation, referenceLinkProps, resolveReference, type ReferenceEntry, type ReferenceNavigation } from './catalogReferences';
import { findOverlayNode, overlayAddressFromSearch } from './overlayViewport';
import { SpecimenAddressProvider } from './SpecimenAddress';
import type { UsageData } from './usage';
import type { NavGroup, PreviewWidths, SectionDef, UpdateNotice, VersionStatus } from './types';

/** `active` can be a real page id, or a reserved id (the update page, the Overview) — never both a
 *  generic `TId` constraint and a hardcoded string literal type at once, which is why this is its
 *  own alias. */
type ShellPageId<TId extends string> = TId | typeof UPDATE_PAGE_ID | typeof OVERVIEW_PAGE_ID;

/** The reserved pages that are not catalog sections. */
function isReservedPage(id: string | undefined): boolean {
  return id === UPDATE_PAGE_ID || id === OVERVIEW_PAGE_ID;
}

/** #60's "opening context" (plan Task 2B item 4): the page/member a Source reference journey
 *  started from, remembered only in memory (no persistent history manager) so a reference
 *  destination can offer a real `Back to <origin title>` link. Never an alias — always the actual
 *  page/member identity the user was looking at. */
type ReferenceOrigin<TId extends string> = { pageId: TId; memberId?: string };

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
function MajorBanner({ update, onReviewUpdate, onDismiss, keepDocumentUrl = false }: { update: UpdateNotice; onReviewUpdate: () => void; onDismiss: () => void; keepDocumentUrl?: boolean }) {
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
        <Text
          role="link"
          style={bannerStyles.link}
          onPress={(event?: { preventDefault?: () => void }) => {
            // An embedded shell opens its own update page; the host page's address stays put.
            if (keepDocumentUrl) event?.preventDefault?.();
            onReviewUpdate();
          }}
          {...({ href: hashForId(UPDATE_PAGE_ID) } as Record<string, unknown>)}
        >
          Review update
        </Text>
      </Text>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={`Dismiss for ${update.latest}`} style={bannerStyles.close}>
        <Text style={bannerStyles.closeGlyph}>×</Text>
      </Pressable>
    </View>
  );
}

/** Spec §5.3 "Unknown or malformed address": shown instead of silently falling back to the first
 *  page, for every page (not only family pages). Focuses its own title on mount — unlike a normal
 *  page change, this can be the very first thing a fresh load shows, so it can't wait for the
 *  shared "focus only when the user navigated" logic the rest of the shell uses. */
function NotFoundPage({ raw, firstHref, onOpenFirst }: { raw: string; firstHref?: string; onOpenFirst: () => void }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    focusElement(ref.current);
  }, []);
  return (
    <View>
      <View ref={ref} tabIndex={-1} role="heading" {...({ 'aria-level': 1 } as Record<string, unknown>)} style={notFoundStyles.headingTarget}>
        <Text style={notFoundStyles.title}>Page not found</Text>
      </View>
      <Text style={notFoundStyles.body}>{`There's no catalog page at #${raw}.`}</Text>
      <Pressable
        onPress={onOpenFirst}
        accessibilityRole="link"
        {...(firstHref ? ({ href: firstHref } as Record<string, unknown>) : null)}
        style={notFoundStyles.link}
      >
        <Text style={notFoundStyles.linkText}>Open the first page</Text>
      </Pressable>
    </View>
  );
}

/** A quiet return or browse fallback. The callback owns activation in both shell modes,
 *  using the same modified-click policy as inline references. A same-family return can reuse
 *  this anchor as "Browse catalog" before the browser runs its default, so that default must
 *  never follow the newly rendered href after the intended origin has already been selected. */
function ReferenceReturnLink<TId extends string>({ label, targetId, memberId, onNavigate }: {
  label: string;
  targetId: TId;
  memberId?: string;
  onNavigate: (id: TId, memberId?: string) => void;
}) {
  const activation = referenceLinkProps({
    resolve: () => ({ pageId: targetId, memberId }),
    open: onNavigate,
  }, targetId);
  return (
    <Pressable
      onPress={activation?.onPress}
      accessibilityRole="link"
      {...({ href: hashForId(memberId ?? targetId) } as Record<string, unknown>)}
      style={notFoundStyles.link}
    >
      <Text style={notFoundStyles.linkText}>{label}</Text>
    </Pressable>
  );
}

const notFoundStyles = StyleSheet.create({
  headingTarget: { alignSelf: 'flex-start', marginBottom: 6 },
  title: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text },
  body: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.lg },
  link: { alignSelf: 'flex-start', minHeight: CATALOG_LAYOUT.controlSize, justifyContent: 'center' },
  linkText: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.accent },
});

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
  text: { flex: 1, ...CATALOG_TEXT.body, color: CATALOG_COLOR.warning },
  bold: { ...CATALOG_TEXT.bodyStrong },
  link: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.warning, textDecorationLine: 'underline' },
  close: { width: 32, height: 32, borderRadius: CATALOG_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.warning },
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
  usage,
  embedded = false,
  initialPage,
}: {
  /** Short product/app name — the sidebar logo and the breadcrumb root. */
  appName: string;
  /** A shell shown inside another page (a catalog demo): it keeps its selected page in its own
   *  state, never reads or writes the URL, and doesn't treat the page's address as its own. */
  embedded?: boolean;
  /** The page an embedded shell opens on (defaults to the first page). */
  initialPage?: TId;
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
  /** Where each component is used (usage file format v1), validated by `sync` and written to
   *  `.ds-viewer/generated/usage.json`. `null`/absent: no "Appears in" blocks anywhere. */
  usage?: UsageData | null;
}) {
  // A `BoundedOverlayViewport`'s own child document (design §5): render ONLY the one authored
  // node this document's URL addresses, with no sidebar/breadcrumb/title/pager — never the whole
  // page, since that page's other examples (and this same example's own viewport wrapper, now
  // recognizing itself as the selected address) would otherwise render alongside it for nothing.
  // Read once per mount, like `active`'s own initial read below: this mode is only ever entered by
  // a fresh document load, never a same-document transition.
  // An embedded shell never owns the URL (hash routing, the overlay child-document address).
  const routesByUrl = isWeb() && !embedded;
  const overlayAddress = useMemo(() => (routesByUrl ? overlayAddressFromSearch(window.location.search) : undefined), [routesByUrl]);
  const overlayNode = useMemo(() => (overlayAddress ? findOverlayNode(sections, overlayAddress) : undefined), [overlayAddress, sections]);

  const sectionsById = useMemo(() => new Map(sections.map((def) => [def.id, def])), [sections]);
  const labels = useMemo(() => new Map(sections.filter((def) => def.title).map((def) => [def.id as string, def.title as string])), [sections]);
  // #60: the browse-facing subset only (reference-only pages, and their members, stay routable —
  // see `knownAddressIds` below — but drop out of the sidebar/pager/hash-fallback sequence
  // `order` itself is).
  const browsable = useMemo(() => browsableIds(sections), [sections]);
  const order = useMemo(() => orderedIds(groups, browsable, labels), [groups, browsable, labels]);
  // #60: true once any page opts into the `'reference'` layer — the sidebar's own trigger for
  // showing the separate Source reference entry at all; a legacy catalog with no such page keeps
  // its present sidebar unchanged.
  const hasReference = useMemo(() => hasReferenceNavigation(sections), [sections]);
  // #60: the catalog-wide reference index the picker searches — built from every registered page,
  // never filtered to `browsable`, so a page's family members are findable even when the page
  // itself is reference-only.
  const referenceEntries = useMemo(() => buildReferenceIndex(sections), [sections]);
  // Spec §5.3: every family page's own member ids/aliases, resolved to their page (and member, for
  // anything other than the whole) — used both for an old/alias/member address (`resolveRoute`)
  // and for the sidebar's member search (`memberSearchEntries` below).
  const aliasMap = useMemo(() => aliasTargets(sections), [sections]);
  // V2d item 3: every real catalog address a family member's `composedOf` could resolve to,
  // outside its own family — every other page's own id, plus every member id/alias `aliasMap`
  // already resolves (`FamilyPage` itself always adds its own family's member ids on top of this).
  const knownAddressIds = useMemo(() => new Set<string>([...sectionsById.keys(), ...aliasMap.keys()]), [sectionsById, aliasMap]);
  // #60: every registered page id, independent of `order` (browse-only) — `resolveRoute` only
  // ever uses this to decide whether a hash literally names a real page (never for display
  // order), so a reference-only page's own address still resolves even though it's absent from
  // `order`. The "Implementation seams" warning this plan carries: never repurpose the filtered
  // browse set as the known-address set.
  const fullRouteIds = useMemo(() => Array.from(sectionsById.keys()), [sectionsById]);
  // #60: a reference-only family page's own members are excluded here too (not just `order`) —
  // "Reference-only pages and their family member search hits stay out of ordinary browsing".
  const memberIndex = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const section of sections) {
      if (!section.family || !browsable.has(section.id)) continue;
      const ids: string[] = [];
      for (const member of section.family.members) {
        ids.push(member.id, ...(member.aliases ?? []));
      }
      map.set(section.id, ids);
    }
    return map;
  }, [sections, browsable]);
  const memberSearchEntries = useMemo(() => {
    const entries: MemberSearchEntry<TId>[] = [];
    for (const section of sections) {
      if (!section.family || !browsable.has(section.id)) continue;
      for (const member of section.family.members) {
        if (member.id === section.family.whole) continue;
        entries.push({ pageId: section.id, memberId: member.id, aliases: member.aliases, familyTitle: section.title ?? section.id });
      }
    }
    return entries;
  }, [sections, browsable]);

  // #60: the sidebar's own `groups` filtered to `browsable` — a reference-only page is never
  // listed there regardless of whether the catalog author also left it out of `groups` (defense
  // in depth, same reasoning as `memberIndex`/`memberSearchEntries` above).
  const browsableGroups = useMemo(
    () => groups.map((group) => ({ label: group.label, ids: group.ids.filter((id) => browsable.has(id)) })).filter((group) => group.ids.length > 0),
    [groups, browsable],
  );

  // The Overview exists only with usage data: without it its address is as unknown as any other.
  const overviewEnabled = usage != null;
  const routeFromHash = useCallback((hash: string) => resolveRoute(hash, fullRouteIds, aliasMap, overviewEnabled), [fullRouteIds, aliasMap, overviewEnabled]);

  const [active, setActive] = useState<ShellPageId<TId> | undefined>(() => {
    if (embedded) return initialPage ?? order[0];
    if (!isWeb()) return order[0];
    const route = routeFromHash(window.location.hash);
    if (route.kind === 'empty') return order[0];
    if (route.kind === 'update') return UPDATE_PAGE_ID;
    if (route.kind === 'overview') return OVERVIEW_PAGE_ID;
    if (route.kind === 'page') return route.id;
    if (route.kind === 'member') return route.pageId;
    return undefined; // notFound
  });
  // The Overview's tab lives in the address (`#ds-viewer-overview/usage`); its filter and sort are
  // kept here so Back from a card returns to the same view.
  const [overviewTab, setOverviewTab] = useState<OverviewTab>(() => {
    if (embedded || !isWeb()) return 'components';
    const route = routeFromHash(window.location.hash);
    return route.kind === 'overview' ? route.tab : 'components';
  });
  const [overviewPrefs, setOverviewPrefs] = useState<OverviewPrefs>(DEFAULT_OVERVIEW_PREFS);
  const overviewTabRef = useRef(overviewTab);
  overviewTabRef.current = overviewTab;
  const [pendingMemberId, setPendingMemberId] = useState<string | undefined>(() => {
    if (embedded || !isWeb()) return undefined;
    const route = routeFromHash(window.location.hash);
    return route.kind === 'member' ? route.memberId : undefined;
  });
  // V2c item 11: bumped on every member activation, even a repeat one, so `FamilyPage`'s own
  // one-shot jump (`shouldRunMemberJump`) counts a re-selected member address as fresh — a plain
  // `pendingMemberId` state update bails out (no re-render) when the string value is unchanged.
  const [pendingMemberNonce, setPendingMemberNonce] = useState(0);
  // #64 B5: the tokenDefinition section (if any) a page route's own `sectionId` named — set only
  // by hash resolution (a section-alias route), never by `select` (an ordinary navigation never
  // carries one). Consumed once by `SectionBlock`'s own scroll effect, the same one-shot-jump
  // convention `pendingMemberId`/`pendingMemberNonce` already establishes for a member address.
  const [pendingSectionId, setPendingSectionId] = useState<string | undefined>(() => {
    if (embedded || !isWeb()) return undefined;
    const route = routeFromHash(window.location.hash);
    return route.kind === 'page' ? route.sectionId : undefined;
  });
  const [pendingSectionNonce, setPendingSectionNonce] = useState(0);
  const [notFoundRaw, setNotFoundRaw] = useState<string | undefined>(() => {
    if (embedded || !isWeb()) return undefined;
    const route = routeFromHash(window.location.hash);
    return route.kind === 'notFound' ? route.raw : undefined;
  });

  // #60: the Source reference picker's own open/close state, and the one journey it may have
  // started (plan Task 2B item 4) — `undefined` means no recorded origin, which is also the
  // truthful state for a directly loaded reference URL (no invented origin).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourceOrigin, setSourceOrigin] = useState<ReferenceOrigin<TId> | undefined>(undefined);
  // What page/member to remember as this journey's origin, captured the moment the picker opens
  // (a ref, not state — opening never itself changes the route, so it must not re-render or touch
  // `sourceOrigin` until an actual selection commits to a destination).
  const pendingOriginRef = useRef<ReferenceOrigin<TId> | undefined>(undefined);
  // A selected entry, parked here until the picker has actually finished closing (see the effect
  // below) — the focus-ordering seam both `SourceReferencePicker.tsx` and this file's own module
  // doc comment warn about: Modal's trigger-restore effect must run first, or it can restore the
  // trigger focus OVER the destination this same selection is about to open.
  const pendingReferenceSelectionRef = useRef<{ entry: ReferenceEntry<TId>; origin: ReferenceOrigin<TId> | undefined } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  // Where the Overview thumbnails' lookahead is measured: the column that scrolls, not the window.
  const getScrollRoot = useCallback(
    () => (Platform.OS === 'web' ? (scrollRef.current as unknown as { getScrollableNode?: () => Element | null } | null)?.getScrollableNode?.() ?? null : null),
    [],
  );
  const tokenIds = useMemo(() => tokenGroupIds(groups), [groups]);
  const headingRef = useRef<View>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const pushHistoryNext = useRef(false);
  const focusHeadingNext = useRef(false);
  // #60 correction: the fragment-sync effect below writes `window.location.hash` itself to keep
  // the URL in step with `active`/`pendingMemberId` — on web that write queues its own real
  // `hashchange` event, which arrives at the very listener below meant for genuine external/manual/
  // back-forward navigation. Recording the exact hash we just wrote (cleared the moment the next
  // `hashchange` is seen, matched or not) lets that listener recognise its own settling event and
  // skip it, instead of treating it as new navigation and erasing a just-recorded source origin.
  const ownHashWriteRef = useRef<string | undefined>(undefined);
  // The page/member the last scroll reset ran for — see the URL-sync effect.
  const lastScrollTargetRef = useRef<{ active: ShellPageId<TId>; memberId: string | undefined } | undefined>(undefined);

  const select = useCallback((id: ShellPageId<TId>, memberId?: string) => {
    // Every ordinary navigation — sidebar, pager, a member hit, the recovery/banner/return links
    // below — starts a fresh page, so any previously recorded Source reference origin is now
    // stale (plan Task 2B item 4: "must not leave a stale source-return control on unrelated
    // pages"). A real selection from the picker re-records it afterwards (see the effect below),
    // in the same batch, so that later call always wins.
    setSourceOrigin(undefined);
    setNotFoundRaw(undefined);
    // #64 B5: `select` is always an ordinary navigation (sidebar, pager, a member hit, …), never a
    // section-alias arrival — any section scroll still owed from a previous hash resolution is now
    // stale.
    setPendingSectionId(undefined);
    // The sidebar's Overview link (and a card's way back to it) means the Components tab; leaving
    // a different tab open would contradict the address the link advertises.
    if (id === OVERVIEW_PAGE_ID && overviewTabRef.current !== 'components') {
      pushHistoryNext.current = true;
      setOverviewTab('components');
    }
    if (id === activeRef.current) {
      if (memberId) {
        pushHistoryNext.current = true;
        setPendingMemberId(memberId);
        setPendingMemberNonce((n) => n + 1);
      } else {
        setPendingMemberId(undefined);
        focusElement(headingRef.current);
      }
      return;
    }
    pushHistoryNext.current = true;
    focusHeadingNext.current = !memberId;
    setPendingMemberId(memberId);
    if (memberId) setPendingMemberNonce((n) => n + 1);
    setActive(id);
  }, []);

  // Stable, so a memoized Overview card is not re-rendered (and its live thumbnail re-run) by every
  // shell render.
  const openFromOverview = useCallback((id: string) => select(id as TId), [select]);

  const selectOverviewTab = useCallback((tab: OverviewTab) => {
    if (tab === overviewTabRef.current) return;
    pushHistoryNext.current = true;
    setOverviewTab(tab);
  }, []);

  // Task 2B2 correction: the one private reference-selection routine both the picker's deferred
  // selection (below) and inline reference activation (`referenceNavigation.open`, further below)
  // share — `select` alone always clears any recorded origin (every *ordinary* navigation must),
  // so this is what actually records a truthful one afterwards, in the same batch: a self-
  // referential selection (destination already equals the recorded origin) records no origin at
  // all, the same "no self-referential Back link" rule the picker already established.
  const openReference = useCallback(
    (pageId: TId, memberId: string | undefined, origin: ReferenceOrigin<TId> | undefined) => {
      const sameAsOrigin = origin !== undefined && origin.pageId === pageId && origin.memberId === memberId;
      select(pageId, memberId);
      setSourceOrigin(sameAsOrigin ? undefined : origin);
    },
    [select],
  );

  // Task 2B2: the shared navigation `SectionBlock`/`FamilyPage` use to turn an already-true
  // reference fact (a Composition name, an "also used by" user, a `related`/anatomy name) into a
  // real canonical link — through the exact same `resolveReference`/`openReference` this shell's
  // own Source reference journey already uses, never a second lookup or a global context. Supplied
  // to every active page's own renderer below, independent of `hasReference` (plan: "CatalogShell
  // supplies optional reference-navigation behavior to its own ordinary/family renderers,
  // independent of whether reference-only navigation metadata exists").
  const referenceNavigation: ReferenceNavigation<TId> = useMemo(
    () => ({
      resolve: (name) => {
        const result = resolveReference(name, fullRouteIds, aliasMap, referenceEntries);
        return result.kind === 'address' ? { pageId: result.pageId, memberId: result.memberId } : undefined;
      },
      // The inline origin is the page the reference was actually clicked from — never the stale
      // `pendingMemberId` of a previously selected, unrelated member (plan correction R1: "a
      // page-level anatomy/relatedPages reference starts at the page"). `sourceMemberId`, when the
      // calling renderer supplied one, narrows that to the actual owning part/whole instead — but
      // only once validated against the current page's own real family; an unknown hint can never
      // fabricate an origin.
      open: (pageId, memberId, sourceMemberId) => {
        const current = active !== undefined && !isReservedPage(active) ? (active as TId) : undefined;
        if (current === undefined) {
          openReference(pageId, memberId, undefined);
          return;
        }
        const ownerFamily = sectionsById.get(current)?.family;
        const validHint = sourceMemberId !== undefined && ownerFamily?.members.some((member) => member.id === sourceMemberId) ? sourceMemberId : undefined;
        openReference(pageId, memberId, { pageId: current, memberId: validHint });
      },
    }),
    [fullRouteIds, aliasMap, referenceEntries, active, sectionsById, openReference],
  );

  // Back/forward, manual fragment edits, and our own hash assignments below (which also fire
  // `hashchange`) all funnel through here.
  useEffect(() => {
    if (!routesByUrl) return;
    const onHashChange = () => {
      // This event may just be our own fragment-sync write (below) settling, not new navigation —
      // state already reflects that write, so there is nothing to reconcile and no stale origin to
      // clear. One-shot: consumed (and cleared) on the very next event, matched or not, so a later
      // genuine navigation that happens to land on the same hash is never mistaken for our own.
      const ownWrite = ownHashWriteRef.current !== undefined && ownHashWriteRef.current === window.location.hash;
      ownHashWriteRef.current = undefined;
      if (ownWrite) return;
      // Back/forward and manual fragment edits bypass `select` entirely — clear any recorded
      // Source reference origin here too, for the same "no stale return control" reason.
      setSourceOrigin(undefined);
      const route = routeFromHash(window.location.hash);
      if (route.kind === 'notFound') {
        setNotFoundRaw(route.raw);
        setPendingMemberId(undefined);
        setPendingSectionId(undefined);
        return;
      }
      setNotFoundRaw(undefined);
      if (route.kind === 'empty') {
        setPendingMemberId(undefined);
        setPendingSectionId(undefined);
        if (order[0] !== undefined && order[0] !== activeRef.current) {
          focusHeadingNext.current = true;
          setActive(order[0]);
        }
        return;
      }
      if (route.kind === 'update') {
        setPendingMemberId(undefined);
        setPendingSectionId(undefined);
        if (UPDATE_PAGE_ID !== activeRef.current) {
          focusHeadingNext.current = true;
          setActive(UPDATE_PAGE_ID);
        }
        return;
      }
      if (route.kind === 'overview') {
        setPendingMemberId(undefined);
        setPendingSectionId(undefined);
        setOverviewTab(route.tab);
        if (OVERVIEW_PAGE_ID !== activeRef.current) {
          focusHeadingNext.current = true;
          setActive(OVERVIEW_PAGE_ID);
        }
        return;
      }
      if (route.kind === 'page') {
        setPendingMemberId(undefined);
        // #64 B5: a section-alias route re-scrolls even to the page it's already on (a plain
        // `pendingSectionId` string update would otherwise bail out when re-visiting the same
        // section) — bump the nonce whenever one is named, the same "even a repeat one" reasoning
        // `pendingMemberNonce` already uses for a member address.
        setPendingSectionId(route.sectionId);
        if (route.sectionId) setPendingSectionNonce((n) => n + 1);
        if (route.id !== activeRef.current) {
          focusHeadingNext.current = true;
          setActive(route.id);
        }
        return;
      }
      // member: scroll/open/focus is the member itself (FamilyPage's own effect), never the page
      // heading — even when this also switches the active page.
      setPendingSectionId(undefined);
      setPendingMemberId(route.memberId);
      setPendingMemberNonce((n) => n + 1);
      if (route.pageId !== activeRef.current) {
        focusHeadingNext.current = false;
        setActive(route.pageId);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [order, routesByUrl, routeFromHash]);

  // After every page or member change: sync the fragment, return to the top (unless a member is
  // addressed — FamilyPage scrolls to that instead), and move focus when the user navigated to a
  // new page (never on first load, and never for a member address, which focuses the member).
  useEffect(() => {
    if (active === undefined) return;
    const push = pushHistoryNext.current;
    const focus = focusHeadingNext.current;
    pushHistoryNext.current = false;
    focusHeadingNext.current = false;
    // F7: while a section-alias arrival is live (`pendingSectionId` is cleared by every other
    // navigation), the URL already names that section — leave the alias hash alone so a reload or
    // a copied link keeps the section instead of collapsing to the page id.
    const keepSectionAliasHash = pendingMemberId === undefined && pendingSectionId !== undefined;
    if (routesByUrl && !keepSectionAliasHash) {
      const expected = active === OVERVIEW_PAGE_ID ? overviewHash(overviewTab) : hashForId(pendingMemberId ?? active);
      if (window.location.hash !== expected) {
        ownHashWriteRef.current = expected;
        if (push) window.location.hash = expected;
        else window.history.replaceState(null, '', expected);
      }
    }
    // Only a real page or member change returns to the top. A change of `pendingSectionId` alone
    // (a same-page section-alias arrival) re-runs this effect for the hash above, but the section
    // has already scrolled itself into view (child effects run first), so resetting would undo it.
    const previous = lastScrollTargetRef.current;
    lastScrollTargetRef.current = { active, memberId: pendingMemberId };
    const targetChanged = previous === undefined || previous.active !== active || previous.memberId !== pendingMemberId;
    if (!pendingMemberId && targetChanged) {
      resetMainScroll(scrollRef.current);
      if (focus) focusElement(headingRef.current);
    }
  }, [active, pendingMemberId, pendingSectionId, routesByUrl, overviewTab]);

  // #60: captures the current page/member as this journey's origin (before the picker has
  // changed anything), then opens it. A cancellation (Escape/Close) never reaches the effect
  // below, so nothing it captured here is ever applied.
  const openSourceReferencePicker = useCallback(() => {
    pendingOriginRef.current = active !== undefined && !isReservedPage(active) ? { pageId: active as TId, memberId: pendingMemberId } : undefined;
    setPickerOpen(true);
  }, [active, pendingMemberId]);

  const dismissSourceReferencePicker = useCallback(() => setPickerOpen(false), []);

  // The picker leaf never navigates itself (`SourceReferencePicker.tsx`'s own module doc
  // comment) — only parks the choice and closes. The effect below applies it once closed.
  const selectReference = useCallback((entry: ReferenceEntry<TId>) => {
    pendingReferenceSelectionRef.current = { entry, origin: pendingOriginRef.current };
    setPickerOpen(false);
  }, []);

  // Runs only after the picker has actually finished closing — React commits a child's (the
  // Modal's) own closing/trigger-restore effects before this component's own effect, so the
  // destination's focus below can never be clobbered by that restore (the ordering hazard this
  // file's own module doc comment and `SourceReferencePicker.tsx`'s both warn about).
  useEffect(() => {
    if (pickerOpen) return;
    const pending = pendingReferenceSelectionRef.current;
    if (!pending) return;
    pendingReferenceSelectionRef.current = null;
    const { entry, origin } = pending;
    openReference(entry.pageId, entry.memberId, origin);
  }, [pickerOpen, openReference]);

  const activeDef = active !== undefined && !isReservedPage(active) ? sectionsById.get(active as TId) : undefined;

  // Return to the recorded source-lookup origin for any destination. A directly opened
  // reference-only page has no origin and may instead offer the first real browsing page.
  const referenceReturn = useMemo(() => {
    if (!activeDef) return undefined;
    if (sourceOrigin) {
      return { label: `Back to ${labels.get(sourceOrigin.pageId) ?? sourceOrigin.pageId}`, targetId: sourceOrigin.pageId, memberId: sourceOrigin.memberId };
    }
    if (activeDef.navigation === 'reference' && order[0] !== undefined) return { label: 'Browse catalog', targetId: order[0], memberId: undefined };
    return undefined;
  }, [activeDef, sourceOrigin, labels, order]);

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
        {/* The addressed example's own device frame recognises this document as its viewport. */}
        <SpecimenAddressProvider address={overlayAddress}>
          {overlayNode ?? <Text style={styles.overlayUnavailable}>This example is no longer available.</Text>}
        </SpecimenAddressProvider>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CatalogSidebar
        logo={appName}
        logoImageSource={logoImageSource}
        caption={title}
        groups={browsableGroups}
        labels={labels}
        memberIndex={memberIndex}
        memberSearchEntries={memberSearchEntries}
        active={active}
        onPress={select}
        onSelectMember={(pageId, memberId) => select(pageId, memberId)}
        footer={footer}
        sourceReference={hasReference ? { onPress: openSourceReferencePicker } : undefined}
        overview={overviewEnabled ? { active: active === OVERVIEW_PAGE_ID, onPress: () => select(OVERVIEW_PAGE_ID) } : undefined}
        keepDocumentUrl={embedded}
      />
      <SourceReferencePicker visible={pickerOpen} entries={referenceEntries} onDismiss={dismissSourceReferencePicker} onSelect={selectReference} />
      <ScrollView ref={scrollRef} style={styles.main} contentContainerStyle={styles.mainContent}>
        {notFoundRaw !== undefined ? (
          <NotFoundPage raw={notFoundRaw} firstHref={order[0] !== undefined ? hashForId(order[0]) : undefined} onOpenFirst={() => order[0] !== undefined && select(order[0])} />
        ) : active === OVERVIEW_PAGE_ID && usage ? (
          <ScrollRootContext.Provider value={getScrollRoot}>
          <Overview
            sections={sections}
            usage={usage}
            browsable={browsable}
            tokenIds={tokenIds}
            defaultPreviewWidths={defaultPreviewWidths}
            tab={overviewTab}
            onTab={selectOverviewTab}
            prefs={overviewPrefs}
            onPrefs={setOverviewPrefs}
            onOpen={openFromOverview}
            headingRef={headingRef}
            keepDocumentUrl={embedded}
          />
          </ScrollRootContext.Provider>
        ) : active === UPDATE_PAGE_ID ? (
          <UpdatePanel
            update={effectiveUpdate}
            versionStatus={liveStatus}
            onVersionStatus={setLiveStatus}
            endpoint={updateEndpoint}
            appName={appName}
            headingRef={headingRef}
          />
        ) : activeDef?.family?.kind === 'group' ? (
          <React.Fragment key={activeDef.id}>
            {referenceReturn && <ReferenceReturnLink label={referenceReturn.label} targetId={referenceReturn.targetId} memberId={referenceReturn.memberId} onNavigate={select} />}
            <GroupPage
              def={activeDef}
              groupLabel={groupLabelFor(groups, activeDef.id)}
              breadcrumbRoot={appName}
              banner={showBanner && effectiveUpdate ? <MajorBanner update={effectiveUpdate} onReviewUpdate={() => select(UPDATE_PAGE_ID)} onDismiss={dismissMajorBanner} keepDocumentUrl={embedded} /> : undefined}
              pager={{
                previousId: neighbors(order, activeDef.id).previous,
                nextId: neighbors(order, activeDef.id).next,
                onNavigate: select,
                labelOf: (id) => labels.get(id) ?? id,
              }}
              headingRef={headingRef}
              defaultPreviewWidths={defaultPreviewWidths}
              focusMemberId={pendingMemberId}
              focusNonce={pendingMemberNonce}
              knownAddressIds={knownAddressIds}
              navigation={referenceNavigation}
              usage={usage}
            />
          </React.Fragment>
        ) : activeDef?.family ? (
          <React.Fragment key={activeDef.id}>
            {referenceReturn && <ReferenceReturnLink label={referenceReturn.label} targetId={referenceReturn.targetId} memberId={referenceReturn.memberId} onNavigate={select} />}
            <FamilyPage
              def={activeDef}
              groupLabel={groupLabelFor(groups, activeDef.id)}
              breadcrumbRoot={appName}
              banner={showBanner && effectiveUpdate ? <MajorBanner update={effectiveUpdate} onReviewUpdate={() => select(UPDATE_PAGE_ID)} onDismiss={dismissMajorBanner} keepDocumentUrl={embedded} /> : undefined}
              pager={{
                previousId: neighbors(order, activeDef.id).previous,
                nextId: neighbors(order, activeDef.id).next,
                onNavigate: select,
                labelOf: (id) => labels.get(id) ?? id,
              }}
              headingRef={headingRef}
              defaultPreviewWidths={defaultPreviewWidths}
              focusMemberId={pendingMemberId}
              focusNonce={pendingMemberNonce}
              knownAddressIds={knownAddressIds}
              navigation={referenceNavigation}
              usage={usage}
            />
          </React.Fragment>
        ) : activeDef ? (
          <React.Fragment key={activeDef.id}>
            {referenceReturn && <ReferenceReturnLink label={referenceReturn.label} targetId={referenceReturn.targetId} memberId={referenceReturn.memberId} onNavigate={select} />}
            <SectionBlock
              def={activeDef}
              groupLabel={groupLabelFor(groups, activeDef.id)}
              breadcrumbRoot={appName}
              // The approved mockup's own `PAGE_BG` order: crumb, then banner, then title — the
              // banner used to render above the breadcrumb instead (Important finding, Fable
              // correction pass).
              banner={showBanner && effectiveUpdate ? <MajorBanner update={effectiveUpdate} onReviewUpdate={() => select(UPDATE_PAGE_ID)} onDismiss={dismissMajorBanner} keepDocumentUrl={embedded} /> : undefined}
              pager={{
                previousId: neighbors(order, activeDef.id).previous,
                nextId: neighbors(order, activeDef.id).next,
                onNavigate: select,
                labelOf: (id) => labels.get(id) ?? id,
              }}
              headingRef={headingRef}
              defaultPreviewWidths={defaultPreviewWidths}
              navigation={referenceNavigation}
              focusSectionId={pendingSectionId}
              focusNonce={pendingSectionNonce}
              usage={usage}
            />
          </React.Fragment>
        ) : hasReference ? (
          // #60 correction: an all-reference catalog with no `initialPage`/browsable page has
          // `active === undefined` here too, same as a genuinely empty one — but every one of its
          // registered reference pages is real and selectable, so claiming "No catalog pages are
          // available" would be false. No destination is fabricated (there is no browsable page to
          // invent one from); this only ever offers the real Source reference action already wired
          // above, never a second picker or a guessed route.
          <View>
            <Text style={styles.empty}>No pages are set up for ordinary browsing yet.</Text>
            <Pressable onPress={openSourceReferencePicker} accessibilityRole="button" style={notFoundStyles.link}>
              <Text style={notFoundStyles.linkText}>Open source reference</Text>
            </Pressable>
          </View>
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
  overlayUnavailable: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, padding: CATALOG_SPACE.lg },
  main: { flex: 1 },
  mainContent: {
    width: '100%',
    maxWidth: CATALOG_MAX_CONTENT_WIDTH,
    paddingTop: CATALOG_LAYOUT.mainPaddingTop,
    paddingHorizontal: CATALOG_LAYOUT.mainPaddingX,
    paddingBottom: CATALOG_SPACE['3xl'],
  },
  empty: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
});
