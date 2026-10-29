#!/usr/bin/env node
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from './config.ts';
import { initExistingProject, initNewProject, promptInitMode, type InitOptions, type InitResult, type NewProjectOptions } from './init.ts';
import { dev } from './dev.ts';
import { sync } from './sync.ts';
import { formatHuman, runDoctor, toDoctorJson, withExtraIssues } from './doctor.ts';
import { renderCheck } from './render.ts';
import { RENDER_WORKSPACE_DIR } from './types.ts';
import { explainPage, formatExplain, parseHeights } from './explain.ts';
import { comparableWidths, diffLayouts, formatLayoutDiff, layoutSnapshot, type LayoutSnapshot } from './layout.ts';
import { readOwnVersion } from './packageVersion.ts';
import { checkForUpdate, defaultPreferencesDir, readPersonalAutoCheck, resolveAutoCheck } from './updateCheck.ts';
import { runKitDiffCommand } from './kitDiff.ts';
import { formatMigrateHuman, runMigrate } from './migrate.ts';
import { runUpdate } from './update.ts';

const USAGE = `Usage: ds-viewer <command>

Commands:
  init     Set up the viewer in this project: config, catalog pages, and an npm script
           --new           start from the starter kit (new project)
           --existing      detect this project's own components/tokens (existing project)
           --kit-root DIR  where to copy the starter kit (--new only; default src/ds)
           --yes           accept the detected components and tokens without asking (--existing only)
  sync     Regenerate the component, props, token, and page data from source
  dev      Sync, then serve the catalog on a local web address and keep it current as files change
           [--port <number>]
           Pin the catalog (and its update endpoint's restart handoff) to this port
           [--no-update-endpoint]
           Serve with no local update endpoint, leaving the one a running dev server recorded alone
           [--workspace-dir <name>]
           Generate into this directory instead of .ds-viewer, so two servers never share files
  doctor   Check every page for drift and coverage gaps
           --json          print the machine-readable report instead
           --ci            exit 1 when any error was found (never on a warning alone)
           --render        also open every page in a headless browser (needs puppeteer)
           --port <n>      pin the render server's port (with --render), for when something
                           else already holds the range it would pick from
  explain <Page>
           Print why a page's specimens are laid out the way they are
           --heights <first>,<second>  check side-by-side placement with these measured heights
           --json          print the machine-readable report instead
           --all           every page's geometry as JSON, for layout-diff
  layout-diff <before.json> <after.json>
           What changed about every page's layout between two explain --all snapshots, so a
           viewer upgrade that reshapes your catalog is visible rather than silent
           --json          print the changes as JSON
  kit diff <Component>
           Show the user's kit file(s) for <Component> against the installed kit's copy
  migrate --from <version>
           Run every migration introduced after <version>
           --dry-run       report the changes without writing them
           --json          print the machine-readable report instead
  update  [--dry-run]     Build and show the update plan; stop without installing
          [--yes]         Skip the confirmation prompt
          [--force]       Install even if planned files have uncommitted changes

Options:
  -h, --help     Show this help
  -v, --version  Show the installed version`;

function packageVersion(): string {
  try {
    return readOwnVersion(path.dirname(fileURLToPath(import.meta.url)));
  } catch {
    return 'unknown';
  }
}

/** `--kit-root`'s raw CLI value, normalized to a project-root-relative, forward-slash path — or an
 *  error when the value can't be made into one. Without this: an absolute value was silently
 *  relocated *under* the project root by `path.join` (which never does `path.resolve`'s "a later
 *  absolute segment replaces everything before it" — it just concatenates), a trailing slash
 *  produced a doubled-slash glob (`src/ds//components/*`), and a quote broke the generated
 *  config's TypeScript string literal (Minor finding, Fable's implementation review,
 *  cli/main.ts:59-60 & cli/init.ts:231-233,257). */
export function parseKitRoot(projectRoot: string, rawValue: string): { value: string; error?: undefined } | { value?: undefined; error: string } {
  if (rawValue.includes("'") || rawValue.includes('"')) {
    return { error: `--kit-root cannot contain a quote (got "${rawValue}")` };
  }
  const relative = path.relative(projectRoot, path.resolve(projectRoot, rawValue));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { error: `--kit-root must stay inside the project root (got "${rawValue}")` };
  }
  return { value: relative.split(path.sep).join('/') };
}

