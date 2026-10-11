/**
 * Pure page-layout logic for catalog specimens — no React or React Native runtime imports, so it
 * runs under Node's test runner. A page shows its specimens in one of four layouts:
 *   • grid    — two props that combine freely (rows × columns table);
 *   • grouped — one row per variant holding that variant's own configurations;
 *   • list    — one axis, in ONE shared card whose cells wrap into balanced rows;
 *   • preview — free-form content: component demos at phone width, token galleries at full width.
 * It also decides whether two blocks sit side by side (choosePlacement) and how many columns the
 * Props box uses (propsColumns). ComparisonGrid, ComparisonGroups, and ComparisonList render it.
 */
import type {
  ComparisonAxisItem, ComparisonDef, GridAxis, PreviewWidths, SectionDef, SpecimenAlign, SpecimenSize, SpecimenSurfaceKind, TokenSection, VariantSlot,
} from './types.ts';
import type React from 'react';

/** Approved geometry. `cellPadding` equals CATALOG_SPACE.lg (asserted in tests). The laptop
 *  content width is a 1280px viewport minus the 264px sidebar and 32px side padding. */
export const MATRIX_LAYOUT = {
  rowHeaderWidth: 120,
  columnMaxWidth: 402,
  cellPadding: 16,
  rowMinHeight: 150,
  laptopContentWidth: 952,
} as const;

/** Component previews never render wider than a phone. */
export const PREVIEW_MAX_WIDTH = 402;

/** Two blocks share a row only when that saves at least this much page height. */
export const PLACEMENT_MIN_SAVING = 120;

/** A Props column is never narrower than this; below it the Props box uses one column. */
export const PROPS_MIN_COLUMN_WIDTH = 360;

/** Gap between the two Props columns (CATALOG_SPACE['2xl']). */
export const PROPS_COLUMN_GAP = 32;

/** A reference column (Guidance, Quick reference, or Composition) is never narrower than this;
 *  below it, `referenceColumns` drops to fewer columns. */
export const REFERENCE_MIN_COLUMN_WIDTH = 280;

/** Gap between reference columns (CATALOG_SPACE['2xl'], the same token the card's columns already
 *  use). */
export const REFERENCE_COLUMN_GAP = 32;

/** Smallest column or cell width per specimen size. Wide specimens are fixed at phone width. */
export const COLUMN_MIN_WIDTH: Record<SpecimenSize, number> = { compact: 160, regular: 240, wide: 402 };

/** `Array.isArray`'s built-in type guard narrows to a mutable `any[]`, which a `readonly T[]`
 *  union member is never assignable to — so the `else` branch of `Array.isArray(axis) ? ... :
 *  ...` keeps `axis`'s full union type instead of narrowing away the array member. This explicit
 *  predicate sidesteps that (never caught before Task 4: this file had never been typechecked by
 *  `tsc` until `cli/doctor.ts`'s import pulled it into the root `tsconfig.json`'s program). */
function isBoundAxis(axis: GridAxis): axis is { prop: string; items: readonly ComparisonAxisItem[] } {
  return !Array.isArray(axis);
}

/** A `GridAxis`'s own items, whether it's a plain array or bound to a prop — every reader of
 *  `ComparisonDef.rows`/`columns` goes through this (never `Array.isArray` directly), so a future
 *  third axis shape only needs to change this one function. */
export function axisItems(axis: GridAxis): ComparisonAxisItem[] {
  return isBoundAxis(axis) ? [...axis.items] : [...axis];
}

/** The prop name a `GridAxis` is bound to, or undefined for a plain, unbound axis. */
export function axisProp(axis: GridAxis): string | undefined {
  return isBoundAxis(axis) ? axis.prop : undefined;
}

/**
 * Shared page-authoring helper (design §1 "Page shape", §4 "Binding examples to props"). Every
 * grid comparison in the starter kit builds its `ComparisonDef` with this instead of its own local
 * copy, so `cli/staticPage.ts`'s static reader has exactly one call shape to recognize anywhere a
 * page's `comparison` field is produced by a function call rather than written as a plain object
 * literal. `rows`/`columns` accept either a plain item array (unbound) or `{ prop, items }` (bound)
 * — the cell grid itself is unaffected either way, since cells are always keyed by each axis's own
 * items regardless of whether that axis names a prop. Lives here, beside `axisItems`/`axisProp`,
 * rather than in its own `grid.ts` — every other file in this module has only *type-only* relative
 * imports; a bare, no-extension value import would be the first of its kind in `native/catalog`.
 *
 * Each cell is a real instance with exactly the props its row and column name. Never build these by
 * multiplying `variants` with `states` — those are pre-rendered nodes and cannot be combined.
 */
