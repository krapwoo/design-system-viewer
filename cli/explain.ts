import path from 'node:path';
import { readStaticPages, type StaticComparison, type StaticListItem, type StaticMember, type StaticPage } from './staticPage.ts';
import { discoverAllPageFiles, resolvePageId } from './pageIndex.ts';
import { resolveGlob } from './glob.ts';
import {
  axisItems, blockMinWidth, choosePlacement, gridColumnLimit, listGeometry, presentationBlocks, MATRIX_LAYOUT,
  type PlacementBlock, type PresentationBlock,
} from '../native/catalog/comparison.ts';
import { CATALOG_LAYOUT } from '../native/catalog/tokens.ts';
import { sectionColumns } from '../native/catalog/tokenLayout.ts';
import { numberForGroupMember } from '../native/catalog/pageApi.ts';
import type { ComparisonDef, SectionDef, SpecimenAlign, SpecimenSize, SpecimenSurfaceKind } from '../native/catalog/types.ts';
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
  /** The page's own authored `intentionalStaticPreview.reason` (guided intelligence design §3),
   *  carried through so the declaration stays explainable rather than silently suppressing
   *  `cli/doctor.ts`'s missing-working-preview advisory with no visible trace. Undefined with no
   *  such declaration. */
  intentionalStaticPreviewReason?: string;
  /** #63 A10: set only for a group page (`members` with no `whole`/`sections`) — net-new output,
   *  with no prior behavior to preserve (a family or group page's real content lives on its
   *  members, which `blocks` above never reads at all). `blocks`/`placement` are left empty/absent
   *  for a group page; this is its own outline instead. */
  group?: ExplainGroupResult;
  /** Each member's own blocks, keyed by member id — set only for a family or group page (a page
   *  with `members`). Same shape as `blocks`, from the same layout functions, at the full row
   *  width; a member with no specimens has an empty list, as the viewer shows nothing for it. A
   *  family or group page's `blocks`/`group` above are unchanged. */
  members?: Record<string, ExplainBlockResult[]>;
  /** Set, per member id, for a member whose two blocks the viewer may place side by side at
   *  runtime (the page-level `placement` condition): its counts in `members` are for the full row
   *  and may be halved there. Absent for a member with fewer than two blocks. */
  memberPlacement?: Record<string, { decision: 'decided-in-viewer'; reason: string }>;
}

export interface ExplainGroupPart {
  number: string;
  id: string;
}

export interface ExplainGroupTopLevel {
  id: string;
  /** A component binding's own name when the member has one, else "documentation-only" — the
   *  closest static-read equivalent of the member header's own kind/fidelity qualifier (its real
   *  `fidelity` isn't part of `StaticMember`). */
  qualifier: string;
  /** This top-level member's own parts, numbered exactly like `numberForGroupMember`, in authored
   *  (pre-order) sequence — a part's own children immediately follow it, already nested by number. */
  parts: ExplainGroupPart[];
}

export interface ExplainGroupResult {
  topLevel: ExplainGroupTopLevel[];
}

function placeholderItem(item: StaticListItem) {
  return {
    key: item.key, name: item.name, node: null, group: item.group,
    fill: item.fill, surface: item.surface as SpecimenSurfaceKind | undefined, align: item.align as SpecimenAlign | undefined,
  };
}

/** How many of a block's entries (list/grouped items, or grid cells, named by `noun`) override a
 *  given `SpecimenPresentation` field, as a trailing sentence fragment — empty when none do, so an
 *  unremarkable block's reason stays unchanged. Shared by every one of the four override-note
 *  functions below so a list item's and a grid cell's own surface/alignment override are reported
 *  identically. */
function overrideNote<K extends string>(entries: Partial<Record<K, unknown>>[], field: K, label: string, noun: 'item' | 'cell'): string {
  const overridden = entries.filter((entry) => entry[field] !== undefined).length;
  return overridden > 0 ? ` ${overridden} ${noun}${overridden === 1 ? '' : 's'} override${overridden === 1 ? 's' : ''} the ${label}.` : '';
}

