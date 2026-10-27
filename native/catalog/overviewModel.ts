/** The Overview page's data (contract O): which pages qualify, what each card says, and how cards are
 *  grouped, filtered and sorted. Node-safe and React-free — only React *types* — so the whole model runs under Node's test runner. */
import type { ReactNode } from 'react';
import type { UsageAreaCount, UsageData, UsageEntry, UsageUse } from './usage.ts';
import type { NavGroup, PreviewWidths, SectionDef, SpecimenSurfaceKind } from './types.ts';

// This file imports only types: the host apps compile `native/catalog` without
// `allowImportingTsExtensions`, and Node's test runner needs the `.ts` extension, so a value import
// of a sibling would break one of the two. What it needs from `usage.ts` and `tokens.ts` is passed in.

/** The final group of cards that have no home area. */
export const OVERVIEW_OTHER = 'Other';

export type OverviewFilter = { kind: 'all' } | { kind: 'shared' } | { kind: 'area'; area: string };
export type ComponentsSort = 'area' | 'used';

/** The Overview's own choices, kept by the shell so Back from a card returns to the same view. */
export interface OverviewPrefs {
  filter: OverviewFilter;
  componentsSort: ComponentsSort;
}

export const DEFAULT_OVERVIEW_PREFS: OverviewPrefs = { filter: { kind: 'all' }, componentsSort: 'area' };

/** What a card's thumbnail renders: one authored node, or a page's `render()` (called inside the
 *  thumbnail so its hooks run in a component, as they do in `Preview`). */
export type ThumbnailSource = (
  | { node: ReactNode }
  | { render: () => ReactNode }
) & {
  /** The width the specimen is laid out at before it is scaled down — the page's own first preview
   *  width, so it looks as it does on its page. Absent: the thumbnail's default phone width. */
  width?: number;
  /** The stage the specimen sits on; absent: the catalog's default (`'auto'`). */
  surface?: SpecimenSurfaceKind;
};

export interface OverviewPage {
  id: string;
  title: string;
  source: ThumbnailSource;
  /** The home area, from the usage entry's `area`. */
  home?: string;
  /** True when the page has a usage entry at all (even with no uses). */
  hasUsage: boolean;
  uses: number;
  /** Use counts by area, most first. */
  byArea: ReadonlyArray<{ area: string; count: number }>;
  /** Used in at least one area other than its home area. */
  shared: boolean;
}

const TITLE_COLLATOR = new Intl.Collator('en', { sensitivity: 'accent' });

function hasNode(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false;
}

type Specimenful = Pick<SectionDef, 'variants' | 'states' | 'comparison'> & {
  previewWidths?: PreviewWidths;
  specimenSurface?: SpecimenSurfaceKind;
};

/** The width of a `'full'` preview: a roomy desktop-ish frame, since the specimen is shrunk to fit. */
const FULL_PREVIEW_WIDTH = 720;

/** The first numeric preview width, as the page's first specimen frame uses it; `undefined` when
 *  the page has none (the thumbnail then lays out at a phone width). */
function firstPreviewWidth(widths: PreviewWidths | undefined): number | undefined {
  if (widths === 'full') return FULL_PREVIEW_WIDTH;
  return widths?.find((width) => Number.isFinite(width) && width > 0);
}

/** The first specimen a page or member shows: its first variant, else first state, else the first
 *  available comparison cell — with the surface that specimen sits on. */
function firstSpecimen(source: Specimenful): { node: ReactNode; surface?: SpecimenSurfaceKind } | undefined {
  const variant = source.variants?.items.find((item) => hasNode(item.node));
  if (variant) return { node: variant.node, surface: variant.surface ?? source.specimenSurface };
  const state = source.states?.items.find((item) => hasNode(item.node));
  if (state) return { node: state.node, surface: state.surface ?? source.specimenSurface };
  const cell = source.comparison?.cells.find((item) => hasNode(item.node));
  return cell ? { node: cell.node, surface: cell.surface ?? source.specimenSurface } : undefined;
}

/** Only keys that have a value, so a plain page's source stays `{ node }`. */
function withLook(
  base: { node: ReactNode } | { render: () => ReactNode },
  widths: PreviewWidths | undefined,
  surface: SpecimenSurfaceKind | undefined,
): ThumbnailSource {
  const width = firstPreviewWidth(widths);
  return { ...base, ...(width !== undefined && { width }), ...(surface !== undefined && { surface }) };
}

