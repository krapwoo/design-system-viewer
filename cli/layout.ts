// cli/layout.ts — `explain --all` and `layout-diff`: capture every page's geometry as data,
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
import { sectionColumns } from '../native/catalog/tokenLayout.ts';
import { memberBlocks, toSectionDef } from './explain.ts';
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
  /** The narrowest width this block can take. `null` means the block deliberately owns a full row. */
  minWidth: number | null;
  /** Geometry with the whole row, and with half of it. Both are recorded because which one applies
   *  depends on a placement decision that needs measured heights (see `sideEligible`). */
  full?: BlockGeometry;
  half?: BlockGeometry;
}

export interface PageSnapshot {
  page: string;
  blocks: BlockSnapshot[];
  /** A family or group page's members, each member id to its own blocks (at the full row width,
   *  like `blocks`). Absent on a page with no members and on a snapshot written before this field
   *  existed; `diffLayouts` compares members only when both snapshots carry `membersRecorded`. */
  members?: Record<string, BlockSnapshot[]>;
  /** For a two-block page: whether both blocks keep their minimum width and still fit one row at
   *  half width. These are the gates `choosePlacement` can decide without measured height. The
   *  decision itself also weighs a single tall specimen and the height actually saved, neither of
   *  which is knowable without a browser, so this is reported as eligibility, not as the outcome. */
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
  /** Set by a version that records `members`. A page with no `members` in a marked snapshot has no
   *  members, so `diffLayouts` reads it as `{}` and reports a page that gains or loses its members;
   *  an unmarked (older) snapshot never recorded them, so members are not compared against it. */
  membersRecorded?: true;
  pages: PageSnapshot[];
}

function tokenSectionGeometry(block: Extract<PresentationBlock, { kind: 'tokenSections' }>, width: number): BlockGeometry {
  const columns = sectionColumns(width, block.columns);
  let rows = 0;
  let used = 0;
  let fillers = 0;
  const closePartialRow = () => {
    if (used === 0) return;
    rows += 1;
    fillers += columns - used;
    used = 0;
  };
  for (const section of block.sections) {
    if (section.wide) {
      closePartialRow();
      rows += 1;
      continue;
    }
    used += 1;
    if (used === columns) closePartialRow();
  }
  closePartialRow();
  return { columns, rows, fillers };
}

function geometryFor(block: PresentationBlock, width: number): BlockGeometry | undefined {
  if (block.kind === 'list') {
    const { columns, rows, fillers } = listGeometry(block.items.length, width, block.size, block.maxColumns);
    return { columns, rows, fillers };
  }
  if (block.kind === 'tokenSections') return tokenSectionGeometry(block, width);
  return undefined;
}

function snapshotMinWidth(block: PresentationBlock): number | null {
  const width = blockMinWidth(block);
  return Number.isFinite(width) ? width : null;
}

function blockSnapshot(block: PresentationBlock, full: number, half: number): BlockSnapshot {
  const fullGeometry = geometryFor(block, full);
  const halfGeometry = geometryFor(block, half);
  return {
    title: block.kind === 'tokenSections' ? 'Token sections' : block.title,
    kind: block.kind,
    ...(block.kind === 'list' ? { size: block.size, items: block.items.length } : {}),
    ...(block.kind === 'tokenSections' ? { items: block.sections.length } : {}),
    minWidth: snapshotMinWidth(block),
    ...(fullGeometry ? { full: fullGeometry } : {}),
    ...(halfGeometry ? { half: halfGeometry } : {}),
  };
}

