// cli/dependencyBumpProof.ts
/** Conservative proof that a dirty `package.json` or npm `package-lock.json` is *solely* a
 *  viewer-only dependency bump to the version already installed — i.e. a previously-started
 *  update that the running process itself already finished. Every check here fails closed:
 *  malformed JSON, an unsupported lockfile shape, a missing side, or any other difference at all
 *  leaves the file classified unsafe (still dirty). Pure functions only — `updatePlan.ts` owns
 *  reading `HEAD` and the working tree. Every comparison here is against *parsed* JSON, not raw
 *  text: formatting-only and key-ordering differences are never treated as a difference, and
 *  duplicate keys in either side collapse to their last occurrence, exactly as `JSON.parse` does. */

import { compareVersions, parseVersion } from './semver.ts';

const PACKAGE_NAME = '@krapwoo/ds-viewer';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    return aKeys.length === Object.keys(b).length && aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

type JsonDiff = { path: string[]; type: 'added' | 'removed' | 'changed'; workingValue?: unknown };

/** Every leaf (or missing-key) difference between two parsed JSON values, each named by its full
 *  key path. An empty result means the two values are deeply equal. */
function diffJson(head: unknown, working: unknown, path: string[] = []): JsonDiff[] {
  if (deepEqual(head, working)) return [];
  if (isPlainObject(head) && isPlainObject(working)) {
    const diffs: JsonDiff[] = [];
    for (const key of new Set([...Object.keys(head), ...Object.keys(working)])) {
      const inHead = Object.prototype.hasOwnProperty.call(head, key);
      const inWorking = Object.prototype.hasOwnProperty.call(working, key);
      if (inHead && !inWorking) diffs.push({ path: [...path, key], type: 'removed' });
      else if (!inHead && inWorking) diffs.push({ path: [...path, key], type: 'added', workingValue: working[key] });
      else diffs.push(...diffJson(head[key], working[key], [...path, key]));
    }
    return diffs;
  }
  return [{ path, type: 'changed', workingValue: working }];
}

/** The three registry forms `update` (and a prior run of it) ever writes for an exact target
 *  version — never a local/path/workspace spec, which `isLocalSpec` elsewhere already refuses to
 *  update over in the first place. */
function isAcceptedRegistryForm(spec: unknown, currentVersion: string): boolean {
  return spec === currentVersion || spec === `^${currentVersion}` || spec === `~${currentVersion}`;
}

/** Whether a HEAD spec names a version strictly older than `currentVersion` — the proof that the
 *  working spec is a genuine forward bump, not a same-version range edit (e.g. HEAD `"^0.4.0"` →
 *  working `"0.4.0"` at `currentVersion` `"0.4.0"`, which names the same version both sides).
 *  Fails closed on anything other than a parseable exact/caret/tilde registry form. */
function isOlderRegistryForm(spec: unknown, currentVersion: string): boolean {
  if (typeof spec !== 'string') return false;
  const exact = spec.replace(/^[\^~]/, '');
  try {
    return compareVersions(parseVersion(exact), parseVersion(currentVersion)) === -1;
  } catch {
    return false;
  }
}