/** Ids of the pages in a "Tokens" group. A `tokenGallery` page there is a token page; the same
 *  flag on a page elsewhere (a full-width pattern screen) is only a layout choice. */
export function tokenGroupIds(groups: readonly NavGroup<string>[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) if (group.label.trim().toLowerCase() === 'tokens') for (const id of group.ids) ids.add(id);
  return ids;
}

/** The thumbnail source of a page, or undefined when the page has nothing to show — a token page,
 *  or a page with no specimen. A token page is one defined by `tokenDefinition`/`tokenSections`, or a
 *  `tokenGallery` page the catalog lists in its Tokens group (`inTokenGroup`). A family or group page
 *  uses its first member that has a specimen. */
export function thumbnailSource(def: SectionDef, options: { inTokenGroup?: boolean; defaultPreviewWidths?: PreviewWidths } = {}): ThumbnailSource | undefined {
  if (def.tokenDefinition || (def.tokenSections?.length ?? 0) > 0) return undefined;
  if (def.tokenGallery && options.inTokenGroup) return undefined;
  if (def.family) {
    for (const member of def.family.members) {
      const specimen = firstSpecimen(member);
      if (specimen) return withLook({ node: specimen.node }, member.previewWidths ?? def.previewWidths ?? options.defaultPreviewWidths, specimen.surface ?? def.specimenSurface);
    }
    return undefined;
  }
  const specimen = firstSpecimen(def);
  if (specimen) return withLook({ node: specimen.node }, def.previewWidths ?? options.defaultPreviewWidths, specimen.surface);
  // A `render()` preview on a token gallery sits on no stage (`SectionBlock` passes none).
  return def.render ? withLook({ render: def.render }, def.previewWidths ?? options.defaultPreviewWidths, def.tokenGallery ? undefined : def.specimenSurface) : undefined;
}

/** Whether a page gets an Overview card: a specimen to show, and not a token page. */
export function qualifiesForOverview(def: SectionDef, options: { inTokenGroup?: boolean } = {}): boolean {
  return thumbnailSource(def, options) !== undefined;
}

/** `findUsage` from `usage.ts`, passed in (see the note at the top). */
export type UsageLookup = (data: UsageData, keys: readonly (string | undefined)[]) => UsageEntry | undefined;
/** `countUsesByArea` from `usage.ts`, passed in too: the "Appears in" block and the Overview must
 *  order tied areas the same way, so there is one comparator and it lives there. */
export type UsageAreaCounter = (uses: readonly UsageUse[]) => UsageAreaCount[];
export interface UsageHelpers {
  find: UsageLookup;
  countByArea: UsageAreaCounter;
}

/** The usage entries that describe a page: its own (by id, then component), then each member's —
 *  distinct entries only, so a key shared by a page and its whole counts once. */
function pageEntries(def: SectionDef, usage: UsageData, find: UsageLookup): UsageEntry[] {
  const entries = new Set<UsageEntry>();
  const add = (keys: readonly (string | undefined)[]) => {
    const entry = find(usage, keys);
    if (entry) entries.add(entry);
  };
  add([def.id, def.component]);
  for (const member of def.family?.members ?? []) add([member.id, member.component]);
  return [...entries];
}

/** Every page that gets a card, in the catalog's own order. `browsable`, when given, drops pages the
 *  sidebar does not list (reference-only pages), so a card never opens a page that is hidden from
 *  browsing; `tokenIds` are the pages of the Tokens group (see `tokenGroupIds`). */
export function buildOverviewPages(
  sections: readonly SectionDef[],
  usage: UsageData,
  { find, countByArea }: UsageHelpers,
  { browsable, tokenIds, defaultPreviewWidths }: { browsable?: ReadonlySet<string>; tokenIds?: ReadonlySet<string>; defaultPreviewWidths?: PreviewWidths } = {},
): OverviewPage[] {
  const pages: OverviewPage[] = [];
  for (const def of sections) {
    if (browsable && !browsable.has(def.id)) continue;
    const source = thumbnailSource(def, { inTokenGroup: tokenIds?.has(def.id), defaultPreviewWidths });
    if (!source) continue;
    const entries = pageEntries(def, usage, find);
    const uses = entries.flatMap((entry) => entry.uses);
    const home = entries.find((entry) => entry.area)?.area;
    pages.push({
      id: def.id,
      title: def.title ?? def.id,
      source,
      home,
      hasUsage: entries.length > 0,
      uses: uses.length,
      byArea: countByArea(uses),
      shared: home !== undefined && uses.some((use) => use.area !== home),
    });
  }
  return pages;
}

