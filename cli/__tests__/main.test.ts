import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mainPath = path.join(repoRoot, 'cli/main.ts');
const { version } = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };

function run(...args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', mainPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

for (const flag of ['--help', '-h', 'help']) {
  test(`${flag} prints usage with every command and exits 0`, () => {
    const result = run(flag);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: ds-viewer <command>/);
    for (const command of ['init', 'sync', 'dev']) assert.match(result.stdout, new RegExp(`^  ${command} `, 'm'));
    assert.match(result.stdout, /--new/);
    assert.match(result.stdout, /--existing/);
    assert.match(result.stdout, /--kit-root/);
    assert.match(result.stdout, /--yes/);
    assert.equal(result.stderr, '');
  });
}

test('no command prints usage and exits 0', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ds-viewer <command>/);
});

for (const flag of ['--version', '-v']) {
  test(`${flag} prints the package version`, () => {
    const result = run(flag);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), version);
  });
}

test('an unknown command prints usage to stderr and exits 1', () => {
  const result = run('bogus');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command "bogus"/);
  assert.match(result.stderr, /Usage: ds-viewer <command>/);
});
