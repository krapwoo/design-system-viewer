import { basename, join, relative } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.ds-viewer', '.expo', '.github',
  'ios', 'android', 'build', 'web-build',
]);
const TOKEN_FILE_HINT = /token/i;
const TOKEN_EXPORT_HINT = /export\s+const\s+[A-Z0-9_]*(COLOR|SPACING|TYPOGRAPHY|PALETTE|RADIUS)[A-Z0-9_]*\b/;

export interface DetectedComponentFolder {
  /** The folder's own name — also the default export name `init`'s draft page documents. */
  name: string;
  relativePath: string;
  /** Which index file this folder actually has — `init`'s config glob (Important: a `.tsx`-only
   *  project got "N components" from `init` but 0 from `sync`, since the glob only ever named
   *  `.ts`) also emits a `*\/index.tsx` pattern when any detected folder is `'tsx'`. */
  indexExt: 'ts' | 'tsx';
}

export interface DetectedTokenFile {
  relativePath: string;
}

/** A folder is a candidate component when its name is PascalCase and it holds both an
 *  `index.ts`/`index.tsx` and a file named after the folder (`Button/Button.tsx`) — the
 *  convention this repo's own `native/components/*` already follows. */
export function detectComponentFolders(projectRoot: string, searchRoot: string): DetectedComponentFolder[] {
  const results: DetectedComponentFolder[] = [];
  walk(searchRoot, (dir) => {
    const entries = readdirSync(dir);
    const folderName = dir.split(/[/\\]/).pop() ?? '';
    const hasIndex = entries.includes('index.ts') || entries.includes('index.tsx');
    const hasMatchingFile = entries.some((entry) => entry.startsWith(`${folderName}.`));
    if (hasIndex && hasMatchingFile && /^[A-Z]/.test(folderName)) {
      const indexExt = entries.includes('index.ts') ? 'ts' : 'tsx';
      results.push({ name: folderName, relativePath: relative(projectRoot, dir), indexExt });
    }
  });
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** A file is a candidate token module when its name hints at tokens, or it exports a const whose
 *  name hints at color/spacing/typography/palette/radius values (design §3's examples). */
export function detectTokenFiles(
  projectRoot: string,
  searchRoot: string,
  readFile: (path: string) => string,
): DetectedTokenFile[] {
  const results: DetectedTokenFile[] = [];
  walk(searchRoot, (dir) => {
    // A name hint (e.g. `authToken.ts`) is only trusted inside a folder actually named `tokens` —
    // elsewhere it also needs the export hint, so an unrelated `authToken.ts` isn't swept into
    // `tokens` and `optionRoots` just because its name contains "token".
    const inTokensFolder = basename(dir).toLowerCase() === 'tokens';
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
      const fullPath = join(dir, entry);
      let content: string;
      try {
        content = readFile(fullPath);
      } catch {
        continue; // e.g. a broken symlink.
      }
      const nameHint = TOKEN_FILE_HINT.test(entry) && inTokensFolder;
      if (nameHint || TOKEN_EXPORT_HINT.test(content)) {
        results.push({ relativePath: relative(projectRoot, fullPath) });
      }
    }
  });
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function walk(dir: string, visit: (dir: string) => void): void {
  visit(dir);
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let isDirectory: boolean;
    try {
      isDirectory = statSync(fullPath).isDirectory();
    } catch {
      continue; // A broken symlink (or anything else statSync can't follow) is simply skipped.
    }
    if (isDirectory) walk(fullPath, visit);
  }
}
