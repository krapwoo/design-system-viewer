import React, { memo, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { countUsesByArea, findUsage } from './usage';
import { hashForId, type OverviewTab } from './catalogNavigation';
import { JumpChip } from './JumpRow';
import { OverviewThumbnail } from './OverviewThumbnail';
import {
  DEFAULT_OVERVIEW_PREFS,
  buildOverviewPages,
  chipAreas,
  countInArea,
  filterPages,
  groupByHome,
  heatStyle,
  homeLine,
  orderAreas,
  sortByUses,
  tableAreas,
  usageLine,
  usageRows,
  type OverviewFilter,
  type OverviewPage,
  type OverviewPrefs,
} from './overviewModel';
import type { PreviewWidths, SectionDef } from './types';
import type { UsageData } from './usage';

type Press = (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => void;

const CARD_THUMB_HEIGHT = 132;
const ROW_THUMB = { width: 64, height: 44 } as const;
const COMPONENT_COL = 300;
const AREAS_COL = 72;
const AREA_COL = 96;
/** The inset count chip in a Usage table cell. */
const HEAT_CHIP_WIDTH = 36;
const HEAT_CHIP_HEIGHT = 28;

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

const TAB_ORDER: readonly OverviewTab[] = ['components', 'usage'];
const TAB_LABEL: Record<OverviewTab, string> = { components: 'Components', usage: 'Usage' };
const tabId = (tab: OverviewTab) => `ds-viewer-overview-tab-${tab}`;
const PANEL_ID = 'ds-viewer-overview-panel';

/** One tab of the tablist. Only the selected tab is a tab stop (roving `tabIndex`); the arrow keys
 *  on the tablist move between them (see `OverviewTabs`). */
const Tab = memo(React.forwardRef<View, { tab: OverviewTab; selected: boolean; onPress: () => void }>(function Tab({ tab, selected, onPress }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      nativeID={tabId(tab)}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      {...({ 'aria-selected': selected, 'aria-controls': PANEL_ID, tabIndex: selected ? 0 : -1 } as Record<string, unknown>)}
      style={[styles.tab, selected && styles.tabSelected, focused && styles.focusRing]}
    >
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{TAB_LABEL[tab]}</Text>
    </Pressable>
  );
}));

/** The WAI-ARIA tabs pattern with automatic activation: Left/Right (wrapping), Home and End move
 *  focus to a tab and select it. */
function OverviewTabs({ tab, onTab }: { tab: OverviewTab; onTab: (tab: OverviewTab) => void }) {
  const refs = useRef<Partial<Record<OverviewTab, View | null>>>({});
  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    const index = TAB_ORDER.indexOf(tab);
    const next = event.key === 'ArrowRight' ? TAB_ORDER[(index + 1) % TAB_ORDER.length]
      : event.key === 'ArrowLeft' ? TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length]
      : event.key === 'Home' ? TAB_ORDER[0]
      : event.key === 'End' ? TAB_ORDER[TAB_ORDER.length - 1]
      : undefined;
    if (!next) return;
    event.preventDefault();
    onTab(next);
    (refs.current[next] as unknown as { focus?: () => void } | null | undefined)?.focus?.();
  };
  return (
    <View role="tablist" aria-label="Overview" {...({ onKeyDown } as Record<string, unknown>)} style={styles.tabs}>
      {TAB_ORDER.map((name) => (
        <Tab key={name} ref={(node) => { refs.current[name] = node; }} tab={name} selected={tab === name} onPress={() => onTab(name)} />
      ))}
    </View>
  );
}

function SharedTag() {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>Shared across areas</Text>
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
        <Text style={styles.cardTitle} numberOfLines={1}>{page.title}</Text>
        <Text style={styles.cardMeta}>{usageLine(page)}</Text>
        {page.shared && <SharedTag />}
      </Pressable>
    </View>
  );
});