function surfaceOverrideNote(items: { surface?: SpecimenSurfaceKind }[]): string {
  return overrideNote(items, 'surface', 'surface', 'item');
}

function alignOverrideNote(items: { align?: SpecimenAlign }[]): string {
  return overrideNote(items, 'align', 'alignment', 'item');
}

/** Same pair of override notes, worded for a grid's cells rather than a list's items. */
function cellOverrideNote(cells: { surface?: SpecimenSurfaceKind; align?: SpecimenAlign }[]): string {
  return overrideNote(cells, 'surface', 'surface', 'cell') + overrideNote(cells, 'align', 'alignment', 'cell');
}

/** A throwaway `ComparisonDef` from a read `comparison`: present `cells` only for a direct
 *  object-literal `comparison` (never a `grid()` call, whose `cell` callback is unevaluated) whose
 *  `cells` array was itself literal — see `StaticComparison.cells`. `node: null` the same way every
 *  other placeholder specimen here is never evaluated. */
function toComparisonDef(source: StaticComparison): ComparisonDef {
  return {
    rowLabel: source.rowLabel ?? '',
    columnLabel: source.columnLabel ?? '',
    rows: source.rows.prop !== undefined ? { prop: source.rows.prop, items: source.rows.items } : source.rows.items,
    columns:
      source.columns.prop !== undefined ? { prop: source.columns.prop, items: source.columns.items } : source.columns.items,
    cells: (source.cells ?? []).map((cell) => ({
      rowKey: cell.rowKey, columnKey: cell.columnKey, node: null,
      fill: cell.fill, surface: cell.surface as SpecimenSurfaceKind | undefined, align: cell.align as SpecimenAlign | undefined,
    })),
    size: source.size as SpecimenSize | undefined,
  };
}

/** A throwaway `SectionDef` built from a `StaticPage` (Task 3) — every specimen's `node` is `null`
 *  (design §4: specimen nodes are never evaluated), since none of the layout functions below ever
 *  look at it; only the counts/keys/sizes they do look at are carried over. Every field Task 3
 *  reads is carried through here, including `previewWidths`/`fullWidthLabel`/`hide`/`itemsFill`/
 *  `maxColumns` — dropping any of them makes `explain` report different geometry than the viewer. */
export function toSectionDef(page: StaticPage): SectionDef {
  const comparison = page.comparison && toComparisonDef(page.comparison);
  return {
    id: resolvePageId(page, page.file),
    description: '',
    path: page.file,
    tokenGallery: page.tokenGallery,
    fullWidthLabel: page.fullWidthLabel,
    specimenSize: page.specimenSize as SpecimenSize | undefined,
    previewWidths: page.previewWidths,
    // Carried because `blockMinWidth` reads it: the two preview cards have different chrome, so
    // without it `explain` prices a 'table' preview as a frames card.
    previewLayout: page.previewLayout,
    variants: page.variantsItems ? { itemsFill: page.variantsItemsFill, maxColumns: page.variantsMaxColumns, items: page.variantsItems.map(placeholderItem) } : undefined,
    states: page.statesItems ? { itemsFill: page.statesItemsFill, maxColumns: page.statesMaxColumns, items: page.statesItems.map(placeholderItem) } : undefined,
    comparison,
    render: page.hasRender ? () => null : undefined,
    tokenSections: page.tokenSectionTitles?.map((title, i) => ({ title, wide: page.tokenSectionWide?.[i] || undefined, render: () => null })),
    tokenColumns: page.tokenColumns === 2 || page.tokenColumns === 3 ? page.tokenColumns : undefined,
    hide: (page.hideVariants || page.hideStates) ? { variants: page.hideVariants, states: page.hideStates } : undefined,
  };
}

