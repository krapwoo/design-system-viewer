/**
 * Pure catalog navigation logic — no React or React Native imports, so it runs under Node's test
 * runner. CatalogShell, CatalogSidebar, and SectionBlock all derive page order from here, so the
 * sidebar order, previous/next order, and fragment fallback can never drift apart.
 */
import type { NavGroup, SectionDef, UpdateNotice, VersionStatus } from './types.ts';

/** Fixed English locale, case-insensitive, accent-distinguishing — the one comparator every
 *  canonical ordering (sidebar, filtered matches, previous/next, hash fallback) shares, so none of
 *  them can drift against each other. */
const TITLE_COLLATOR = new Intl.Collator('en', { sensitivity: 'accent' });

/** THE canonical ordering of two ids: by displayed title (`labels.get(id) ?? id`) first, then —
 *  for an equal title — by id with the same collator, then by exact code-unit id comparison for
 *  the rare case where case-insensitive ids also compare equal. */
function compareCanonical<TId extends string>(a: TId, b: TId, labels?: ReadonlyMap<string, string>): number {
  const byTitle = TITLE_COLLATOR.compare(labels?.get(a) ?? a, labels?.get(b) ?? b);
  if (byTitle !== 0) return byTitle;
  const byId = TITLE_COLLATOR.compare(a, b);
  if (byId !== 0) return byId;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** THE canonical within-group ordering of section ids: by each id's displayed title
 *  (`SectionDef.title`, via `labels`), falling back to the id itself when a page has no title. */
export function sortIds<TId extends string>(ids: readonly TId[], labels?: ReadonlyMap<string, string>): TId[] {
  return ids.slice().sort((a, b) => compareCanonical(a, b, labels));
}

/** Every page id in sidebar order: groups in declared order, ids sorted within each group (by
 *  displayed title, via `labels`), first occurrence wins, and ids without a matching section (when
 *  `availableIds` is given) are dropped. */
export function orderedIds<TId extends string>(
  groups: readonly NavGroup<TId>[],
  availableIds?: ReadonlySet<TId>,
  labels?: ReadonlyMap<string, string>,
): TId[] {
  const seen = new Set<TId>();
  const order: TId[] = [];
  for (const group of groups) {
    for (const id of sortIds(group.ids, labels)) {
      if (seen.has(id)) continue;
      if (availableIds && !availableIds.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
  }
  return order;
}

export function groupLabelFor<TId extends string>(groups: readonly NavGroup<TId>[], id: TId): string | undefined {
  return groups.find((group) => group.ids.includes(id))?.label;
}

/** Previous and next page ids. Never wraps; null marks an unavailable direction. */
export function neighbors<TId extends string>(
  order: readonly TId[],
  id: TId,
): { previous: TId | null; next: TId | null } {
  const index = order.indexOf(id);
  if (index < 0) return { previous: null, next: null };
  return {
    previous: index > 0 ? order[index - 1] : null,
    next: index < order.length - 1 ? order[index + 1] : null,
  };
}

/** Sidebar filter: case-insensitive substring match, sorted ids, empty groups removed. A page
 *  matches on its id, its title, or (spec §5.3) any of its family's member ids or aliases. */
export function filterGroups<TId extends string>(
  groups: readonly NavGroup<TId>[],
  query: string,
  /** Display titles by id; a page matches on its id or its title. */
  labels?: ReadonlyMap<string, string>,
  /** Every member id/alias a family page's members use, by page id. */
  memberIds?: ReadonlyMap<string, readonly string[]>,
): NavGroup<TId>[] {
  const q = query.trim().toLowerCase();
  return groups
    .map((group) => ({
      label: group.label,
      ids: sortIds(q ? group.ids.filter((id) =>
        id.toLowerCase().includes(q)
        || (labels?.get(id)?.toLowerCase().includes(q) ?? false)
        || (memberIds?.get(id)?.some((memberId) => memberId.toLowerCase().includes(q)) ?? false),
      ) : group.ids, labels),
    }))
    .filter((group) => group.ids.length > 0);
}

export function hashForId(id: string): string {
  return `#${encodeURIComponent(id)}`;
}

/** The page named by a URL fragment, or the first page when the fragment is empty, malformed, or
 *  unknown. Undefined only when there are no pages. */
export function idFromHash<TId extends string>(hash: string, order: readonly TId[]): TId | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let decoded = '';
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = '';
  }
  const match = order.find((id) => id === decoded);
  return match ?? order[0];
}

/** Design §5: the update panel is its own catalog page at this fragment, "not listed in the
 *  sidebar groups" — it is therefore never a member of `order`, so `idFromHash` alone would treat
 *  it as an unknown fragment and fall back to the first real page. */
export const UPDATE_PAGE_ID = 'ds-viewer-update';

/** The Overview page (shown only when the catalog has usage data) is reserved the same way. It has
 *  two tabs, addressed `#ds-viewer-overview` (Components) and `#ds-viewer-overview/usage`. */
export const OVERVIEW_PAGE_ID = 'ds-viewer-overview';
export type OverviewTab = 'components' | 'usage';

export function overviewHash(tab: OverviewTab): string {
  return tab === 'usage' ? `#${OVERVIEW_PAGE_ID}/usage` : `#${OVERVIEW_PAGE_ID}`;
}

/** The tab a decoded fragment names, or undefined when it is not an Overview address. */
export function overviewTabFromFragment(decoded: string): OverviewTab | undefined {
  if (decoded === OVERVIEW_PAGE_ID) return 'components';
  if (decoded === `${OVERVIEW_PAGE_ID}/usage`) return 'usage';
  return undefined;
}

/** The request header both the local endpoint (Task 12, which checks it) and the panel's own
 *  fetch calls (Task 16, which send it) use for the per-`dev`-run secret (design §5 "Local
 *  endpoint safeguards"). Defined once, here, rather than as a literal string repeated in both the
 *  `cli/` and `native/catalog/` halves of the package, which may never import from each other in
 *  the other direction (`cli/` imports `native/catalog/`; `native/catalog/` imports nothing from
 *  `cli/`). */
export const DS_VIEWER_SECRET_HEADER = 'x-ds-viewer-secret';

/** A minimal `major.minor.patch` comparison, duplicated from `cli/semver.ts`'s own
 *  `compareVersions` rather than imported — `native/catalog/` is the published package root and
 *  never imports from `cli/` (the same reasoning `native/catalog/updatePanelState.ts`'s own
 *  `UpdatePlanView`/`UpdateStatusView`, Task 15, already established for duplicated types). Used
 *  only as a defense-in-depth guard (Critical finding, Fable correction pass) alongside
 *  `checkForUpdate`'s own newer-than-current check (Task 4) — not a general-purpose semver
 *  comparator, the same scope note `cli/semver.ts`'s own `Version` interface already carries.
 *  Errata 5: parses with a regex rather than `split('.').map(Number)` so a prerelease suffix on
 *  either string (e.g. `0.4.1-verify`) doesn't turn the patch component into `NaN`; a string that
 *  doesn't match at all is treated as not newer. */
function isNewerVersion(a: string, b: string): boolean {
  const ma = a.match(/^(\d+)\.(\d+)\.(\d+)/);
  const mb = b.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!ma || !mb) return false;
  for (let i = 1; i <= 3; i += 1) {
    const na = Number(ma[i]);
    const nb = Number(mb[i]);
    if (na !== nb) return na > nb;
  }
  return false;
}