export interface RunInitOptions {
  /** Test-only: forwarded to `initNewProject` so a `--new` dispatch test never runs a real `expo
   *  install`. */
  installer?: NewProjectOptions['installer'];
  /** Test-only: forwarded to `initExistingProject`'s confirmation prompt. */
  confirm?: InitOptions['confirm'];
  /** Test-only: replaces `promptInitMode` when neither `--new`/`--existing`/`--yes` was passed. */
  promptMode?: () => Promise<'new' | 'existing' | undefined>;
  /** Test-only: replaces `process.stdin.isTTY` for the "could not parse the answer" message
   *  below, so that message is reachable without a real TTY. */
  isTTY?: boolean;
}

/** Parses `init`'s flags and dispatches to `initNewProject`/`initExistingProject` — pulled out of
 *  `main` so the dispatch (which flags pick which project path, `--yes`'s 0.1-compatible default,
 *  `--kit-root`'s normalization) is unit-testable with an injected installer, never a real `expo
 *  install` (Minor finding, Fable's implementation review: "No CLI test covers `--yes` defaulting
 *  to existing, `--kit-root` parsing, or `--new` dispatch"). */
export async function runInit(projectRoot: string, rest: string[], options: RunInitOptions = {}): Promise<InitResult> {
  const kitRootIndex = rest.indexOf('--kit-root');
  // Validated, not just indexed: a bare trailing `--kit-root` (no value) or `--kit-root --yes`
  // (the next token is itself a flag) would otherwise silently pass `undefined`/`'--yes'` as the
  // kit root. Both are treated as "no value given", the same as omitting the flag entirely.
  const kitRootValue = kitRootIndex !== -1 ? rest[kitRootIndex + 1] : undefined;
  const kitRootRaw = kitRootValue && !kitRootValue.startsWith('--') ? kitRootValue : undefined;
  let kitRoot: string | undefined;
  if (kitRootRaw !== undefined) {
    const parsed = parseKitRoot(projectRoot, kitRootRaw);
    if (parsed.error) return { messages: [parsed.error], written: [], exitCode: 1 };
    kitRoot = parsed.value;
  }

  let mode: 'new' | 'existing' | undefined = rest.includes('--new') ? 'new' : rest.includes('--existing') ? 'existing' : undefined;
  // 0.1 had only one `init` path (today's `initExistingProject`) and no mode question at all —
  // `--yes` alone must keep working exactly as it did for a 0.1 user or script, so `--yes` with
  // neither `--new` nor `--existing` defaults to `existing`, the same path 0.1's `--yes` always
  // ran, instead of prompting (which would hang/exit 1 on non-interactive stdin and break them).
  if (!mode && rest.includes('--yes')) mode = 'existing';
  if (!mode) mode = await (options.promptMode ?? promptInitMode)();
  if (!mode) {
    const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY);
    // A non-interactive stdin (CI, piped npx) never got to ask the question at all — but a TTY
    // whose answer `promptInitMode` simply couldn't parse did ask, so it needs its own message,
    // not the "non-interactive" one (Minor finding, Fable's implementation review).
    const message = isTTY
      ? 'Could not parse that answer. Specify --new or --existing directly.'
      : 'Specify --new or --existing (non-interactive stdin cannot be asked).';
    return { messages: [`${message}\n\n${USAGE}`], written: [], exitCode: 1 };
  }
  return mode === 'new'
    ? initNewProject(projectRoot, { kitRoot, installer: options.installer })
    : initExistingProject(projectRoot, { yes: rest.includes('--yes'), confirm: options.confirm });
}

/** Pulled out of `main()` for the same reason `runInit` was in 0.1/0.2 (Fable's review): testable
 *  without spawning a process. `--ci`'s exit code is read from `runDoctor`'s own `exitCode` — a
 *  plain `doctor` (no `--ci`) always returns 0 here regardless of errors found. */
