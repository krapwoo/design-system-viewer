import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { globBaseFolder, resolveGlob } from './glob.ts';
import { createComponentReader, type ReadComponentsOptions } from './props.ts';
import { readTokenModules } from './tokens.ts';
import { discoverPages, writePageIndex } from './pageIndex.ts';
import type { ComponentRecord, ResolvedConfig } from './types.ts';

export interface SyncResult {
  componentCount: number;
  pageCount: number;
  generatedDir: string;
  /** Every "Could not read ..." message this run printed via `console.warn` — also returned so
   *  `cli/doctor.ts`'s `props-unreadable` rule (Task 4) can report them without re-deriving
   *  anything `sync` already knows. In declaration order; empty when nothing failed to read. */
  warnings: string[];
}

const GENERATED_INDEX = "export { default as components } from './components.json';\nexport { default as tokens } from './tokens.json';\n";

/** Reads detection, props, and tokens from source, then writes `.ds-viewer/generated/`
 *  (design §3 — "Output and speed": `components.json`, `tokens.json`, and the page import list,
 *  sorted and deterministic). Nothing from the project is executed. `resolveOptions` is test-only
 *  (see this task's Interfaces note) — production callers omit it. */
export function sync(config: ResolvedConfig, resolveOptions?: ReadComponentsOptions): SyncResult {
  const generatedDir = path.join(config.projectRoot, '.ds-viewer', 'generated');
  mkdirSync(generatedDir, { recursive: true });

  const excluded = new Set((config.exclude ?? []).flatMap((pattern) => resolveGlob(config.projectRoot, pattern)));
  const componentEntryFiles = config.components.flatMap((pattern) => resolveGlob(config.projectRoot, pattern)).filter((file) => !excluded.has(file));
  const tokenEntryFiles = config.tokens.flatMap((pattern) => resolveGlob(config.projectRoot, pattern));

  // Coverage-target options (design §3) are recorded only for string-literal unions declared
  // inside the project's own component or token folders — never a sibling folder (e.g. `icons/`)
  // that happens to export a large union too.
  const optionRoots = [
    ...new Set([
      ...config.components.map((pattern) => path.join(config.projectRoot, globBaseFolder(pattern))),
      ...tokenEntryFiles.map((file) => path.dirname(file)),
    ]),
  ];

  // Error-handling rule (design, Global Constraints): one broken component/token file never stops
  // the rest of a sync. Each entry is read in its own try/catch so an exception from one file's
  // read (as opposed to a missing file, which `readComponents`/`readTokenModules` already skip)
  // is reported with its path and the remaining files are still synced. `createComponentReader`
  // builds one `ts.Program` across every entry up front (Important: one-program-per-entry took
  // 9.9s over 37 components) while keeping that per-entry isolation.
  const components: ComponentRecord[] = [];
  const componentRefs: { name: string; entryFile: string }[] = [];
  const seenNames = new Set<string>();
  // A component entry file can live outside `config.projectRoot` (e.g. kit-host's sibling
  // `../starter-kit/`) — `createComponentReader`'s own host-tsconfig lookup walks up from the
  // entry file, never reaching `config.projectRoot`'s own node_modules. This fallback (lowest
  // priority — a real host `paths`, or `resolveOptions.paths`, still wins) is what lets such a
  // file still resolve `react`/`react-native` against the project that actually declares them.
  // `@types/*` is listed BEFORE the plain package deliberately (confirmed by spike,
  // `spikes/README.md` "sync-fallback-paths"): once `paths` redirects a bare specifier to an
  // on-disk folder, TypeScript resolves it there and never falls through to a second entry just
  // because the first has no types — the reverse order left `react`/`react-native` both
  // resolving to "implicitly any", because the plain package folder matched first. Only computed
  // when at least one entry file actually lies outside `config.projectRoot` — normal projects
  // (every entry file under projectRoot) keep standard TypeScript resolution untouched.
  const hasEntryOutsideProjectRoot = componentEntryFiles.some(
    (file) => !file.startsWith(`${config.projectRoot}${path.sep}`),
  );
  const fallbackPaths = hasEntryOutsideProjectRoot
    ? { '*': [path.join(config.projectRoot, 'node_modules', '@types', '*'), path.join(config.projectRoot, 'node_modules', '*')] }
    : undefined;
  const componentRoots = [...new Set(config.components.map((pattern) => path.join(config.projectRoot, globBaseFolder(pattern))))];
  const readComponent = createComponentReader(componentEntryFiles, { ...resolveOptions, optionRoots, componentRoots, fallbackPaths });
  const warnings: string[] = [];
  for (const entryFile of componentEntryFiles) {
    try {
      for (const record of readComponent(entryFile)) {
        if (seenNames.has(record.name)) {
          const message = `Duplicate component name "${record.name}" (${path.relative(config.projectRoot, entryFile)}); the catalog will show only one.`;
          console.warn(message);
          warnings.push(message);
        }
        seenNames.add(record.name);
        components.push(record);
        componentRefs.push({ name: record.name, entryFile });
      }
    } catch (error) {
      const message = `Could not read ${path.relative(config.projectRoot, entryFile)}: ${(error as Error).message}`;
      console.warn(message);
      warnings.push(message);
    }
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(path.join(generatedDir, 'components.json'), `${JSON.stringify(components, null, 2)}\n`);

  const tokenRecords = [];
  for (const tokenFile of tokenEntryFiles) {
    try {
      tokenRecords.push(...readTokenModules([tokenFile]));
    } catch (error) {
      const message = `Could not read ${path.relative(config.projectRoot, tokenFile)}: ${(error as Error).message}`;
      console.warn(message);
      warnings.push(message);
    }
  }
  writeFileSync(path.join(generatedDir, 'tokens.json'), `${JSON.stringify(tokenRecords, null, 2)}\n`);
  writeFileSync(path.join(generatedDir, 'index.ts'), GENERATED_INDEX);

  const pageFiles = discoverPages({ components: componentRefs, standalonePageGlobs: config.pages ?? [], projectRoot: config.projectRoot });
  writePageIndex(generatedDir, pageFiles);

  return { componentCount: components.length, pageCount: pageFiles.length, generatedDir, warnings };
}
