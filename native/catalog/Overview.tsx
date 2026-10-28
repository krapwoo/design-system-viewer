import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { countUsesByArea, findUsage } from './usage';
import { hashForId } from './catalogNavigation';
import { JumpChip } from './JumpRow';
import { OverviewThumbnail } from './OverviewThumbnail';
import {
  DEFAULT_OVERVIEW_PREFS,
  buildOverviewPages,
  chipAreas,
  filterPages,
  groupByHome,
  orderAreas,
  usageLine,
  type OverviewFilter,
  type OverviewPage,
  type OverviewPrefs,
  type ThumbnailSource,
} from './overviewModel';
import type { PreviewWidths, SectionDef } from './types';
import type { UsageData } from './usage';

type Press = (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => void;

const CARD_THUMB_HEIGHT = 132;
/** A card's title may take two lines, so its room is always reserved and every card is the same
 *  height. It comes from the text role's own line height, not a pixel guess, and is a `minHeight`:
 *  the content (at most two title lines) never exceeds it, so nothing clips at any font size. */
const TITLE_LINES = 2;
export const CARD_TITLE_MIN_HEIGHT = CATALOG_TEXT.bodyStrong.lineHeight * TITLE_LINES;

function openHandler(onOpen: () => void, keepDocumentUrl: boolean, stop = false): Press {
  return (event) => {
    // An embedded shell handles the press itself; the browser's own navigation would change the host page.
    if (keepDocumentUrl) event?.preventDefault?.();
    if (stop) event?.stopPropagation?.();
    onOpen();
  };
}

function sameFilter(a: OverviewFilter, b: OverviewFilter): boolean {
  return a.kind === b.kind && (a.kind !== 'area' || a.area === (b as { area: string }).area);
}

/**
 * One card. It is a plain box, not a link around everything: a live specimen can hold its own links
 * and buttons, and an `<a>` may not contain either. So the thumbnail is a sibling of the title link,
 * the title link is the card's one tab stop, and a stretched, role-less overlay makes the rest of
 * the card (thumbnail included) click through to the same page. Hover and focus styling sit on the
 * box, so they show whichever part is hovered or the link is focused. The Overview and a page's
 * Parts block (`PartsBlock`) both draw it, in the `cardGrid` list; a `source` of `undefined` keeps the thumbnail's room as an
 * empty frame, so a card without a specimen is still the same height.
 */
export const OverviewCard = memo(function OverviewCard({ title, caption, source, href, onPress, number }: {
  title: string;
  caption: string;
  source?: ThumbnailSource;
  href: string;
  onPress: Press;
  /** A page's Parts block numbers its cards: the badge over the thumbnail, and in the link's name. */
  number?: string;
}) {
  const [overlayHovered, setOverlayHovered] = useState(false);
  const [linkHovered, setLinkHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.card, (overlayHovered || linkHovered) && styles.cardHover, focused && styles.focusRing]}>
      <Pressable
        accessible={false}
        onPress={onPress}
        onHoverIn={() => setOverlayHovered(true)}
        onHoverOut={() => setOverlayHovered(false)}
        // react-native-web ignores `focusable={false}` on a Pressable; `tabIndex` is what keeps it out of the tab order.
        {...({ tabIndex: -1 } as Record<string, unknown>)}
        style={styles.cardOverlay}
      />
      {source ? (
        <OverviewThumbnail source={source} height={CARD_THUMB_HEIGHT} />
      ) : (
        <View {...({ 'aria-hidden': true } as Record<string, unknown>)} style={styles.thumbEmpty} />
      )}
      {number !== undefined && (
        // Over the thumbnail frame's top-left, inset past the card's ring; decorative (the link's
        // name carries the number) and click-through, so the stretched link still takes the press.
        <View {...({ 'aria-hidden': true } as Record<string, unknown>)} style={styles.cardBadge} testID="part-badge">
          <View style={styles.cardBadgePin}>
            <Text style={styles.cardBadgeText}>{number}</Text>
          </View>
        </View>
      )}
      <Pressable
        onPress={onPress}
        onHoverIn={() => setLinkHovered(true)}
        onHoverOut={() => setLinkHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="link"
        {...({ href, ...(number !== undefined ? { 'aria-label': `Part ${number}, ${title}, ${caption}` } : {}) } as Record<string, unknown>)}
        style={styles.cardText}
      >
        <Text style={styles.cardTitle} numberOfLines={TITLE_LINES}>{title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{caption}</Text>
      </Pressable>
    </View>
  );
});

/** An Overview card for a page: opens it like a sidebar link does. Memoized so a re-render of the
 *  grid does not re-render (and re-run) the live specimen of a card whose page did not change. */
const PageCard = memo(function PageCard({ page, keepDocumentUrl, onOpen }: { page: OverviewPage; keepDocumentUrl: boolean; onOpen: (id: string) => void }) {
  const open = useMemo(() => openHandler(() => onOpen(page.id), keepDocumentUrl), [onOpen, page.id, keepDocumentUrl]);
  return <OverviewCard title={page.title} caption={usageLine(page)} source={page.source} href={hashForId(page.id)} onPress={open} />;
});

function ComponentsGrid({ pages, areaOrder, prefs, onPrefs, keepDocumentUrl, onOpen }: {
  pages: readonly OverviewPage[];
  areaOrder: readonly string[];
  prefs: OverviewPrefs;
  onPrefs: (next: OverviewPrefs) => void;
  keepDocumentUrl: boolean;
  onOpen: (id: string) => void;
}) {
  const areas = useMemo(() => chipAreas(pages, areaOrder), [pages, areaOrder]);
  // A remembered choice can name an area this catalog no longer has: show everything then.
  const filter: OverviewFilter = prefs.filter.kind === 'area' && !areas.includes(prefs.filter.area) ? { kind: 'all' } : prefs.filter;
  const visible = useMemo(() => filterPages(pages, filter), [pages, filter]);
  const groups = useMemo(() => groupByHome(visible, areaOrder), [visible, areaOrder]);

  const chips: Array<{ key: string; label: string; value: OverviewFilter }> = [
    { key: 'all', label: 'All areas', value: { kind: 'all' } },
    ...areas.map((area) => ({ key: `area:${area}`, label: area, value: { kind: 'area', area } as OverviewFilter })),
  ];

  return (
    <View>
      <View role="group" aria-label="Filter by area" style={styles.chipRow}>
        {chips.map((chip) => (
          <JumpChip key={chip.key} title={chip.label} selected={sameFilter(filter, chip.value)} onPress={() => onPrefs({ ...prefs, filter: chip.value })} />
        ))}
      </View>
      <Text role="status" style={styles.count}>{`${visible.length} ${visible.length === 1 ? 'component' : 'components'}`}</Text>
      {visible.length === 0 ? (
        <Text style={styles.empty}>No components match this filter.</Text>
      ) : (
        groups.map((group) => (
          <View key={group.fallback ? 'no-home' : `area:${group.area}`} style={styles.group}>
            <View style={styles.groupHeading}>
              <Text role="heading" {...({ 'aria-level': 2 } as Record<string, unknown>)} style={styles.groupTitle}>{group.area}</Text>
              <Text style={styles.groupCount}>{group.pages.length}</Text>
            </View>
            <View role="list" style={styles.grid}>
              {group.pages.map((page) => (
                <View key={page.id} role="listitem" style={styles.gridItem}>
                  <PageCard page={page} keepDocumentUrl={keepDocumentUrl} onOpen={onOpen} />
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * The Overview page (contract O), shown only when the catalog has usage data: every page that has a
 * specimen as a card with a live thumbnail, grouped by home area, with area filter chips. A card opens its page like a sidebar link does, and every card is the
 * same height. The choices can be controlled (`CatalogShell` keeps them so Back returns to the same
 * view); without `prefs` it keeps its own.
 */
export function Overview({
  sections,
  usage,
  browsable,
  tokenIds,
  defaultPreviewWidths,
  prefs: prefsProp,
  onPrefs,
  onOpen,
  headingRef,
  keepDocumentUrl = false,
}: {
  sections: readonly SectionDef[];
  usage: UsageData;
  /** Page ids the sidebar lists; reference-only pages get no card. Omitted: every page. */
  browsable?: ReadonlySet<string>;
  /** Ids of the pages in the Tokens group: a `tokenGallery` page among them gets no card. */
  tokenIds?: ReadonlySet<string>;
  /** The catalog's default preview widths, for a thumbnail whose page names none. */
  defaultPreviewWidths?: PreviewWidths;
  prefs?: OverviewPrefs;
  onPrefs?: (prefs: OverviewPrefs) => void;
  /** Opens a page, like a sidebar link. */
  onOpen?: (id: string) => void;
  headingRef?: React.Ref<View>;
  /** In an embedded shell a card's own link must not change the host page's address. */
  keepDocumentUrl?: boolean;
}) {
  const [localPrefs, setLocalPrefs] = useState<OverviewPrefs>(DEFAULT_OVERVIEW_PREFS);
  const prefs = prefsProp ?? localPrefs;
  const setPrefs = onPrefs ?? setLocalPrefs;
  const open = onOpen ?? (() => undefined);

  const pages = useMemo(
    () => buildOverviewPages(sections, usage, { find: findUsage, countByArea: countUsesByArea }, { browsable, tokenIds, defaultPreviewWidths }),
    [sections, usage, browsable, tokenIds, defaultPreviewWidths],
  );
  // A real area called "Other" stays a real area: the home-less group is not keyed by name.
  const areaOrder = useMemo(() => orderAreas(usage.areas, pages), [usage.areas, pages]);

  return (
    <View>
      <View ref={headingRef} tabIndex={-1} role="heading" {...({ 'aria-level': 1 } as Record<string, unknown>)} style={styles.headingTarget}>
        <Text style={styles.title}>Overview</Text>
      </View>
      <Text style={styles.desc}>Every component with something to show, and where the app uses it.</Text>
      <ComponentsGrid pages={pages} areaOrder={areaOrder} prefs={prefs} onPrefs={setPrefs} keepDocumentUrl={keepDocumentUrl} onOpen={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  headingTarget: { alignSelf: 'flex-start', marginBottom: 6 },
  title: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text },
  desc: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.sm, marginBottom: CATALOG_SPACE.md },
  count: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.md },
  empty: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
  group: { marginBottom: CATALOG_LAYOUT.blockGap },
  groupHeading: { flexDirection: 'row', alignItems: 'baseline', gap: CATALOG_SPACE.sm, marginBottom: CATALOG_SPACE.md },
  groupTitle: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text },
  groupCount: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  // One or two columns on a narrow window, more as the room grows: a card wants about 240px.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.lg },
  gridItem: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0, maxWidth: 360 },
  card: {
    position: 'relative',
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_SPACE.md,
    gap: CATALOG_SPACE.md,
  },
  thumbEmpty: { height: CARD_THUMB_HEIGHT, borderRadius: CATALOG_RADIUS.sm, backgroundColor: CATALOG_COLOR.specimenStage },
  cardBadge: { pointerEvents: 'none', position: 'absolute', top: CATALOG_SPACE.md + CATALOG_SPACE.sm, left: CATALOG_SPACE.md + CATALOG_SPACE.sm },
  // The anatomy pin's look (`Anatomy.tsx` `pin`): a filled accent pill.
  cardBadgePin: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: CATALOG_COLOR.accent, alignItems: 'center', justifyContent: 'center' },
  cardBadgeText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.surface },
  cardHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  // Behind the title link (later siblings paint above it), above the thumbnail's own box.
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, cursor: 'pointer' } as object,
  cardText: { gap: 2, alignItems: 'flex-start', borderRadius: CATALOG_RADIUS.sm },
  cardTitle: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text, minHeight: CARD_TITLE_MIN_HEIGHT },
  cardMeta: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
});

/** The wrapping list of cards and the item each sits in (the Overview's grid, reused by `PartsBlock`). */
export const cardGrid = { list: styles.grid, item: styles.gridItem };
