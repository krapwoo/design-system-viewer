// cli/layout.ts — `explain --all --json` and `layout-diff`: capture every page's geometry as data,
// and report what a version changed.
//
// Layout rules live in this package and reach every consuming project on `update`, while their page
// files never change. So a release can reshape a catalog with nothing in the consumer's repository
// to explain it — 0.7.0 moved three pages from side-by-side to stacked, and the only trace was a
// changelog paragraph. This turns that into a measured artifact: snapshot before, snapshot after,
// diff the two.
import { resolvePageId } from './pageIndex.ts';
import { discoverStaticPages } from './explain.ts';
import {
  blockMinWidth, fitsOneRow, listGeometry, presentationBlocks, MATRIX_LAYOUT,
  type PresentationBlock,
} from '../native/catalog/comparison.ts';
import { CATALOG_LAYOUT } from '../native/catalog/tokens.ts';
import { toSectionDef } from './explain.ts';
import type { ResolvedConfig } from './types.ts';

/** One block's geometry at a given width: what the reader actually sees laid out. */
export interface BlockGeometry {
  columns: number;
  rows: number;
  fillers: number;
}

export interface BlockSnapshot {
  title: string;
  kind: PresentationBlock['kind'];
  /** Lists only — the declared specimen size, which drives the column minimum. */
  size?: string;
  items?: number;
  /** The narrowest width this block can take, from the viewer's own `blockMinWidth`. */
  minWidth: number;
  /** Geometry with the whole row, and with half of it. Both are recorded because which one applies
   *  depends on a placement decision that needs measured heights (see `sideEligible`). */
  full?: BlockGeometry;
  half?: BlockGeometry;
}

export interface PageSnapshot {
  page: string;
  blocks: BlockSnapshot[];
  /** For a two-block page: whether both blocks still fit one row at half width. This is the
   *  height-independent half of `choosePlacement` — the part a rule change moves. The decision
   *  itself also weighs a single tall specimen and the height actually saved, neither of which is
   *  knowable without a browser, so this is reported as eligibility, not as the outcome. */
  sideEligible?: boolean;
  /** A page whose layout data is not a literal this reader can resolve. Recorded rather than
   *  skipped, so a page that *becomes* uncheckable shows up as a change instead of vanishing. */
  notCheckable?: true;
}

export interface LayoutSnapshot {
  /** The package version that produced it, so a diff can name what moved. */
  version: string;
  /** The width every geometry here was computed at: the CLI's laptop content width. A snapshot
   *  taken at one width cannot be compared with one taken at another, and recording it makes that
   *  checkable rather than silent. */
  width: number;
  pages: PageSnapshot[];
}

function geometryFor(block: PresentationBlock, width: number): BlockGeometry | undefined {
  if (block.kind !== 'list') return undefined;
  const { columns, rows, fillers } = listGeometry(block.items.length, width, block.size, block.maxColumns);
  return { columns, rows, fillers };
}

/** One page's geometry, from the same static read `explain` uses. */
export function pageSnapshot(page: Parameters<typeof toSectionDef>[0], pageId: string): PageSnapshot {
  if (!page.checkable) return { page: pageId, blocks: [], notCheckable: true };
  const blocks = presentationBlocks(toSectionDef(page), { defaultPreviewWidths: [402] });
  const full = MATRIX_LAYOUT.laptopContentWidth;
  const half = Math.floor((full - CATALOG_LAYOUT.blockGap) / 2);

  const snapshot: PageSnapshot = {
    page: pageId,
    blocks: blocks.map((block) => ({
      title: block.kind === 'tokenSections' ? 'Token sections' : block.title,
      kind: block.kind,
      ...(block.kind === 'list' ? { size: block.size, items: block.items.length } : {}),
      minWidth: blockMinWidth(block),
      ...(geometryFor(block, full) ? { full: geometryFor(block, full) } : {}),
      ...(geometryFor(block, half) ? { half: geometryFor(block, half) } : {}),
    })),
  };
  if (blocks.length === 2) {
    const [first, second] = blocks;
    const asPlacement = (b: PresentationBlock) => ({
      kind: b.kind, height: 0, minWidth: blockMinWidth(b),
      ...(b.kind === 'list' ? { itemCount: b.items.length, size: b.size, maxColumns: b.maxColumns } : {}),
    });
    snapshot.sideEligible = fitsOneRow(asPlacement(first), half) && fitsOneRow(asPlacement(second), half);
  }
  return snapshot;
}