export function grid(
  rowLabel: string,
  columnLabel: string,
  rows: GridAxis,
  columns: GridAxis,
  cell: (row: string, column: string) => React.ReactNode,
  size?: SpecimenSize,
): ComparisonDef {
  const rowItems = axisItems(rows);
  const columnItems = axisItems(columns);
  return {
    rowLabel,
    columnLabel,
    rows,
    columns,
    cells: rowItems.flatMap((row) => columnItems.map((column) => ({ rowKey: row.key, columnKey: column.key, node: cell(row.key, column.key) }))),
    size,
  };
}

/** How many grid columns fit beside the row header on a 1280px laptop without scrolling. */
export function gridColumnLimit(size: SpecimenSize): number {
  return Math.floor((MATRIX_LAYOUT.laptopContentWidth - MATRIX_LAYOUT.rowHeaderWidth) / COLUMN_MIN_WIDTH[size]);
}

export function gridWidthBounds(columnCount: number, size: SpecimenSize): { minWidth: number; maxWidth: number } {
  const n = Math.max(0, columnCount);
  return {
    minWidth: MATRIX_LAYOUT.rowHeaderWidth + n * COLUMN_MIN_WIDTH[size],
    maxWidth: MATRIX_LAYOUT.rowHeaderWidth + n * MATRIX_LAYOUT.columnMaxWidth,
  };
}

export interface ListGeometry {
  columns: number;
  rows: number;
  fillers: number;
  cellWidth: number;
  containerWidth: number;
}

/** Balanced wrapping for a one-axis list inside a single bordered card (1px outer border). Each
 *  cell's 1px divider sits inside its own width, so no cell is ever wider than 402px. Uses as few
 *  rows as fit, then spreads items evenly across them so a short last row leaves as little empty
 *  space as possible. `fillers` blank cells complete the last row. `columnCap` (from
 *  `VariantSlot.maxColumns`) only ever lowers the natural, width-based column count — a narrow
 *  container still drops below it when it has to, so the cap can never widen a row past what the
 *  available width actually fits. */
export function listGeometry(itemCount: number, availableWidth: number, size: SpecimenSize, columnCap?: number): ListGeometry {
  if (itemCount <= 0) return { columns: 0, rows: 0, fillers: 0, cellWidth: 0, containerWidth: 0 };
  const inner = Math.max(0, availableWidth - 2);
  const min = COLUMN_MIN_WIDTH[size];
  const widthLimit = Math.floor(inner / min);
  const limit = columnCap !== undefined ? Math.min(widthLimit, columnCap) : widthLimit;
  const maxColumns = Math.max(1, Math.min(itemCount, limit));
  const rows = Math.ceil(itemCount / maxColumns);
  const columns = Math.ceil(itemCount / rows);
  const fitted = Math.floor(inner / columns);
  const cellWidth = size === 'wide' ? MATRIX_LAYOUT.columnMaxWidth : Math.max(min, Math.min(MATRIX_LAYOUT.columnMaxWidth, fitted));
  return {
    columns,
    rows,
    fillers: rows * columns - itemCount,
    cellWidth,
    containerWidth: columns * cellWidth + 2,
  };
}

export function cellKey(rowKey: string, columnKey: string): string {
  return `${rowKey}\u0000${columnKey}`;
}

export function indexCells(def: ComparisonDef): Map<string, ComparisonDef['cells'][number]> {
  const index = new Map<string, ComparisonDef['cells'][number]>();
  for (const cell of def.cells) {
    const key = cellKey(cell.rowKey, cell.columnKey);
    if (!index.has(key)) index.set(key, cell);
  }
  return index;
}

/** Human-readable problems in a stable order: axis duplicates, column fit, each cell in
 *  declaration order, then missing coordinates in row-major order. Empty when valid. */
