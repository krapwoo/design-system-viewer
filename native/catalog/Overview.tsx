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
  sortByUses,
  usageLine,
  type OverviewFilter,
  type OverviewPage,
  type OverviewPrefs,
} from './overviewModel';
import type { PreviewWidths, SectionDef } from './types';
import type { UsageData } from './usage';

type Press = (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => void;

const CARD_THUMB_HEIGHT = 132;
const TAG_PADDING_VERTICAL = 2;
/** A card's title may take two lines, and the "Shared across areas" tag row is always there, so
 *  every card is the same height. Both come from the text roles' own line heights, not a pixel
 *  guess, and are `minHeight`s: the content (at most two title lines, one tag line) never exceeds
 *  them, so nothing clips at any font size. */
const TITLE_LINES = 2;
export const CARD_TITLE_MIN_HEIGHT = CATALOG_TEXT.bodyStrong.lineHeight * TITLE_LINES;
export const CARD_TAG_ROW_MIN_HEIGHT = CATALOG_SPACE.xs + CATALOG_TEXT.captionStrong.lineHeight + 2 * TAG_PADDING_VERTICAL;

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

/** The tag row is rendered on every card, empty when the card is not shared, so its height is
 *  always reserved. */
function SharedTagRow({ shared }: { shared: boolean }) {
  return (
    <View style={styles.tagRow}>
      {shared && (
        <View style={styles.tag}>
          <Text style={styles.tagText} numberOfLines={1}>Shared across areas</Text>
        </View>
      )}
    </View>
  );
}

/**
 * One card. It is a plain box, not a link around everything: a live specimen can hold its own links
 * and buttons, and an `<a>` may not contain either. So the thumbnail is a sibling of the title link,
 * the title link is the card's one tab stop, and a stretched, role-less overlay makes the rest of
 * the card (thumbnail included) click through to the same page. Hover and focus styling sit on the
 * box, so they show whichever part is hovered or the link is focused.
 */
const Card = memo(function Card({ page, keepDocumentUrl, onOpen }: { page: OverviewPage; keepDocumentUrl: boolean; onOpen: (id: string) => void }) {
  const [overlayHovered, setOverlayHovered] = useState(false);
  const [linkHovered, setLinkHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = openHandler(() => onOpen(page.id), keepDocumentUrl);
  return (
    <View style={[styles.card, (overlayHovered || linkHovered) && styles.cardHover, focused && styles.focusRing]}>
      <Pressable
        accessible={false}
        onPress={open}
        onHoverIn={() => setOverlayHovered(true)}
        onHoverOut={() => setOverlayHovered(false)}
        // react-native-web ignores `focusable={false}` on a Pressable; `tabIndex` is what keeps it out of the tab order.
        {...({ tabIndex: -1 } as Record<string, unknown>)}
        style={styles.cardOverlay}
      />
      <OverviewThumbnail source={page.source} height={CARD_THUMB_HEIGHT} />
      <Pressable
        onPress={open}
        onHoverIn={() => setLinkHovered(true)}
        onHoverOut={() => setLinkHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="link"
        {...({ href: hashForId(page.id) } as Record<string, unknown>)}
        style={styles.cardText}
      >
        <Text style={styles.cardTitle} numberOfLines={TITLE_LINES}>{page.title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{usageLine(page)}</Text>
        <SharedTagRow shared={page.shared} />
      </Pressable>
    </View>
  );
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
  const hasShared = useMemo(() => pages.some((page) => page.shared), [pages]);
  // A remembered choice can name an area this catalog no longer has: show everything then.
  const filter: OverviewFilter = prefs.filter.kind === 'area' && !areas.includes(prefs.filter.area) ? { kind: 'all' } : prefs.filter;
  const visible = useMemo(() => filterPages(pages, filter), [pages, filter]);
  const groups = useMemo(() => (prefs.componentsSort === 'area' ? groupByHome(visible, areaOrder) : []), [visible, areaOrder, prefs.componentsSort]);
  const flat = useMemo(() => (prefs.componentsSort === 'used' ? sortByUses(visible) : []), [visible, prefs.componentsSort]);

  const chips: Array<{ key: string; label: string; value: OverviewFilter }> = [
    { key: 'all', label: 'All areas', value: { kind: 'all' } },
    ...areas.map((area) => ({ key: `area:${area}`, label: area, value: { kind: 'area', area } as OverviewFilter })),
    ...(hasShared ? [{ key: 'shared', label: 'Shared across areas', value: { kind: 'shared' } as OverviewFilter }] : []),
  ];
  const grid = (list: readonly OverviewPage[]) => (
    <View role="list" style={styles.grid}>
      {list.map((page) => (
        <View key={page.id} role="listitem" style={styles.gridItem}>
          <Card page={page} keepDocumentUrl={keepDocumentUrl} onOpen={onOpen} />
        </View>
      ))}
    </View>
  );

  return (
    <View>
      <View style={styles.controls}>
        <View role="group" aria-label="Filter by area" style={styles.chipRow}>
          {chips.map((chip) => (
            <JumpChip key={chip.key} title={chip.label} selected={sameFilter(filter, chip.value)} onPress={() => onPrefs({ ...prefs, filter: chip.value })} />
          ))}
        </View>
        <View role="group" aria-label="Sort components" style={styles.chipRow}>
          <JumpChip title="By area" selected={prefs.componentsSort === 'area'} onPress={() => onPrefs({ ...prefs, componentsSort: 'area' })} />
          <JumpChip title="Most used" selected={prefs.componentsSort === 'used'} onPress={() => onPrefs({ ...prefs, componentsSort: 'used' })} />
        </View>
      </View>
      <Text role="status" style={styles.count}>{`${visible.length} ${visible.length === 1 ? 'component' : 'components'}`}</Text>
      {visible.length === 0 ? (
        <Text style={styles.empty}>No components match this filter.</Text>
      ) : prefs.componentsSort === 'used' ? (
        grid(flat)
      ) : (
        groups.map((group) => (
          <View key={group.fallback ? 'no-home' : `area:${group.area}`} style={styles.group}>
            <View style={styles.groupHeading}>
              <Text role="heading" {...({ 'aria-level': 2 } as Record<string, unknown>)} style={styles.groupTitle}>{group.area}</Text>
              <Text style={styles.groupCount}>{group.pages.length}</Text>
            </View>
            {grid(group.pages)}
          </View>
        ))
      )}
    </View>
  );
}

/**
 * The Overview page (contract O), shown only when the catalog has usage data: every page that has a
 * specimen as a card with a live thumbnail, grouped by home area, with area filter chips and a "By
 * area" / "Most used" sort. A card opens its page like a sidebar link does, and every card is the
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
  controls: { gap: CATALOG_SPACE.md, marginBottom: CATALOG_SPACE.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.sm },
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
  cardHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  // Behind the title link (later siblings paint above it), above the thumbnail's own box.
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, cursor: 'pointer' } as object,
  cardText: { gap: 2, alignItems: 'flex-start', borderRadius: CATALOG_RADIUS.sm },
  cardTitle: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text, minHeight: CARD_TITLE_MIN_HEIGHT },
  cardMeta: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  tagRow: { minHeight: CARD_TAG_ROW_MIN_HEIGHT, paddingTop: CATALOG_SPACE.xs, alignItems: 'flex-start' },
  tag: { paddingHorizontal: CATALOG_SPACE.sm, paddingVertical: TAG_PADDING_VERTICAL, borderRadius: CATALOG_RADIUS.control, backgroundColor: CATALOG_COLOR.accentSubtle },
  tagText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
});
