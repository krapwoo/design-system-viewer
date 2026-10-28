/** Usage data (file format v1): where each component is used across the host app. The project
 *  generates the JSON file; `sync` validates it (`cli/usage.ts`) and the shell receives the result.
 *  Node-safe and React-free — the CLI imports it too. */

/** One place a component is used. */
export interface UsageUse {
  /** Free text: the product area the file belongs to. */
  area: string;
  file: string;
  line?: number;
}

export interface UsageEntry {
  /** The component's home area, free text. */
  area?: string;
  uses: UsageUse[];
}

export interface UsageData {
  version: 1;
  /** Optional display order for areas. */
  areas?: string[];
  /** Keyed by page id, component name, or family/group member id. */
  components: Record<string, UsageEntry>;
}

/** Looks the first matching key up in `data`; a falsy key is skipped. The caller passes keys in
 *  priority order (a page or member id first, then its `component`). */
export function findUsage(data: UsageData | null | undefined, keys: readonly (string | undefined)[]): UsageEntry | undefined {
  if (!data) return undefined;
  for (const key of keys) {
    if (key && Object.prototype.hasOwnProperty.call(data.components, key)) return data.components[key];
  }
  return undefined;
}

/** U5: a usage key can name a family or group page itself (its id or component). That entry shows
 *  once, after the page's members, unless a member matched the same entry — the whole of a family
 *  usually shares the page's id, and its own block already shows it. */
export function pageLevelUsage(
  data: UsageData | null | undefined,
  page: { id: string; component?: string },
  members: readonly { id: string; component?: string }[],
): UsageEntry | undefined {
  const entry = findUsage(data, [page.id, page.component]);
  if (!entry || members.some((member) => findUsage(data, [member.id, member.component]) === entry)) return undefined;
  return entry;
}

export interface UsageAreaCount {
  area: string;
  count: number;
}

/** Per-area use counts, highest first; equal counts fall back to the area name so the order is
 *  stable. */
export function countUsesByArea(uses: readonly UsageUse[]): UsageAreaCount[] {
  const counts = new Map<string, number>();
  for (const use of uses) counts.set(use.area, (counts.get(use.area) ?? 0) + 1);
  return [...counts].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

/** `file:line`, or just `file` when the use has no line. */
export function formatUseLocation(use: UsageUse): string {
  return use.line === undefined ? use.file : `${use.file}:${use.line}`;
}

/** The "Files that use it" list collapses to this many entries until expanded. */
export const USAGE_FILES_COLLAPSED = 8;
