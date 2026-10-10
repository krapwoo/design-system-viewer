// cli/updateCheck.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compareVersions, isBreakingUpgrade, parseVersion } from './semver.ts';
import type { AutoCheckSource, VersionStatus } from '../native/catalog/types.ts';

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
  /** Ask npm even when the 24-hour cache is fresh (the update page's **Check now**). */
  force?: boolean;
}

/** One update check, with whether npm actually answered — `checkForUpdate` alone can't tell "no
 *  newer version" from "couldn't reach npm", which the update page must say differently. Never
 *  throws. `cached` is the cache as it stands afterwards (the last successful check on this
 *  computer), when there is one. */
export async function runUpdateCheck(
  currentVersion: string,
  options: UpdateCheckOptions = {},
): Promise<{ result?: UpdateCheckResult; reached: boolean; cached?: CachedUpdateCheck }> {
  const now = options.now ?? Date.now;
  const cacheDir = options.cacheDir ?? cacheDirFor(process.platform, process.env, process.env.HOME ?? process.env.USERPROFILE ?? '');
  const cached = readCache(cacheDir);
  // `parseVersion` (inside `toResultOrUndefined`) throws on a non-semver `latest`, whether from a
  // malformed cache file or an unexpected registry body; this function must never throw.
  const safeResult = (entry: CachedUpdateCheck) => {
    try {
      return toResultOrUndefined(entry, currentVersion);
    } catch {
      return undefined;
    }
  };
  if (cached && !options.force && isCacheFresh(cached, now())) return { result: safeResult(cached), reached: true, cached };

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 900;
  let latest: string;
  try {
    const registryResponse = (await fetchWithTimeout(REGISTRY_URL, fetchImpl, timeoutMs)) as { version: string };
    latest = registryResponse.version;
    parseVersion(latest);
  } catch {
    // A stale cache is still better than nothing once offline — still run through the same
    // not-actually-newer guard, never a raw passthrough.
    return { result: cached ? safeResult(cached) : undefined, reached: false, cached };
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

  const fresh: CachedUpdateCheck = { latest, summary, releasedAt, checkedAt: new Date(now()).toISOString() };
  // A registry that (briefly, during its own propagation) reports an older "latest" than what is
  // already cached never regresses the cache's version, but the check time still moves forward.
  let stored = fresh;
  try {
    if (cached && compareVersions(parseVersion(fresh.latest), parseVersion(cached.latest)) < 0) stored = { ...cached, checkedAt: fresh.checkedAt };
  } catch {
    // An unreadable cached version is simply replaced.
  }
  try {
    writeCache(cacheDir, stored);
  } catch {
    // A read-only cache folder must not turn a successful check into a failure.
  }
  return { result: safeResult(fresh), reached: true, cached: stored };
}

/** Design §5 "Update check" in full. Never throws — every failure (a stale/missing cache with no
 *  reachable registry, a GitHub release that 404s, a request that times out) resolves to either a
 *  usable result or `undefined`, so every caller can treat "no update known" as the one, uniform
 *  outcome of being offline, blocked, or genuinely up to date with nothing cached yet. */
export async function checkForUpdate(currentVersion: string, options: UpdateCheckOptions = {}): Promise<UpdateCheckResult | undefined> {
  try {
    return (await runUpdateCheck(currentVersion, options)).result;
  } catch {
    return undefined;
  }
}

/** A settings folder, not the cache folder (which the OS may clear): the personal switch must
 *  survive. */
export function preferencesDirFor(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, homedir: string): string {
  if (platform === 'darwin') return path.posix.join(homedir, 'Library', 'Application Support', 'ds-viewer');
  if (platform === 'win32') return path.win32.join(env.APPDATA ?? path.win32.join(homedir, 'AppData', 'Roaming'), 'ds-viewer');
  return path.posix.join(env.XDG_CONFIG_HOME ?? path.posix.join(homedir, '.config'), 'ds-viewer');
}

export function defaultPreferencesDir(): string {
  return preferencesDirFor(process.platform, process.env, process.env.HOME ?? process.env.USERPROFILE ?? '');
}

const PREFERENCES_FILE_NAME = 'preferences.json';
type Preferences = { projects?: Record<string, { autoCheck?: boolean }> };

function readPreferences(dir: string): Preferences {
  try {
    const parsed = JSON.parse(readFileSync(path.join(dir, PREFERENCES_FILE_NAME), 'utf8')) as Preferences;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Your own "check automatically" switch for one project on this computer, or `undefined` when you
 *  haven't set it (the project config then decides). */
export function readPersonalAutoCheck(dir: string, projectRoot: string): boolean | undefined {
  const value = readPreferences(dir).projects?.[path.resolve(projectRoot)]?.autoCheck;
  return typeof value === 'boolean' ? value : undefined;
}

export function writePersonalAutoCheck(dir: string, projectRoot: string, enabled: boolean): void {
  const prefs = readPreferences(dir);
  const projects = { ...(prefs.projects ?? {}) };
  projects[path.resolve(projectRoot)] = { ...projects[path.resolve(projectRoot)], autoCheck: enabled };
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, PREFERENCES_FILE_NAME), `${JSON.stringify({ ...prefs, projects }, null, 2)}\n`);
}

/** Which setting decides automatic checks, strongest first: CI's environment variable, your own
 *  switch, the project config, then on by default. */
export function resolveAutoCheck(
  config: { updateCheck?: boolean },
  env: NodeJS.ProcessEnv,
  personal: boolean | undefined,
): { enabled: boolean; source: AutoCheckSource } {
  if (env.DS_VIEWER_NO_UPDATE_CHECK === '1') return { enabled: false, source: 'env' };
  if (personal !== undefined) return { enabled: personal, source: 'personal' };
  if (config.updateCheck !== undefined) return { enabled: config.updateCheck, source: 'project' };
  return { enabled: true, source: 'default' };
}

function toNotice(result: UpdateCheckResult | undefined): VersionStatus['update'] {
  if (!result) return null;
  return { current: result.current, latest: result.latest, breaking: result.breaking, summary: result.summary, releasedAt: result.releasedAt };
}

/** The version status `dev` starts with: runs the (cached) check only when automatic checks are on. */
export async function buildVersionStatus(
  currentVersion: string,
  autoCheck: { enabled: boolean; source: AutoCheckSource },
  options: UpdateCheckOptions = {},
): Promise<VersionStatus> {
  if (!autoCheck.enabled) {
    const cacheDir = options.cacheDir ?? cacheDirFor(process.platform, process.env, process.env.HOME ?? process.env.USERPROFILE ?? '');
    return { current: currentVersion, autoCheck, lastCheckedAt: readCache(cacheDir)?.checkedAt, lastOutcome: 'not-run', update: null };
  }
  return statusFromCheck(currentVersion, autoCheck, await runUpdateCheck(currentVersion, options));
}

/** Folds one check's outcome into a status (startup, or **Check now**). */
export function statusFromCheck(
  currentVersion: string,
  autoCheck: { enabled: boolean; source: AutoCheckSource },
  outcome: { result?: UpdateCheckResult; reached: boolean; cached?: CachedUpdateCheck },
): VersionStatus {
  return {
    current: currentVersion,
    autoCheck,
    lastCheckedAt: outcome.cached?.checkedAt,
    lastOutcome: outcome.reached ? 'ok' : 'unreachable',
    update: toNotice(outcome.result),
  };
}

/** `dev` writes this next to `update.json`; the generated entry file imports it. */
export function writeVersionFile(projectRoot: string, status: VersionStatus): string {
  const file = path.join(projectRoot, '.ds-viewer', 'version.json');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(status));
  return file;
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