/** A family or group member's own `SectionDef`, with the fields `FamilyPage.tsx`'s
 *  `memberAsSectionDef` hands `presentationBlocks` (a member has no `render`, token sections or
 *  `hide` of those slots), so a member's blocks are the ones the viewer shows for it. */
export function memberToSectionDef(member: StaticMember): SectionDef {
  return {
    id: member.id,
    description: '',
    path: member.id,
    specimenSize: member.specimenSize as SpecimenSize | undefined,
    previewWidths: member.previewWidths,
    variants: member.variantsItems ? { axis: member.variantsAxis, itemsFill: member.variantsItemsFill, maxColumns: member.variantsMaxColumns, items: member.variantsItems.map(placeholderItem) } : undefined,
    states: member.statesItems ? { axis: member.statesAxis, itemsFill: member.statesItemsFill, maxColumns: member.statesMaxColumns, items: member.statesItems.map(placeholderItem) } : undefined,
    comparison: member.comparison && toComparisonDef(member.comparison),
  };
}

/** The presentation blocks of one member, as the viewer shows them: an empty block is dropped. */
export function memberBlocks(member: StaticMember): PresentationBlock[] {
  return presentationBlocks(memberToSectionDef(member), { defaultPreviewWidths: [402] }).filter((block) => block.kind !== 'empty');
}

function explainBlock(block: PresentationBlock, availableWidth: number): ExplainBlockResult {
  if (block.kind === 'grid') {
    const rows = axisItems(block.comparison.rows).length;
    const columns = axisItems(block.comparison.columns).length;
    const limit = gridColumnLimit(block.size);
    return {
      kind: 'grid', title: block.title,
      reason: `${rows} rows × ${columns} columns (${block.size}); ${columns} of ${limit} max ${block.size} columns used — ` +
        `${columns <= limit ? 'fits' : 'does NOT fit'} a 1280px laptop.` + cellOverrideNote(block.comparison.cells),
    };
  }
  if (block.kind === 'list') {
    const geometry = listGeometry(block.items.length, availableWidth, block.size, block.maxColumns);
    return {
      kind: 'list', title: block.title,
      reason: `${block.items.length} items (${block.size}) → ${geometry.columns} column${geometry.columns === 1 ? '' : 's'} × ${geometry.rows} row${geometry.rows === 1 ? '' : 's'}` +
        (geometry.fillers > 0 ? ` (${geometry.fillers} filler${geometry.fillers === 1 ? '' : 's'})` : '') + '.' +
        surfaceOverrideNote(block.items) + alignOverrideNote(block.items),
    };
  }
  if (block.kind === 'grouped') {
    const items = block.groups.flatMap((group) => group.items);
    return {
      kind: 'grouped', title: block.title,
      reason: `${block.groups.length} variant row(s), each with its own configurations.${surfaceOverrideNote(items)}${alignOverrideNote(items)}`,
    };
  }
  if (block.kind === 'preview') {
    const widths = block.widths === 'full' ? 'full width' : `${block.widths.join('/')}px`;
    return { kind: 'preview', title: block.title, reason: `render() content at ${widths}.` };
  }
  if (block.kind === 'tokenSections') {
    const n = block.sections.length;
    const titles = block.sections.every((s) => s.title) ? ` (${block.sections.map((s) => s.title).join(', ')})` : '';
    const wide = block.sections.filter((s) => s.wide).length;
    const narrow = n - wide;
    const fit = sectionColumns(MATRIX_LAYOUT.laptopContentWidth, block.columns);
    const parts = [];
    if (narrow > 0) parts.push(narrow > 1 && fit > 1 ? `${Math.min(fit, narrow)} side by side on a 1280px laptop` : 'one per row');
    if (wide > 0) parts.push(`${wide} full width`);
    return { kind: 'tokenSections', title: 'Token sections', reason: `${n} section${n === 1 ? '' : 's'}${titles}: ${parts.join('; ')}.` };
  }
  return { kind: 'empty', title: block.title, reason: block.message };
}

