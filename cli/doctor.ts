import * as ts from 'typescript';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ComponentRecord, ResolvedConfig } from './types.ts';
import type { StaticPage } from './staticPage.ts';
import { discoverAllPageFiles, resolvePageId } from './pageIndex.ts';
import { readHostTsconfigOptions } from './props.ts';
import { readStaticPages } from './staticPage.ts';
import { resolveGlob } from './glob.ts';
import { sync } from './sync.ts';
import { gridColumnLimit } from '../native/catalog/comparison.ts';
import type { SpecimenSize } from '../native/catalog/types.ts';

export type DoctorSeverity = 'error' | 'warning';

export interface DoctorIssue {
  id: string;
  severity: DoctorSeverity;
  /** A page's resolved id (design §2's `id ?? component ?? file stem`) — absent for an issue that
   *  isn't tied to one page (`props-unreadable`, `no-token-modules`). */
  page?: string;
  file?: string;
  /** Populated only by `checkPageTypeErrors` below, from the diagnostic's own source position;
   *  every other rule leaves this `undefined` (see this task's own resolved-scope note above). */
  line?: number;
  message: string;
  fix: string;
}

function issue(fields: DoctorIssue): DoctorIssue {
  return fields;
}

function pageRef(page: StaticPage): { page: string; file: string } {
  return { page: resolvePageId(page, page.file), file: page.file };
}

/** Errata (controller, binding): a page discovered from a component folder (a `components` glob's
 *  folder, not a `pages` glob) with no explicit `component:` documents the component named by its
 *  own file (design §2; the viewer already applies this same default via `page.component ??
 *  page.id`, and the generated page index already defaults a missing `id` to the file stem). A
 *  page from a standalone `pages` glob is never touched — `componentFolders` only ever contains
 *  folders resolved from `config.components`, so a standalone page's own folder is never a member. */
export function applyComponentDefaults(pages: StaticPage[], componentFolders: Set<string>): StaticPage[] {
  return pages.map((page) =>
    page.component === undefined && componentFolders.has(path.dirname(page.file))
      ? { ...page, component: resolvePageId(page, page.file) }
      : page,
  );
}

function checkParseErrors(pages: StaticPage[]): DoctorIssue[] {
  return pages
    .filter((p): p is StaticPage & { parseError: string } => Boolean(p.parseError))
    .map((p) => issue({ id: 'page-parse-error', severity: 'error', file: p.file, message: `Failed to parse: ${p.parseError}`, fix: 'Fix the syntax error, then rerun doctor.' }));
}

function checkNotCheckable(pages: StaticPage[]): DoctorIssue[] {
  return pages
    .filter((p) => !p.checkable && !p.parseError)
    .map((p) => issue({
      id: 'page-not-checkable', severity: 'warning', ...pageRef(p),
      message: 'Page not statically checkable — some of its layout data is not a literal doctor can read.',
      fix: 'Write rows/columns/items/propNotes as literal arrays/objects (or a same-file const), not a function call.',
    }));
}

function checkComponentExportRemoved(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const names = new Set(components.map((c) => c.name));
  return pages
    .filter((p) => p.component && !names.has(p.component))
    .map((p) => issue({
      id: 'component-export-removed', severity: 'error', ...pageRef(p),
      message: `Documents "${p.component}", which no longer exists as a component export.`,
      fix: 'Delete this page, or update "component" to the export\'s new name.',
    }));
}

/** True when a page documents at least one example by any mechanism design §4 recognizes — a
 *  grid, a `variants` item, a `states` item, or `render`. A page can be "fully covered" by
 *  `checkComponentExportRemoved`'s standard (it names a real component) and still have none of
 *  these — e.g. `init`'s own "Needs examples" draft, which sets only `component`/`group`/
 *  `description` — in which case the viewer shows the exact same "No examples documented." an
 *  undocumented component would. */
function pageHasExamples(page: StaticPage): boolean {
  return Boolean(page.comparison) || Boolean(page.variantsItems?.length) || Boolean(page.statesItems?.length) || page.hasRender === true;
}

