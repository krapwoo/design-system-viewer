// cli/render.ts — `doctor --render`: open every catalog page in a headless browser and report what
// only a real render shows (console errors, pages that fail to render, the viewer's own [Catalog]
// layout warnings). The browser is resolved from the project; ds-viewer never installs one.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { get as httpGet } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RENDER_WORKSPACE_DIR } from './types.ts';
import type { DoctorIssue } from './doctor.ts';

export interface PageMessage {
  type: string;
  text: string;
}

const OVERFLOW = /is \d+px wide in a \d+px cell/;

/**
 * Turns one page's console output into doctor findings. Console errors and a missing heading are
 * errors. The viewer's own `[Catalog]` warnings are warnings: `render-layout` for an example that
 * overflows its cell, `render-catalog-warning` for anything else. Other console noise (React Native
 * web deprecations, logs) is ignored. `seen` is shared across the whole run, so a warning the
 * catalog logs on every page (a duplicate id, an unknown `composedOf` name) is reported once.
 */
export function issuesFromPage(
  page: { id: string; file?: string },
  messages: readonly PageMessage[],
  hasHeading: boolean,
  seen: Set<string> = new Set(),
): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  const issues: DoctorIssue[] = [];
  if (!hasHeading) {
    issues.push({ id: 'render-no-heading', severity: 'error', ...ref, message: 'The page rendered without its heading, so it probably failed to render.', fix: 'Open the page in `ds-viewer dev` and check the browser console.' });
  }
  const pageErrors = new Set<string>();
  for (const m of messages) {
    const first = m.text.split('\n')[0];
    if (m.type === 'error' || m.type === 'pageerror') {
      if (pageErrors.has(first)) continue;
      pageErrors.add(first);
      issues.push({ id: 'render-error', severity: 'error', ...ref, message: `Console error while rendering: ${first}`, fix: 'Open the page in `ds-viewer dev` and fix the error in the browser console.' });
    } else if ((m.type === 'warn' || m.type === 'warning') && first.startsWith('[Catalog] ')) {
      const text = first.slice('[Catalog] '.length);
      if (seen.has(text)) continue;
      seen.add(text);
      issues.push(
        OVERFLOW.test(text)
          ? { id: 'render-layout', severity: 'warning', ...ref, message: text, fix: 'Give the page a wider specimenSize; see the README page guide.' }
          : { id: 'render-catalog-warning', severity: 'warning', ...ref, message: text, fix: 'Follow the message; the static doctor rule of the same name has the details.' },
      );
    }
  }
  return issues;
}

export interface IdenticalPair {
  /** The card the two examples share, from its accessible name. */
  card: string;
  names: [string, string];
}

/**
 * Runs in the browser: finds any two examples in the same list card whose specimens render
 * identically. A variant's name is a claim that something differs; two cells that render the same
 * teach the reader nothing and usually mean the difference needs a wider cell (a column count in a
 * cell too narrow to show it) or was never wired up.
 *
 * The fingerprint covers each specimen's whole subtree — tag, box size, colours, radius and text —
 * but never the caption strip that carries the variant's own name, which always differs. Colour is
 * part of it, so a "default vs disabled" pair that differs only in tone is not reported.
 */
