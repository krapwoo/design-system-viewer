// Fresh tab per page: heading, main text (sidebar removed), split into the props panel and the rest, console errors.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const [, , port, out, idsArg] = process.argv;
const base = `http://localhost:${port}/`;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--window-size=1280,900'],
});

async function open(id) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 200)));
  await page.goto(base + (id ? `#${id}` : ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('[role=navigation] [role=link]', { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 1200));
  return { page, errors };
}

const first = await open('');
const ids = idsArg ? idsArg.split(',') : await first.page.$$eval('[role=navigation] [role=link]', (els) => els.map((e) => e.textContent));
await first.page.close();

const result = {};
for (const id of ids) {
  const { page, errors } = await open(id);
  const data = await page.evaluate(() => {
    const nav = document.querySelector('[role=navigation]');
    const all = document.body.innerText;
    const main = nav ? all.replace(nav.innerText, '') : all;
    const h1 = document.querySelector('[aria-level="1"]')?.textContent;
    const idx = main.search(/\nPROPS\n/i);
    return { h1, body: idx >= 0 ? main.slice(0, idx) : main, props: idx >= 0 ? main.slice(idx) : '', overflow: document.documentElement.scrollWidth > innerWidth };
  });
  result[id] = { ...data, errors };
  await page.close();
}
writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
console.log(`captured ${Object.keys(result).length} pages from :${port}`);
