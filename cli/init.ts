import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { preflight } from './preflight.ts';
import { detectComponentFolders, detectTokenFiles, type DetectedComponentFolder, type DetectedTokenFile } from './detect.ts';

export interface InitResult {
  messages: string[];
  written: string[];
  /** Set to 1 when `init` stopped without writing anything for a reason a script should treat as
   *  a failure (a missing required package, or an abort caused by non-interactive stdin rather
   *  than an explicit "no") — `cli/main.ts` sets `process.exitCode` from this. An interactive "no"
   *  is a deliberate choice, not a failure, so it leaves this unset. */
  exitCode?: number;
}

export interface InitOptions {
  /** Skips the confirmation prompt below (CLI `--yes` flag). */
  yes?: boolean;
  /** Test-only: replaces the `node:readline/promises` prompt with a fixed answer. */
  confirm?: (message: string) => Promise<boolean> | boolean;
}

async function promptConfirm(message: string): Promise<boolean> {
  // A closed, non-interactive stdin (CI, piped npx) would reject `question` with an AbortError;
  // say how to proceed instead.
  if (!process.stdin.isTTY) {
    console.log('Non-interactive stdin: rerun with --yes to accept the detected list.');
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(message);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

/** This package's own version — used as the `^x.y.z` devDependency version written below, since a
 *  project run via `npx @krapwoo/ds-viewer init` has no local copy to read its version from yet.
 *  Walks up from this file's own directory looking for the `package.json` named
 *  `@krapwoo/ds-viewer`, rather than a fixed relative path: this file sits one level under the
 *  repo root as `cli/init.ts` (how the test below runs it) but two levels under it once compiled,
 *  as `dist/cli/init.js` — a single `../..` would be wrong for one of the two. */
function ownVersion(): string {
  let dir = import.meta.dirname;
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = path.join(dir, 'package.json');
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string; version: string };
      if (pkg.name === '@krapwoo/ds-viewer') return pkg.version;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find @krapwoo/ds-viewer's own package.json to read its version.");
}

/** Detects the existing indent of a JSON file's first indented line, so rewriting it (e.g.
 *  `package.json` below) doesn't reformat the user's own indentation style. Falls back to two
 *  spaces when nothing indented is found (e.g. a minified `package.json`). */
function detectIndent(raw: string): string {
  const match = /\n([ \t]+)\S/.exec(raw);
  return match ? match[1] : '  ';
}

/** The existing-project half of `init` (design §2) — new-project/starter-kit `init` is 0.2 scope. */
export async function initExistingProject(projectRoot: string, options: InitOptions = {}): Promise<InitResult> {
  const { errors, warnings } = preflight(projectRoot);
  if (errors.length > 0) {
    return { messages: errors.map((issue) => `Missing ${issue.package}. Run: ${issue.installCommand}`), written: [], exitCode: 1 };
  }

  const componentFolders = detectComponentFolders(projectRoot, projectRoot);
  const tokenFiles = detectTokenFiles(projectRoot, projectRoot, (file) => readFileSync(file, 'utf8'));

  // Design §2: detected items are "shown for confirmation or editing" before anything is written.
  if (!options.yes) {
    const detectionList = [
      ...componentFolders.map((folder) => `  component  ${folder.relativePath}`),
      ...tokenFiles.map((file) => `  tokens     ${file.relativePath}`),
    ].join('\n');
    const confirmFn = options.confirm ?? promptConfirm;
    const proceed = await confirmFn(`Detected:\n${detectionList}\nWrite ds-viewer.config.ts and draft catalog pages for these? [y/N] `);
    if (!proceed) {
      // A declined interactive prompt is a deliberate "no" (exit 0); a non-interactive stdin never
      // asked the question at all, so a script that forgot `--yes` should see this as a failure.
      const nonInteractive = !options.confirm && !process.stdin.isTTY;
      return {
        messages: [nonInteractive ? 'Aborted: non-interactive stdin. Rerun with --yes to accept the detected list.' : 'Aborted: no files written.'],
        written: [],
        exitCode: nonInteractive ? 1 : undefined,
      };
    }
  }

  // Counted before any draft is written below, so a component that already had a `.catalog.tsx`
  // is distinguished from one `init` is about to create for the first time (Minor: this line must
  // not hardcode "0 with examples" — it changes on a rerun once pages gain examples).
  const withExamplesCount = componentFolders.filter((folder) =>
    existsSync(path.join(projectRoot, folder.relativePath, `${folder.name}.catalog.tsx`)),
  ).length;

  const written: string[] = [];

  const configPath = path.join(projectRoot, 'ds-viewer.config.ts');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, configFileContents(componentFolders, tokenFiles));
    written.push(configPath);
  }

  for (const folder of componentFolders) {
    const draftPath = path.join(projectRoot, folder.relativePath, `${folder.name}.catalog.tsx`);
    if (!existsSync(draftPath)) {
      writeFileSync(draftPath, draftPageContents(folder.name));
      written.push(draftPath);
    }
  }

  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJsonRaw = readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  let packageJsonChanged = false;
  if (!packageJson.scripts?.['ds-viewer']) {
    packageJson.scripts = { ...packageJson.scripts, 'ds-viewer': 'ds-viewer' };
    packageJsonChanged = true;
  }
  if (!{ ...packageJson.dependencies, ...packageJson.devDependencies }['@krapwoo/ds-viewer']) {
    // Design §2 "First run": init installs @krapwoo/ds-viewer as a devDependency; init cannot
    // reliably invoke the user's package manager, so the README (Task 16) runs `npm install` next.
    packageJson.devDependencies = { ...packageJson.devDependencies, '@krapwoo/ds-viewer': `^${ownVersion()}` };
    packageJsonChanged = true;
  }
  if (packageJsonChanged) {
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, detectIndent(packageJsonRaw))}\n`);
    written.push(packageJsonPath);
  }

  const gitignorePath = path.join(projectRoot, '.gitignore');
  const gitignoreEntry = '.ds-viewer/';
  const existingGitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  // `\r\n` line endings leave a trailing `\r` on each split line, which never equals the entry —
  // trim it per line so a CRLF .gitignore is recognized as already having the entry on a rerun.
  if (!existingGitignore.split('\n').some((line) => line.replace(/\r$/, '') === gitignoreEntry)) {
    const separator = existingGitignore === '' || existingGitignore.endsWith('\n') ? '' : '\n';
    writeFileSync(gitignorePath, `${existingGitignore}${separator}${gitignoreEntry}\n`);
    written.push(gitignorePath);
  }

  const routerWarnings = componentFolders
    .filter((folder) => folder.relativePath.split(path.sep)[0] === 'app')
    .map(
      (folder) =>
        `Warning: ${folder.relativePath.split(path.sep).join('/')} is inside an Expo Router "app/" directory; its .catalog.tsx file will become a route.`,
    );

  const messages = [
    ...warnings.map((issue) => `Warning: ${issue.package} not found. Run: ${issue.installCommand}`),
    ...routerWarnings,
    // "with catalog pages", not "with examples": this counts any existing `<Name>.catalog.tsx`,
    // including init's own drafts, which explicitly say "Needs examples" — not real coverage yet.
    `${componentFolders.length} components · ${withExamplesCount} with catalog pages`,
    'Next: npm install, then npm run ds-viewer dev',
  ];
  return { messages, written };
}

function configFileContents(componentFolders: DetectedComponentFolder[], tokenFiles: DetectedTokenFile[]): string {
  // Emits both `index.ts` and `index.tsx` globs for every detected parent folder whenever any
  // detected folder uses `.tsx` (`detect.ts` accepts either extension — Important: a project using
  // `.tsx` entries got "N components" from `init` but 0 from `sync`, since the config glob only
  // ever named `.ts`; `resolveGlob` has no brace syntax to name both extensions in one pattern).
  const anyTsx = componentFolders.some((folder) => folder.indexExt === 'tsx');
  const parentFolders = [...new Set(componentFolders.map((folder) => path.dirname(folder.relativePath).split(path.sep).join('/')))];
  const componentGlobs = parentFolders.flatMap((folder) => (anyTsx ? [`${folder}/*/index.ts`, `${folder}/*/index.tsx`] : [`${folder}/*/index.ts`]));
  const tokenPaths = tokenFiles.map((file) => file.relativePath.split(path.sep).join('/'));
  return `import { defineConfig } from '@krapwoo/ds-viewer/config';

export default defineConfig({
  name: 'My App',
  components: ${JSON.stringify(componentGlobs.length > 0 ? componentGlobs : ['src/components/*/index.ts'])},
  tokens: ${JSON.stringify(tokenPaths.length > 0 ? tokenPaths : ['src/tokens/index.ts'])},
});
`;
}

function draftPageContents(name: string): string {
  // `id` is omitted: it defaults to `component` for a component page (design §2 "Page id";
  // Task 9's `writePageIndex` resolves it), so a draft never has to repeat the export name twice.
  return `import { defineCatalogPage } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: '${name}',
  group: 'Components',
  description: 'Needs examples — fill in variants and states for ${name}.',
});
`;
}
