import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { ComparisonGrid } from './ComparisonGrid';
import { ComparisonGroups } from './ComparisonGroups';
import { ComparisonList } from './ComparisonList';
import { ReferenceDetails } from './ReferenceDetails';
import { SpecimenSurface } from './SpecimenSurface';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import { TokenSections } from './TokenLayouts';
import { choosePlacement, listGeometry, presentationBlocks, type PresentationBlock } from './comparison';
import type { PreviewWidths, SectionDef, SpecimenSurfaceKind } from './types';

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

function PagerButton<TId extends string>({
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
 *  is omitted for token galleries, which keep their current, unstaged presentation. */
function Preview({ render, widths, surface }: { render: () => React.ReactNode; widths: PreviewWidths; surface?: SpecimenSurfaceKind }) {
  const stage = (node: React.ReactNode) => (surface ? <SpecimenSurface surface={surface}>{node}</SpecimenSurface> : node);
  if (widths === 'full') return <View style={styles.previewCard}>{stage(render())}</View>;
  return (
    <View style={styles.previewCard}>
      <View style={styles.frames}>
        {widths.map((width, i) => (
          <View
            key={`${width}-${i}`}
            // Two live instances of the same component: name each so assistive tech can tell them apart.
            {...(widths.length > 1 ? ({ role: 'group', 'aria-label': frameLabel(width) } as Record<string, unknown>) : null)}
            style={[styles.frame, { width }]}
          >
            {widths.length > 1 && <Text style={styles.frameLabel}>{frameLabel(width)}</Text>}
            {stage(render())}
          </View>
        ))}
      </View>
    </View>
  );
}

function BlockContent<TId extends string>({ block, def, surface }: { block: PresentationBlock; def: SectionDef<TId>; surface: SpecimenSurfaceKind }) {
  switch (block.kind) {
    case 'grid':
      return <ComparisonGrid def={block.comparison} size={block.size} sectionId={def.id} surface={surface} />;
    case 'grouped':
      return <ComparisonGroups groups={block.groups} size={block.size} label={def.id} surface={surface} />;
    case 'list':
      return <ComparisonList items={block.items} size={block.size} label={`${def.id}: ${block.title}`} maxColumns={block.maxColumns} surface={surface} />;
    case 'preview':
      // A token gallery's `preview` block shows full-width raw token data, not a component
      // specimen — it keeps its current, unstaged presentation.
      return def.render ? <Preview render={def.render} widths={block.widths} surface={def.tokenGallery ? undefined : surface} /> : null;
    case 'tokenSections':
      return <TokenSections sections={block.sections} columns={block.columns} />;
    default:
      return (
        <View style={styles.previewCard}>
          <Text style={styles.emptyText}>{block.message}</Text>
        </View>
      );
  }
}

/** Width a block's card occupies: lists hug their columns; everything else fills the row. */
function blockWidth(block: PresentationBlock, available: number): number {
  return block.kind === 'list' ? listGeometry(block.items.length, available, block.size, block.maxColumns).containerWidth : available;
}

/**
 * The page's specimen blocks, stacked or side by side. Starts stacked, records each block's stacked
 * height, then moves to side by side only when choosePlacement says it saves real height. Heights
 * are never recorded while side by side, so the decision never feeds on its own result; a width
 * change returns to stacked and decides again.
 */
function Blocks<TId extends string>({ blocks, def, surface }: { blocks: PresentationBlock[]; def: SectionDef<TId>; surface: SpecimenSurfaceKind }) {
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
      first: { kind: first.kind, width: blockWidth(first, available), height: heights[0] },
      second: second.kind === 'list'
        ? { kind: 'list', height: heights[1], itemCount: second.items.length, size: second.size, maxColumns: second.maxColumns }
        : { kind: second.kind, height: heights[1] },
    });
    if (decision === 'side') setPlacement('side');
  }, [available, blocks, heights, placement]);

  const side = placement === 'side';
  return (
    <View onLayout={onContainerLayout} style={[styles.blocks, side && styles.blocksSide]}>
      {blocks.map((block, i) => (
        <View
          key={block.title || block.kind}
          onLayout={onBlockLayout(i)}
          style={side ? (i === 0 ? { width: blockWidth(block, available), flexShrink: 0 } : styles.blockFill) : undefined}
        >
          {block.title ? <Text style={styles.blockLabel}>{block.title}</Text> : null}
          <BlockContent block={block} def={def} surface={surface} />
        </View>
      ))}
    </View>
  );
}

/**
 * One catalog page: breadcrumb, title, description, previous/next, then one or two specimen
 * blocks (grid, grouped rows, list, or preview), stacked or side by side, then always-visible
 * reference details (Quick reference only for token galleries). Works standalone without a pager
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
}) {
  checkCompleteness(def);
  // Memoized so Blocks' placement effect runs on real changes, not on every render.
  const blocks = useMemo(() => presentationBlocks(def, { defaultPreviewWidths }), [def, defaultPreviewWidths]);
  const surface = def.specimenSurface ?? DEFAULT_SPECIMEN_SURFACE;
  // react-native-web reads `aria-level`; React Native's prop types do not declare it.
  const headingLevelProps = { 'aria-level': headingLevel } as Record<string, unknown>;

  return (
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
        {pager && (
          <View style={styles.pager}>
            <PagerButton direction="previous" targetId={pager.previousId} onNavigate={pager.onNavigate} labelOf={pager.labelOf} />
            <PagerButton direction="next" targetId={pager.nextId} onNavigate={pager.onNavigate} labelOf={pager.labelOf} />
          </View>
        )}
      </View>

      {blocks.length > 0 && <Blocks blocks={blocks} def={def} surface={surface} />}

      <ReferenceDetails def={def} />
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
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
  osBadgeText: { fontSize: CATALOG_TYPE.xs, fontWeight: '700', letterSpacing: 0.4, color: CATALOG_COLOR.text },
  title: { fontSize: CATALOG_TYPE.pageTitle, fontWeight: '700', color: CATALOG_COLOR.text, marginBottom: 5 },
  desc: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
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
  pagerGlyph: { fontSize: CATALOG_TYPE.lg, color: CATALOG_COLOR.text },
  pagerGlyphDisabled: { color: CATALOG_COLOR.textMuted },
  blocks: { gap: CATALOG_LAYOUT.blockGap, marginBottom: CATALOG_LAYOUT.blockGap },
  blocksSide: { flexDirection: 'row', alignItems: 'flex-start' },
  blockFill: { flex: 1, minWidth: 0 },
  frames: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.xl, alignItems: 'flex-start' },
  frame: { maxWidth: '100%', gap: CATALOG_SPACE.sm },
  frameLabel: {
    fontSize: CATALOG_TYPE.tableHeader,
    fontWeight: '800',
    letterSpacing: 0.44,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.textMuted,
  },
  blockLabel: {
    fontSize: CATALOG_TYPE.sm,
    fontWeight: '700',
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginBottom: CATALOG_LAYOUT.blockLabelGap,
  },
  previewCard: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    padding: CATALOG_SPACE.xl,
    gap: CATALOG_SPACE.md,
  },
  emptyText: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