export function resolveActiveFromHash<TId extends string>(
  hash: string,
  order: readonly TId[],
): TId | typeof UPDATE_PAGE_ID | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let decoded = '';
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = '';
  }
  if (decoded === UPDATE_PAGE_ID) return UPDATE_PAGE_ID;
  return idFromHash(hash, order);
}

/** Where an alias or member id resolves: the family page `pageId`, and — unless it names the
 *  whole itself — the specific `memberId` within it. Built by `aliasTargets`. #64 B5: a
 *  tokenDefinition page's section alias instead sets `sectionId` (never together with
 *  `memberId`), so the page can scroll that section into view on arrival. */
export interface AliasTarget {
  pageId: string;
  memberId?: string;
  sectionId?: string;
}

/** Every member id other than the whole, every member alias, and every family page's own
 *  (page-level) alias, mapped to where it resolves (spec §5.3 "Old addresses"). #64 B5: also, a
 *  tokenDefinition page's own page-level aliases (`tokenDefinitionAliases`) and each of its
 *  sections' own `aliases` — the same routing a family page's aliases already get, extended to
 *  tokenDefinition pages. A page with neither contributes nothing. */
export function aliasTargets<TId extends string>(sections: readonly SectionDef<TId>[]): Map<string, AliasTarget> {
  const targets = new Map<string, AliasTarget>();
  for (const section of sections) {
    const family = section.family;
    if (family) {
      for (const member of family.members) {
        if (member.id === family.whole) {
          // C3: the whole's own id already resolves via `order` (it equals the page's own id), but
          // its own aliases were never registered anywhere — routing one to the page, with no member
          // focus (unlike a non-whole member's alias, which focuses that member).
          for (const alias of member.aliases ?? []) targets.set(alias, { pageId: section.id });
          continue;
        }
        targets.set(member.id, { pageId: section.id, memberId: member.id });
        for (const alias of member.aliases ?? []) targets.set(alias, { pageId: section.id, memberId: member.id });
      }
      for (const alias of family.aliases ?? []) targets.set(alias, { pageId: section.id });
    }
    for (const alias of section.tokenDefinitionAliases ?? []) targets.set(alias, { pageId: section.id });
    for (const tdSection of section.tokenDefinition?.sections ?? []) {
      for (const alias of tdSection.aliases ?? []) targets.set(alias, { pageId: section.id, sectionId: tdSection.id });
    }
  }
  return targets;
}

