// cli/kitDiff.ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveKitRoot } from './kitRoot.ts';
import type { ResolvedConfig } from './types.ts';

export interface KitFileDiff {
  /** Forward-slash, relative to the kit root on both sides (e.g. `components/Button/index.ts`). */
  relativePath: string;
  status: 'identical' | 'modified' | 'user-only' | 'kit-only';
}

function listFilesRecursively(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFilesRecursively(path.join(dir, entry.name), relative));
    else if (entry.isFile()) out.push(relative);
  }
  return out;
}

function installedKitDir(projectRoot: string): string {
  return path.join(projectRoot, 'node_modules', '@krapwoo', 'ds-viewer', 'starter-kit');
}

/** Design §5 "Starter-kit changes": every kit file on both sides, compared by exact content —
 *  never applied, only reported. `undefined` from `resolveKitRoot` (no `starterKit` configured at
 *  all) means "not a kit project", not an error: `[]` either way (Task 9 reads this directly for
 *  its `kitFilesDiffering` count, which is simply 0 for a non-kit project).
 *
 *  `compareDir` overrides the "other side" of the comparison — the currently-*installed* kit
 *  (`node_modules/@krapwoo/ds-viewer/starter-kit`) by default, used by `kit diff`; `buildUpdatePlan`
 *  (M4, Fable correction pass) instead passes the *downloaded target version's* own extracted
 *  `starter-kit/`, matching its own copy ("differ from {latest}'s kit") and design §5. */
export function listKitFileDiffs(config: Pick<ResolvedConfig, 'starterKit' | 'components' | 'projectRoot'>, compareDir?: string): KitFileDiff[] {
  const kitRoot = resolveKitRoot(config);
  if (!kitRoot) return [];
  const userDir = path.join(config.projectRoot, kitRoot);
  const installedDir = compareDir ?? installedKitDir(config.projectRoot);
  const userFiles = new Set(listFilesRecursively(userDir));
  const installedFiles = new Set(listFilesRecursively(installedDir));
  const diffs: KitFileDiff[] = [];
  for (const relativePath of [...new Set([...userFiles, ...installedFiles])].sort()) {
    if (userFiles.has(relativePath) && !installedFiles.has(relativePath)) {
      diffs.push({ relativePath, status: 'user-only' });
    } else if (!userFiles.has(relativePath) && installedFiles.has(relativePath)) {
      diffs.push({ relativePath, status: 'kit-only' });
    } else {
      const same = readFileSync(path.join(userDir, relativePath), 'utf8') === readFileSync(path.join(installedDir, relativePath), 'utf8');
      diffs.push({ relativePath, status: same ? 'identical' : 'modified' });
    }
  }
  return diffs;
}

/** A plain LCS line diff, `-`/`+`/`  ` (two-space) prefixed — not a strict POSIX unified diff (no
 *  `@@` hunk headers, no surrounding-context trimming): design §5 says `kit diff` "shows" the two
 *  files against each other, and every kit file is already small enough that a full-file line diff
 *  reads more plainly than hunk-trimmed context would. */
export function diffLines(a: string, b: string): string[] {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const m = aLines.length;
  const n = bLines.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i][j] = aLines[i] === bLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) {
      out.push(`  ${aLines[i]}`);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push(`- ${aLines[i]}`);
      i += 1;
    } else {
      out.push(`+ ${bLines[j]}`);
      j += 1;
    }
  }
  while (i < m) { out.push(`- ${aLines[i]}`); i += 1; }
  while (j < n) { out.push(`+ ${bLines[j]}`); j += 1; }
  return out;
}

/** `npx ds-viewer kit diff <Component>` (design §5). `installed` is always the "before" (`-`) side
 *  and `yours` the "after" (`+`) side — the installed kit is what shipped; the user's file is what
 *  they changed it to. Exit code 1 only for a usage problem (no kit configured, unknown component);
 *  a real diff is informational and exits 0. */
export function runKitDiffCommand(config: ResolvedConfig, componentName: string): { output: string; exitCode: number } {
  const kitRoot = resolveKitRoot(config);
  if (!kitRoot) return { output: 'This project has no starter kit configured (no "starterKit" in ds-viewer.config.ts).', exitCode: 1 };
  const diffs = listKitFileDiffs(config).filter((d) => d.relativePath.startsWith(`components/${componentName}/`));
  if (diffs.length === 0) {
    return { output: `No kit files found for "${componentName}" under ${kitRoot}/components/${componentName}/.`, exitCode: 1 };
  }
  const installedDir = installedKitDir(config.projectRoot);
  const userDir = path.join(config.projectRoot, kitRoot);
  const lines: string[] = [];
  let anyDiff = false;
  for (const diff of diffs) {
    if (diff.status === 'identical') continue;
    anyDiff = true;
    lines.push(`--- ${diff.relativePath} (installed kit)`, `+++ ${diff.relativePath} (yours)`);
    if (diff.status === 'kit-only') { lines.push('(only in the installed kit — you have not copied this file)', ''); continue; }
    if (diff.status === 'user-only') { lines.push('(only in your project — not part of the installed kit)', ''); continue; }
    const installedContent = readFileSync(path.join(installedDir, diff.relativePath), 'utf8');
    const userContent = readFileSync(path.join(userDir, diff.relativePath), 'utf8');
    lines.push(...diffLines(installedContent, userContent), '');
  }
  if (!anyDiff) return { output: `${componentName}'s kit files match the installed kit exactly.`, exitCode: 0 };
  return { output: lines.join('\n'), exitCode: 0 };
}
