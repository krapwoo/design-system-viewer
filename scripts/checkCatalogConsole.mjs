#!/usr/bin/env node
// Drives `ds-viewer dev` as a child process against <projectRoot>, then uses a headless browser to
// visit every page the rendered sidebar links to, failing if any page is missing its heading or
// logged a console error (design §6, "Browser smoke test in CI").
import { spawn } from 'node:child_process';
import path from 'node:path';
import puppeteer from 'puppeteer';

const projectRoot = process.argv[2];
if (!projectRoot) {
  console.error('Usage: node scripts/checkCatalogConsole.mjs <projectRoot>');
  process.exit(1);
}

// A cold Metro bundle of every kit + Viewer page can take a while on a CI runner — comfortably
// over the 30s this script originally used (Important finding, Fable correction pass).
const COLD_BUNDLE_TIMEOUT_MS = 120_000;

function startDev() {
  return new Promise((resolve, reject) => {
    // The compiled CLI directly, not `npx ds-viewer` (never through `kit-host`'s own `.bin`
    // symlink) — same exec-bit reasoning as the root `kit:dev` script (Task 5 Step 20).
    // `detached: true` puts the child in its own process group, so cleanup below can kill that
    // whole group (the `expo start` grandchild included) with one signal, not just this one pid.
    const child = spawn('node', [path.join('node_modules', '@krapwoo', 'ds-viewer', 'dist', 'cli', 'main.js'), 'dev'], {
      cwd: projectRoot,
      env: { ...process.env, CI: '1' },
      detached: true,
    });
    let resolved = false;
    const onData = (data) => {
      const text = data.toString();
      process.stdout.write(text);
      const match = text.match(/Starting the catalog at http:\/\/localhost:(\d+)/);
      if (match && !resolved) {
        resolved = true;
        resolve({ child, port: Number(match[1]) });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`ds-viewer dev exited early with code ${code}`));
    });
    setTimeout(() => {
      if (!resolved) reject(new Error('Timed out waiting for "Starting the catalog at ..." from ds-viewer dev.'));
    }, COLD_BUNDLE_TIMEOUT_MS);
  });
}

/** Kills `dev`'s whole process group (it, and the `expo start`/Metro it spawned), not just the one
 *  pid `child.kill()` would reach — `detached: true` above is what makes `-child.pid` a process
 *  group id, not just this one process (Important finding, Fable correction pass: `child.kill()`
 *  alone left the grandchild running, holding this script's stdout pipe open, so the job hung). */
function killDevGroup(child) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Already exited.
  }
}

async function main() {
  const { child, port } = await startDev();
  const browser = await puppeteer.launch({ headless: true });
  let exitCode = 0;
  try {
    const page = await browser.newPage();
    let messages = [];
    page.on('console', (msg) => messages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (error) => messages.push({ type: 'pageerror', text: String(error) }));

    // A retry loop, not a single `page.goto` (Errata 3): `dev` prints its URL before Expo is
    // actually listening, so the very first connection attempt can see ECONNREFUSED.
    const firstLoadDeadline = Date.now() + COLD_BUNDLE_TIMEOUT_MS;
    for (;;) {
      try {
        await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: COLD_BUNDLE_TIMEOUT_MS });
        break;
      } catch (error) {
        if (!String(error).includes('ERR_CONNECTION_REFUSED') || Date.now() > firstLoadDeadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    const ids = await page.evaluate(() => [
      ...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1))),
    ]);
    if (ids.length === 0) throw new Error('No sidebar links found — the catalog may have failed to render at all.');
    await page.close();

    const failures = [];
    for (const id of ids) {
      // A fresh page per id, not a `window.location.hash` change on one shared page (Errata 4): a
      // hash-only `goto` is a same-document navigation and does not reload, so React would
      // deduplicate warnings across ids and the landing page's own load (before this loop even
      // starts) would never be checked at all.
      const pageForId = await browser.newPage();
      const idMessages = [];
      pageForId.on('console', (msg) => idMessages.push({ type: msg.type(), text: msg.text() }));
      pageForId.on('pageerror', (error) => idMessages.push({ type: 'pageerror', text: String(error) }));
      await pageForId.goto(`http://localhost:${port}/#${id}`, { waitUntil: 'networkidle0', timeout: COLD_BUNDLE_TIMEOUT_MS });
      await new Promise((resolve) => setTimeout(resolve, 600));
      const hasHeading = await pageForId.evaluate(() => {
        const heading = document.querySelector('[role="heading"]');
        return Boolean(heading && heading.textContent && heading.textContent.trim().length > 0);
      });
      const errors = idMessages.filter((m) => m.type === 'error' || m.type === 'pageerror');
      if (!hasHeading) failures.push({ id, reason: 'no heading rendered' });
      if (errors.length > 0) failures.push({ id, reason: errors.map((e) => e.text.split('\n')[0]).join('; ') });
      await pageForId.close();
    }

    console.log(`Checked ${ids.length} pages.`);
    if (failures.length > 0) {
      console.error(`${failures.length} page(s) failed:`);
      for (const failure of failures) console.error(`  ${failure.id}: ${failure.reason}`);
      exitCode = 1;
    } else {
      console.log('Every page rendered its heading with zero console errors.');
    }
  } catch (error) {
    console.error(error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    killDevGroup(child);
  }
  // Explicit, not just `process.exitCode =` (Important finding, Fable correction pass): the
  // grandchild Metro/Expo process can keep this script's own stdout pipe open even after
  // `killDevGroup` signals it, which would otherwise leave the process alive waiting to flush.
  process.exit(exitCode);
}

main();
