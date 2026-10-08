#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from './config.ts';
import { initExistingProject, initNewProject, promptInitMode } from './init.ts';
import { dev } from './dev.ts';
import { sync } from './sync.ts';

const USAGE = `Usage: ds-viewer <command>

Commands:
  init     Set up the viewer in this project: config, catalog pages, and an npm script
           --new           start from the starter kit (new project)
           --existing      detect this project's own components/tokens (existing project)
           --kit-root DIR  where to copy the starter kit (--new only; default src/ds)
           --yes           accept the detected components and tokens without asking (--existing only)
  sync     Regenerate the component, props, token, and page data from source
  dev      Sync, then serve the catalog on a local web address and keep it current as files change

Options:
  -h, --help     Show this help
  -v, --version  Show the installed version`;

/** Walks up from this file (cli/ in source, dist/cli/ when installed) to the package's own package.json. */
function packageVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = path.join(dir, 'package.json');
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string; version?: string };
      if (pkg.name === '@krapwoo/ds-viewer' && pkg.version) return pkg.version;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return 'unknown';
    dir = parent;
  }
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
    const kitRootIndex = rest.indexOf('--kit-root');
    // Validated, not just indexed: a bare trailing `--kit-root` (no value) or `--kit-root --yes`
    // (the next token is itself a flag) would otherwise silently pass `undefined`/`'--yes'` as the
    // kit root. Both are treated as "no value given", the same as omitting the flag entirely.
    const kitRootValue = kitRootIndex !== -1 ? rest[kitRootIndex + 1] : undefined;
    const kitRoot = kitRootValue && !kitRootValue.startsWith('--') ? kitRootValue : undefined;
    let mode: 'new' | 'existing' | undefined = rest.includes('--new') ? 'new' : rest.includes('--existing') ? 'existing' : undefined;
    // 0.1 had only one `init` path (today's `initExistingProject`) and no mode question at all —
    // `--yes` alone must keep working exactly as it did for a 0.1 user or script, so `--yes` with
    // neither `--new` nor `--existing` defaults to `existing`, the same path 0.1's `--yes` always
    // ran, instead of prompting (which would hang/exit 1 on non-interactive stdin and break them).
    if (!mode && rest.includes('--yes')) mode = 'existing';
    if (!mode) mode = await promptInitMode();
    if (!mode) {
      console.error('Specify --new or --existing (non-interactive stdin cannot be asked).\n\n' + USAGE);
      process.exitCode = 1;
      return;
    }
    const result =
      mode === 'new' ? await initNewProject(projectRoot, { kitRoot }) : await initExistingProject(projectRoot, { yes: rest.includes('--yes') });
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

  if (command === 'dev') {
    const config = resolveConfig(projectRoot);
    await dev(config);
    return;
  }

  console.error(`Unknown command "${command}".\n\n${USAGE}`);
  process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
