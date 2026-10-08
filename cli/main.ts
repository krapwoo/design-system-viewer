#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from './config.ts';
import { initExistingProject } from './init.ts';
import { dev } from './dev.ts';
import { sync } from './sync.ts';

const USAGE = `Usage: ds-viewer <command>

Commands:
  init     Set up the viewer in this project: config, draft catalog pages, and an npm script
           --yes  accept the detected components and tokens without asking
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
    const result = await initExistingProject(projectRoot, { yes: rest.includes('--yes') });
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