export async function runDoctorCommand(
  projectRoot: string,
  rest: string[],
  options: { checkForUpdate?: typeof checkForUpdate; env?: NodeJS.ProcessEnv; prefsDir?: string; renderCheck?: typeof renderCheck } = {},
): Promise<{ output: string; exitCode: number }> {
  const config = resolveConfig(projectRoot);
  let result: Omit<ReturnType<typeof runDoctor>, 'pageFiles'> = runDoctor(config);
  // `--render`: open every page in a headless browser and add what only a real render shows.
  // Progress goes to stderr, so `--json` output stays pure JSON.
  if (rest.includes('--render')) {
    const files = (result as ReturnType<typeof runDoctor>).pageFiles;
    // `--port <n>`: pin the render server instead of taking the first free port from 5181. Needed
    // when something else already holds that range (another project's catalog, a second `dev`),
    // because the check cannot tell a stranger's server on its port from its own and would report
    // that server's pages as this project's failures.
    const portFlag = rest.indexOf('--port');
    let renderPort: number | undefined;
    if (portFlag !== -1) {
      const raw = rest[portFlag + 1];
      renderPort = Number(raw);
      if (!raw || !Number.isInteger(renderPort) || renderPort < 1 || renderPort > 65535) {
        // Refused rather than quietly falling back to a port it picked itself: a check that
        // ignores the port you gave it would render against whatever else is there and report a
        // stranger's pages as this project's failures.
        return { output: `doctor --render --port needs a port between 1 and 65535, not ${raw ?? '(nothing)'}.`, exitCode: 1 };
      }
    }
    const rendered = await (options.renderCheck ?? renderCheck)(config.projectRoot, { files, log: (line) => process.stderr.write(`${line}\n`), ...(renderPort ? { port: renderPort } : {}) });
    result = withExtraIssues(result, rendered, Boolean(config.doctor?.strict));
  }
  // Design §4 "`--ci`: ... no update check." — `--ci` skips this whole block even when
  // `updateCheck` is otherwise enabled; `result.update` stays `null`.
  // Same precedence as the viewer: CI's environment variable, your own switch, the project config.
  const autoCheck = resolveAutoCheck(config, options.env ?? process.env, readPersonalAutoCheck(options.prefsDir ?? defaultPreferencesDir(), config.projectRoot));
  if (!rest.includes('--ci') && autoCheck.enabled) {
    const ownVersion = readOwnVersion(path.dirname(fileURLToPath(import.meta.url)));
    const updateResult = await (options.checkForUpdate ?? checkForUpdate)(ownVersion);
    if (updateResult) {
      result.update = { current: updateResult.current, latest: updateResult.latest, breaking: updateResult.breaking };
    }
  }
  // The human formatter (`formatHuman`, unchanged) knows nothing about updates — it predates this
  // release and every other release's own doctor output; appending one line here, rather than
  // threading `update` through `formatHuman`'s own signature, keeps that function's existing
  // tests untouched (Minor finding, Fable correction pass: the human path previously said nothing
  // about an update `--json` already reported).
  const updateLine = result.update ? `\nUpdate available: ${result.update.current} → ${result.update.latest}` : '';
  const output = rest.includes('--json') ? JSON.stringify(toDoctorJson(result), null, 2) : `${formatHuman(result)}${updateLine}`;
  return { output, exitCode: rest.includes('--ci') ? result.exitCode : 0 };
}

