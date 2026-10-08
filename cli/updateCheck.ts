// cli/updateCheck.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compareVersions, isBreakingUpgrade, parseVersion } from './semver.ts';

/** Exactly what the user-wide cache file holds — deliberately missing `current`/`breaking`
 *  (Critical finding, Fable correction pass): the cache is shared across every project on this
 *  machine, so it must never carry one project's "current" version into another's — or into the
 *  same project after `update` moves it forward. `checkForUpdate` always computes `current`/
 *  `breaking` fresh, from the `currentVersion` argument it was actually called with. */
export interface CachedUpdateCheck {
  latest: string;
  /** "What's new" bullet lines, extracted from the GitHub release body (design §5's "the GitHub
   *  release for that tag for the summary"); empty when the release couldn't be fetched or had no
   *  bullet lines — never invented. At most 5, matching the approved mockup's own 3-bullet example
   *  without letting an unusually long release body overwhelm the panel. */
  summary: string[];
  /** The release's own publish date (ISO 8601), when known — the panel's "Released N days ago." */
  releasedAt?: string;
  /** When this result was produced — the 24-hour cache key. */
  checkedAt: string;
}

export interface UpdateCheckResult extends CachedUpdateCheck {
  current: string;
  breaking: boolean;
}

const CACHE_FILE_NAME = 'update-check.json';
const PACKAGE_NAME = '@krapwoo/ds-viewer';
const REGISTRY_URL = `https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME).replace('%40', '@')}/latest`;
const GITHUB_REPO = 'krapwoo/design-system-viewer';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Design §5: a user-wide (not project-wide) cache folder, shared across every project running
 *  this CLI — one real release per package version, so there is nothing to key by project. */
export function cacheDirFor(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, homedir: string): string {
  if (platform === 'darwin') return path.posix.join(homedir, 'Library', 'Caches', 'ds-viewer');
  if (platform === 'win32') return path.win32.join(env.LOCALAPPDATA ?? path.win32.join(homedir, 'AppData', 'Local'), 'ds-viewer');
  return path.posix.join(env.XDG_CACHE_HOME ?? path.posix.join(homedir, '.cache'), 'ds-viewer');
}

export function readCache(cacheDir: string): CachedUpdateCheck | undefined {
  const file = path.join(cacheDir, CACHE_FILE_NAME);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as CachedUpdateCheck;
  } catch {
    return undefined;
  }
}

function writeCache(cacheDir: string, cached: CachedUpdateCheck): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path.join(cacheDir, CACHE_FILE_NAME), JSON.stringify(cached));
}

export function isCacheFresh(cache: CachedUpdateCheck, nowMs: number): boolean {
  return nowMs - Date.parse(cache.checkedAt) < TWENTY_FOUR_HOURS_MS;
}

/** The one place "is this actually worth showing" is decided: a cached/fetched `latest` that is
 *  not strictly newer than the version asking (already up to date, or — this repository's own
 *  `kit-host` before a real publish — temporarily *ahead* of what the registry reports) resolves
 *  to `undefined`, the same uniform "no update known" every other non-case already returns
 *  (Critical finding, Fable correction pass: without this, a stale/foreign cache entry could show
 *  a downgrade, or keep showing an update that was already applied). */
function toResultOrUndefined(cached: CachedUpdateCheck, currentVersion: string): UpdateCheckResult | undefined {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(cached.latest);
  if (compareVersions(latest, current) <= 0) return undefined;
  return { ...cached, current: currentVersion, breaking: isBreakingUpgrade(current, latest) };
}

/** `config` only ever needs its one field here — a plain object literal, not the full
 *  `ResolvedConfig`, is deliberately accepted so this has no import-time dependency on `cli/types.ts`. */
export function isUpdateCheckEnabled(config: { updateCheck?: boolean }, env: NodeJS.ProcessEnv): boolean {
  if (env.DS_VIEWER_NO_UPDATE_CHECK === '1') return false;
  return config.updateCheck ?? true;
}

