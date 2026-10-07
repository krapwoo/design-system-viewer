/**
 * Pure page-layout logic for catalog specimens — no React or React Native runtime imports, so it
 * runs under Node's test runner. A page shows its specimens in one of three layouts:
 *   • grid    — two props that combine freely (rows × columns table);
 *   • list    — one axis, in ONE shared card whose cells wrap into balanced rows;
 *   • preview — free-form content (live demos, token galleries, recipes) at full width.
 * ComparisonGrid and ComparisonList render what this module plans and measures.
 */
import type { ComparisonDef, SectionDef, SpecimenSize, VariantSlot } from './types';

/** Approved geometry. `cellPadding` equals CATALOG_SPACE.lg (asserted in tests). The laptop
 *  content width is a 1280px viewport minus the 264px sidebar and 32px side padding. */
export const MATRIX_LAYOUT = {
  rowHeaderWidth: 120,
  columnMaxWidth: 402,
  cellPadding: 16,
  rowMinHeight: 150,
  laptopContentWidth: 952,
} as const;

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

export type PresentationBlock =
  | { kind: 'grid'; title: string; size: SpecimenSize; comparison: ComparisonDef }
  | { kind: 'list'; title: string; size: SpecimenSize; items: ListItem[] }
  | { kind: 'preview'; title: string }
  | { kind: 'empty'; title: string; message: string };

/** Specimen size for a one-axis slot: the section's explicit size, else wide for full-width
 *  (itemsFill) slots, else regular. */
export function slotSize<TId extends string>(def: SectionDef<TId>, slot: VariantSlot): SpecimenSize {
  return def.specimenSize ?? (slot.itemsFill ? 'wide' : 'regular');
}

function slotItems(slot: VariantSlot): ListItem[] {
  return slot.items.map((item) => ({ key: item.key, label: item.name, node: item.node, fill: item.fill || slot.itemsFill }));
}

/** The visual blocks of one page, in reading order. Reference details are not included. */
export function presentationBlocks<TId extends string>(def: SectionDef<TId>): PresentationBlock[] {
  if (def.tokenGallery) {
    const title = def.fullWidthLabel ?? 'Tokens';
    return [def.render ? { kind: 'preview', title } : { kind: 'empty', title, message: 'Nothing to preview.' }];
  }
  const hide = def.hide ?? {};
  const blocks: PresentationBlock[] = [];

  if (!hide.variants) {
    if (def.comparison) {
      blocks.push({
        kind: 'grid',
        title: `${def.comparison.rowLabel} × ${def.comparison.columnLabel}`,
        size: def.comparison.size ?? def.specimenSize ?? 'regular',
        comparison: def.comparison,
      });
    } else if (def.variants) {
      blocks.push({ kind: 'list', title: 'Variants', size: slotSize(def, def.variants), items: slotItems(def.variants) });
    } else if (def.render) {
      blocks.push({ kind: 'preview', title: 'Preview' });
    } else {
      blocks.push({ kind: 'empty', title: 'Variants', message: 'No variants documented.' });
    }
  }

  if (!hide.states) {
    const states = remainingStates(def.states, def.comparison);
    if (states) {
      blocks.push({
        kind: 'list',
        title: def.comparison ? 'Other configurations' : 'States / configurations',
        size: slotSize(def, states),
        items: slotItems(states),
      });
    } else if (!def.comparison && !def.states) {
      blocks.push({ kind: 'empty', title: 'States / configurations', message: 'No additional states or configurations documented.' });
    }
  }
  return blocks;
}