export const IDENTICAL_VARIANTS_SCRIPT = `(() => {
  const doc = document;
  const fingerprint = (root) => {
    const out = [];
    const base = root.getBoundingClientRect();
    const walk = (el) => {
      // PhoneFrame renders its example into a same-origin child document, so without reaching in
      // every phone looks like an identical empty box.
      if (el.tagName === 'IFRAME') {
        try {
          const body = el.contentDocument && el.contentDocument.body;
          if (body) { out.push('IFRAME'); walk(body); return; }
        } catch (error) { out.push('IFRAME|unreadable'); return; }
      }
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      out.push([
        el.tagName,
        Math.round(box.width), Math.round(box.height),
        Math.round(box.left - base.left), Math.round(box.top - base.top),
        style.color, style.backgroundColor, style.borderColor, style.borderRadius,
        style.fontSize, style.fontWeight, style.opacity, style.visibility,
        // An icon page's variants are same-sized SVGs that differ only in geometry; a card page's
        // in shadow; a text page's in style, decoration or alignment.
        style.fill, style.stroke, style.boxShadow, style.fontStyle, style.textDecorationLine, style.textAlign,
        el.getAttribute && (el.getAttribute('d') || el.getAttribute('points') || ''),
        el.currentSrc || (el.getAttribute && el.getAttribute('src')) || '',
        el.children.length === 0 ? (el.textContent || '') : '',
        // A field's visible text is its value, not its textContent, which is always empty.
        el.value === undefined ? '' : String(el.value),
        el.placeholder || '', el.disabled ? 'disabled' : '',
      ].join('|'));
      for (const child of el.children) walk(child);
    };
    walk(root);
    return out.join('\\n');
  };
  const pairs = [];
  for (const card of doc.querySelectorAll('[role=list][aria-label]')) {
    // ComparisonList and ComparisonGroups label their card "<page id>: <block title>". Anything
    // else with role=list is a consumer's own component inside a specimen, not a card of examples.
    if (!/^[^:]+: .+/.test(card.getAttribute('aria-label') || '')) continue;
    const cells = [...card.querySelectorAll('[role=listitem]')].filter((c) => c.closest('[role=list]') === card);
    const byPrint = new Map();
    for (const cell of cells) {
      // children[0] is the caption strip (the variant's own name); the specimen follows it.
      const specimen = cell.children.length > 1 ? cell.children[1] : cell.children[0];
      if (!specimen) continue;
      const name = (cell.children[0] ? cell.children[0].textContent : '') || '';
      const print = fingerprint(specimen);
      if (!print.trim()) continue;
      const first = byPrint.get(print);
      if (first === undefined) byPrint.set(print, name);
      else pairs.push({ card: card.getAttribute('aria-label') || '', names: [first, name] });
    }
  }
  return pairs;
})()`;

/** Turns the browser's findings into doctor issues, one per identical pair. */
export function identicalVariantIssues(page: { id: string; file?: string }, pairs: readonly IdenticalPair[]): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  return pairs.map((pair) => ({
    id: 'identical-variants',
    severity: 'warning' as const,
    ...ref,
    message: `"${pair.names[0]}" and "${pair.names[1]}" render identically in ${pair.card || 'the same card'}.`,
    fix: "Make the difference visible — a wider specimenSize when the cell is too narrow to show it, or the prop the name claims — or drop one of the two examples.",
  }));
}

export interface ClippedSpecimen {
  /** The cell's own caption, so the message names the example the reader is looking at. */
  name: string;
  /** How far outside its cell the content paints, in px, on the worst side. */
  overflow: number;
  side: 'left' | 'right';
}

/**
 * Runs in the browser: finds specimen content that paints outside its cell and cannot be reached.
 *
 * A cell is the width the page gives an example. Content wider than it is either clipped — the
 * reader sees a cut-off component and no indication anything is missing — or drawn over its
 * neighbour. Either way the page is showing something other than the component.
 *
 * Scrollable content is deliberately not reported, and so is content a component clips itself:
 * both are decisions the specimen made, not width the page failed to give it. `PillRow`'s "Many
 * pills (scrollable)" paints 220px outside its cell at 1280 and is correct; a shimmer sweep or a
 * carousel that hides its own overflow is equally deliberate.
 *
 * The containment walk stops at the cell. Looking past it was wrong: `ComparisonGroups` wraps every
 * grouped card in a horizontal `ScrollView`, which react-native-web renders as `overflow-x: auto`,
 * so a walk to the document root found that scroller above every grouped cell and exempted all of
 * them — the rule covered plain list blocks only, while its calibration claimed the whole corpus.
 * What matters is whether the *specimen* contains its own overflow, which is a question about the
 * ancestors inside the cell.
 *
 * Only horizontal crossings are measured. A cell's width is what the page allocates and what
 * `specimenSize` controls; its height grows with content.
 */
export const CLIPPED_SPECIMEN_SCRIPT = `(() => {
  const doc = document;
  const CONTAINS = /^(auto|scroll|hidden|clip)$/;
  const out = [];
  for (const card of doc.querySelectorAll('[role=list][aria-label]')) {
    if (!/^[^:]+: .+/.test(card.getAttribute('aria-label') || '')) continue;
    for (const cell of card.querySelectorAll('[role=listitem]')) {
      if (cell.closest('[role=list]') !== card) continue;
      const box = cell.getBoundingClientRect();
      if (box.width < 2) continue;
      let worst = 0;
      let side = 'right';
      for (const el of cell.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const over = Math.max(box.left - r.left, r.right - box.right);
        if (over <= worst) continue;
        // Invisible content, including anything inside an invisible or offscreen wrapper: an exit
        // animation mid-flight, or a visually-hidden node parked at a large negative offset.
        let hidden = false;
        let contained = false;
        for (let p = el; p && p !== cell; p = p.parentElement) {
          const style = getComputedStyle(p);
          if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') { hidden = true; break; }
          // Anything between the content and the cell that handles its own overflow — scrolling it
          // or clipping it — is the specimen's own decision, not the page denying it width.
          if (p !== el && CONTAINS.test(style.overflowX)) { contained = true; break; }
        }
        if (hidden || contained) continue;
        worst = over;
        side = box.left - r.left >= r.right - box.right ? 'left' : 'right';
      }
      if (worst > 1) {
        const caption = cell.children[0] ? (cell.children[0].textContent || '') : '';
        out.push({ name: caption.trim(), overflow: Math.round(worst), side });
      }
    }
  }
  return out;
})()`;

