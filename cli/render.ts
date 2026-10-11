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

/** Stops `dev` and everything it started (Expo/Metro): the whole process group on macOS and Linux,
 *  the whole process tree on Windows. Releases the pipes so this process can exit. */
function stopDev(child: ChildProcess): void {
  if (child.pid) {
    try {
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already exited.
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

function startDev(projectRoot: string): Promise<{ child: ChildProcess; port: number }> {
  const main = path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [main, 'dev'], {
      cwd: projectRoot,
      env: { ...process.env, CI: '1', DS_VIEWER_NO_UPDATE_CHECK: '1' },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let done = false;
    const fail = (message: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stopDev(child);
      reject(new Error(message));
    };
    const timer = setTimeout(() => fail('Timed out waiting for ds-viewer dev to start.'), DEV_START_TIMEOUT_MS);
    // Drained so Metro's output never fills the pipe and blocks it.
    child.stderr?.on('data', () => {});
    child.stdout?.on('data', (data) => {
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

/** Opens every sidebar page and returns its findings. `files` maps page ids to project-relative
 *  page files, for the findings' `file`. `log` receives progress lines (stderr in the CLI). */
export async function renderCheck(
  projectRoot: string,
  options: { files?: ReadonlyMap<string, string>; log?: (line: string) => void } = {},
): Promise<DoctorIssue[]> {
  projectRoot = path.resolve(projectRoot);
  const puppeteer = loadProjectPuppeteer(projectRoot) as { launch: (o: object) => Promise<Browser> } | undefined;
  if (!puppeteer) return [RENDER_UNAVAILABLE];
  const log = options.log ?? (() => {});
  let dev: { child: ChildProcess; port: number } | undefined;
  let browser: Browser | undefined;
  // Ctrl-C or a CI cancel must still stop Metro: `dev` runs in its own process group, so the
  // terminal's signal never reaches it. Registered before the browser launches, so it runs ahead
  // of puppeteer's own handler.
  const onSignal = () => {
    if (dev) stopDev(dev.child);
    process.exit(130);
  };
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
  for (const signal of signals) process.on(signal, onSignal);
  try {
    // The browser first: a missing browser download shouldn't start Metro for nothing.
    try {
      browser = await puppeteer.launch({ headless: true });
    } catch (error) {
      return [{ ...RENDER_UNAVAILABLE, message: `Couldn't start the headless browser: ${(error as Error).message.split('\n')[0]}`, fix: 'npx puppeteer browsers install chrome' }];
    }
    dev = await startDev(projectRoot);
    const home = await browser.newPage();
    const deadline = Date.now() + FIRST_LOAD_TIMEOUT_MS;
    for (;;) {
      try {
        await home.goto(`http://localhost:${dev.port}`, { waitUntil: 'networkidle0', timeout: FIRST_LOAD_TIMEOUT_MS });
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
    const ids = hrefs.map((href) => decodeURIComponent(href.slice(1))).filter(Boolean);
    if (ids.length === 0) {
      return [{ id: 'render-failed', severity: 'error', message: 'The catalog rendered no sidebar links, so it probably failed to render at all.', fix: 'Run `ds-viewer dev` and check the browser console.' }];
    }
    log(`Rendering ${ids.length} pages…`);
    const seen = new Set<string>();
    const issues: DoctorIssue[] = [];
    for (const id of ids) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      const messages: PageMessage[] = [];
      page.on('console', (m: { type: () => string; text: () => string }) => messages.push({ type: m.type(), text: m.text() }));
      page.on('pageerror', (e: unknown) => messages.push({ type: 'pageerror', text: String(e) }));
      await page.goto(`http://localhost:${dev.port}/#${encodeURIComponent(id)}`, { waitUntil: 'networkidle0', timeout: PAGE_TIMEOUT_MS });
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const hasHeading: boolean = await page.evaluate(() => {
        const doc = (globalThis as unknown as { document: { querySelector: (s: string) => { textContent: string | null } | null } }).document;
        return Boolean(doc.querySelector('[role="heading"]')?.textContent?.trim());
      });
      issues.push(...issuesFromPage({ id, file: options.files?.get(id) }, messages, hasHeading, seen));
      await page.close();
    }
    log(`Checked ${ids.length} pages.`);
    return issues;
  } catch (error) {
    return [{ id: 'render-failed', severity: 'error', message: `Couldn't render the catalog: ${(error as Error).message.split('\n')[0]}`, fix: "Run `ds-viewer dev` to see why the catalog doesn't start." }];
  } finally {
    for (const signal of signals) process.off(signal, onSignal);
    if (browser) await browser.close().catch(() => {});
    if (dev) stopDev(dev.child);
  }
}