function checkComponentNoExamples(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const byComponent = new Map<string, StaticPage[]>();
  for (const page of pages) {
    if (page.component) byComponent.set(page.component, [...(byComponent.get(page.component) ?? []), page]);
  }
  return components
    .filter((c) => {
      const componentPages = byComponent.get(c.name) ?? [];
      // A not-statically-checkable page is given the benefit of the doubt here — it might have
      // real examples this reader simply couldn't read (Global Constraint: never a partial read;
      // its own `page-not-checkable` warning already covers it). Only "every page is checkable
      // and genuinely empty" (or "no page at all") fires this rule.
      return componentPages.length === 0 || componentPages.every((p) => p.checkable && !pageHasExamples(p));
    })
    .map((c) => {
      const hasPage = (byComponent.get(c.name) ?? []).length > 0;
      return issue({
        id: 'component-no-examples', severity: 'warning', page: c.name, file: c.file,
        message: hasPage
          ? `"${c.name}" has a catalog page with no variants, states, comparison, or render — it will show "No examples documented."`
          : `"${c.name}" has no catalog page — it will show "No examples documented."`,
        fix: hasPage ? `Add variants/states/comparison, or render, to ${c.name}'s catalog page.` : `Add ${c.name}.catalog.tsx beside ${c.name}'s own file.`,
      });
    });
}

function checkDuplicatePageId(pages: StaticPage[]): DoctorIssue[] {
  const byId = new Map<string, StaticPage[]>();
  for (const page of pages) {
    const id = resolvePageId(page, page.file);
    byId.set(id, [...(byId.get(id) ?? []), page]);
  }
  const issues: DoctorIssue[] = [];
  for (const [id, group] of byId) {
    if (group.length < 2) continue;
    for (const page of group) {
      const others = group.filter((p) => p !== page).map((p) => p.file).join(', ');
      issues.push(issue({
        id: 'duplicate-page-id', severity: 'error', page: id, file: page.file,
        message: `Page id "${id}" is also used by ${others}.`,
        fix: 'Give one of these pages its own "id".',
      }));
    }
  }
  return issues;
}

function checkGridAxisKeys(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    // Global Constraints: "never a partial read" — a not-checkable page gets only
    // `page-not-checkable` (`checkNotCheckable` above); a *different* field on it happening to be
    // literal (e.g. its grid, while its `propNotes` wasn't) is never grounds for a second opinion.
    if (!page.checkable || !page.comparison) continue;
    for (const [axisName, axis] of [['row', page.comparison.rows], ['column', page.comparison.columns]] as const) {
      const seen = new Set<string>();
      for (const item of axis.items) {
        if (item.key === '') {
          issues.push(issue({ id: 'grid-axis-key-invalid', severity: 'error', ...pageRef(page), message: `A ${axisName} has an empty key.`, fix: `Give every ${axisName} a non-empty, unique key.` }));
        } else if (seen.has(item.key)) {
          issues.push(issue({ id: 'grid-axis-key-invalid', severity: 'error', ...pageRef(page), message: `Duplicate ${axisName} key "${item.key}".`, fix: `Give each ${axisName} its own key.` }));
        }
        seen.add(item.key);
      }
    }
  }
  return issues;
}

function checkGridColumnLimit(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.checkable || !page.comparison) continue; // same "never a partial read" reasoning as checkGridAxisKeys above.
    const size = (page.comparison.size ?? page.specimenSize ?? 'regular') as SpecimenSize;
    const limit = gridColumnLimit(size);
    const count = page.comparison.columns.items.length;
    if (count > limit) {
      issues.push(issue({
        id: 'grid-column-limit', severity: 'error', ...pageRef(page),
        message: `Grid has ${count} columns; at most ${limit} ${size} columns fit a 1280px laptop.`,
        fix: 'Swap the axes, use two lists, or pick a smaller specimenSize.',
      }));
    }
  }
  return issues;
}

/** Everything that needs a page's own matching `ComponentRecord` to check: `propNotes`, bound
 *  axes, tagged list items, coverage, grouped-state matching, and guidance/a11y presence. One
 *  function because every one of these checks shares the same per-page `component`/`propsByName`
 *  lookup — splitting it further would only duplicate that lookup, not clarify anything. */