/** Turns the browser's findings into doctor issues, one per clipped example. */
export function clippedSpecimenIssues(page: { id: string; file?: string }, clipped: readonly ClippedSpecimen[]): DoctorIssue[] {
  const ref = { page: page.id, ...(page.file ? { file: page.file } : {}) };
  return clipped.map((c) => ({
    id: 'specimen-clipped',
    severity: 'warning' as const,
    ...ref,
    message: `${c.name ? `"${c.name}"` : 'An example'} paints ${c.overflow}px past the ${c.side} of its cell, where it is cut off rather than scrollable.`,
    fix: 'Give the page a wider specimenSize, stack the blocks so the example gets the full row, or drop `itemsFill` if the example is a small instance that should sit centered.',
  }));
}

/** The project's own puppeteer, or `undefined` when it isn't installed. */
export function loadProjectPuppeteer(projectRoot: string): unknown | undefined {
  try {
    return createRequire(path.join(path.resolve(projectRoot), 'package.json'))('puppeteer');
  } catch {
    return undefined;
  }
}

export const RENDER_UNAVAILABLE: DoctorIssue = {
  id: 'render-unavailable',
  severity: 'error',
  message: "`doctor --render` needs a headless browser, and puppeteer isn't installed in this project.",
  fix: 'npm install --save-dev puppeteer (then run doctor --render again).',
};

const DEV_START_TIMEOUT_MS = 120_000;
const FIRST_LOAD_TIMEOUT_MS = 300_000;
const PAGE_TIMEOUT_MS = 120_000;
const SETTLE_MS = 900;

/** Stops `dev` and everything it started (Expo/Metro): the whole process tree on Windows, the
 *  whole process group elsewhere (Expo stops through dev's own signal handler). Releases the pipes
 *  so this process can exit. `os` is injectable for tests. */