/** One page's geometry, from the same static read `explain` uses. */
export function pageSnapshot(page: Parameters<typeof toSectionDef>[0], pageId: string): PageSnapshot {
  if (!page.checkable) return { page: pageId, blocks: [], notCheckable: true };
  const blocks = presentationBlocks(toSectionDef(page), { defaultPreviewWidths: [402] });
  const full = MATRIX_LAYOUT.laptopContentWidth;
  const half = Math.floor((full - CATALOG_LAYOUT.blockGap) / 2);

  const snapshot: PageSnapshot = {
    page: pageId,
    blocks: blocks.map((block) => blockSnapshot(block, full, half)),
    ...(page.members !== undefined && page.members.length > 0
      ? { members: Object.fromEntries(page.members.map((member) => [member.id, memberBlocks(member).map((block) => blockSnapshot(block, full, half))])) }
      : {}),
  };
  if (blocks.length === 2) {
    const [first, second] = blocks;
    const firstMin = blockMinWidth(first);
    const secondMin = blockMinWidth(second);
    const asPlacement = (b: PresentationBlock) => ({
      kind: b.kind, height: 0, minWidth: blockMinWidth(b),
      ...(b.kind === 'list' ? { itemCount: b.items.length, size: b.size, maxColumns: b.maxColumns } : {}),
    });
    // This is every static gate that runs before measured height enters choosePlacement. Omitting
    // the min-width check made Avatar claim eligibility even though its 600px grid can never fit the
    // 462px half-row; a later fitsOneRow change would then fabricate a placement change for it.
    snapshot.sideEligible = half > 0 && firstMin <= half && secondMin <= half
      && fitsOneRow(asPlacement(first), half) && fitsOneRow(asPlacement(second), half);
  }
  return snapshot;
}

/** Every page's geometry, ordered by page id so two snapshots diff line for line. */
export function layoutSnapshot(config: ResolvedConfig, version: string): LayoutSnapshot {
  const staticPages = discoverStaticPages(config);
  const ids = staticPages.map((page) => resolvePageId(page, page.file));
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length > 0) {
    throw new Error(`Cannot snapshot duplicate page id${duplicates.length === 1 ? '' : 's'}: ${duplicates.join(', ')}. Run ds-viewer doctor and give each page a unique id.`);
  }
  const pages = staticPages
    .map((page, index) => pageSnapshot(page, ids[index]))
    // Code-point order is stable across machines; localeCompare can produce different snapshot text
    // under different host locales, defeating a committed artifact's textual review.
    .sort((a, b) => (a.page < b.page ? -1 : a.page > b.page ? 1 : 0));
  return { version, width: MATRIX_LAYOUT.laptopContentWidth, membersRecorded: true, pages };
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

function describeMinWidth(width: number | null): string {
  return width === null ? 'a full row' : `${width}px`;
}

function blockKeys(blocks: readonly BlockSnapshot[]): { key: string; label: string }[] {
  const seen = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const block of blocks) totals.set(block.title, (totals.get(block.title) ?? 0) + 1);
  return blocks.map((block) => {
    const occurrence = (seen.get(block.title) ?? 0) + 1;
    seen.set(block.title, occurrence);
    return {
      key: `${block.title}\u0000${occurrence}`,
      label: (totals.get(block.title) ?? 0) > 1 ? `${block.title} (${occurrence})` : block.title,
    };
  });
}

/** What changed between two lists of one page's (or one member's) blocks. `prefix` leads every
 *  detail, naming the member when it is one. */