function checkComponentPages(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const componentsByName = new Map(components.map((c) => [c.name, c]));
  const issues: DoctorIssue[] = [];

  for (const page of pages) {
    if (!page.component) continue;
    if (!page.checkable) continue; // never a partial read — see checkGridAxisKeys's own note.
    const component = componentsByName.get(page.component);
    if (!component) continue; // already reported by checkComponentExportRemoved
    const ref = pageRef(page);
    const propsByName = new Map(component.props.map((p) => [p.name, p]));

    for (const key of page.propNoteKeys ?? []) {
      if (!propsByName.has(key)) {
        issues.push(issue({
          id: 'propnotes-prop-removed', severity: 'error', ...ref,
          message: `propNotes names "${key}", which is no longer a prop of ${component.name}.`,
          fix: `Delete the "${key}" entry from propNotes, or rename it to the prop's new name.`,
        }));
      }
    }

    if (page.comparison) {
      for (const [axisName, axis] of [['row', page.comparison.rows], ['column', page.comparison.columns]] as const) {
        if (axis.prop === undefined) continue;
        const prop = propsByName.get(axis.prop);
        if (!prop) {
          issues.push(issue({
            id: 'bound-axis-prop-removed', severity: 'error', ...ref,
            message: `The ${axisName} axis is bound to "${axis.prop}", which is no longer a prop of ${component.name}.`,
            fix: 'Update "prop" to the prop\'s new name, or unbind this axis.',
          }));
          continue;
        }
        if (!prop.options) {
          issues.push(issue({
            id: 'bound-axis-not-union', severity: 'error', ...ref,
            message: `The ${axisName} axis is bound to "${axis.prop}", which is not a string-literal-union prop.`,
            fix: 'Only a prop with a fixed set of string options can be bound; unbind this axis.',
          }));
          continue;
        }
        for (const item of axis.items) {
          if (!prop.options.includes(item.key)) {
            issues.push(issue({
              id: 'bound-option-removed', severity: 'error', ...ref,
              message: `The ${axisName} "${item.key}" is bound to "${axis.prop}", which no longer has that option.`,
              fix: `Delete this ${axisName}, or update its key to a current option of "${axis.prop}".`,
            }));
          }
        }
      }
    }

    const listItems = [...(page.variantsItems ?? []), ...(page.statesItems ?? [])];
    for (const item of listItems) {
      for (const [propName, value] of Object.entries(item.props ?? {})) {
        if (typeof value !== 'string') continue;
        const prop = propsByName.get(propName);
        if (!prop) {
          // A name missing from `props` is only real drift when the component has nothing
          // inherited to explain it — `component.props` deliberately omits a node_modules-declared
          // prop (cli/props.ts:200), so e.g. `autoCapitalize` on a `TextInput`-extending component
          // is expected to be absent here, not a removed prop (design: `inheritedFrom` summarises
          // those instead of listing them).
          if (component.inheritedFrom.length > 0) continue;
          // The tagged prop *name* itself no longer exists — arguably the same drift as
          // `bound-axis-prop-removed`, but a tagged list item (unlike a bound axis) has no
          // "prop" field of its own to report that id against, so it's reported here instead.
          // Previously silently skipped (`!prop?.options` was true for both "prop missing" and
          // "prop exists but isn't a union"), masking exactly the drift this rule exists to catch.
          issues.push(issue({
            id: 'bound-option-removed', severity: 'error', ...ref,
            message: `"${item.name}" is tagged props.${propName} = "${value}", but "${propName}" is no longer a prop of ${component.name}.`,
            fix: 'Delete the tag, or update it to a current prop name.',
          }));
          continue;
        }
        if (!prop.options || prop.options.includes(value)) continue;
        issues.push(issue({
          id: 'bound-option-removed', severity: 'error', ...ref,
          message: `"${item.name}" is tagged props.${propName} = "${value}", which is no longer an option of "${propName}".`,
          fix: 'Update the tagged value, or delete this item if the option no longer exists.',
        }));
      }
    }

    for (const prop of component.props) {
      if (!prop.options) continue;
      const covered = new Set<string>();
      if (page.comparison) {
        for (const axis of [page.comparison.rows, page.comparison.columns]) {
          if (axis.prop === prop.name) for (const item of axis.items) covered.add(item.key);
        }
      }
      for (const item of listItems) {
        const value = item.props?.[prop.name];
        if (typeof value === 'string') covered.add(value);
      }
      for (const option of prop.options.filter((o) => !covered.has(o))) {
        issues.push(issue({
          id: 'option-not-covered', severity: 'warning', ...ref,
          message: `"${prop.name}" option "${option}" has no bound or tagged example.`,
          fix: `Bind a grid axis to "${prop.name}", or add { props: { ${prop.name}: '${option}' } } to a variants/states item.`,
        }));
      }
    }

    const variantKeys = new Set((page.variantsItems ?? []).map((i) => i.key));
    for (const item of page.statesItems ?? []) {
      if (item.group !== undefined && !variantKeys.has(item.group)) {
        issues.push(issue({
          id: 'group-unmatched', severity: 'warning', ...ref,
          message: `"${item.name}" names group "${item.group}", which matches no variant key; it will show under "Other configurations".`,
          fix: 'Fix the group value, or remove it if this item isn\'t tied to a specific variant.',
        }));
      }
    }

    // Design §4 names this one rule, "missing guidance or accessibility notes" — one id, and (per
    // the controller) both halves: a missing `whenToUse` and a missing `a11y` each get their own
    // message under `missing-guidance-or-a11y`, since the viewer renders a visible placeholder
    // ("No usage guidance documented."/"No accessibility notes documented.") for either gap, not
    // just the second. Never invented content — both messages only ever point the author at
    // writing their own, real sentence.
    if (!page.tokenGallery && page.hasWhenToUse === false) {
      issues.push(issue({
        id: 'missing-guidance-or-a11y', severity: 'warning', ...ref,
        message: 'No "whenToUse" guidance documented.',
        fix: 'Add a one-sentence whenToUse note disambiguating this component from its closest look-alike(s), or omit it only when there genuinely is none.',
      }));
    }
    if (!page.tokenGallery && page.hasA11y === false && !page.hidesAccessibility) {
      issues.push(issue({
        id: 'missing-guidance-or-a11y', severity: 'warning', ...ref,
        message: 'No "a11y" notes documented.',
        fix: 'Add a one-sentence a11y note, grounded in the component\'s real behavior — even "no explicit handling beyond defaults" is better than leaving it blank.',
      }));
    }
  }
  return issues;
}

