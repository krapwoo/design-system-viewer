// cli/updatePlan.ts
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { detectPackageManager, platformCommand, type PackageManager } from './packageManager.ts';
import { listKitFileDiffs } from './kitDiff.ts';
import { extractSummaryBullets, fetchWithTimeout } from './updateCheck.ts';
import { compareVersions, isBreakingUpgrade, parseVersion } from './semver.ts';
import type { MigrateResult } from './migrate.ts';
import type { ResolvedConfig } from './types.ts';

const PACKAGE_NAME = '@krapwoo/ds-viewer';
const OFFLINE_MESSAGE = "Couldn't prepare the update. You may be offline, or npm didn't respond. Nothing was changed.";

export interface UpdatePlanFile {
  path: string;
  reason: string;
  dirty: boolean;
}

export interface UpdatePlan {
  current: string;
  latest: string;
  breaking: boolean;
  summary: string[];
  releasedAt?: string;
  files: UpdatePlanFile[];
  dirtyFiles: string[];
  kitFilesDiffering: number;
  /** Decision 4 (brief): "outside a git repository, say so and treat files as not dirty." */
  outsideGitRepo: boolean;
}

export interface BuildPlanOptions {
  /** Important finding, Fable correction pass: the real default below is `execFile`, promisified —
   *  never `execFileSync`. This now runs inside the endpoint's own request handler (Task 12); the
   *  synchronous version blocked the whole event loop (including `/update/status` polls, and any
   *  other request) for the entire download. `timeout` (used only for `npm view`/`npm pack` below)
   *  lets a real, unreachable registry fail in ~20s instead of hanging for minutes. */
  execImpl?: (command: string, args: string[], options: { cwd: string; encoding: 'utf8'; timeout?: number }) => Promise<string>;
  fetchImpl?: typeof fetch;
  tmpDirImpl?: () => string;
  /** Returns `git status --porcelain`'s output for exactly `plannedPaths` (relative to
   *  `projectRoot`), or `undefined` outside a git repository (and when `git` itself isn't
   *  installed — decision 4 treats both the same way). The real default scopes the real `git
   *  status` call to `plannedPaths` and strips `git rev-parse --show-prefix` from every returned
   *  path first (Important finding, Fable correction pass: `git status --porcelain` always prints
   *  paths relative to the *repository* root, not `projectRoot` — a project in a subfolder, e.g.
   *  `apps/mobile/`, would otherwise never see its own `package.json` as dirty). A test's injected
   *  fake returns already-project-relative paths directly, exactly as every existing test here
   *  already does — `plannedPaths` only matters to the real implementation. */
  gitStatusImpl?: (projectRoot: string, plannedPaths: string[]) => string | undefined;
}

function tarballFileName(version: string): string {
  return `krapwoo-ds-viewer-${version}.tgz`;
}

function lockfileName(pm: PackageManager): string {
  if (pm === 'pnpm') return 'pnpm-lock.yaml';
  if (pm === 'yarn-classic' || pm === 'yarn-berry') return 'yarn.lock';
  return 'package-lock.json';
}

/** `git status --porcelain`'s format is `XY path` (plain) or `XY old -> new` (a rename) — the
 *  path starts at column 3 either way; a rename's own "dirty" identity is its *new* path (the one
 *  this plan's own `files` list names), never the old one (Important finding, Fable correction
 *  pass: `R  old -> new` was previously read as the single literal path `"old -> new"`, which
 *  could never match a planned file). */
function parseDirtyPaths(porcelain: string): Set<string> {
  return new Set(
    porcelain
      .split('\n')
      .filter((line) => line.length > 3)
      .map((line) => {
        const raw = line.slice(3).trim();
        const arrow = raw.indexOf(' -> ');
        return arrow === -1 ? raw : raw.slice(arrow + 4);
      }),
  );
}

/** Strips the repository-root prefix `git rev-parse --show-prefix` reports from every path in a
 *  `git status --porcelain` listing (both sides of a rename), so the result reads relative to
 *  `projectRoot` the same way every test's injected fake already does. */
export function stripRepoPrefix(porcelain: string, prefix: string): string {
  if (!prefix) return porcelain;
  return porcelain
    .split('\n')
    .map((line) => {
      if (line.length <= 3) return line;
      const status = line.slice(0, 3);
      const rest = line.slice(3).split(' -> ').map((part) => (part.startsWith(prefix) ? part.slice(prefix.length) : part));
      return `${status}${rest.join(' -> ')}`;
    })
    .join('\n');
}