export function validateComparison(def: ComparisonDef): string[] {
  const rowItems = axisItems(def.rows);
  const columnItems = axisItems(def.columns);
  if (rowItems.length === 0 || columnItems.length === 0) {
    return ['Comparison needs at least one row and one column.'];
  }
  const issues: string[] = [];
  const rowKeys = new Set<string>();
  for (const row of rowItems) {
    if (rowKeys.has(row.key)) issues.push(`Duplicate row key "${row.key}".`);
    rowKeys.add(row.key);
  }
  const columnKeys = new Set<string>();
  for (const column of columnItems) {
    if (columnKeys.has(column.key)) issues.push(`Duplicate column key "${column.key}".`);
    columnKeys.add(column.key);
  }
  const size = def.size ?? 'regular';
  const limit = gridColumnLimit(size);
  if (columnKeys.size > limit) {
    issues.push(`Grid has ${columnKeys.size} columns; at most ${limit} ${size} columns fit a 1280px laptop. Swap the axes or use two lists.`);
  }
  const seen = new Set<string>();
  for (const cell of def.cells) {
    const key = cellKey(cell.rowKey, cell.columnKey);
    if (seen.has(key)) {
      issues.push(`Duplicate cell for row "${cell.rowKey}" and column "${cell.columnKey}".`);
      continue;
    }
    seen.add(key);
    if (!rowKeys.has(cell.rowKey)) {
      issues.push(`Cell references undeclared row "${cell.rowKey}".`);
      continue;
    }
    if (!columnKeys.has(cell.columnKey)) {
      issues.push(`Cell references undeclared column "${cell.columnKey}".`);
      continue;
    }
    const hasNode = cell.node !== undefined;
    const hasReason = typeof cell.unavailableReason === 'string' && cell.unavailableReason.length > 0;
    if (hasNode === hasReason) {
      issues.push(`Cell for row "${cell.rowKey}" and column "${cell.columnKey}" must provide exactly one of node or unavailableReason.`);
    }
  }
  for (const rowKey of rowKeys) {
    for (const columnKey of columnKeys) {
      if (!seen.has(cellKey(rowKey, columnKey))) {
        issues.push(`Missing cell for row "${rowKey}" and column "${columnKey}".`);
      }
    }
  }
  return issues;
}

/** `states` minus items whose key is already a grid row or column. */
export function remainingStates(states: VariantSlot | undefined, comparison: ComparisonDef | undefined): VariantSlot | undefined {
  if (!states) return undefined;
  if (!comparison) return states;
  const covered = new Set([...axisItems(comparison.rows).map((row) => row.key), ...axisItems(comparison.columns).map((column) => column.key)]);
  const items = states.items.filter((item) => !covered.has(item.key));
  return items.length > 0 ? { ...states, items } : undefined;
}

export interface ListItem {
  key: string;
  /** Which authored slot this item came from, so a device frame inside it can address it
   *  (`overlayViewport.ts`). */
  slot?: 'variants' | 'states';
  label: string;
  node: unknown;
  fill?: boolean;
  /** This item's own `specimenSurface` override — see `SpecimenPresentation`. Omit to inherit the
   *  surface already in effect (the slot's/page's `specimenSurface`, else `'auto'`). */
  surface?: SpecimenSurfaceKind;
  /** This item's own cross-axis alignment override — see `SpecimenPresentation.align`. Omit to
   *  inherit the established default (centered, or stretched when `fill` is set). */
  align?: SpecimenAlign;
}

export interface ListGroup {
  key: string;
  label: string;
  items: ListItem[];
}

export type PresentationBlock =
  | { kind: 'grid'; title: string; size: SpecimenSize; comparison: ComparisonDef }
  | { kind: 'grouped'; title: string; size: SpecimenSize; groups: ListGroup[] }
  | { kind: 'list'; title: string; size: SpecimenSize; items: ListItem[]; maxColumns?: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'preview'; title: string; widths: PreviewWidths }
  | { kind: 'tokenSections'; title: string; sections: TokenSection[]; columns: 1 | 2 | 3 }
  | { kind: 'empty'; title: string; message: string };

export interface PresentationOptions {
  /** Preview widths for component pages that do not set `previewWidths`. Default: one phone width. */
  defaultPreviewWidths?: PreviewWidths;
}

/** Specimen size for a one-axis slot: the section's explicit size, else wide for full-width
 *  (itemsFill) slots, else regular. */
export function slotSize<TId extends string>(def: SectionDef<TId>, slot: VariantSlot): SpecimenSize {
  return def.specimenSize ?? (slot.itemsFill ? 'wide' : 'regular');
}

/** Full-width (filled) examples are block components (cards, banners, rows): narrower than about a
 *  third of a laptop's content width they stop reading as themselves, so they wrap at most 3
 *  across unless the page sets its own `maxColumns`. Small centred examples wrap freely. */