function headValueAtPath(head: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = head;
  for (const key of path) {
    if (!isPlainObject(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

/** Safe only when `workingRaw` differs from `headRaw` solely at one existing `dependencies` or
 *  `devDependencies` entry for `@krapwoo/ds-viewer`, and that entry's working value names
 *  `currentVersion` in an accepted registry form. */
export function isSafePackageJsonBump(headRaw: string, workingRaw: string, currentVersion: string): boolean {
  let head: unknown;
  let working: unknown;
  try {
    head = JSON.parse(headRaw);
    working = JSON.parse(workingRaw);
  } catch {
    return false;
  }
  if (!isPlainObject(head) || !isPlainObject(working)) return false;

  const diffs = diffJson(head, working);
  if (diffs.length !== 1) return false;
  const [diff] = diffs;
  if (diff.type !== 'changed' || diff.path.length !== 2) return false;
  const [section, name] = diff.path;
  if (name !== PACKAGE_NAME) return false;
  if (section !== 'dependencies' && section !== 'devDependencies') return false;
  if (!isOlderRegistryForm(headValueAtPath(head, diff.path), currentVersion)) return false;
  return isAcceptedRegistryForm(diff.workingValue, currentVersion);
}

function redactKey(value: Record<string, unknown>, keyPath: string[]): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < keyPath.length - 1; i += 1) {
    const next = cursor[keyPath[i]];
    if (!isPlainObject(next)) return clone;
    cursor = next;
  }
  delete cursor[keyPath[keyPath.length - 1]];
  return clone;
}

/** Which section (`dependencies`/`devDependencies`) the lockfile root (`packages[""]`, design's
 *  own npm v7+ shape) declares `@krapwoo/ds-viewer` in, and that its working value is an accepted
 *  registry form of `currentVersion` — `undefined` for any ambiguity (declared in neither or both
 *  sides, mismatched sections, or anything other than a plain string on either side). */
function safeRootDeclarationSection(
  headRoot: Record<string, unknown>,
  workingRoot: Record<string, unknown>,
  currentVersion: string,
): 'dependencies' | 'devDependencies' | undefined {
  for (const section of ['dependencies', 'devDependencies'] as const) {
    const other = section === 'dependencies' ? 'devDependencies' : 'dependencies';
    const headValue = isPlainObject(headRoot[section]) ? (headRoot[section] as Record<string, unknown>)[PACKAGE_NAME] : undefined;
    const workingValue = isPlainObject(workingRoot[section]) ? (workingRoot[section] as Record<string, unknown>)[PACKAGE_NAME] : undefined;
    if (headValue === undefined && workingValue === undefined) continue;
    if (typeof headValue !== 'string' || typeof workingValue !== 'string') return undefined;
    const headOther = isPlainObject(headRoot[other]) ? (headRoot[other] as Record<string, unknown>)[PACKAGE_NAME] : undefined;
    const workingOther = isPlainObject(workingRoot[other]) ? (workingRoot[other] as Record<string, unknown>)[PACKAGE_NAME] : undefined;
    if (headOther !== undefined || workingOther !== undefined) return undefined; // declared in both sections somewhere — ambiguous.
    return isAcceptedRegistryForm(workingValue, currentVersion) && isOlderRegistryForm(headValue, currentVersion) ? section : undefined;
  }
  return undefined;
}

function isSafeLockfileV1Bump(head: Record<string, unknown>, working: Record<string, unknown>, currentVersion: string): boolean {
  const headDeps = head.dependencies;
  const workingDeps = working.dependencies;
  if (!isPlainObject(headDeps) || !isPlainObject(workingDeps)) return false;
  const headEntry = headDeps[PACKAGE_NAME];
  const workingEntry = workingDeps[PACKAGE_NAME];
  if (!isPlainObject(headEntry) || !isPlainObject(workingEntry)) return false;
  if (workingEntry.version !== currentVersion) return false;

  const redactedHead = redactKey(head, ['dependencies', PACKAGE_NAME]);
  const redactedWorking = redactKey(working, ['dependencies', PACKAGE_NAME]);
  return deepEqual(redactedHead, redactedWorking);
}

function isSafeLockfileV2Or3Bump(head: Record<string, unknown>, working: Record<string, unknown>, currentVersion: string): boolean {
  const nodeModulesKey = `node_modules/${PACKAGE_NAME}`;
  const headPackages = head.packages;
  const workingPackages = working.packages;
  if (!isPlainObject(headPackages) || !isPlainObject(workingPackages)) return false;

  const headEntry = headPackages[nodeModulesKey];
  const workingEntry = workingPackages[nodeModulesKey];
  if (!isPlainObject(headEntry) || !isPlainObject(workingEntry)) return false;
  if (workingEntry.version !== currentVersion) return false;

  const headRoot = headPackages[''];
  const workingRoot = workingPackages[''];
  if (!isPlainObject(headRoot) || !isPlainObject(workingRoot)) return false;
  const section = safeRootDeclarationSection(headRoot, workingRoot, currentVersion);
  if (!section) return false;

  // npm v7/v8's legacy mirror tree, kept alongside `packages` for backward-compat tooling — absent
  // in v9+'s v3 lockfiles. Unlike the two checks above, redacting this unconditionally (without
  // first proving its own working value) would let an untracked edit to this entry hide behind an
  // otherwise-safe bump.
  const workingLegacy = isPlainObject(working.dependencies) ? (working.dependencies as Record<string, unknown>)[PACKAGE_NAME] : undefined;
  if (workingLegacy !== undefined && (!isPlainObject(workingLegacy) || workingLegacy.version !== currentVersion)) return false;

  let redactedHead = redactKey(head, ['packages', nodeModulesKey]);
  let redactedWorking = redactKey(working, ['packages', nodeModulesKey]);
  redactedHead = redactKey(redactedHead, ['packages', '', section, PACKAGE_NAME]);
  redactedWorking = redactKey(redactedWorking, ['packages', '', section, PACKAGE_NAME]);
  redactedHead = redactKey(redactedHead, ['dependencies', PACKAGE_NAME]);
  redactedWorking = redactKey(redactedWorking, ['dependencies', PACKAGE_NAME]);

  return deepEqual(redactedHead, redactedWorking);
}

/** Safe only when valid JSON differs from `HEAD` solely in the root declaration for
 *  `@krapwoo/ds-viewer` and the package's own lock entry, both resolving `currentVersion`.
 *  Supports lockfileVersion 1 (the single `dependencies` entry doubles as both) and 2/3 (the
 *  `packages[""]` root declaration plus the `packages["node_modules/..."]` entry). Any other
 *  `lockfileVersion`, or a mismatch between `HEAD` and the working tree, is an unsupported shape —
 *  fails closed. */
export function isSafeNpmLockfileBump(headRaw: string, workingRaw: string, currentVersion: string): boolean {
  let head: unknown;
  let working: unknown;
  try {
    head = JSON.parse(headRaw);
    working = JSON.parse(workingRaw);
  } catch {
    return false;
  }
  if (!isPlainObject(head) || !isPlainObject(working)) return false;
  const lockfileVersion = working.lockfileVersion;
  if (head.lockfileVersion !== lockfileVersion) return false;

  if (lockfileVersion === 1) return isSafeLockfileV1Bump(head, working, currentVersion);
  if (lockfileVersion === 2 || lockfileVersion === 3) return isSafeLockfileV2Or3Bump(head, working, currentVersion);
  return false;
}