/** Same "testable without spawning" shape as `runDoctorCommand` above. */
export function runExplainCommand(projectRoot: string, pageId: string | undefined, rest: string[]): { output: string; exitCode: number } {
  // `--all`: every page's geometry as one JSON document, for `layout-diff` to compare across
  // versions. It takes no page id, and it is JSON only — the whole point is a machine-readable
  // artifact, and a prose dump of 50 pages would be read by nobody.
  if (pageId === '--all' || rest.includes('--all')) {
    const config = resolveConfig(projectRoot);
    const version = readOwnVersion(path.dirname(fileURLToPath(import.meta.url)));
    try {
      return { output: JSON.stringify(layoutSnapshot(config, version), null, 2), exitCode: 0 };
    } catch (error) {
      return { output: (error as Error).message, exitCode: 1 };
    }
  }
  if (!pageId) return { output: 'Usage: ds-viewer explain <Page> [--heights <first>,<second>] [--json], or explain --all for every page as JSON', exitCode: 1 };
  const heightsIndex = rest.indexOf('--heights');
  const heightsRaw = heightsIndex !== -1 ? rest[heightsIndex + 1] : undefined;
  const heights = heightsRaw ? parseHeights(heightsRaw) : undefined;
  if (heightsRaw && !heights) {
    return { output: `--heights must be two comma-separated numbers, e.g. --heights 420,610 (got "${heightsRaw}")`, exitCode: 1 };
  }
  const config = resolveConfig(projectRoot);
  const result = explainPage(config, pageId, { heights });
  if (!result) return { output: `No page named "${pageId}" was found.`, exitCode: 1 };
  return { output: rest.includes('--json') ? JSON.stringify(result, null, 2) : formatExplain(result), exitCode: 0 };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isGeometry(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const geometry = value as Record<string, unknown>;
  return Number.isInteger(geometry.columns) && (geometry.columns as number) >= 0
    && Number.isInteger(geometry.rows) && (geometry.rows as number) >= 0
    && Number.isInteger(geometry.fillers) && (geometry.fillers as number) >= 0;
}

function isBlockSnapshot(entryBlock: unknown): boolean {
  if (!entryBlock || typeof entryBlock !== 'object') return false;
  const block = entryBlock as Record<string, unknown>;
  if (typeof block.title !== 'string' || !['grid', 'grouped', 'list', 'preview', 'tokenSections', 'empty'].includes(String(block.kind))) return false;
  if (!(block.minWidth === null || isFiniteNumber(block.minWidth))) return false;
  if (block.items !== undefined && (!Number.isInteger(block.items) || (block.items as number) < 0)) return false;
  if (block.size !== undefined && typeof block.size !== 'string') return false;
  if (block.full !== undefined && !isGeometry(block.full)) return false;
  if (block.half !== undefined && !isGeometry(block.half)) return false;
  return true;
}

function isLayoutSnapshot(value: unknown): value is LayoutSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.version !== 'string' || !isFiniteNumber(snapshot.width) || snapshot.width <= 0 || !Array.isArray(snapshot.pages)) return false;
  if (snapshot.membersRecorded !== undefined && snapshot.membersRecorded !== true) return false;
  const ids = new Set<string>();
  for (const entry of snapshot.pages) {
    if (!entry || typeof entry !== 'object') return false;
    const page = entry as Record<string, unknown>;
    if (typeof page.page !== 'string' || page.page.length === 0 || ids.has(page.page) || !Array.isArray(page.blocks)) return false;
    ids.add(page.page);
    if (page.sideEligible !== undefined && typeof page.sideEligible !== 'boolean') return false;
    if (page.notCheckable !== undefined && page.notCheckable !== true) return false;
    if (!Array.isArray(page.blocks) || !page.blocks.every(isBlockSnapshot)) return false;
    if (page.members !== undefined) {
      if (!page.members || typeof page.members !== 'object' || Array.isArray(page.members)) return false;
      if (!Object.values(page.members as Record<string, unknown>).every((blocks) => Array.isArray(blocks) && blocks.every(isBlockSnapshot))) return false;
    }
  }
  return true;
}