export const FILLED_SLOT_MAX_COLUMNS = 3;

function slotColumnCap(slot: VariantSlot): { maxColumns?: 1 | 2 | 3 | 4 | 5 } {
  if (slot.maxColumns !== undefined) return { maxColumns: slot.maxColumns };
  return slot.itemsFill ? { maxColumns: FILLED_SLOT_MAX_COLUMNS } : {};
}

function slotItems(slot: VariantSlot, from: 'variants' | 'states'): ListItem[] {
  // Nullish, not `||`: an item's own explicit `fill: false` must override an inherited
  // `itemsFill: true`, which `false || slot.itemsFill` would silently discard.
  return slot.items.map((item) => ({ key: item.key, slot: from, label: item.name, node: item.node, fill: item.fill ?? slot.itemsFill, surface: item.surface, align: item.align }));
}

/** Preview widths, each capped at phone width. 'full' is kept for catalog chrome and token pages. */
function previewWidths(requested: PreviewWidths | undefined, fallback: PreviewWidths | undefined): PreviewWidths {
  const widths = requested ?? fallback ?? [PREVIEW_MAX_WIDTH];
  return widths === 'full' ? 'full' : widths.map((w) => Math.min(w, PREVIEW_MAX_WIDTH));
}

/** Grouped rows when at least one state names a variant through `group`. Every variant gets a row:
 *  its grouped states, or the variant's own example when it has none. States without a matching
 *  group are returned as leftovers for "Other configurations". */
function groupStates(variants: VariantSlot, states: VariantSlot): { groups: ListGroup[]; leftovers: VariantSlot | undefined } | undefined {
  const variantKeys = new Set(variants.items.map((v) => v.key));
  if (!states.items.some((s) => s.group !== undefined && variantKeys.has(s.group))) return undefined;
  // Nullish, not `||` — same reasoning as `slotItems`: an explicit `fill: false` must win over an
  // inherited `itemsFill: true`.
  const fill = (item: VariantSlot['items'][number], slot: VariantSlot) => item.fill ?? slot.itemsFill;
  const groups = variants.items.map((variant) => {
    const own = states.items.filter((s) => s.group === variant.key);
    const items = own.length > 0
      ? own.map((s) => ({ key: s.key, slot: 'states' as const, label: s.name, node: s.node, fill: fill(s, states), surface: s.surface, align: s.align }))
      : [{ key: variant.key, slot: 'variants' as const, label: variant.name, node: variant.node, fill: fill(variant, variants), surface: variant.surface, align: variant.align }];
    return { key: variant.key, label: variant.name, items };
  });
  const rest = states.items.filter((s) => s.group === undefined || !variantKeys.has(s.group));
  for (const s of rest) {
    if (s.group !== undefined && (globalThis as { __DEV__?: boolean }).__DEV__) {
      console.warn(`[Catalog] state "${s.key}" names group "${s.group}", which matches no variant key; it is shown under "Other configurations".`);
    }
  }
  return { groups, leftovers: rest.length > 0 ? { ...states, items: rest } : undefined };
}

/** The visual blocks of one page, in reading order. Reference details are not included. A page
 *  never shows an empty block next to a real one; with nothing documented at all it shows one
 *  "No examples documented." block. */