/** Every page's geometry, ordered by page id so two snapshots diff line for line. */
export function layoutSnapshot(config: ResolvedConfig, version: string): LayoutSnapshot {
  const pages = discoverStaticPages(config)
    .map((page) => pageSnapshot(page, resolvePageId(page, page.file)))
    .sort((a, b) => a.page.localeCompare(b.page));
  return { version, width: MATRIX_LAYOUT.laptopContentWidth, pages };
}

export interface LayoutChange {
  page: string;
  /** `added` and `removed` are the page itself appearing or disappearing; everything else names
   *  what about an existing page moved. */
  kind: 'added' | 'removed' | 'blocks' | 'geometry' | 'placement' | 'checkable';
  detail: string;
}

function describeGeometry(g: BlockGeometry | undefined): string {
  return g ? `${g.columns}×${g.rows}` : '—';
}

/** What changed between two snapshots. Pure, so it is the part worth testing. */
export function diffLayouts(before: LayoutSnapshot, after: LayoutSnapshot): LayoutChange[] {
  const changes: LayoutChange[] = [];
  const beforePages = new Map(before.pages.map((p) => [p.page, p]));
  const afterPages = new Map(after.pages.map((p) => [p.page, p]));

  for (const page of before.pages) {
    if (!afterPages.has(page.page)) changes.push({ page: page.page, kind: 'removed', detail: 'the page is gone' });
  }
  for (const page of after.pages) {
    const was = beforePages.get(page.page);
    if (!was) {
      changes.push({ page: page.page, kind: 'added', detail: 'a new page' });
      continue;
    }
    if (Boolean(was.notCheckable) !== Boolean(page.notCheckable)) {
      changes.push({
        page: page.page, kind: 'checkable',
        detail: page.notCheckable ? 'its layout is no longer statically readable' : 'its layout became statically readable',
      });
      continue;
    }
    if (was.blocks.length !== page.blocks.length) {
      changes.push({ page: page.page, kind: 'blocks', detail: `${was.blocks.length} blocks → ${page.blocks.length}` });
    }
    for (const [i, block] of page.blocks.entries()) {
      const old = was.blocks[i];
      if (!old) continue;
      if (old.kind !== block.kind) {
        changes.push({ page: page.page, kind: 'blocks', detail: `"${block.title}" is a ${block.kind} block, was ${old.kind}` });
        continue;
      }
      if (old.minWidth !== block.minWidth) {
        changes.push({ page: page.page, kind: 'geometry', detail: `"${block.title}" needs ${block.minWidth}px, was ${old.minWidth}px` });
      }
      for (const width of ['full', 'half'] as const) {
        const a = old[width];
        const b = block[width];
        if (describeGeometry(a) !== describeGeometry(b)) {
          changes.push({
            page: page.page, kind: 'geometry',
            detail: `"${block.title}" at ${width} width: ${describeGeometry(a)} → ${describeGeometry(b)}`,
          });
        }
      }
    }
    if (was.sideEligible !== page.sideEligible) {
      changes.push({
        page: page.page, kind: 'placement',
        detail: page.sideEligible
          ? 'its two blocks can now share a row'
          : 'its two blocks can no longer share a row',
      });
    }
  }
  return changes;
}

/** Human output. Silence is the useful answer, so it says so explicitly rather than printing
 *  nothing and leaving the reader to wonder whether it ran. */
export function formatLayoutDiff(before: LayoutSnapshot, after: LayoutSnapshot, changes: readonly LayoutChange[]): string {
  const header = `${before.version} → ${after.version}, measured at ${after.width}px`;
  if (before.width !== after.width) {
    return `${header}\n\nThese snapshots were taken at different widths (${before.width}px and ${after.width}px), so their geometry is not comparable.`;
  }
  if (changes.length === 0) return `${header}\n\nNo page changes layout.`;

  const byPage = new Map<string, LayoutChange[]>();
  for (const change of changes) {
    const list = byPage.get(change.page) ?? [];
    list.push(change);
    byPage.set(change.page, list);
  }
  const pages = [...byPage.keys()];
  const lines = [header, '', `Layout changes on ${pages.length} page${pages.length === 1 ? '' : 's'}: ${pages.join(', ')}.`, ''];
  for (const [page, list] of byPage) {
    lines.push(`${page}`);
    for (const change of list) lines.push(`  ${change.detail}`);
  }
  return lines.join('\n');
}