/** Where a URL fragment should take the viewer (spec §5.3). Unlike `resolveActiveFromHash`
 *  (kept, unchanged, for existing callers), this never silently falls back to the first page: an
 *  unknown or malformed fragment is reported as `notFound` instead. */
export type Route<TId extends string> =
  // #64 B5: `sectionId` is set only when a tokenDefinition page's own section alias resolved here
  // — the page then scrolls that section into view on arrival. Absent for every other page route,
  // exactly as before.
  | { kind: 'page'; id: TId; sectionId?: string }
  | { kind: 'member'; pageId: TId; memberId: string }
  | { kind: 'update' }
  /** The Overview page (only resolved when the catalog has usage data), on one of its two tabs. */
  | { kind: 'overview'; tab: OverviewTab }
  | { kind: 'notFound'; raw: string }
  | { kind: 'empty' };

export function resolveRoute<TId extends string>(
  hash: string,
  order: readonly TId[],
  aliases: ReadonlyMap<string, AliasTarget>,
  /** True when the catalog has usage data: only then does the Overview address resolve, otherwise
   *  it is as unknown as any other fragment. */
  overviewEnabled = false,
): Route<TId> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return { kind: 'empty' };
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: 'notFound', raw };
  }
  if (decoded === UPDATE_PAGE_ID) return { kind: 'update' };
  const overviewTab = overviewEnabled ? overviewTabFromFragment(decoded) : undefined;
  if (overviewTab) return { kind: 'overview', tab: overviewTab };
  if ((order as readonly string[]).includes(decoded)) return { kind: 'page', id: decoded as TId };
  const target = aliases.get(decoded);
  if (target) {
    if (target.memberId !== undefined) return { kind: 'member', pageId: target.pageId as TId, memberId: target.memberId };
    if (target.sectionId !== undefined) return { kind: 'page', id: target.pageId as TId, sectionId: target.sectionId };
    return { kind: 'page', id: target.pageId as TId };
  }
  return { kind: 'notFound', raw: decoded };
}

/** One member search candidate: a family page's member, with its owning page and family title. */
export interface MemberSearchEntry<TId extends string> {
  pageId: TId;
  memberId: string;
  aliases?: readonly string[];
  familyTitle: string;
}

/** Member search hits (spec §5.3 "Search"): every entry whose member id or alias contains the
 *  query, case-insensitively. The label is always the member id — the Swift declaration name. */
export function searchResults<TId extends string>(
  entries: readonly MemberSearchEntry<TId>[],
  query: string,
): Array<{ pageId: TId; memberId: string; label: string; familyTitle: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entries
    .filter((entry) => entry.memberId.toLowerCase().includes(q) || (entry.aliases ?? []).some((alias) => alias.toLowerCase().includes(q)))
    .map((entry) => ({ pageId: entry.pageId, memberId: entry.memberId, label: entry.memberId, familyTitle: entry.familyTitle }));
}

/** Design §5: "Major: ... dismissible per version; the footer line remains." `dismissedVersion`
 *  is whatever a previous dismissal recorded (`CatalogShell`'s own `localStorage` read, Task 14) —
 *  any value other than the *current* `update.latest` (including `null`, or an older dismissed
 *  major) still shows the banner, so dismissing 1.0.0 does not also suppress a later 2.0.0. */
export function shouldShowMajorBanner(update: UpdateNotice | null | undefined, dismissedVersion: string | null): boolean {
  if (!update || !update.breaking) return false;
  if (!isNewerVersion(update.latest, update.current)) return false;
  return update.latest !== dismissedVersion;
}

/** The quiet footer line's exact copy (design §5: `"Update available · 0.5.0"`), or `undefined`
 *  when there is nothing to show. Independent of `shouldShowMajorBanner` — design: the footer line
 *  shows for *every* available update, minor or major, and stays even once the major banner is
 *  dismissed. */
export function footerLabel(update: UpdateNotice | null | undefined): string | undefined {
  if (!update || !isNewerVersion(update.latest, update.current)) return undefined;
  return `Update available · ${update.latest}`;
}

/** The sidebar's footer line: the blue "Update available" notice when a newer version is known
 *  (from startup or **Check now**), else the installed version, quietly. `undefined` only for a
 *  workspace generated before version status existed, which keeps the old notice-only footer. */
export function footerLink(
  update: UpdateNotice | null | undefined,
  status: VersionStatus | null | undefined,
): { label: string; kind: 'update' | 'version' } | undefined {
  const notice = footerLabel(update) ?? footerLabel(status?.update);
  if (notice) return { label: notice, kind: 'update' };
  if (status) return { label: `DS Viewer ${status.current}`, kind: 'version' };
  return undefined;
}