/** `layout-diff <before.json> <after.json>`: what a version changed about every page's geometry. */
export function runLayoutDiffCommand(
  args: string[],
  deps: { readFile?: (file: string) => string } = {},
): { output: string; exitCode: number } {
  const [beforePath, afterPath] = args.filter((a) => !a.startsWith('--'));
  if (!beforePath || !afterPath) {
    return { output: 'Usage: ds-viewer layout-diff <before.json> <after.json>\n\nBoth are written by `ds-viewer explain --all`.', exitCode: 1 };
  }
  const read = deps.readFile ?? ((file: string) => readFileSync(file, 'utf8'));
  const load = (file: string): LayoutSnapshot | string => {
    let raw: string;
    try {
      raw = read(file);
    } catch {
      return `Could not read ${file}.`;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      // Refuse plausible-but-incomplete JSON before the diff touches it. Treating an absent block
      // array as empty reports invented removals; dereferencing it reports a raw TypeError instead
      // of telling the user they selected the wrong file.
      if (!isLayoutSnapshot(parsed)) {
        return `${file} is not a layout snapshot. Write one with \`ds-viewer explain --all\`.`;
      }
      return parsed;
    } catch {
      return `${file} is not valid JSON.`;
    }
  };
  const before = load(beforePath);
  if (typeof before === 'string') return { output: before, exitCode: 1 };
  const after = load(afterPath);
  if (typeof after === 'string') return { output: after, exitCode: 1 };

  // Before diffing, not only before printing: the guard used to live in `formatLayoutDiff`, so
  // `--json` — the path most likely to be automated in CI — returned a confident list of changes
  // computed across incomparable widths.
  if (!comparableWidths(before, after)) {
    return {
      output: `These snapshots were taken at different widths (${before.width}px and ${after.width}px), so their geometry is not comparable. The two viewer versions use different catalog content widths; compare releases whose snapshot widths match.`,
      exitCode: 1,
    };
  }
  const changes = diffLayouts(before, after);
  if (args.includes('--json')) return { output: JSON.stringify(changes, null, 2), exitCode: 0 };
  return { output: formatLayoutDiff(before, after, changes), exitCode: 0 };
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const projectRoot = process.cwd();

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log(packageVersion());
    return;
  }

  if (command === 'init') {
    const result = await runInit(projectRoot, rest);
    for (const message of result.messages) console.log(message);
    for (const file of result.written) console.log(`Wrote ${path.relative(projectRoot, file)}`);
    if (result.exitCode) process.exitCode = result.exitCode;
    return;
  }

  if (command === 'sync') {
    const config = resolveConfig(projectRoot);
    const result = sync(config);
    console.log(`Synced ${result.componentCount} components, ${result.pageCount} pages.`);
    return;
  }

  if (command === 'doctor') {
    const { output, exitCode } = await runDoctorCommand(projectRoot, rest);
    console.log(output);
    if (exitCode) process.exitCode = exitCode;
    return;
  }

  if (command === 'layout-diff') {
    const { output, exitCode } = runLayoutDiffCommand(rest);
    console.log(output);
    if (exitCode) process.exitCode = exitCode;
    return;
  }
  if (command === 'explain') {
    const [pageId, ...explainRest] = rest;
    const { output, exitCode } = runExplainCommand(projectRoot, pageId, explainRest);
    console.log(output);
    if (exitCode) process.exitCode = exitCode;
    return;
  }

  if (command === 'kit') {
    const [sub, componentName] = rest;
    if (sub !== 'diff' || !componentName) {
      console.error(`Usage: ds-viewer kit diff <Component>\n\n${USAGE}`);
      process.exitCode = 1;
      return;
    }
    const config = resolveConfig(projectRoot);
    const { output, exitCode } = runKitDiffCommand(config, componentName);
    console.log(output);
    if (exitCode) process.exitCode = exitCode;
    return;
  }

  if (command === 'migrate') {
    const fromIndex = rest.indexOf('--from');
    const fromVersion = fromIndex !== -1 ? rest[fromIndex + 1] : undefined;
    if (!fromVersion) {
      console.error(`Usage: ds-viewer migrate --from <version> [--dry-run] [--json]\n\n${USAGE}`);
      process.exitCode = 1;
      return;
    }
    const result = runMigrate(projectRoot, fromVersion, { dryRun: rest.includes('--dry-run') });
    console.log(rest.includes('--json') ? JSON.stringify(result, null, 2) : formatMigrateHuman(result));
    return;
  }

  if (command === 'update') {
    const config = resolveConfig(projectRoot);
    const result = await runUpdate(config, { dryRun: rest.includes('--dry-run'), yes: rest.includes('--yes'), force: rest.includes('--force') });
    console.log(result.output);
    if (result.exitCode) process.exitCode = result.exitCode;
    return;
  }

  if (command === 'dev') {
    const config = resolveConfig(projectRoot);
    const portIndex = rest.indexOf('--port');
    const parsedPort = portIndex !== -1 ? Number(rest[portIndex + 1]) : undefined;
    const pinnedPort = parsedPort !== undefined && Number.isInteger(parsedPort) ? parsedPort : undefined;
    // `--no-update-endpoint`: run the catalog without the local update endpoint, and leave the
    // endpoint an already-running `dev` recorded in the shared workspace alone. `doctor --render`
    // starts its own server this way.
    const noUpdateEndpoint = rest.includes('--no-update-endpoint');
    // `--workspace-dir <name>`: which generated directory this run owns, so a second server (a
    // render check's own) never writes the files the first one is serving. A bare directory name
    // only — anything with a path separator, or a parent reference, would let an argument write
    // outside the project.
    const dirIndex = rest.indexOf('--workspace-dir');
    const requestedDir = dirIndex !== -1 ? rest[dirIndex + 1] : undefined;
    if (requestedDir !== undefined && (requestedDir === '' || requestedDir !== path.basename(requestedDir) || requestedDir.startsWith('.') === false)) {
      console.error(`--workspace-dir must be a single hidden directory name such as ${RENDER_WORKSPACE_DIR}.`);
      process.exitCode = 1;
      return;
    }
    await dev(config, { pinnedPort, noUpdateEndpoint, workspaceDir: requestedDir });
    return;
  }

  console.error(`Unknown command "${command}".\n\n${USAGE}`);
  process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
