import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { ComparisonGrid } from './ComparisonGrid';
import { ComparisonGroups } from './ComparisonGroups';
import { ComparisonList } from './ComparisonList';
import { AppearsIn } from './AppearsIn';
import { PartsBlock } from './PartsBlock';
import { AnatomyBox } from './Anatomy';
import { PartNumbersContext, usePagePartNumbering } from './partNumbersContext';
import { anatomyPreviewWidth } from './familyModel';
import { partEntries } from './partsModel';
import { ReferenceDetails, ReferenceDetailsPanel } from './ReferenceDetails';
import { findUsage, type UsageData } from './usage';
import type { ReferenceNavigation } from './catalogReferences';
import { SpecimenSurface } from './SpecimenSurface';
import { SpecimenAddressProvider } from './SpecimenAddress';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import { TokenSections } from './TokenLayouts';
import { TokenDefinitionBlock } from './StructuredTokenPage';
import { MATRIX_LAYOUT, PREVIEW_CARD_CHROME, blockMinWidth, choosePlacement, presentationBlocks, type PlacementBlock, type PresentationBlock } from './comparison';
import type { CatalogMember, PreviewWidths, SectionDef, SpecimenSurfaceKind } from './types';

// Matches a quoted-string-literal union type, e.g. "'primary' | 'secondary' | 'tertiary'" — anything
// else (string, boolean, IconName, () => void, …) has no fixed enum to sweep and is skipped.
const STRING_LITERAL_RE = /'([^']+)'/g;

/** Opt-in completeness check (rule 4 of the policy documented on `SectionDef.states`): once a
 *  section has at least one `VariantExample.props`-tagged item, warn about any enum value from
 *  `def.props` that no tagged item (across Variants + States) actually demonstrates. Sections that
 *  haven't started tagging are skipped entirely — annotating is gradual, not all-or-nothing. */
function checkCompleteness<TId extends string>(def: SectionDef<TId>): void {
  if (!def.props) return;
  const items = [...(def.variants?.items ?? []), ...(def.states?.items ?? [])];
  const tagged = items.filter((item) => item.props);
  if (tagged.length === 0) return;

  for (const prop of def.props) {
    const literals = prop.type.match(STRING_LITERAL_RE);
    if (!literals || literals.length < 2) continue; // not a multi-value enum
    const values = literals.map((s) => s.slice(1, -1));
    const covered = new Set(
      tagged
        .map((item) => item.props?.[prop.name])
        .filter((v): v is string => typeof v === 'string'),
    );
    const missing = values.filter((v) => !covered.has(v));
    if (missing.length > 0) {
      console.warn(
        `[Catalog] ${def.id}: prop "${prop.name}" has no tagged example for value(s) ${missing.map((v) => `"${v}"`).join(', ')} — ` +
          `add { props: { ${prop.name}: '${missing[0]}' } } to whichever VariantExample already demonstrates it, or add a new one.`,
      );
    }
  }
}

export interface SectionPager<TId extends string> {
  previousId: TId | null;
  nextId: TId | null;
  onNavigate: (id: TId) => void;
  /** Display title for a page id, for the buttons' accessible names. */
  labelOf?: (id: TId) => string;
}

export function PagerButton<TId extends string>({
  direction,
  targetId,
  onNavigate,
  labelOf,
}: {
  direction: 'previous' | 'next';
  targetId: TId | null;
  onNavigate: (id: TId) => void;
  labelOf?: (id: TId) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const disabled = targetId == null;
  const label = disabled
    ? direction === 'previous' ? 'No previous page' : 'No next page'
    : `${direction === 'previous' ? 'Previous' : 'Next'}: ${labelOf ? labelOf(targetId) : targetId}`;
  return (
    <Pressable
      onPress={() => {
        if (targetId != null) onNavigate(targetId);
      }}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pagerButton,
        !disabled && (pressed || hovered) && styles.pagerButtonActive,
        focused && styles.focusRing,
        disabled && styles.pagerButtonDisabled,
      ]}
    >
      <Text style={[styles.pagerGlyph, disabled && styles.pagerGlyphDisabled]}>{direction === 'previous' ? '←' : '→'}</Text>
    </Pressable>
  );
}

