import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveGlob } from './glob.ts';

export interface PageIndexInput {
  /** Each detected component's name and the entry file its folder was matched by. */
  components: { name: string; entryFile: string }[];
  /** Standalone page globs (design's `pages` config field), resolved relative to `projectRoot`. */
  standalonePageGlobs: string[];
  projectRoot: string;
}

/** Component pages: `<Export>.catalog.tsx` beside the component's entry file (design §2). A
 *  component with none is simply absent here — `buildCatalogSections` (Task 8) still shows it. */
export function discoverPages(input: PageIndexInput): string[] {
  const componentPages = input.components
    .map(({ name, entryFile }) => path.join(path.dirname(entryFile), `${name}.catalog.tsx`))
    .filter((file) => existsSync(file));
  const standalonePages = input.standalonePageGlobs.flatMap((pattern) => resolveGlob(input.projectRoot, pattern));
  return [...componentPages, ...standalonePages].sort();
}

/** Writes `.ds-viewer/generated/pages.ts`: imports every discovered page's default export,
 *  resolves each one's id (design §2 "Page id": `id ?? component ?? <file stem>` — a component
 *  page defaults to its export name, a standalone page to its own file's stem) and `file` (the
 *  page's own project-relative path — a standalone page with no matching component record has
 *  nothing else to show as its Source; Important finding 4), and re-exports the resolved pages as
 *  one ordered array, so the generated entry file and (from 0.3) `doctor` share one page list
 *  instead of each re-deriving it. */
export function writePageIndex(generatedDir: string, pageFiles: string[]): string {
  const outFile = path.join(generatedDir, 'pages.ts');
  const importLines = pageFiles.map((file, index) => `import page${index} from '${toImportPath(generatedDir, file)}';`);
  const resolveLines = pageFiles.map(
    (file, index) =>
      `const resolved${index} = { ...page${index}, id: page${index}.id ?? page${index}.component ?? ${JSON.stringify(fileStem(file))}, file: ${JSON.stringify(path.relative(process.cwd(), file))} };`,
  );
  const exportLine = `export default [${pageFiles.map((_, index) => `resolved${index}`).join(', ')}];`;
  writeFileSync(outFile, `${importLines.join('\n')}\n\n${resolveLines.join('\n')}\n\n${exportLine}\n`);
  return outFile;
}

function toImportPath(fromDir: string, toFile: string): string {
  const withoutExt = toFile.replace(/\.tsx?$/, '');
  const relativePath = path.relative(fromDir, withoutExt).split(path.sep).join('/');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

/** A page file's name with its `.catalog.tsx`/`.catalog.ts` suffix (or, failing that, just
 *  `.tsx`/`.ts`) stripped — `Button.catalog.tsx` → `"Button"`, matching design §2's "the file
 *  stem" for a standalone page's default id. */
function fileStem(file: string): string {
  return path.basename(file).replace(/\.catalog\.tsx?$/, '').replace(/\.tsx?$/, '');
}
