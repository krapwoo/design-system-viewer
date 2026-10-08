// cli/updatePlan.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectPackageManager, type PackageManager } from './packageManager.ts';
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
  execImpl?: (command: string, args: string[], options: { cwd: string; encoding: 'utf8' }) => string;
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
function stripRepoPrefix(porcelain: string, prefix: string): string {
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

function defaultGitStatus(projectRoot: string, plannedPaths: string[]): string | undefined {
  try {
    const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: projectRoot, encoding: 'utf8' }).trim();
    // Errata 6: pathspecs are relative to the cwd (`projectRoot`), so they are passed unprefixed
    // — only the *output* paths (which `git status --porcelain` always reports relative to the
    // repository root) need `stripRepoPrefix` below.
    const porcelain = execFileSync('git', ['status', '--porcelain', '--', ...plannedPaths], { cwd: projectRoot, encoding: 'utf8' });
    return stripRepoPrefix(porcelain, prefix);
  } catch {
    return undefined;
  }
}

/** Design §5 "Update plan", steps 1-3, in full. Every external effect is injected (Global
 *  Constraints) — the real defaults are a real `npm view`/`npm pack`/`tar`/`node migrate` and a
 *  real `git status --porcelain`, exactly what Task 20's own Verdaccio spike already exercised. */
export async function buildUpdatePlan(
  config: ResolvedConfig,
  currentVersion: string,
  options: BuildPlanOptions = {},
): Promise<UpdatePlan | { error: string }> {
  const execImpl = options.execImpl ?? ((cmd, args, opts) => execFileSync(cmd, args, { ...opts, encoding: 'utf8' }) as unknown as string);
  const fetchImpl = options.fetchImpl ?? fetch;
  const tmpDirImpl = options.tmpDirImpl ?? (() => mkdtempSync(path.join(tmpdir(), 'ds-viewer-update-')));
  const gitStatusImpl = options.gitStatusImpl ?? defaultGitStatus;

  let targetVersion: string;
  try {
    targetVersion = execImpl('npm', ['view', PACKAGE_NAME, 'version'], { cwd: config.projectRoot, encoding: 'utf8' }).trim();
  } catch {
    return { error: OFFLINE_MESSAGE };
  }
  // Errata 13: "Already on the latest version" when target <= current, not only on equality — an
  // installed version ahead of the registry's own `npm view` result (e.g. a local prerelease) is
  // not something `update` should try to "downgrade" into.
  if (compareVersions(parseVersion(targetVersion), parseVersion(currentVersion)) <= 0) {
    return { error: `Already on the latest version (${currentVersion}).` };
  }

  let migrateResult: MigrateResult;
  let tmp: string | undefined;
  try {
    tmp = tmpDirImpl();
    // Step 1: "Download the target version into a temporary folder" — `npm pack` is an ordinary
    // install-shaped request (it honors the project's own `.npmrc`/registry config exactly like
    // `npm install` would), never a URL this file hardcodes.
    execImpl('npm', ['pack', `${PACKAGE_NAME}@${targetVersion}`, '--silent', '--pack-destination', tmp], { cwd: config.projectRoot, encoding: 'utf8' });
    execImpl('tar', ['-xzf', path.join(tmp, tarballFileName(targetVersion)), '-C', tmp], { cwd: tmp, encoding: 'utf8' });
    // Step 2: the *downloaded* version's own migrations, never the currently-running one — so the
    // plan always reflects the migrations the version being installed actually ships. This runs
    // `migrateEntry.js`, never `main.js` (Critical finding, Fable correction pass, spiked for real
    // in `spikes/migrate-entry/`): the extracted tarball has no `node_modules` of its own, and
    // `main.js`'s own import chain pulls in the `typescript` npm package at module load, which
    // would fail there with `ERR_MODULE_NOT_FOUND`; `migrateEntry.js` imports nothing but
    // `migrate.ts`/`migrations/`/`semver.ts`, none of which may ever import `typescript`.
    const migrateOutput = execImpl(
      'node',
      [path.join(tmp, 'package', 'dist', 'cli', 'migrateEntry.js'), '--from', currentVersion, '--dry-run', '--json'],
      { cwd: config.projectRoot, encoding: 'utf8' },
    );
    migrateResult = JSON.parse(migrateOutput) as MigrateResult;
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
  const porcelain = gitStatusImpl(config.projectRoot, files.map((f) => f.path));
  const outsideGitRepo = porcelain === undefined;
  const dirtyPaths = outsideGitRepo ? new Set<string>() : parseDirtyPaths(porcelain);
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
    kitFilesDiffering: listKitFileDiffs(config).filter((d) => d.status !== 'identical').length,
    outsideGitRepo,
  };
}