/** Caption above each frame when a preview shows more than one width. */
function frameLabel(width: number): string {
  if (width >= 402) return `${width} · Default phone`;
  if (width <= 360) return `${width} · Small phone`;
  return `${width}px`;
}

/** A component preview: one frame per width (each at most phone width), or full width for catalog
 *  chrome and token galleries. Every frame is its own live instance with its own state. `surface`
 *  is omitted for token galleries, which keep their current, unstaged presentation. `layout: 'table'`
 *  (only ever set for a numeric-width preview — see `presentationBlocks`) renders `TablePreview`
 *  instead; omitted/`'frames'` keeps this exact, unchanged presentation. */
function Preview({ render, widths, surface, layout }: { render: () => React.ReactNode; widths: PreviewWidths; surface?: SpecimenSurfaceKind; layout?: 'table' }) {
  // Token galleries pass no surface: their card stays white.
  const kind = surface ?? 'transparent';
  if (widths === 'full') return <SpecimenSurface surface={kind} style={styles.previewCard}>{render()}</SpecimenSurface>;
  if (layout === 'table') return <TablePreview render={render} widths={widths} surface={kind} />;
  return (
    <SpecimenSurface surface={kind} style={styles.previewCard}>
      <View style={styles.frames}>
        {widths.map((width, i) => (
          <View
            key={`${width}-${i}`}
            // Two live instances of the same component: name each so assistive tech can tell them apart.
            {...(widths.length > 1 ? ({ role: 'group', 'aria-label': frameLabel(width) } as Record<string, unknown>) : null)}
            style={[styles.frame, { width }]}
          >
            {widths.length > 1 && <Text style={styles.frameLabel}>{frameLabel(width)}</Text>}
            {render()}
          </View>
        ))}
      </View>
    </SpecimenSurface>
  );
}

/** `layout: 'table'` presentation for a numeric-width Preview: every width shares ONE
 *  `ComparisonList`-style card (same caption typography, muted caption strip, border/radius/surface
 *  tokens) instead of each width getting its own bordered frame-card. Each width keeps its own
 *  caption strip directly above its own live body, in a single flex-wrapped row — one stable parent
 *  with keyed cells, so a viewport resize that wraps the row to stacked columns reflows in place
 *  rather than remounting any demo. A cell's body carries the same `MATRIX_LAYOUT.cellPadding`
 *  `ComparisonList`'s own cells use; the requested width instead reaches the demo untouched through
 *  an inner width-qualified viewport nested inside that padded body (capped only by
 *  `maxWidth: '100%'`, the same cap `Preview`'s own frames already use), so a cell's `flexBasis`
 *  reserving `width + 2 * cellPadding` leaves the padded body exactly enough room for it, with no
 *  blank trailing slack. The row's cells share 1px gutters (a `gap` on a bordered backing) for
 *  dividers, in both the side-by-side and stacked-wrap arrangements. */
function TablePreview({ render, widths, surface }: { render: () => React.ReactNode; widths: readonly number[]; surface: SpecimenSurfaceKind }) {
  return (
    <View style={styles.tableCard}>
      <View style={styles.tableRow}>
        {widths.map((width, i) => (
          <View key={`${width}-${i}`} style={[styles.tableCell, { flexBasis: width + 2 * MATRIX_LAYOUT.cellPadding }]}>
            <View style={styles.tableCaption}>
              <Text style={styles.tableCaptionText}>{frameLabel(width)}</Text>
            </View>
            <SpecimenSurface surface={surface} style={styles.tableBody}>
              <View role="group" aria-label={frameLabel(width)} style={[styles.tableBodyViewport, { width }]}>
                {render()}
              </View>
            </SpecimenSurface>
          </View>
        ))}
      </View>
    </View>
  );
}

