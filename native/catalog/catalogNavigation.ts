/**
 * Pure catalog navigation logic — no React or React Native imports, so it runs under Node's test
 * runner. CatalogShell, CatalogSidebar, and SectionBlock all derive page order from here, so the
 * sidebar order, previous/next order, and fragment fallback can never drift apart.
 */
import type { NavGroup } from './types';

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