/** Every page-scoped issue, from every rule above. */
export function collectIssues(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  return [
    ...checkParseErrors(pages),
    ...checkNotCheckable(pages),
    ...checkComponentExportRemoved(pages, components),
    ...checkComponentNoExamples(pages, components),
    ...checkDuplicatePageId(pages),
    ...checkGridAxisKeys(pages),
    ...checkGridColumnLimit(pages),
    ...checkComponentPages(pages, components),
  ];
}

/** Issues that aren't tied to one page: `sync`'s own "Could not read" warnings, and a configured
 *  project with no token modules at all. */
export function collectGlobalIssues(input: { syncWarnings: string[]; tokenFileCount: number }): DoctorIssue[] {
  const issues: DoctorIssue[] = input.syncWarnings.map((warning) =>
    issue({ id: 'props-unreadable', severity: 'warning', message: warning, fix: 'Fix the file so sync can read it, or exclude it from the components/tokens globs.' }),
  );
  if (input.tokenFileCount === 0) {
    issues.push(issue({ id: 'no-token-modules', severity: 'warning', message: 'No token modules are configured.', fix: 'Add a tokens glob to ds-viewer.config.ts.' }));
  }
  return issues;
}

/** Design §4's other half of "fails to parse or typecheck" — the half `cli/staticPage.ts` (Task 3)
 *  deliberately never attempts, since it has no type checker and no module resolution at all.
 *  This builds exactly one `ts.Program` over every page file, using the identical compiler-host
 *  construction `cli/props.ts`'s `createComponentReader` already uses for component files (same
 *  `compilerOptions` shape, same `fallbackPaths` mechanism for a page outside the project root —
 *  `runDoctor`, Task 5, computes `fallbackPaths` the same way `cli/sync.ts` already does for
 *  component files), and reports every syntactic *and* semantic diagnostic as `page-parse-error`,
 *  with a real `line` (unlike every other rule in this file — see this task's own resolved-scope
 *  note above). Errata (controller, binding): a page that already has a `parseError` from
 *  `cli/staticPage.ts`'s own syntactic reader is skipped here — its syntax error was already
 *  reported once by `checkParseErrors`, and this program would otherwise report it again (its own
 *  syntactic diagnostics are a superset of what `ts.transpileModule` already found). A spike
 *  against the real kit (`spikes/page-typecheck/` in this plan's spike folder) found exactly one
 *  real, previously-uncaught diagnostic, fixed in Task 2. */