/** Mirrors `native/catalog/SectionBlock.tsx`'s own `placementBlock` helper: side by side splits the
 *  row in two and each block fills its half, so the decision needs each block's narrowest width
 *  plus, for a list, the geometry that predicts its height in half a row. */
function toPlacementBlock(block: PresentationBlock, height: number): PlacementBlock {
  const base = { kind: block.kind, height, minWidth: blockMinWidth(block) };
  return block.kind === 'list'
    ? { ...base, itemCount: block.items.length, size: block.size, maxColumns: block.maxColumns }
    : base;
}

/** Every page `cli/doctor.ts`'s own `discoverAllPageFiles` would find, with the same exclusions
 *  `runDoctor` applies (mirroring `sync`), so an excluded folder's page never resolves. Shared with
 *  `cli/layout.ts` rather than copied: a snapshot built from a different page set than `explain`
 *  reads would diff pages the viewer does not have. */
export function discoverStaticPages(config: ResolvedConfig): StaticPage[] {
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
  return readStaticPages(pageFiles);
}

/** Each member's blocks at the full row, plus a `decided-in-viewer` placement for every member
 *  with two blocks — the viewer's `Blocks` may put those side by side, at half the row each. */
function explainMembers(members: readonly StaticMember[]): Pick<ExplainResult, 'members' | 'memberPlacement'> {
  const full = MATRIX_LAYOUT.laptopContentWidth;
  const half = Math.floor((full - CATALOG_LAYOUT.blockGap) / 2);
  const explained: Record<string, ExplainBlockResult[]> = {};
  const placement: NonNullable<ExplainResult['memberPlacement']> = {};
  for (const member of members) {
    const blocks = memberBlocks(member);
    explained[member.id] = blocks.map((block) => explainBlock(block, full));
    if (blocks.length === 2) {
      placement[member.id] = {
        decision: 'decided-in-viewer',
        reason: "Side-by-side placement depends on each block's measured height — decided in the viewer at runtime. " +
          `The counts above are for the full ${full}px row; side by side each block gets ${half}px instead, which can fit fewer columns.`,
      };
    }
  }
  return { members: explained, ...(Object.keys(placement).length > 0 ? { memberPlacement: placement } : {}) };
}

/** Finds `pageId` among every page `cli/doctor.ts`'s own `discoverAllPageFiles` would find, builds
 *  its throwaway `SectionDef`, and asks the viewer's own pure layout functions for each block's
 *  decision — undefined when no page resolves to that id. */
