// cli/__tests__/migrateEntry.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const entryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrateEntry.ts');

function runEntry(...args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', entryPath, ...args], { encoding: 'utf8' });
}

test('migrateEntry --from <v> --dry-run --json prints the same report shape runMigrate returns', () => {
  const result = runEntry('--from', '0.3.0', '--dry-run', '--json');
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { version: 1, from: '0.3.0', changes: [], dryRun: true });
});

test('migrateEntry with no --from prints usage and exits 1', () => {
  const result = runEntry();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: migrateEntry/);
});