/** Areas in the usage file's `areas` order, then any other area the pages mention, alphabetically. */
export function orderAreas(declared: readonly string[] | undefined, pages: readonly OverviewPage[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const push = (area: string) => {
    if (seen.has(area)) return;
    seen.add(area);
    order.push(area);
  };
  for (const area of declared ?? []) push(area);
  const extra = new Set<string>();
  for (const page of pages) {
    if (page.home) extra.add(page.home);
    for (const { area } of page.byArea) extra.add(area);
  }
  for (const area of [...extra].sort(TITLE_COLLATOR.compare)) push(area);
  return order;
}

export function compareByTitle(a: OverviewPage, b: OverviewPage): number {
  return TITLE_COLLATOR.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function filterPages(pages: readonly OverviewPage[], filter: OverviewFilter): OverviewPage[] {
  if (filter.kind === 'shared') return pages.filter((page) => page.shared);
  if (filter.kind === 'area') return pages.filter((page) => page.home === filter.area);
  return pages.slice();
}

/** The chips' areas: those that are the home of at least one page, in display order. */
export function chipAreas(pages: readonly OverviewPage[], areaOrder: readonly string[]): string[] {
  const homes = new Set(pages.map((page) => page.home).filter((home): home is string => home !== undefined));
  return areaOrder.filter((area) => homes.has(area));
}

export interface OverviewGroup {
  area: string;
  /** The group of pages with no home area, titled "Other". Distinct from a real area that happens to
   *  be named "Other" (area names are free text). */
  fallback?: true;
  pages: OverviewPage[];
}

/** Cards grouped by home area (areas in display order, then the home-less group last), alphabetical
 *  within a group. A group with no cards is left out. The home-less group is keyed by `undefined`,
 *  which no area name can equal. */
export function groupByHome(pages: readonly OverviewPage[], areaOrder: readonly string[]): OverviewGroup[] {
  const byHome = new Map<string | undefined, OverviewPage[]>();
  for (const page of pages) {
    const list = byHome.get(page.home);
    if (list) list.push(page);
    else byHome.set(page.home, [page]);
  }
  const groups: OverviewGroup[] = [];
  for (const area of areaOrder) {
    const list = byHome.get(area);
    if (list) groups.push({ area, pages: list.sort(compareByTitle) });
  }
  const homeless = byHome.get(undefined);
  if (homeless) groups.push({ area: OVERVIEW_OTHER, fallback: true, pages: homeless.sort(compareByTitle) });
  return groups;
}

/** "Most used": a flat list, most uses first, then by title. */
export function sortByUses(pages: readonly OverviewPage[]): OverviewPage[] {
  return pages.slice().sort((a, b) => b.uses - a.uses || compareByTitle(a, b));
}

/** "17 uses · 7 areas", "52 uses · Settings only", "1 use · Chat only"; "No usage recorded" without
 *  any, "No uses yet" for an entry with an empty list. */
export function usageLine(page: Pick<OverviewPage, 'hasUsage' | 'uses' | 'byArea'>): string {
  if (!page.hasUsage) return 'No usage recorded';
  if (page.uses === 0) return 'No uses yet';
  const uses = `${page.uses} ${page.uses === 1 ? 'use' : 'uses'}`;
  return page.byArea.length === 1 ? `${uses} · ${page.byArea[0].area} only` : `${uses} · ${page.byArea.length} areas`;
}

/** How far to shrink a specimen of `natural` size so it fits `frame` with `inset` to spare. Never
 *  above 1: a small specimen is centred at its own size, not enlarged. */
export function thumbnailScale(natural: { width: number; height: number }, frame: { width: number; height: number }, inset: number): number {
  if (natural.width <= 0 || natural.height <= 0 || frame.width <= 0 || frame.height <= 0) return 1;
  return Math.min(1, (frame.width - 2 * inset) / natural.width, (frame.height - 2 * inset) / natural.height);
}