export function checkPageTypeErrors(pages: StaticPage[], options: { fallbackPaths?: Record<string, string[]> } = {}): DoctorIssue[] {
  const checkablePages = pages.filter((p) => !p.parseError);
  const pageFiles = checkablePages.map((p) => p.file);
  if (pageFiles.length === 0) return [];
  const byFile = new Map(checkablePages.map((p) => [p.file, p]));
  // Important finding 2 (Fable's review): the host project's own tsconfig decides every option —
  // its ambient declarations (expo-env.d.ts's `*.png`/`*.svg` modules, a project's own
  // declarations.d.ts) and its `strict`/`lib`/etc. settings — not a fixed set copied from
  // `createComponentReader` (where a mismatch only degrades prop reading silently; here it would
  // produce CI-failing errors the host's own `tsc` would never raise). Only `noEmit`,
  // `skipLibCheck`, and the merged `paths` are forced on top.
  const host = readHostTsconfigOptions(pageFiles[0]);
  const compilerOptions: ts.CompilerOptions = {
    ...host.options,
    noEmit: true,
    skipLibCheck: true,
    paths: { ...options.fallbackPaths, ...host.paths },
  };
  const program = ts.createProgram([...pageFiles, ...host.declarationFiles], compilerOptions);
  const issues: DoctorIssue[] = [];
  for (const file of pageFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;
    const diagnostics = [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)];
    const page = byFile.get(file);
    const ref = page ? pageRef(page) : { file };
    for (const d of diagnostics) {
      const line = d.start !== undefined ? sourceFile.getLineAndCharacterOfPosition(d.start).line + 1 : undefined;
      issues.push(issue({
        id: 'page-parse-error', severity: 'error', ...ref, line,
        message: `Failed to typecheck: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`,
        fix: 'Fix the error, then rerun doctor.',
      }));
    }
  }
  return issues;
}

export interface DoctorSummary {
  errors: number;
  warnings: number;
  components: number;
  withExamples: number;
  unboundExamples: number;
}

export interface DoctorJsonResult {
  version: 1;
  summary: DoctorSummary;
  /** `null` when the check didn't run (disabled, `--ci`, or offline with nothing cached);
   *  otherwise filled by `cli/main.ts`'s `runDoctorCommand` — `runDoctor` itself never calls the
   *  update check (it stays pure/synchronous; see this task's own note in Global Constraints). */
  update: { current: string; latest: string; breaking: boolean } | null;
  issues: DoctorIssue[];
}

export interface DoctorRunResult extends DoctorJsonResult {
  /** 1 when `summary.errors > 0`, else 0 — what `--ci` exits with; a plain `doctor` run (no
   *  `--ci`) never uses this (design §4: "local work is never blocked"). */
  exitCode: number;
}

/** "With examples" means what `checkComponentNoExamples` (Task 4) checks the *absence* of: at
 *  least one checkable page with a real example, not merely "has a page" (an `init`-drafted
 *  "Needs examples" page has one, with none). */
function countWithExamples(pages: StaticPage[], components: ComponentRecord[]): number {
  const byComponent = new Map<string, StaticPage[]>();
  for (const page of pages) {
    if (page.component) byComponent.set(page.component, [...(byComponent.get(page.component) ?? []), page]);
  }
  return components.filter((c) => (byComponent.get(c.name) ?? []).some((p) => p.checkable && pageHasExamples(p))).length;
}

function countUnboundExamples(pages: StaticPage[]): number {
  let count = 0;
  for (const page of pages) {
    if (page.comparison) {
      if (page.comparison.rows.prop === undefined) count += page.comparison.rows.items.length;
      if (page.comparison.columns.prop === undefined) count += page.comparison.columns.items.length;
    }
    for (const item of [...(page.variantsItems ?? []), ...(page.statesItems ?? [])]) {
      if (!item.props || Object.keys(item.props).length === 0) count += 1;
    }
  }
  return count;
}

/** Runs `sync`, reads every page `cli/staticPage.ts` can find (`discoverAllPageFiles` —
 *  deliberately wider than the viewer's own page list, so a renamed/removed component's orphaned
 *  page is still seen), applies the component-folder default (Errata, `applyComponentDefaults`
 *  above), and applies every rule from Task 4. `config.doctor.strict` promotes every warning to an
 *  error for both the summary counts and the exit code (design §2 Config: "`strict: true` promotes
 *  `doctor` warnings to errors"). */
