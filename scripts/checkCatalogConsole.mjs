#!/usr/bin/env node
// This repository's own catalog check (CI and `npm run check:catalog`): runs `doctor --render`'s
// engine (cli/render.ts, built to dist/) against <projectRoot> and fails on ANY render finding,
// warnings included, so this repo's own catalogs always render clean: no console error, no page
// that fails to render, no example overflowing its cell, no other [Catalog] warning. The engine
// starts and stops `dev` itself, including on Ctrl-C.
import path from 'node:path';
import { renderCheck } from '../dist/cli/render.js';

const projectRoot = process.argv[2];
if (!projectRoot) {
  console.error('Usage: node scripts/checkCatalogConsole.mjs <projectRoot>');
  process.exit(1);
}

const findings = await renderCheck(path.resolve(projectRoot), { log: (line) => console.log(line) });
if (findings.length > 0) {
  console.error(`${findings.length} render finding(s):`);
  for (const f of findings) console.error(`  [${f.severity}] ${f.page ?? 'catalog'}: ${f.id}: ${f.message}`);
  process.exit(1);
}
console.log('Every page rendered its heading with zero console errors and no [Catalog] warnings.');
// Explicit: a leftover pipe from the stopped dev process must not keep this script alive.
process.exit(0);