export function presentationBlocks<TId extends string>(def: SectionDef<TId>, options: PresentationOptions = {}): PresentationBlock[] {
  if (def.tokenSections && def.tokenSections.length > 0) {
    // Each section carries its own label, so the block itself has none.
    return [{ kind: 'tokenSections', title: '', sections: def.tokenSections, columns: def.tokenColumns ?? 1 }];
  }
  if (def.tokenGallery) {
    const title = def.fullWidthLabel ?? 'Tokens';
    return [def.render ? { kind: 'preview', title, widths: 'full' } : { kind: 'empty', title, message: 'Nothing to preview.' }];
  }
  const hide = def.hide ?? {};
  const blocks: PresentationBlock[] = [];
  let states = hide.states ? undefined : remainingStates(def.states, def.comparison);

  if (!hide.variants) {
    const grouped = !def.comparison && def.variants && states ? groupStates(def.variants, states) : undefined;
    if (def.comparison) {
      blocks.push({
        kind: 'grid',
        title: `${def.comparison.rowLabel} × ${def.comparison.columnLabel}`,
        size: def.comparison.size ?? def.specimenSize ?? 'regular',
        comparison: def.comparison,
      });
    } else if (grouped && def.variants) {
      // Grouped rows place several cells beside a row header, so full-width (itemsFill) slots do
      // not force 402px cells here; a cell's own `fill` still stretches its specimen.
      blocks.push({ kind: 'grouped', title: 'Variant × configuration', size: def.specimenSize ?? 'regular', groups: grouped.groups });
      states = grouped.leftovers;
    } else if (def.variants) {
      blocks.push({
        kind: 'list',
        title: 'Variants',
        size: slotSize(def, def.variants),
        items: slotItems(def.variants, 'variants'),
        ...slotColumnCap(def.variants),
      });
    } else if (def.render) {
      blocks.push({ kind: 'preview', title: 'Preview', widths: previewWidths(def.previewWidths, options.defaultPreviewWidths) });
    }
  }

  if (states) {
    const secondary = blocks.length > 0 && blocks[0].kind !== 'list';
    blocks.push({
      kind: 'list',
      title: secondary ? 'Other configurations' : 'States / configurations',
      size: slotSize(def, states),
      items: slotItems(states, 'states'),
      ...slotColumnCap(states),
    });
  }

  if (blocks.length === 0 && !hide.variants && !hide.states) {
    blocks.push({ kind: 'empty', title: 'Examples', message: 'No examples documented.' });
  }
  return blocks;
}

export interface PlacementBlock {
  kind: PresentationBlock['kind'];
  /** Rendered width of the block's card (lists hug their columns; everything else fills). */
  width?: number;
  /** Measured height of the whole block, label included, while stacked. */
  height: number;
  /** For a list: item count, specimen size, and any explicit column cap, so its side-by-side
   *  height can be predicted from the same geometry the rendered list uses. */
  itemCount?: number;
  size?: SpecimenSize;
  maxColumns?: 1 | 2 | 3 | 4 | 5;
}

/** Side by side or stacked, for a page with exactly two blocks. Tries both and keeps the shorter;
 *  stays stacked unless side by side saves at least PLACEMENT_MIN_SAVING. Only a list can move
 *  beside a first block that hugs its content, and only when its cells keep their minimum width. */
export function choosePlacement({ available, gap, first, second }: { available: number; gap: number; first: PlacementBlock; second: PlacementBlock }): 'side' | 'stacked' {
  if (second.kind !== 'list' || !second.itemCount || !second.size) return 'stacked';
  const firstWidth = first.width ?? available;
  if (firstWidth > available * 0.7) return 'stacked';
  const room = available - firstWidth - gap;
  const minCell = second.size === 'wide' ? MATRIX_LAYOUT.columnMaxWidth : COLUMN_MIN_WIDTH[second.size];
  if (room < minCell + 2) return 'stacked';
  const stackedRows = listGeometry(second.itemCount, available, second.size, second.maxColumns).rows;
  const sideRows = listGeometry(second.itemCount, room, second.size, second.maxColumns).rows;
  const rowHeight = second.height / Math.max(1, stackedRows);
  const sideHeight = Math.max(first.height, sideRows * rowHeight);
  const stackedHeight = first.height + gap + second.height;
  return sideHeight <= stackedHeight - PLACEMENT_MIN_SAVING ? 'side' : 'stacked';
}

/** Props box columns: two, filled across first, for 4+ props when each column keeps its minimum. */
export function propsColumns(count: number, width: number): 1 | 2 {
  return count >= 4 && width >= 2 * PROPS_MIN_COLUMN_WIDTH + PROPS_COLUMN_GAP ? 2 : 1;
}

/** How many columns the reference card's Guidance / Quick reference / Composition panel uses at a
 *  given measured inner card width: 3 only when there is confirmed composition to show as its own
 *  column AND the card is wide enough for three REFERENCE_MIN_COLUMN_WIDTH columns; 2 when wide
 *  enough for two (any composition then stays nested under Quick reference, as it always has been);
 *  1 (stacked, full content in document order — nothing dropped) when even two columns wouldn't
 *  each keep their minimum. An unmeasured width (`<= 0`) stacks, so the first frame before layout
 *  settles never overflows. */
export function referenceColumns(width: number, hasComposition: boolean): 1 | 2 | 3 {
  const fits = (n: number) => width >= n * REFERENCE_MIN_COLUMN_WIDTH + (n - 1) * REFERENCE_COLUMN_GAP;
  if (hasComposition && fits(3)) return 3;
  if (fits(2)) return 2;
  return 1;
}
