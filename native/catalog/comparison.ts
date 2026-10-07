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
import type { ComparisonDef, PreviewWidths, SectionDef, SpecimenSize, VariantSlot } from './types';

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

/** Smallest column or cell width per specimen size. Wide specimens are fixed at phone width. */
export const COLUMN_MIN_WIDTH: Record<SpecimenSize, number> = { compact: 160, regular: 240, wide: 402 };

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
 *  space as possible. `fillers` blank cells complete the last row. */
export function listGeometry(itemCount: number, availableWidth: number, size: SpecimenSize): ListGeometry {
  if (itemCount <= 0) return { columns: 0, rows: 0, fillers: 0, cellWidth: 0, containerWidth: 0 };
  const inner = Math.max(0, availableWidth - 2);
  const min = COLUMN_MIN_WIDTH[size];
  const maxColumns = Math.max(1, Math.min(itemCount, Math.floor(inner / min)));
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
  if (def.rows.length === 0 || def.columns.length === 0) {
    return ['Comparison needs at least one row and one column.'];
  }
  const issues: string[] = [];
  const rowKeys = new Set<string>();
  for (const row of def.rows) {
    if (rowKeys.has(row.key)) issues.push(`Duplicate row key "${row.key}".`);
    rowKeys.add(row.key);
  }
  const columnKeys = new Set<string>();
  for (const column of def.columns) {
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
  const covered = new Set([...comparison.rows.map((row) => row.key), ...comparison.columns.map((column) => column.key)]);
  const items = states.items.filter((item) => !covered.has(item.key));
  return items.length > 0 ? { ...states, items } : undefined;
}

export interface ListItem {
  key: string;
  label: string;
  node: unknown;
  fill?: boolean;
}

export interface ListGroup {
  key: string;
  label: string;
  items: ListItem[];
}

export type PresentationBlock =
  | { kind: 'grid'; title: string; size: SpecimenSize; comparison: ComparisonDef }
  | { kind: 'grouped'; title: string; size: SpecimenSize; groups: ListGroup[] }
  | { kind: 'list'; title: string; size: SpecimenSize; items: ListItem[] }
  | { kind: 'preview'; title: string; widths: PreviewWidths }
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

function slotItems(slot: VariantSlot): ListItem[] {
  return slot.items.map((item) => ({ key: item.key, label: item.name, node: item.node, fill: item.fill || slot.itemsFill }));
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
  const fill = (item: VariantSlot['items'][number], slot: VariantSlot) => item.fill || slot.itemsFill;
  const groups = variants.items.map((variant) => {
    const own = states.items.filter((s) => s.group === variant.key);
    const items = own.length > 0
      ? own.map((s) => ({ key: s.key, label: s.name, node: s.node, fill: fill(s, states) }))
      : [{ key: variant.key, label: variant.name, node: variant.node, fill: fill(variant, variants) }];
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
      blocks.push({ kind: 'list', title: 'Variants', size: slotSize(def, def.variants), items: slotItems(def.variants) });
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
      items: slotItems(states),
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
  /** For a list: item count and specimen size, so its side-by-side height can be predicted. */
  itemCount?: number;
  size?: SpecimenSize;
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
  const stackedRows = listGeometry(second.itemCount, available, second.size).rows;
  const sideRows = listGeometry(second.itemCount, room, second.size).rows;
  const rowHeight = second.height / Math.max(1, stackedRows);
  const sideHeight = Math.max(first.height, sideRows * rowHeight);
  const stackedHeight = first.height + gap + second.height;
  return sideHeight <= stackedHeight - PLACEMENT_MIN_SAVING ? 'side' : 'stacked';
}

/** Props box columns: two, filled across first, for 4+ props when each column keeps its minimum. */
export function propsColumns(count: number, width: number): 1 | 2 {
  return count >= 4 && width >= 2 * PROPS_MIN_COLUMN_WIDTH + PROPS_COLUMN_GAP ? 2 : 1;
}
