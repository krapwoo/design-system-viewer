/**
 * Pure catalog navigation logic — no React or React Native imports, so it runs under Node's test
 * runner. CatalogShell, CatalogSidebar, and SectionBlock all derive page order from here, so the
 * sidebar order, previous/next order, and fragment fallback can never drift apart.
 */
import type { NavGroup, UpdateNotice } from './types.ts';

/** THE canonical within-group ordering of section ids. */
export function sortIds<TId extends string>(ids: readonly TId[]): TId[] {
  return ids.slice().sort((a, b) => a.localeCompare(b));
}

/** Every page id in sidebar order: groups in declared order, ids sorted within each group,
 *  first occurrence wins, and ids without a matching section (when `availableIds` is given) are
 *  dropped. */
export function orderedIds<TId extends string>(
  groups: readonly NavGroup<TId>[],
  availableIds?: ReadonlySet<TId>,
): TId[] {
  const seen = new Set<TId>();
  const order: TId[] = [];
  for (const group of groups) {
    for (const id of sortIds(group.ids)) {
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

/** Sidebar filter: case-insensitive substring match, sorted ids, empty groups removed. */
export function filterGroups<TId extends string>(groups: readonly NavGroup<TId>[], query: string): NavGroup<TId>[] {
  const q = query.trim().toLowerCase();
  return groups
    .map((group) => ({
      label: group.label,
      ids: sortIds(q ? group.ids.filter((id) => id.toLowerCase().includes(q)) : group.ids),
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