function BlockContent<TId extends string>({
  block, def, surface, focusSectionId, focusNonce,
}: {
  block: PresentationBlock;
  def: SectionDef<TId>;
  surface: SpecimenSurfaceKind;
  /** #64 B5: a tokenDefinition page's own section to scroll into view on arrival (a section-alias
   *  route) — only ever consumed by the 'tokenSections' case below; every other block kind ignores
   *  it. */
  focusSectionId?: string;
  focusNonce?: number;
}) {
  switch (block.kind) {
    case 'grid':
      return <ComparisonGrid def={block.comparison} size={block.size} sectionId={def.id} surface={surface} />;
    case 'grouped':
      return <ComparisonGroups groups={block.groups} size={block.size} label={def.id} surface={surface} pageId={def.id} />;
    case 'list':
      return <ComparisonList items={block.items} size={block.size} label={`${def.id}: ${block.title}`} maxColumns={block.maxColumns} surface={surface} pageId={def.id} />;
    case 'preview':
      // A token gallery's `preview` block shows full-width raw token data, not a component
      // specimen — it keeps its current, unstaged presentation.
      // `Preview`'s own `widths === 'full'` check already excludes a full-width or token-gallery
      // preview from ever reaching the table layout, regardless of `def.previewLayout`.
      return def.render ? (
        <SpecimenAddressProvider address={{ pageId: def.id, slot: 'preview', itemKey: 'preview' }}>
          <Preview render={def.render} widths={block.widths} surface={def.tokenGallery ? undefined : surface} layout={def.previewLayout === 'table' ? 'table' : undefined} />
        </SpecimenAddressProvider>
      ) : null;
    case 'tokenSections': {
      // #61: a page's own `tokenDefinition` (when set) carries the real entry data —
      // `buildCatalogSections` only ever derives `block.sections` from it as placeholder geometry
      // (`render: () => null`), so the real rendering happens here instead, at this file's own
      // existing JSX boundary. #64 B2/B5: `TokenDefinitionBlock` additionally renders the jump row
      // and consumes a pending section arrival; a legacy `tokenSections` page (no `tokenDefinition`)
      // keeps the plain `TokenSections` rendering, unchanged.
      if (def.tokenDefinition) {
        return <TokenDefinitionBlock definition={def.tokenDefinition} columns={block.columns} label={def.id} focusSectionId={focusSectionId} focusNonce={focusNonce} />;
      }
      return <TokenSections sections={block.sections} columns={block.columns} label={def.id} />;
    }
    default:
      return (
        <View style={styles.previewCard}>
          <Text style={styles.emptyText}>{block.message}</Text>
        </View>
      );
  }
}

/** Width a block's card occupies: lists hug their columns; everything else fills the row. */


/** What `choosePlacement` needs about a block: how narrow it can get, and (for a list) the geometry
 *  that predicts its height in half a row. */
function placementBlock(block: PresentationBlock, height: number): PlacementBlock {
  const base = { kind: block.kind, height, minWidth: blockMinWidth(block) };
  return block.kind === 'list' ? { ...base, itemCount: block.items.length, size: block.size, maxColumns: block.maxColumns } : base;
}

/**
 * The page's specimen blocks, stacked or side by side. Starts stacked, records each block's stacked
 * height, then moves to side by side only when choosePlacement says it saves real height. Heights
 * are never recorded while side by side, so the decision never feeds on its own result; a width
 * change returns to stacked and decides again.
 */
/** The previous/next pager buttons, in their row — shared by `SectionBlock` and `FamilyPage` so a
 *  family page's own page head gets the same pager chrome as every other page. */
export function SectionPagerRow<TId extends string>({ pager }: { pager: SectionPager<TId> }) {
  return (
    <View style={styles.pager}>
      <PagerButton direction="previous" targetId={pager.previousId} onNavigate={pager.onNavigate} labelOf={pager.labelOf} />
      <PagerButton direction="next" targetId={pager.nextId} onNavigate={pager.onNavigate} labelOf={pager.labelOf} />
    </View>
  );
}

/** The page's specimen blocks (grid, grouped rows, list, or preview), stacked or side by side —
 *  exported so `FamilyPage` can render a member's own specimens through the exact same placement
 *  logic a normal page's blocks use, rather than a second copy of it. */