export function stopDev(
  child: ChildProcess,
  os: { platform?: NodeJS.Platform; spawnSync?: typeof spawnSync; kill?: (pid: number, signal: NodeJS.Signals) => void } = {},
): void {
  const platform = os.platform ?? process.platform;
  if (child.pid) {
    try {
      if (platform === 'win32') (os.spawnSync ?? spawnSync)('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else (os.kill ?? ((pid, signal) => process.kill(pid, signal)))(-child.pid, 'SIGTERM');
    } catch {
      // Already exited.
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

/** The last few KB of dev's output, so a failed start can say why. */
function outputTail(): { push: (data: unknown) => void; text: () => string } {
  let tail = '';
  return {
    push: (data) => {
      tail = (tail + String(data)).slice(-4000);
    },
    text: () => {
      const lines = tail.trim().split('\n').slice(-8).join('\n');
      return lines ? `\n${lines}` : '';
    },
  };
}

/** Starts the project's own `dev` in its own process group. `onSpawn` receives the child at once,
 *  so a signal during startup can still stop it. */
/** Polls `http://localhost:<port>/` until it answers, so a caller never navigates to a port Metro
 *  has not bound yet. Any HTTP reply counts — the page's own content is checked afterwards. */
async function waitForServer(port: number, timeoutMs = DEV_START_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const answered = await new Promise<boolean>((resolve) => {
      const request = httpGet({ host: 'localhost', port, path: '/', timeout: 2000 }, () => resolve(true));
      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
    });
    if (answered) return;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for the catalog to answer on port ${port}.`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function startDev(projectRoot: string, onSpawn: (child: ChildProcess) => void, pinnedPort?: number): Promise<{ child: ChildProcess; port: number }> {
  const main = path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.js');
  return new Promise((resolve, reject) => {
    // Its own workspace directory and no update endpoint: this server exists to render pages, and
    // every file it generates would otherwise overwrite the ones an already-running `dev` is
    // serving — including that developer's endpoint, pointing their open catalog at a port that
    // dies with this check.
    const child = spawn(process.execPath, [main, 'dev', '--no-update-endpoint', '--workspace-dir', RENDER_WORKSPACE_DIR, ...(pinnedPort ? ['--port', String(pinnedPort)] : [])], {
      cwd: projectRoot,
      env: { ...process.env, CI: '1', DS_VIEWER_NO_UPDATE_CHECK: '1' },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    onSpawn(child);
    const output = outputTail();
    let done = false;
    const fail = (message: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stopDev(child);
      reject(new Error(`${message}${output.text()}`));
    };
    const timer = setTimeout(() => fail('Timed out waiting for ds-viewer dev to start.'), DEV_START_TIMEOUT_MS);
    // Read continuously (so Metro's output never fills the pipe) and keep the tail for errors.
    child.stderr?.on('data', output.push);
    child.stdout?.on('data', (data) => {
      output.push(data);
      const match = String(data).match(/Starting the catalog at http:\/\/localhost:(\d+)/);
      if (match && !done) {
        done = true;
        clearTimeout(timer);
        // `dev` prints that line before it spawns Expo, so the port is known well before Metro is
        // listening on it. Resolving here raced the bundler: the first navigation could land on a
        // port nothing was bound to yet. Wait for the server to actually answer.
        const port = Number(match[1]);
        waitForServer(port)
          .then(() => resolve({ child, port }))
          .catch((error: Error) => fail(`${error.message} `));
      }
    });
    child.on('exit', (code) => fail(`ds-viewer dev exited early (code ${code}).`));
  });
}

type Browser = { newPage: () => Promise<any>; close: () => Promise<void> };

const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 } as const;

/** A sidebar href's page id; a malformed escape falls back to the raw text (like `idFromHash`). */
function idFromHref(href: string): string {
  const raw = href.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Opens every sidebar page and returns its findings. `files` maps page ids to project-relative
 *  page files, for the findings' `file`. `log` receives progress lines (stderr in the CLI). `deps`
 *  replaces the browser, dev process control and exit for tests. */
export async function renderCheck(
  projectRoot: string,
  options: {
    files?: ReadonlyMap<string, string>;
    log?: (line: string) => void;
    /** Wait after each page loads before reading it (lets deferred effects log). @default 900 */
    settleMs?: number;
    /**
     * Pin the render server to this port instead of letting it take the first free one from 5181.
     * Worth setting when something else is already using that range — another project's catalog,
     * or a second `dev` — because the check's server and anything else on its port cannot both
     * win, and the check has no way to tell a stranger's server from its own.
     */
    port?: number;
    deps?: {
      puppeteer?: unknown;
      startDev?: (projectRoot: string, onSpawn: (child: ChildProcess) => void, port?: number) => Promise<{ child: ChildProcess; port: number }>;
      stopDev?: (child: ChildProcess) => void;
      exit?: (code: number) => void;
    };
  } = {},
): Promise<DoctorIssue[]> {
  projectRoot = path.resolve(projectRoot);
  const deps = options.deps ?? {};
  const puppeteer = (deps.puppeteer ?? loadProjectPuppeteer(projectRoot)) as { launch: (o: object) => Promise<Browser> } | undefined;
  if (!puppeteer) return [RENDER_UNAVAILABLE];
  const stop = deps.stopDev ?? ((child: ChildProcess) => stopDev(child));
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? (() => {});
  // Set as soon as dev is spawned, before it's ready, so a signal during startup still stops it.
  let devChild: ChildProcess | undefined;
  let port = 0;
  let browser: Browser | undefined;
  // Ctrl-C or a CI cancel must still stop Metro: `dev` runs in its own process group, so the
  // terminal's signal never reaches it. Registered before the browser launches, so it runs ahead
  // of puppeteer's own handler.
  const handlers = (Object.keys(SIGNAL_EXIT_CODES) as (keyof typeof SIGNAL_EXIT_CODES)[]).map((signal) => {
    const handler = () => {
      if (devChild) stop(devChild);
      exit(SIGNAL_EXIT_CODES[signal]);
    };
    process.on(signal, handler);
    return [signal, handler] as const;
  });
  try {
    // The browser first: a missing browser download shouldn't start Metro for nothing.
    try {
      browser = await puppeteer.launch({ headless: true });
    } catch (error) {
      return [{ ...RENDER_UNAVAILABLE, message: `Couldn't start the headless browser: ${(error as Error).message.split('\n')[0]}`, fix: 'npx puppeteer browsers install chrome' }];
    }
    ({ port } = await (deps.startDev ?? startDev)(projectRoot, (child) => {
      devChild = child;
    }, options.port));
    const home = await browser.newPage();
    const deadline = Date.now() + FIRST_LOAD_TIMEOUT_MS;
    for (;;) {
      try {
        await home.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: FIRST_LOAD_TIMEOUT_MS });
        break;
      } catch (error) {
        if (!String(error).includes('ERR_CONNECTION_REFUSED') || Date.now() > deadline) throw error;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    // Runs in the browser; `document` is typed loosely because the CLI compiles without DOM types.
    const readHrefs = (): Promise<string[]> => home.evaluate(() => {
      const doc = (globalThis as unknown as { document: { querySelectorAll: (s: string) => ArrayLike<{ getAttribute: (n: string) => string | null }> } }).document;
      return [...new Set(Array.from(doc.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute('href') ?? ''))];
    });
    // The server answers before the bundle has run, and a workspace Metro has never bundled before
    // (a fresh `.ds-viewer-render`) is slow the first time. Keep asking until the sidebar is there,
    // rather than reading once and calling an empty page a failed render.
    let hrefs = await readHrefs();
    while (hrefs.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      hrefs = await readHrefs();
    }
    await home.close();
    const ids = hrefs.map(idFromHref).filter(Boolean);
    if (ids.length === 0) {
      return [{ id: 'render-failed', severity: 'error', message: 'The catalog rendered no sidebar links, so it probably failed to render at all.', fix: 'Run `ds-viewer dev` and check the browser console.' }];
    }
    log(`Rendering ${ids.length} pages…`);
    const seen = new Set<string>();
    const issues: DoctorIssue[] = [];
    for (const id of ids) {
      // One page failing (a navigation timeout) is that page's finding; the others still run.
      let page: { close: () => Promise<void> } & Record<string, any> | undefined;
      try {
        page = await browser.newPage();
        await page!.setViewport({ width: 1280, height: 800 });
        const messages: PageMessage[] = [];
        page!.on('console', (m: { type: () => string; text: () => string }) => messages.push({ type: m.type(), text: m.text() }));
        page!.on('pageerror', (e: unknown) => messages.push({ type: 'pageerror', text: String(e) }));
        await page!.goto(`http://localhost:${port}/#${encodeURIComponent(id)}`, { waitUntil: 'networkidle0', timeout: PAGE_TIMEOUT_MS });
        await new Promise((r) => setTimeout(r, options.settleMs ?? SETTLE_MS));
        const hasHeading: boolean = await page!.evaluate(() => {
          const doc = (globalThis as unknown as { document: { querySelector: (s: string) => { textContent: string | null } | null } }).document;
          return Boolean(doc.querySelector('[role="heading"]')?.textContent?.trim());
        });
        issues.push(...issuesFromPage({ id, file: options.files?.get(id) }, messages, hasHeading, seen));
        // Advisory: a script failure (a detached child document mid-navigation, an element whose
        // `value` getter throws) must not become this page's render-error, so it has its own catch
        // rather than falling into the one below.
        let identical: IdenticalPair[] | undefined;
        try {
          identical = (await page!.evaluate(IDENTICAL_VARIANTS_SCRIPT)) as IdenticalPair[] | undefined;
        } catch {
          identical = undefined;
        }
        if (Array.isArray(identical)) issues.push(...identicalVariantIssues({ id, file: options.files?.get(id) }, identical));
        // Advisory for the same reason as the pass above, and kept separate so one failing script
        // does not cost the other its findings.
        let clipped: ClippedSpecimen[] | undefined;
        try {
          clipped = (await page!.evaluate(CLIPPED_SPECIMEN_SCRIPT)) as ClippedSpecimen[] | undefined;
        } catch {
          clipped = undefined;
        }
        if (Array.isArray(clipped)) issues.push(...clippedSpecimenIssues({ id, file: options.files?.get(id) }, clipped));
        await page!.close();
      } catch (error) {
        // A stuck page's tab is closed, so it doesn't keep loading next to the remaining pages.
        await page?.close().catch(() => {});
        const file = options.files?.get(id);
        issues.push({ id: 'render-error', severity: 'error', page: id, ...(file ? { file } : {}), message: `Couldn't open the page: ${(error as Error).message.split('\n')[0]}`, fix: 'Open the page in `ds-viewer dev`; it may be very slow to load or stuck.' });
      }
    }
    log(`Checked ${ids.length} pages.`);
    return issues;
  } catch (error) {
    return [{ id: 'render-failed', severity: 'error', message: `Couldn't render the catalog: ${(error as Error).message}`, fix: "Run `ds-viewer dev` to see why the catalog doesn't start." }];
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler);
    if (browser) await browser.close().catch(() => {});
    if (devChild) stop(devChild);
  }
}