/** Thrown by `defaultGitStatus` for any git failure that is *not* "not a git repository" (or git
 *  missing) — `buildUpdatePlan` below catches exactly this to return a plan `{ error }`, naming
 *  git, instead of silently treating the failure as "outside a git repository" (Minor finding,
 *  Fable correction pass: `fatal: detected dubious ownership`, a corrupt repo, or any other
 *  non-zero exit previously fell into the same `undefined` branch as genuinely being outside a
 *  repository, fail-open on the feature's one core safeguard — the dirty-file check — the CLI then
 *  printing the misleading "(Not a git repository …)" note over a real error). */
export class GitStatusError extends Error {}

function isMissingRepo(error: unknown): boolean {
  const e = error as NodeJS.ErrnoException & { stderr?: string };
  if (e.code === 'ENOENT') return true;
  return /not a git repository/i.test(e.stderr ?? e.message ?? '');
}

function defaultGitStatus(projectRoot: string, plannedPaths: string[]): string | undefined {
  let prefix: string;
  try {
    prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch (error) {
    if (isMissingRepo(error)) return undefined;
    throw new GitStatusError(`git rev-parse failed: ${(error as Error).message}`);
  }
  try {
    // Errata 6: pathspecs are relative to the cwd (`projectRoot`), so they are passed unprefixed
    // — only the *output* paths (which `git status --porcelain` always reports relative to the
    // repository root) need `stripRepoPrefix` below.
    const porcelain = execFileSync('git', ['status', '--porcelain', '--', ...plannedPaths], { cwd: projectRoot, encoding: 'utf8' });
    return stripRepoPrefix(porcelain, prefix);
  } catch (error) {
    throw new GitStatusError(`git status failed: ${(error as Error).message}`);
  }
}

/** "Already on the latest version" is reported through the plan's `{ error }` channel, but it is not a
 *  failure: `update` exits 0 for it, and the viewer shows it as up to date (`isAlreadyUpToDateError`). */
export const ALREADY_UP_TO_DATE = 'Already on the latest version';

export function isAlreadyUpToDate(error: string): boolean {
  return error.startsWith(ALREADY_UP_TO_DATE);
}

/** Design §5 "Update plan", steps 1-3, in full. Every external effect is injected (Global
 *  Constraints) — the real defaults are a real `npm view`/`npm pack`/`tar`/`node migrate` and a
 *  real `git status --porcelain`, exactly what Task 20's own Verdaccio spike already exercised. */
export async function buildUpdatePlan(
  config: ResolvedConfig,
  currentVersion: string,
  options: BuildPlanOptions = {},
): Promise<UpdatePlan | { error: string }> {
  const execFileAsync = promisify(execFile);
  const execImpl = options.execImpl ?? (async (cmd, args, opts) => {
    const run = platformCommand(cmd, args);
    return (await execFileAsync(run.command, run.args, { ...opts, shell: run.shell })).stdout;
  });
  const fetchImpl = options.fetchImpl ?? fetch;
  const tmpDirImpl = options.tmpDirImpl ?? (() => mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-')));
  const gitStatusImpl = options.gitStatusImpl ?? defaultGitStatus;

  // Important finding, Fable correction pass: a real, unreachable registry otherwise hangs `npm
  // view`/`npm pack` for minutes (observed: "Checking…" sat for 140s, with `/update/status` not
  // answering at all in that time — this whole function runs inside the endpoint's own request
  // handler). 20s is generous for a real, reachable registry, and short enough that offline reaches
  // "Couldn't prepare" in a bounded time instead of hanging.
  const NETWORK_TIMEOUT_MS = 20_000;

  let targetVersion: string;
  try {
    targetVersion = (await execImpl('npm', ['view', PACKAGE_NAME, 'version'], { cwd: config.projectRoot, encoding: 'utf8', timeout: NETWORK_TIMEOUT_MS })).trim();
  } catch {
    return { error: OFFLINE_MESSAGE };
  }
  // Errata 13: "Already on the latest version" when target <= current, not only on equality — an
  // installed version ahead of the registry's own `npm view` result (e.g. a local prerelease) is
  // not something `update` should try to "downgrade" into.
  if (compareVersions(parseVersion(targetVersion), parseVersion(currentVersion)) <= 0) {
    return { error: `${ALREADY_UP_TO_DATE} (${currentVersion}).` };
  }

  let migrateResult: MigrateResult;
  // M4 (Minor, Fable correction pass): compared against the *downloaded target version's* own
  // `starter-kit/`, not the currently-installed one — the copy ("differ from {latest}'s kit") and
  // design §5 both name the target, never what's already on disk. Computed here, before the
  // `finally` below cleans the extracted tarball up.
  let kitFilesDiffering = 0;
  let tmp: string | undefined;
  try {
    tmp = tmpDirImpl();
    // Step 1: "Download the target version into a temporary folder" — `npm pack` is an ordinary
    // install-shaped request (it honors the project's own `.npmrc`/registry config exactly like
    // `npm install` would), never a URL this file hardcodes.
    await execImpl('npm', ['pack', `${PACKAGE_NAME}@${targetVersion}`, '--silent', '--pack-destination', tmp], { cwd: config.projectRoot, encoding: 'utf8', timeout: NETWORK_TIMEOUT_MS });
    await execImpl('tar', ['-xzf', path.join(tmp, tarballFileName(targetVersion)), '-C', tmp], { cwd: tmp, encoding: 'utf8' });
    // Step 2: the *downloaded* version's own migrations, never the currently-running one — so the
    // plan always reflects the migrations the version being installed actually ships. This runs
    // `migrateEntry.js`, never `main.js` (Critical finding, Fable correction pass, spiked for real
    // in `spikes/migrate-entry/`): the extracted tarball has no `node_modules` of its own, and
    // `main.js`'s own import chain pulls in the `typescript` npm package at module load, which
    // would fail there with `ERR_MODULE_NOT_FOUND`; `migrateEntry.js` imports nothing but
    // `migrate.ts`/`migrations/`/`semver.ts`, none of which may ever import `typescript`.
    const migrateOutput = await execImpl(
      'node',
      [path.join(tmp, 'package', 'dist', 'cli', 'migrateEntry.js'), '--from', currentVersion, '--dry-run', '--json'],
      { cwd: config.projectRoot, encoding: 'utf8' },
    );
    migrateResult = JSON.parse(migrateOutput) as MigrateResult;
    kitFilesDiffering = listKitFileDiffs(config, path.join(tmp, 'package', 'starter-kit')).filter((d) => d.status !== 'identical').length;
  } catch {
    return { error: OFFLINE_MESSAGE };
  } finally {
    // Minor finding, Fable correction pass: every "Check again" (a fresh plan) used to leak this
    // tarball and its extracted folder — cleaned up here regardless of success or failure.
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }

  const pm = detectPackageManager(config.projectRoot);
  const files: UpdatePlanFile[] = [
    { path: 'package.json', reason: 'version', dirty: false },
    { path: lockfileName(pm), reason: 'version', dirty: false },
    ...migrateResult.changes.map((change) => ({ path: change.file, reason: `migration: ${change.change}`, dirty: false })),
  ];

  // Scoped to exactly the files above (decision 4 (brief): "limited to planned files") — called
  // only now that `files` is known, so the real `defaultGitStatus` can pass their paths as `git
  // status`'s own pathspec.
  // M9 (Minor, Fable correction pass): `gitStatusImpl` throwing (rather than returning `undefined`,
  // reserved for "outside a git repository") means a real git failure — fail closed with a plan
  // `{ error }` naming git, never silently fall back to "outside a git repository, nothing is
  // dirty" the way returning `undefined` here would.
  let porcelain: string | undefined;
  try {
    porcelain = gitStatusImpl(config.projectRoot, files.map((f) => f.path));
  } catch (error) {
    return { error: `Couldn't check for uncommitted changes (git): ${(error as Error).message}` };
  }
  const outsideGitRepo = porcelain === undefined;
  const dirtyPaths = porcelain === undefined ? new Set<string>() : parseDirtyPaths(porcelain);
  for (const file of files) file.dirty = dirtyPaths.has(file.path);

  let summary: string[] = [];
  let releasedAt: string | undefined;
  try {
    // `fetchWithTimeout` (Task 4, exported) — a black-holed `api.github.com` must not hang this
    // plan forever (Important finding, Fable correction pass: this request previously had no
    // timeout of its own, unlike the identical request inside `checkForUpdate`).
    const release = (await fetchWithTimeout(
      `https://api.github.com/repos/krapwoo/design-system-viewer/releases/tags/v${targetVersion}`,
      fetchImpl,
      900,
    )) as { body?: string; published_at?: string };
    summary = release.body ? extractSummaryBullets(release.body) : [];
    releasedAt = release.published_at;
  } catch {
    // Non-fatal — Task 4's identical reasoning: the version/migration half of the plan is what
    // matters; a missing release summary degrades to an empty "What's new" list.
  }

  return {
    current: currentVersion,
    latest: targetVersion,
    breaking: isBreakingUpgrade(parseVersion(currentVersion), parseVersion(targetVersion)),
    summary,
    releasedAt,
    files,
    dirtyFiles: files.filter((f) => f.dirty).map((f) => f.path),
    kitFilesDiffering,
    outsideGitRepo,
  };
}