export function Blocks<TId extends string>({
  blocks,
  def,
  surface,
  showLabels = true,
  trimOuterMargin = false,
  focusSectionId,
  focusNonce,
}: {
  blocks: PresentationBlock[];
  def: SectionDef<TId>;
  surface: SpecimenSurfaceKind;
  /** V2b item 4: a family member's own specimens render with no uppercase "Variants" / "States /
   *  configurations" block label — v8 has none inside a member block. A page's own `SectionBlock`
   *  keeps its labels (the default, unchanged). */
  showLabels?: boolean;
  /** V2b item 5: drops this component's own page-level `marginBottom` — `FamilyPage`'s own
   *  wrapper (`memberSpecimens`) supplies the exact spacing a member block needs instead, so the
   *  two never double-stack. A page's own `SectionBlock` keeps the margin (the default,
   *  unchanged). */
  trimOuterMargin?: boolean;
  /** #64 B5: forwarded to `BlockContent`'s own 'tokenSections' case only — every other block kind
   *  ignores it. */
  focusSectionId?: string;
  focusNonce?: number;
}) {
  const [available, setAvailable] = useState(0);
  const [heights, setHeights] = useState<number[]>([]);
  const [placement, setPlacement] = useState<'side' | 'stacked'>('stacked');

  const onContainerLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width <= 0 || width === available) return;
    // Keep recorded heights: they are only taken while stacked, and blocks often report before the
    // container does. A new width returns to stacked so the decision is made again.
    setAvailable(width);
    setPlacement('stacked');
  };
  const onBlockLayout = (index: number) => (event: LayoutChangeEvent) => {
    if (placement !== 'stacked' || blocks.length !== 2) return;
    const height = Math.round(event.nativeEvent.layout.height);
    setHeights((prev: number[]) => {
      if (prev[index] === height) return prev;
      const next = [...prev];
      next[index] = height;
      return next;
    });
  };

  // Decide once both stacked heights are known for the current width.
  useEffect(() => {
    if (placement !== 'stacked' || blocks.length !== 2 || available <= 0 || !heights[0] || !heights[1]) return;
    const [first, second] = blocks;
    const decision = choosePlacement({
      available,
      gap: CATALOG_LAYOUT.blockGap,
      first: placementBlock(first, heights[0]),
      second: placementBlock(second, heights[1]),
    });
    if (decision === 'side') setPlacement('side');
  }, [available, blocks, heights, placement]);

  const side = placement === 'side';
  return (
    <View onLayout={onContainerLayout} style={[styles.blocks, side && styles.blocksSide, trimOuterMargin && styles.blocksNoMargin]}>
      {blocks.map((block, i) => (
        <View
          // A4: keyed by index, not `block.title || block.kind` — a member that sets the same
          // `axis` on both `variants` and `states` now produces two blocks with identical titles,
          // which would otherwise collide as React keys (as the family-section list already keys
          // by index for the same reason — FamilyPage.tsx).
          key={`${block.kind}-${i}`}
          onLayout={onBlockLayout(i)}
          // Side by side, each block fills its own half: a card always fills the column it is given.
          style={side ? styles.blockFill : undefined}
        >
          {/* A3: `axis` now reaches grid/grouped blocks too (not only list), so any block kind
              carrying one shows its (already informative) title on a family page, which otherwise
              hides every generic block label via `showLabels={false}`. */}
          {(showLabels && block.title) || ('axis' in block && block.axis) ? <Text style={styles.blockLabel}>{('axis' in block && block.axis) || block.title}</Text> : null}
          <BlockContent block={block} def={def} surface={surface} focusSectionId={focusSectionId} focusNonce={focusNonce} />
        </View>
      ))}
    </View>
  );
}

/**
 * One catalog page: breadcrumb, title, description, previous/next, then one or two specimen
 * blocks (grid, grouped rows, list, or preview), stacked or side by side, then always-visible
 * reference details (inline Quick reference for token galleries; behind a "Notes and API" side panel otherwise). Works standalone without a pager
 * inside a host page, as the framework catalog's own SectionBlock demo does.
 */
