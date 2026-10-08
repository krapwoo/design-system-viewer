// cli/semver.ts

/** This package's own version scheme only — `major.minor.patch` plus an optional
 *  `-prerelease` tag (e.g. the throwaway `0.3.1-e2e-spike` this plan's own end-to-end spike
 *  published). Not a general-purpose semver parser: build metadata (`+...`) and multi-segment
 *  prerelease identifiers are out of scope because this package never publishes either. */
export interface Version {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;

export function parseVersion(raw: string): Version {
  const match = VERSION_RE.exec(raw.trim());
  if (!match) throw new Error(`Not a version: "${raw}"`);
  const [, major, minor, patch, prerelease] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch), prerelease };
}

/** -1 when `a` is older than `b`, 1 when newer, 0 when equal — prerelease tags are ignored for
 *  ordering (this package only ever compares a real installed version against a real registry
 *  "latest", which is never a prerelease; the throwaway spike tag above is test-only). */
export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return 0;
}

/** Design §5 "Releasing" — "From 1.0, breaking changes only in major versions"; before that, this
 *  plan still needs one consistent rule to decide the banner vs. the quiet footer line (design
 *  §5 "Viewer notice"), and a major-version bump is the only rule that needs no per-release
 *  judgment call. */
export function isBreakingUpgrade(current: Version, latest: Version): boolean {
  return latest.major > current.major;
}