export function explainPage(config: ResolvedConfig, pageId: string, options: ExplainOptions = {}): ExplainResult | undefined {
  const page = discoverStaticPages(config).find((p) => resolvePageId(p, p.file) === pageId);
  if (!page) return undefined;
  // Important finding 4 (Fable's review): a page whose layout data isn't a literal (or that has a
  // syntax error) must never be explained from partial/empty data — design §4 requires `explain`
  // to never drift from what the viewer actually renders.
  if (!page.checkable) return { pageId, notCheckable: true, blocks: [] };

  // #63 A10: a group page (`members` with no `whole`/`sections`) — its real content lives entirely
  // on its members, which `toSectionDef`/`presentationBlocks` below never read, so it gets its own
  // outline instead of an (otherwise empty) block list.
  if (page.members !== undefined && page.members.length > 0 && page.whole === undefined && page.sections === undefined) {
    const members = page.members;
    const byId = new Set(members.map((m) => m.id));
    const topLevelMembers = members.filter((m) => m.parent === undefined || !byId.has(m.parent));
    const topLevel: ExplainGroupTopLevel[] = topLevelMembers.map((m) => ({
      id: m.id,
      qualifier: m.component ? m.component : 'documentation-only',
      parts: [...numberForGroupMember(m.id, members).entries()].map(([id, entry]) => ({ number: entry.number, id })),
    }));
    return { pageId, blocks: [], group: { topLevel }, ...explainMembers(members) };
  }

  const def = toSectionDef(page);
  const blocks = presentationBlocks(def, { defaultPreviewWidths: [402] });

  // Two blocks placed side by side get half the row each, which changes how many columns fit.
  // Reporting the full-width counts for a page the viewer will halve states the wrong geometry as
  // fact, so the width every block is measured at follows the placement decision.
  const full = MATRIX_LAYOUT.laptopContentWidth;
  const half = Math.floor((full - CATALOG_LAYOUT.blockGap) / 2);

  let placement: ExplainResult['placement'];
  let blockWidth: number = full;
  if (blocks.length === 2) {
    if (options.heights) {
      const [firstHeight, secondHeight] = options.heights;
      const decision = choosePlacement({
        available: full,
        gap: CATALOG_LAYOUT.blockGap,
        first: toPlacementBlock(blocks[0], firstHeight),
        second: toPlacementBlock(blocks[1], secondHeight),
      });
      if (decision === 'side') blockWidth = half;
      placement = {
        decision,
        reason: `With heights ${firstHeight}px/${secondHeight}px on a 1280px laptop (${full}px content width): ${decision}` +
          (decision === 'side' ? `, so each block gets ${half}px.` : `, so each block gets the full ${full}px.`),
      };
    } else {
      placement = {
        decision: 'decided-in-viewer',
        reason: "Side-by-side placement depends on each block's measured height — decided in the viewer at runtime. " +
          `The counts above are for the full ${full}px row; side by side each block gets ${half}px instead, which can fit fewer columns. ` +
          'Pass --heights <first>,<second> to resolve it here.',
      };
    }
  }
  const explained = blocks.map((block) => explainBlock(block, blockWidth));

  return {
    pageId, blocks: explained, placement, intentionalStaticPreviewReason: page.intentionalStaticPreviewReason,
    ...(page.members !== undefined && page.members.length > 0 ? explainMembers(page.members) : {}),
  };
}

/** The "Members" section of the human output: each member's blocks, indented under its id. */
function formatMembers(members: ExplainResult['members'], memberPlacement: ExplainResult['memberPlacement']): string[] {
  if (!members) return [];
  const lines = ['Members'];
  for (const [id, blocks] of Object.entries(members)) {
    lines.push(`  ${id}`);
    if (blocks.length === 0) lines.push('    No specimens.');
    for (const block of blocks) {
      lines.push(`    ${block.title}`);
      lines.push(`      ${block.reason}`);
    }
    if (memberPlacement?.[id]) lines.push(`    Placement: ${memberPlacement[id].reason}`);
  }
  return lines;
}

export function formatExplain(result: ExplainResult): string {
  if (result.notCheckable) {
    return `${result.pageId}\n\nPage not statically checkable — some of its layout data is not a literal doctor can read.`;
  }
  // #63 A10: a group page prints its own outline — title, each top-level member with its
  // qualifier, nested parts with numbers — instead of the block-based report below.
  if (result.group) {
    const lines = [result.pageId, ''];
    for (const top of result.group.topLevel) {
      lines.push(`${top.id} (${top.qualifier})`);
      for (const part of top.parts) lines.push(`  ${part.number}. ${part.id}`);
    }
    if (result.members) lines.push('', ...formatMembers(result.members, result.memberPlacement));
    return lines.join('\n').replace(/\n+$/, '');
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
    lines.push('');
  }
  if (result.intentionalStaticPreviewReason) {
    lines.push('Intentionally static preview');
    lines.push(`  ${result.intentionalStaticPreviewReason}`);
    lines.push('');
  }
  lines.push(...formatMembers(result.members, result.memberPlacement));
  return lines.join('\n').replace(/\n+$/, '');
}

/** `"80,300"` → `[80, 300]`; undefined for anything else (not exactly two positive numbers). */
export function parseHeights(raw: string): [number, number] | undefined {
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return undefined;
  return [parts[0], parts[1]];
}
