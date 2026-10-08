import path from 'node:path';
import { readStaticPages, type StaticListItem, type StaticPage } from './staticPage.ts';
import { discoverAllPageFiles, resolvePageId } from './pageIndex.ts';
import { resolveGlob } from './glob.ts';
import {
  axisItems, choosePlacement, gridColumnLimit, listGeometry, presentationBlocks, MATRIX_LAYOUT,
  type PlacementBlock, type PresentationBlock,
} from '../native/catalog/comparison.ts';
import { CATALOG_LAYOUT } from '../native/catalog/tokens.ts';
import type { ComparisonDef, SectionDef, SpecimenSize } from '../native/catalog/types.ts';
import type { ResolvedConfig } from './types.ts';

export interface ExplainOptions {
  /** `[firstBlockHeight, secondBlockHeight]`, in px — without this, placement is reported as
   *  "decided in the viewer" (design §4), since it genuinely depends on a real measurement. */
  heights?: [number, number];
}

export interface ExplainBlockResult {
  kind: PresentationBlock['kind'];
  title: string;
  reason: string;
}

export interface ExplainResult {
  pageId: string;
  /** True when the page itself isn't statically checkable (design §4) — some of its layout data
   *  isn't a literal this reader can resolve. `blocks` is empty and `placement` absent in that
   *  case, since explaining it anyway would show different (or no) data than the real viewer. */
  notCheckable?: true;
  blocks: ExplainBlockResult[];
  placement?: { decision: 'side' | 'stacked' | 'decided-in-viewer'; reason: string };
}

function placeholderItem(item: StaticListItem) {
  return { key: item.key, name: item.name, node: null, group: item.group };
}

/** A throwaway `SectionDef` built from a `StaticPage` (Task 3) — every specimen's `node` is `null`
 *  (design §4: specimen nodes are never evaluated), since none of the layout functions below ever
 *  look at it; only the counts/keys/sizes they do look at are carried over. Every field Task 3
 *  reads is carried through here, including `previewWidths`/`fullWidthLabel`/`hide`/`itemsFill` —
 *  an earlier draft dropped these four, so `explain` reported different geometry than the real
 *  viewer for any page that set one of them (25 kit pages set `itemsFill`; every `kit-host`
 *  Viewer page sets `hide`). */
function toSectionDef(page: StaticPage): SectionDef {
  const comparison: ComparisonDef | undefined = page.comparison && {
    rowLabel: page.comparison.rowLabel ?? '',
    columnLabel: page.comparison.columnLabel ?? '',
    rows: page.comparison.rows.prop !== undefined ? { prop: page.comparison.rows.prop, items: page.comparison.rows.items } : page.comparison.rows.items,
    columns:
      page.comparison.columns.prop !== undefined ? { prop: page.comparison.columns.prop, items: page.comparison.columns.items } : page.comparison.columns.items,
    cells: [],
    size: page.comparison.size as SpecimenSize | undefined,
  };
  return {
    id: resolvePageId(page, page.file),
    description: '',
    path: page.file,
    tokenGallery: page.tokenGallery,
    fullWidthLabel: page.fullWidthLabel,
    specimenSize: page.specimenSize as SpecimenSize | undefined,
    previewWidths: page.previewWidths,
    variants: page.variantsItems ? { itemsFill: page.variantsItemsFill, items: page.variantsItems.map(placeholderItem) } : undefined,
    states: page.statesItems ? { itemsFill: page.statesItemsFill, items: page.statesItems.map(placeholderItem) } : undefined,
    comparison,
    render: page.hasRender ? () => null : undefined,
    hide: (page.hideVariants || page.hideStates) ? { variants: page.hideVariants, states: page.hideStates } : undefined,
  };
}

function explainBlock(block: PresentationBlock): ExplainBlockResult {
  if (block.kind === 'grid') {
    const rows = axisItems(block.comparison.rows).length;
    const columns = axisItems(block.comparison.columns).length;
    const limit = gridColumnLimit(block.size);
    return {
      kind: 'grid', title: block.title,
      reason: `${rows} rows × ${columns} columns (${block.size}); ${columns} of ${limit} max ${block.size} columns used — ` +
        `${columns <= limit ? 'fits' : 'does NOT fit'} a 1280px laptop.`,
    };
  }
  if (block.kind === 'list') {
    const geometry = listGeometry(block.items.length, MATRIX_LAYOUT.laptopContentWidth, block.size);
    return {
      kind: 'list', title: block.title,
      reason: `${block.items.length} items (${block.size}) → ${geometry.columns} columns × ${geometry.rows} row${geometry.rows === 1 ? '' : 's'}` +
        (geometry.fillers > 0 ? ` (${geometry.fillers} filler${geometry.fillers === 1 ? '' : 's'})` : '') + '.',
    };
  }
  if (block.kind === 'grouped') {
    return { kind: 'grouped', title: block.title, reason: `${block.groups.length} variant row(s), each with its own configurations.` };
  }
  if (block.kind === 'preview') {
    const widths = block.widths === 'full' ? 'full width' : `${block.widths.join('/')}px`;
    return { kind: 'preview', title: block.title, reason: `render() content at ${widths}.` };
  }
  return { kind: 'empty', title: block.title, reason: block.message };
}

