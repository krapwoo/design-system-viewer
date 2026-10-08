import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Minimal glob matcher for the shapes `ds-viewer.config.ts` actually uses (see design §2's
 * example: `'src/ds/components/*\/index.ts'`) — a single `*` standing for one path segment, or
 * `**` for zero or more. No globbing dependency is pulled in for this small a pattern class.
 */
export function resolveGlob(root: string, pattern: string): string[] {
  return walk(root, pattern.split('/'), []);
}

/** The folder a glob pattern varies under — e.g. `src/components` for `src/components/*\/index.ts`
 *  — the part of the pattern before its first wildcard segment (or, for a pattern with no
 *  wildcard, its own containing folder). Shared by every caller that needs a glob's base folder
 *  rather than its matches (`sync`'s `optionRoots`, `workspace`'s `tsconfig` `include`, `dev`'s
 *  watch folders). */
export function globBaseFolder(pattern: string): string {
  const segments = pattern.split('/');
  const wildcardIndex = segments.findIndex((segment) => segment.includes('*'));
  const baseSegments = wildcardIndex === -1 ? segments.slice(0, -1) : segments.slice(0, wildcardIndex);
  return baseSegments.join('/') || '.';
}

function walk(root: string, segments: string[], consumed: string[]): string[] {
  if (segments.length === 0) {
    const fullPath = path.join(root, ...consumed);
    try {
      return statSync(fullPath).isFile() ? [fullPath] : [];
    } catch {
      return [];
    }
  }
  const [segment, ...rest] = segments;
  const dir = path.join(root, ...consumed);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  if (segment === '**') {
    const here = walk(root, rest, consumed);
    const deeper = entries
      .filter((entry) => isDirectory(path.join(dir, entry)))
      .sort()
      .flatMap((entry) => walk(root, segments, [...consumed, entry]));
    return [...here, ...deeper];
  }
  const regex = globSegmentToRegExp(segment);
  // Sorted so every caller (notably `sync`, design §3 — "sorted and deterministic") gets the same
  // order regardless of the filesystem's own directory-entry order (APFS does not sort `readdirSync`).
  return entries
    .filter((entry) => regex.test(entry))
    .sort()
    .flatMap((entry) => walk(root, rest, [...consumed, entry]));
}

function isDirectory(fullPath: string): boolean {
  try {
    return statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}

function globSegmentToRegExp(segment: string): RegExp {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}