export function SectionBlock<TId extends string>({
  def,
  groupLabel,
  breadcrumbRoot,
  banner,
  pager,
  headingRef,
  headingLevel = 1,
  defaultPreviewWidths,
  navigation,
  focusSectionId,
  focusNonce,
  usage,
}: {
  def: SectionDef<TId>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  /** The major-update banner (`CatalogShell`'s own `MajorBanner`), rendered between the breadcrumb
   *  and the title — the approved mockup's own `PAGE_BG` order: crumb, then banner, then title. */
  banner?: React.ReactNode;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  headingLevel?: 1 | 2;
  /** Preview widths for pages without `previewWidths` (CatalogShell passes its catalog default). */
  defaultPreviewWidths?: PreviewWidths;
  /** Task 2B2: `CatalogShell`'s own shared reference navigation, passed straight through to
   *  `ReferenceDetails` so a resolvable Composition name becomes a real canonical link. Omitted for
   *  a standalone-mounted `SectionBlock` (this framework's own catalog demo included), which then
   *  keeps its prior, unlinked rendering — see `ReferenceDetails`'s own doc comment. */
  navigation?: ReferenceNavigation<TId>;
  /** #64 B5: a tokenDefinition page's own section to scroll into view on arrival — set by
   *  `CatalogShell` from `resolveRoute`'s own `sectionId` (a section-alias route). Omitted for a
   *  standalone-mounted `SectionBlock`, which then never auto-scrolls to a section. */
  focusSectionId?: string;
  /** Bumped by `CatalogShell` on every activation, even a repeat one — the same
   *  `focusMemberId`/`focusNonce` convention `FamilyPage` already uses. */
  focusNonce?: number;
  /** The project's usage data (`CatalogShell`'s `usage`). With an entry for this page's id or
   *  component, an "Appears in" block follows the specimens. Omitted: no block. */
  usage?: UsageData | null;
}) {
  checkCompleteness(def);
  // Memoized so Blocks' placement effect runs on real changes, not on every render.
  const blocks = useMemo(() => presentationBlocks(def, { defaultPreviewWidths }), [def, defaultPreviewWidths]);
  const surface = def.specimenSurface ?? DEFAULT_SPECIMEN_SURFACE;
  const parts = useMemo(() => partEntries([{ composedOf: def.composedOf }], (name) => name === def.id || name === def.component), [def]);
  // A standalone page has no members, so its numbered parts are the used components only: anatomy
  // `other` items first, then Parts-only entries, from 1.
  const partNumbers = usePagePartNumbering(1, [def.anatomy], parts, navigation);
  // react-native-web reads `aria-level`; React Native's prop types do not declare it.
  const headingLevelProps = { 'aria-level': headingLevel } as Record<string, unknown>;

  return (
    <PartNumbersContext.Provider value={partNumbers}>
    <View>
      {groupLabel && (
        <Text style={styles.breadcrumb}>{breadcrumbRoot ? `${breadcrumbRoot} / ${groupLabel}` : groupLabel}</Text>
      )}
      {banner}
      <View style={styles.titlebar}>
        <View style={styles.titleText}>
          {/* The focus target is the heading itself, so assistive tech announces its role and level. */}
          <View ref={headingRef} tabIndex={-1} role="heading" {...headingLevelProps} style={styles.headingTarget}>
            <Text style={styles.title}>{def.title ?? def.id}</Text>
          </View>
          {def.osComponent && (
            <View style={styles.osBadge}>
              <Text style={styles.osBadgeText}>{def.osComponent === 'full' ? 'OS component' : 'Partly OS component'}</Text>
            </View>
          )}
          <Text style={styles.desc}>{def.description}</Text>
        </View>
        {pager && <SectionPagerRow pager={pager} />}
      </View>

      {/* The first box after the page head, as on a family page: the same anatomy box and legend. */}
      {def.anatomy && <AnatomyBox anatomy={def.anatomy} byId={NO_MEMBERS} outline={NO_OUTLINE} resolvesAddress={NEVER_RESOLVES} navigation={navigation} previewWidth={anatomyPreviewWidth(def.previewWidths ?? defaultPreviewWidths)} />}

      {blocks.length > 0 && <Blocks blocks={blocks} def={def} surface={surface} focusSectionId={focusSectionId} focusNonce={focusNonce} />}

      <PartsBlock parts={parts} navigation={navigation} />

      <AppearsIn entry={findUsage(usage, [def.id, def.component])} />

      {/* Token galleries keep their short Quick reference inline; every other page's reference
          details live in the side panel behind "Notes and API". */}
      {def.tokenGallery ? <ReferenceDetails def={def} navigation={navigation} /> : <ReferenceDetailsPanel def={def} navigation={navigation} />}
    </View>
    </PartNumbersContext.Provider>
  );
}