/** Mirrors `native/catalog/SectionBlock.tsx`'s own `blockWidth` helper: a list block's width is its
 *  own natural, content-hugging width (`listGeometry`'s `containerWidth`) — the real viewer only
 *  ever moves a *second* block beside a *first* one when that first block doesn't already fill the
 *  whole row, so `choosePlacement` only reads `first.width` (never `second.width`) — but it's
 *  computed uniformly here for either role, since setting it on `second` is simply unused, not wrong. */
function toPlacementBlock(block: PresentationBlock, height: number, available: number): PlacementBlock {
  if (block.kind === 'list') {
    return { kind: 'list', height, itemCount: block.items.length, size: block.size, width: listGeometry(block.items.length, available, block.size).containerWidth };
  }
  return { kind: block.kind, height };
}

/** Finds `pageId` among every page `cli/doctor.ts`'s own `discoverAllPageFiles` would find, builds
 *  its throwaway `SectionDef`, and asks the viewer's own pure layout functions for each block's
 *  decision — undefined when no page resolves to that id. */
export function explainPage(config: ResolvedConfig, pageId: string, options: ExplainOptions = {}): ExplainResult | undefined {
  // Same exclusion `cli/doctor.ts`'s `runDoctor` applies (mirroring `sync`) — an excluded folder's
  // page should never resolve here either.
  const excluded = new Set((config.exclude ?? []).flatMap((pattern) => resolveGlob(config.projectRoot, pattern)));
  const componentFolders = [
    ...new Set(
      config.components
        .flatMap((pattern) => resolveGlob(config.projectRoot, pattern))
        .filter((file) => !excluded.has(file))
        .map((file) => path.dirname(file)),
    ),
  ];
  const pageFiles = discoverAllPageFiles({ componentFolders, standalonePageGlobs: config.pages ?? [], projectRoot: config.projectRoot });
  const page = readStaticPages(pageFiles).find((p) => resolvePageId(p, p.file) === pageId);
  if (!page) return undefined;
  // Important finding 4 (Fable's review): a page whose layout data isn't a literal (or that has a
  // syntax error) must never be explained from partial/empty data — design §4 requires `explain`
  // to never drift from what the viewer actually renders.
  if (!page.checkable) return { pageId, notCheckable: true, blocks: [] };

  const def = toSectionDef(page);
  const blocks = presentationBlocks(def, { defaultPreviewWidths: [402] });
  const explained = blocks.map(explainBlock);

  let placement: ExplainResult['placement'];
  if (blocks.length === 2) {
    if (options.heights) {
      const [firstHeight, secondHeight] = options.heights;
      const decision = choosePlacement({
        available: MATRIX_LAYOUT.laptopContentWidth,
        gap: CATALOG_LAYOUT.blockGap,
        first: toPlacementBlock(blocks[0], firstHeight, MATRIX_LAYOUT.laptopContentWidth),
        second: toPlacementBlock(blocks[1], secondHeight, MATRIX_LAYOUT.laptopContentWidth),
      });
      placement = {
        decision,
        reason: `With heights ${firstHeight}px/${secondHeight}px on a 1280px laptop (${MATRIX_LAYOUT.laptopContentWidth}px content width): ${decision}.`,
      };
    } else {
      placement = {
        decision: 'decided-in-viewer',
        reason: "Side-by-side placement depends on each block's measured height — decided in the viewer at runtime. Pass --heights <first>,<second> to check it here.",
      };
    }
  }

  return { pageId, blocks: explained, placement };
}

export function formatExplain(result: ExplainResult): string {
  if (result.notCheckable) {
    return `${result.pageId}\n\nPage not statically checkable — some of its layout data is not a literal doctor can read.`;
  }
  const lines = [result.pageId, ''];
  for (const block of result.blocks) {
    lines.push(block.title);
    lines.push(`  ${block.reason}`);
    lines.push('');
  }
  if (result.placement) {
    lines.push('Placement');
    lines.push(`  ${result.placement.reason}`);
  }
  return lines.join('\n').replace(/\n+$/, '');
}

/** `"80,300"` → `[80, 300]`; undefined for anything else (not exactly two positive numbers). */
export function parseHeights(raw: string): [number, number] | undefined {
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return undefined;
  return [parts[0], parts[1]];
}