/** `- ` or `* ` markdown list items only, trimmed, in order, capped at 5 — a release body's prose
 *  paragraphs are never shown as if they were bullets. */
export function extractSummaryBullets(body: string): string[] {
  return body
    .split('\n')
    .map((line) => /^[-*]\s+(.*)$/.exec(line.trim())?.[1])
    .filter((line): line is string => Boolean(line))
    .slice(0, 5);
}

/** Exported for `cli/updatePlan.ts` (Task 9), which needs the exact same "don't hang forever on
 *  the GitHub release" behavior for its own plan-building fetch (Important finding, Fable
 *  correction pass: that fetch had no timeout of its own before). */
export async function fetchWithTimeout(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export interface UpdateCheckOptions {
  cacheDir?: string;
  fetchImpl?: typeof fetch;
  /** Each of the two requests' own timeout (design §5: "Timeout under 1 second each"). */
  timeoutMs?: number;
  now?: () => number;
}

/** Design §5 "Update check" in full. Never throws — every failure (a stale/missing cache with no
 *  reachable registry, a GitHub release that 404s, a request that times out) resolves to either a
 *  usable result or `undefined`, so every caller can treat "no update known" as the one, uniform
 *  outcome of being offline, blocked, or genuinely up to date with nothing cached yet. */
export async function checkForUpdate(currentVersion: string, options: UpdateCheckOptions = {}): Promise<UpdateCheckResult | undefined> {
  const now = options.now ?? Date.now;
  const cacheDir = options.cacheDir ?? cacheDirFor(process.platform, process.env, process.env.HOME ?? process.env.USERPROFILE ?? '');
  const cached = readCache(cacheDir);
  if (cached && isCacheFresh(cached, now())) return toResultOrUndefined(cached, currentVersion);

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 900;
  let latest: string;
  try {
    const registryResponse = (await fetchWithTimeout(REGISTRY_URL, fetchImpl, timeoutMs)) as { version: string };
    latest = registryResponse.version;
  } catch {
    // A stale cache is still better than nothing once offline — still run through the same
    // not-actually-newer guard, never a raw passthrough.
    return cached ? toResultOrUndefined(cached, currentVersion) : undefined;
  }

  let summary: string[] = [];
  let releasedAt: string | undefined;
  try {
    const release = (await fetchWithTimeout(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${latest}`,
      fetchImpl,
      timeoutMs,
    )) as { body?: string; published_at?: string };
    summary = release.body ? extractSummaryBullets(release.body) : [];
    releasedAt = release.published_at;
  } catch {
    // The version comparison is the half that matters for the footer/banner; a missing release
    // summary (private repo hiccup, a tag pushed slightly before its release note) degrades to an
    // empty "What's new" list, never a failed check.
  }

  const cachedResult: CachedUpdateCheck = { latest, summary, releasedAt, checkedAt: new Date(now()).toISOString() };
  // compareVersions is used only to decide *whether* this is worth caching as "the latest" at all
  // — a registry that (briefly, during its own propagation) reports an older "latest" than what
  // is already cached never regresses the cache.
  if (!cached || compareVersions(parseVersion(cachedResult.latest), parseVersion(cached.latest)) >= 0) {
    writeCache(cacheDir, cachedResult);
  }
  return toResultOrUndefined(cachedResult, currentVersion);
}

/** Design §5: "`dev` writes the result to `.ds-viewer/update.json`; the viewer reads it." Always
 *  writes something — `null` when there is no result — so the generated entry file (Task 17) can
 *  unconditionally `import updateNotice from './update.json'` without ever hitting a missing file. */
export function writeUpdateFile(projectRoot: string, result: UpdateCheckResult | undefined): string {
  const file = path.join(projectRoot, '.ds-viewer', 'update.json');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(result ?? null));
  return file;
}