function ComponentsTab({ pages, areaOrder, prefs, onPrefs, keepDocumentUrl, onOpen }: {
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

const UsageRow = memo(function UsageRow({ page, columns, max, keepDocumentUrl, onOpen }: {
  page: OverviewPage;
  columns: readonly string[];
  max: number;
  keepDocumentUrl: boolean;
  onOpen: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = openHandler(() => onOpen(page.id), keepDocumentUrl);
  return (
    <Pressable
      role="row"
      {...({ tabIndex: -1 } as Record<string, unknown>)}
      onPress={open}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.row, hovered && styles.rowHover]}
    >
      <View role="rowheader" style={[styles.cell, styles.componentCell]}>
        <OverviewThumbnail source={page.source} width={ROW_THUMB.width} height={ROW_THUMB.height} />
        <Pressable
          onPress={openHandler(() => onOpen(page.id), keepDocumentUrl, true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityRole="link"
          {...({ href: hashForId(page.id) } as Record<string, unknown>)}
          style={[styles.rowLink, focused && styles.focusRing]}
        >
          <Text style={styles.cardTitle} numberOfLines={1}>{page.title}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>{homeLine(page)}</Text>
        </Pressable>
      </View>
      <View role="cell" style={[styles.cell, styles.areasCell]}>
        <Text style={styles.areasCount}>{page.byArea.length}</Text>
      </View>
      {columns.map((area) => {
        const count = countInArea(page, area);
        // A zero is an empty cell; a count sits in an inset chip shaded by intensity, not a
        // full-bleed cell background.
        if (count === 0) return <View key={area} role="cell" style={[styles.cell, styles.areaCell]} />;
        const heat = heatStyle(count, max, CATALOG_COLOR);
        return (
          <View key={area} role="cell" style={[styles.cell, styles.areaCell]}>
            <View style={[styles.heatChip, { backgroundColor: heat.backgroundColor }]}>
              <Text style={[styles.heatCount, { color: heat.color }]}>{count}</Text>
            </View>
          </View>
        );
      })}
    </Pressable>
  );
});

function UsageTab({ pages, areaOrder, prefs, onPrefs, keepDocumentUrl, onOpen }: {
  pages: readonly OverviewPage[];
  areaOrder: readonly string[];
  prefs: OverviewPrefs;
  onPrefs: (next: OverviewPrefs) => void;
  keepDocumentUrl: boolean;
  onOpen: (id: string) => void;
}) {
  const rows = useMemo(() => usageRows(pages, prefs.usageSort), [pages, prefs.usageSort]);
  const columns = useMemo(() => tableAreas(rows, areaOrder), [rows, areaOrder]);
  const max = useMemo(() => rows.reduce((top, row) => Math.max(top, ...row.byArea.map((entry) => entry.count)), 0), [rows]);
  const tableWidth = COMPONENT_COL + AREAS_COL + columns.length * AREA_COL;

  return (
    <View>
      <View style={styles.controls}>
        <View role="group" aria-label="Sort the table" style={styles.chipRow}>
          <JumpChip title="Most shared first" selected={prefs.usageSort === 'shared'} onPress={() => onPrefs({ ...prefs, usageSort: 'shared' })} />
          <JumpChip title="Most used first" selected={prefs.usageSort === 'used'} onPress={() => onPrefs({ ...prefs, usageSort: 'used' })} />
        </View>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No component has recorded uses yet.</Text>
      ) : (
        // Its own scroll container: at narrow widths the table scrolls here and the page never does.
        <ScrollView horizontal style={styles.tableScroll} contentContainerStyle={{ flexGrow: 1, minWidth: tableWidth }}>
          <View role="table" aria-label="Where each component is used" style={{ minWidth: tableWidth, flexGrow: 1 }}>
            <View role="row" style={[styles.row, styles.headerRow]}>
              <View role="columnheader" style={[styles.cell, styles.componentCell]}><Text style={styles.headerText}>Component</Text></View>
              <View role="columnheader" style={[styles.cell, styles.areasCell]}><Text style={styles.headerText}>Areas</Text></View>
              {columns.map((area) => (
                <View key={area} role="columnheader" style={[styles.cell, styles.areaCell]}><Text style={styles.headerText} numberOfLines={1}>{area}</Text></View>
              ))}
            </View>
            {rows.map((page) => (
              <UsageRow key={page.id} page={page} columns={columns} max={max} keepDocumentUrl={keepDocumentUrl} onOpen={onOpen} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * The Overview page (contract O), shown only when the catalog has usage data. **Components**: every
 * page that has a specimen as a card with a live thumbnail, grouped by home area, with area filter
 * chips and a "By area" / "Most used" sort. **Usage**: a table of components by area, with each
 * count shaded by how large it is. Both open a page like a sidebar link does. The tab and the
 * choices can be controlled (`CatalogShell` keeps them so Back returns to the same view); without
 * `tab`/`prefs` it keeps its own.
 */
export function Overview({
  sections,
  usage,
  browsable,
  tokenIds,
  defaultPreviewWidths,
  tab: tabProp,
  onTab,
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
  tab?: OverviewTab;
  onTab?: (tab: OverviewTab) => void;
  prefs?: OverviewPrefs;
  onPrefs?: (prefs: OverviewPrefs) => void;
  /** Opens a page, like a sidebar link. */
  onOpen?: (id: string) => void;
  headingRef?: React.Ref<View>;
  /** In an embedded shell a card's own link must not change the host page's address. */
  keepDocumentUrl?: boolean;
}) {
  const [localTab, setLocalTab] = useState<OverviewTab>('components');
  const [localPrefs, setLocalPrefs] = useState<OverviewPrefs>(DEFAULT_OVERVIEW_PREFS);
  const tab = tabProp ?? localTab;
  const setTab = onTab ?? setLocalTab;
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
      <OverviewTabs tab={tab} onTab={setTab} />
      <View nativeID={PANEL_ID} role="tabpanel" {...({ 'aria-labelledby': tabId(tab) } as Record<string, unknown>)}>
        {tab === 'usage' ? (
          <UsageTab pages={pages} areaOrder={areaOrder} prefs={prefs} onPrefs={setPrefs} keepDocumentUrl={keepDocumentUrl} onOpen={open} />
        ) : (
          <ComponentsTab pages={pages} areaOrder={areaOrder} prefs={prefs} onPrefs={setPrefs} keepDocumentUrl={keepDocumentUrl} onOpen={open} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headingTarget: { alignSelf: 'flex-start', marginBottom: 6 },
  title: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text },
  desc: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.lg },
  tabs: { flexDirection: 'row', gap: CATALOG_SPACE.xs, borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.borderHairline, marginBottom: CATALOG_SPACE.lg },
  tab: { minHeight: CATALOG_LAYOUT.controlSize, justifyContent: 'center', paddingHorizontal: CATALOG_SPACE.md, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: CATALOG_COLOR.accent },
  tabLabel: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.textMuted },
  tabLabelSelected: { color: CATALOG_COLOR.accent },
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
  cardTitle: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text },
  cardMeta: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  tag: { marginTop: CATALOG_SPACE.xs, paddingHorizontal: CATALOG_SPACE.sm, paddingVertical: 2, borderRadius: CATALOG_RADIUS.control, backgroundColor: CATALOG_COLOR.accentSubtle },
  tagText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
  tableScroll: { borderWidth: 1, borderColor: CATALOG_COLOR.borderHairline, borderRadius: CATALOG_RADIUS.md, backgroundColor: CATALOG_COLOR.surface },
  row: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: CATALOG_COLOR.borderSubtle },
  rowHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  headerRow: { borderTopWidth: 0, backgroundColor: CATALOG_COLOR.surfaceMuted },
  cell: { justifyContent: 'center', paddingVertical: CATALOG_SPACE.sm, paddingHorizontal: CATALOG_SPACE.md },
  // The Component column takes the room the area columns leave over, never less than its base width.
  componentCell: { flexGrow: 1, flexBasis: COMPONENT_COL, minWidth: COMPONENT_COL, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: CATALOG_SPACE.md },
  areasCell: { width: AREAS_COL, alignItems: 'center' },
  areaCell: { width: AREA_COL, alignItems: 'center' },
  rowLink: { flex: 1, minWidth: 0, minHeight: CATALOG_LAYOUT.controlSize, justifyContent: 'center', borderRadius: CATALOG_RADIUS.sm },
  headerText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.textMuted },
  areasCount: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text },
  heatChip: { width: HEAT_CHIP_WIDTH, height: HEAT_CHIP_HEIGHT, borderRadius: CATALOG_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  heatCount: { ...CATALOG_TEXT.bodyStrong },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing } as object,
});