function diffBlocks(pageId: string, wasBlocks: readonly BlockSnapshot[], nowBlocks: readonly BlockSnapshot[], prefix: string): LayoutChange[] {
  const changes: LayoutChange[] = [];
  // Title is a block's identity here. Two blocks on one page sharing a title would be
  // indistinguishable, so those fall back to their position *within that title* — which keeps a
  // page with two "Variants" blocks comparing like for like instead of silently dropping one.
  const index = (blocks: readonly BlockSnapshot[]) => {
    const map = new Map<string, BlockSnapshot[]>();
    for (const block of blocks) {
      const list = map.get(block.title) ?? [];
      list.push(block);
      map.set(block.title, list);
    }
    return map;
  };
  const oldBlocks = index(wasBlocks);
  const newBlocks = index(nowBlocks);

  for (const [title, list] of oldBlocks) {
    const now = newBlocks.get(title) ?? [];
    for (let i = now.length; i < list.length; i += 1) {
      changes.push({ page: pageId, kind: 'blocks', detail: `${prefix}"${title}" is gone` });
    }
  }
  for (const [title, list] of newBlocks) {
    const before_ = oldBlocks.get(title) ?? [];
    for (const [i, block] of list.entries()) {
      const old = before_[i];
      if (!old) {
        changes.push({ page: pageId, kind: 'blocks', detail: `${prefix}"${title}" is new` });
        continue;
      }
      if (old.kind !== block.kind) {
        changes.push({ page: pageId, kind: 'blocks', detail: `${prefix}"${block.title}" is a ${block.kind} block, was ${old.kind}` });
        continue;
      }
      if (old.minWidth !== block.minWidth) {
        changes.push({
          page: pageId,
          kind: 'geometry',
          detail: `${prefix}"${block.title}" needs ${describeMinWidth(block.minWidth)}, was ${describeMinWidth(old.minWidth)}`,
        });
      }
      for (const width of ['full', 'half'] as const) {
        const a = old[width];
        const b = block[width];
        if (describeGeometry(a) !== describeGeometry(b)) {
          changes.push({
            page: pageId, kind: 'geometry',
            detail: `${prefix}"${block.title}" at ${width} width: ${describeGeometry(a)} → ${describeGeometry(b)}`,
          });
        }
      }
    }
  }

  // Compare relative order among blocks that exist on both sides. Inserting a new block at the
  // front does not falsely say every existing block moved, but swapping two existing blocks does
  // remain visible rather than disappearing behind title-based identity.
  const oldKeyed = blockKeys(wasBlocks);
  const newKeyed = blockKeys(nowBlocks);
  const oldSet = new Set(oldKeyed.map(({ key }) => key));
  const newSet = new Set(newKeyed.map(({ key }) => key));
  const oldCommon = oldKeyed.filter(({ key }) => newSet.has(key));
  const newCommon = newKeyed.filter(({ key }) => oldSet.has(key));
  const oldPositions = new Map(oldCommon.map(({ key }, index) => [key, index]));
  for (const [index, { key, label }] of newCommon.entries()) {
    const oldIndex = oldPositions.get(key);
    if (oldIndex !== undefined && oldIndex !== index) {
      changes.push({
        page: pageId,
        kind: 'blocks',
        detail: `${prefix}"${label}" moved from block ${oldIndex + 1} to ${index + 1}`,
      });
    }
  }

  return changes;
}

/** What changed between two snapshots. Pure, so it is the part worth testing.
 *
 *  Blocks are matched by title, not by position. Comparing by index means a block inserted at the
 *  front diffs every later block against its neighbour: a page that gained an intro block reported
 *  four changes, including a brand-new block "changing" from a geometry it never had and an
 *  untouched block changing to its neighbour's. A tool whose output is meant to be believed cannot
 *  invent changes that did not happen. */
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

    changes.push(...diffBlocks(page.page, was.blocks, page.blocks, ''));

    // A member's blocks are compared only when both snapshots recorded members: one written before
    // members were captured has none, and reading that as "every member is new" would invent changes.
    // In a marked snapshot a page without `members` has none, so it compares as `{}`.
    if (before.membersRecorded && after.membersRecorded) {
      const wasMembers = was.members ?? {};
      const nowMembers = page.members ?? {};
      for (const id of Object.keys(wasMembers)) {
        if (!(id in nowMembers)) changes.push({ page: page.page, kind: 'blocks', detail: `member "${id}" is gone` });
      }
      for (const [id, blocks] of Object.entries(nowMembers)) {
        const old = wasMembers[id];
        if (!old) {
          changes.push({ page: page.page, kind: 'blocks', detail: `member "${id}" is new` });
          continue;
        }
        changes.push(...diffBlocks(page.page, old, blocks, `member "${id}": `));
      }
    }

    if (typeof was.sideEligible === 'boolean' && typeof page.sideEligible === 'boolean' && was.sideEligible !== page.sideEligible) {
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

/** True when two snapshots were measured at the same width, and so can be compared at all.
 *  Geometry at 952px and at 1112px legitimately differs; diffing across them reports rule changes
 *  that never happened. Exported because every caller needs the guard, not just the one that
 *  prints prose. */
export function comparableWidths(before: LayoutSnapshot, after: LayoutSnapshot): boolean {
  return before.width === after.width;
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