export function runDoctor(config: ResolvedConfig): DoctorRunResult {
  const syncResult = sync(config);
  const components = JSON.parse(readFileSync(path.join(syncResult.generatedDir, 'components.json'), 'utf8')) as ComponentRecord[];
  // Same exclusion `sync` already applies to `componentEntryFiles` (cli/sync.ts:29-30) — without
  // it, an excluded folder's own `*.catalog.tsx` is still discovered below (`discoverAllPageFiles`)
  // even though its component never makes it into `components.json`, firing a false
  // `component-export-removed`.
  const excluded = new Set((config.exclude ?? []).flatMap((pattern) => resolveGlob(config.projectRoot, pattern)));
  const componentFolders = [
    ...new Set(
      config.components
        .flatMap((pattern) => resolveGlob(config.projectRoot, pattern))
        .filter((file) => !excluded.has(file))
        .map((file) => path.dirname(file)),
    ),
  ];
  const tokenFileCount = config.tokens.flatMap((pattern) => resolveGlob(config.projectRoot, pattern)).length;
  const pageFiles = discoverAllPageFiles({ componentFolders, standalonePageGlobs: config.pages ?? [], projectRoot: config.projectRoot });
  const pages = applyComponentDefaults(readStaticPages(pageFiles), new Set(componentFolders));

  // Same "a page outside the project root needs a fallback paths entry" rule `cli/sync.ts` already
  // applies to component entry files (e.g. `kit-host`'s own component pages, which physically live
  // in the sibling `../starter-kit/`) — mirrored here for page files, since `checkPageTypeErrors`
  // below needs it for the identical reason `createComponentReader` does. `@krapwoo/ds-viewer`
  // itself resolves from `../starter-kit` pages through Node's own self-name resolution (the repo
  // root `package.json`'s `name` + `exports`), not this fallback — never a `starter-kit/package.json`.
  const hasPageOutsideProjectRoot = pageFiles.some((file) => !file.startsWith(`${config.projectRoot}${path.sep}`));
  const fallbackPaths = hasPageOutsideProjectRoot
    ? { '*': [path.join(config.projectRoot, 'node_modules', '@types', '*'), path.join(config.projectRoot, 'node_modules', '*')] }
    : undefined;

  let issues = [
    ...collectIssues(pages, components),
    ...checkPageTypeErrors(pages, { fallbackPaths }),
    ...collectGlobalIssues({ syncWarnings: syncResult.warnings, tokenFileCount }),
  ];
  // Design's own `--json` example gives a project-relative `file`; `StaticPage.file` is absolute
  // (`discoverAllPageFiles`) and `ComponentRecord.file` is cwd-relative (`cli/props.ts`) — cwd
  // equals `config.projectRoot` for every real CLI invocation, so resolving against one and
  // re-relativizing against the other normalizes both to the same, documented shape.
  issues = issues.map((i) => (i.file ? { ...i, file: path.relative(config.projectRoot, path.resolve(config.projectRoot, i.file)) } : i));
  if (config.doctor?.strict) issues = issues.map((i) => (i.severity === 'warning' ? { ...i, severity: 'error' as const } : i));

  const summary: DoctorSummary = {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    components: components.length,
    withExamples: countWithExamples(pages, components),
    unboundExamples: countUnboundExamples(pages),
  };
  return { version: 1, summary, update: null, issues, exitCode: summary.errors > 0 ? 1 : 0 };
}

export function toDoctorJson(result: DoctorRunResult): DoctorJsonResult {
  const { version, summary, update, issues } = result;
  return { version, summary, update, issues };
}

/** Human report (design §4 "Output"): grouped by page, each issue with its one-line fix; issues
 *  with no `page` (`props-unreadable`, `no-token-modules`) are listed under "General". Ends with
 *  the same counts `--json`'s `summary` carries. */
export function formatHuman(result: DoctorJsonResult): string {
  const byPage = new Map<string, DoctorIssue[]>();
  const general: DoctorIssue[] = [];
  for (const issue of result.issues) {
    if (issue.page) byPage.set(issue.page, [...(byPage.get(issue.page) ?? []), issue]);
    else general.push(issue);
  }
  const lines: string[] = [];
  const renderIssue = (issue: DoctorIssue) => {
    const location = issue.file ? ` (${issue.file}${issue.line ? `:${issue.line}` : ''})` : '';
    lines.push(`  [${issue.severity}] ${issue.id}: ${issue.message}${location}`);
    lines.push(`    Fix: ${issue.fix}`);
  };
  for (const [page, issues] of [...byPage].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(page);
    for (const issue of issues) renderIssue(issue);
    lines.push('');
  }
  if (general.length > 0) {
    lines.push('General');
    for (const issue of general) renderIssue(issue);
    lines.push('');
  }
  const { errors, warnings, components, withExamples, unboundExamples } = result.summary;
  lines.push(
    `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'} — ` +
      `${components} components (${withExamples} with examples), ${unboundExamples} unbound examples.`,
  );
  return lines.join('\n');
}