// A standalone page's anatomy has no members of its own: nothing to look up, and a name links only
// through `navigation`.
const NO_MEMBERS = new Map<string, Pick<CatalogMember, 'fidelity'>>();
const NO_OUTLINE = new Map<string, { number: string; level: number }>();
const NEVER_RESOLVES = () => false;

const styles = StyleSheet.create({
  breadcrumb: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  titlebar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: CATALOG_SPACE.xl,
    marginTop: 14,
    marginBottom: CATALOG_SPACE.xl,
  },
  titleText: { flex: 1 },
  headingTarget: { alignSelf: 'flex-start' },
  osBadge: {
    alignSelf: 'flex-start',
    marginBottom: CATALOG_SPACE.sm,
    paddingHorizontal: CATALOG_SPACE.sm,
    paddingVertical: 3,
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  osBadgeText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.text },
  // `wordBreak` isn't declared on React Native's own `TextStyle` (react-native-web's own
  // `Text/types.js` declares it; a browser applies any valid CSS property name it recognizes
  // regardless — same caveat ReferenceDetails.tsx's own `mono` style documents), so this is cast
  // the same way. Without it, an unbroken page title (a component identifier with no spaces,
  // e.g. `TranscriptVideoPreviewPlayerView`) has no space for the browser's default line-breaking
  // to use: it stays one unbroken run at its full intrinsic width — wide enough to push past
  // `titleText`'s own column and into the pager — instead of wrapping inside the column like any
  // title with spaces already does.
  title: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text, marginBottom: 5, wordBreak: 'break-word' } as TextStyle,
  desc: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  pager: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  pagerButton: {
    width: CATALOG_LAYOUT.controlSize,
    height: CATALOG_LAYOUT.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  pagerButtonActive: { backgroundColor: CATALOG_COLOR.surfacePressed },
  pagerButtonDisabled: { backgroundColor: CATALOG_COLOR.pageBackground },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  pagerGlyph: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.text },
  pagerGlyphDisabled: { color: CATALOG_COLOR.textMuted },
  blocks: { gap: CATALOG_LAYOUT.blockGap, marginBottom: CATALOG_LAYOUT.blockGap },
  blocksNoMargin: { marginBottom: 0 },
  blocksSide: { flexDirection: 'row', alignItems: 'flex-start' },
  blockFill: { flex: 1, minWidth: 0 },
  // Centred in the card, like every other example (a single phone-width frame used to sit left).
  frames: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.xl, alignItems: 'flex-start', justifyContent: 'center' },
  frame: { maxWidth: '100%', gap: CATALOG_SPACE.sm },
  frameLabel: {
    ...CATALOG_TEXT.label,
    color: CATALOG_COLOR.textMuted,
  },
  blockLabel: {
    ...CATALOG_TEXT.label,
    color: CATALOG_COLOR.text,
    marginBottom: CATALOG_LAYOUT.blockLabelGap,
  },
  previewCard: {
    backgroundColor: CATALOG_COLOR.surface,
    // From comparison.ts, which adds the same numbers to a preview's minimum width.
    borderWidth: PREVIEW_CARD_CHROME.border,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    padding: PREVIEW_CARD_CHROME.padding,
    gap: CATALOG_SPACE.md,
  },
  // `ComparisonList`'s own card/caption tokens, reused so a 'table' preview reads as the same shared
  // surface — no outer `previewCard` padding/chrome around it (that card provides its own).
  tableCard: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    overflow: 'hidden',
  },
  // 1px gutters between cells: a gap over a bordered backing, so dividers read correctly whether
  // cells sit side by side or wrap into stacked rows.
  tableRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: CATALOG_COLOR.border },
  tableCell: { backgroundColor: CATALOG_COLOR.surface, flexGrow: 1, minWidth: 0, maxWidth: '100%' },
  tableCaption: {
    padding: MATRIX_LAYOUT.cellPadding,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.border,
  },
  tableCaptionText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  // Same cell padding `ComparisonList` uses: the requested width instead reaches the live demo
  // untouched through `tableBodyViewport`, the inner width-qualified group nested inside this body.
  tableBody: { padding: MATRIX_LAYOUT.cellPadding, flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start' },
  tableBodyViewport: { maxWidth: '100%' },
  emptyText: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
});
