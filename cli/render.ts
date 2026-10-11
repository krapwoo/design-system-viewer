// cli/render.ts — `doctor --render`: open every catalog page in a headless browser and report what
// only a real render shows (console errors, pages that fail to render, the viewer's own [Catalog]
// layout warnings). The browser is resolved from the project; ds-viewer never installs one.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
function startDev(projectRoot: string, onSpawn: (child: ChildProcess) => void): Promise<{ child: ChildProcess; port: number }> {
  const main = path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [main, 'dev'], {
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
        resolve({ child, port: Number(match[1]) });
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
    deps?: {
      puppeteer?: unknown;
      startDev?: (projectRoot: string, onSpawn: (child: ChildProcess) => void) => Promise<{ child: ChildProcess; port: number }>;
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
    }));
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
    const hrefs: string[] = await home.evaluate(() => {
      const doc = (globalThis as unknown as { document: { querySelectorAll: (s: string) => ArrayLike<{ getAttribute: (n: string) => string | null }> } }).document;
      return [...new Set(Array.from(doc.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute('href') ?? ''))];
    });
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
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        const messages: PageMessage[] = [];
        page.on('console', (m: { type: () => string; text: () => string }) => messages.push({ type: m.type(), text: m.text() }));
        page.on('pageerror', (e: unknown) => messages.push({ type: 'pageerror', text: String(e) }));
        await page.goto(`http://localhost:${port}/#${encodeURIComponent(id)}`, { waitUntil: 'networkidle0', timeout: PAGE_TIMEOUT_MS });
        if (!deps.puppeteer) await new Promise((r) => setTimeout(r, SETTLE_MS));
        const hasHeading: boolean = await page.evaluate(() => {
          const doc = (globalThis as unknown as { document: { querySelector: (s: string) => { textContent: string | null } | null } }).document;
          return Boolean(doc.querySelector('[role="heading"]')?.textContent?.trim());
        });
        issues.push(...issuesFromPage({ id, file: options.files?.get(id) }, messages, hasHeading, seen));
        await page.close();
      } catch (error) {
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
