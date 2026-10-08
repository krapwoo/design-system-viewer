#!/usr/bin/env node
import path from 'node:path';
import { resolveConfig } from './config.ts';
import { initExistingProject } from './init.ts';
import { dev } from './dev.ts';
import { sync } from './sync.ts';

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const projectRoot = process.cwd();

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

  console.error(`Unknown command "${command ?? ''}". Usage: ds-viewer <init|dev|sync>`);
  process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
