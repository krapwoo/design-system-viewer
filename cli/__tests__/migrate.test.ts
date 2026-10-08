// cli/__tests__/migrate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { formatMigrateHuman, runMigrate } from '../migrate.ts';
import { migrationsAfter, MIGRATIONS } from '../migrations/index.ts';
import type { Migration, MigrationChange } from '../migrations/types.ts';

test('MIGRATIONS is empty in 0.4 — no breaking change ships this release', () => {
  assert.deepEqual(MIGRATIONS, []);
});

test('migrationsAfter returns nothing from an empty registry', () => {
  assert.deepEqual(migrationsAfter('0.3.0'), []);
});

/** Test-only — proves the framework works without ever being added to the real `MIGRATIONS`
 *  array. Renames a fixed string inside one file, idempotently (running it twice is a no-op the
 *  second time, since the "before" string is already gone). */
function sampleMigration(): Migration {
  return {
    version: '0.4.0',
    description: 'Rename the sample config key "oldName" to "newName" (test fixture only).',
    dryRun(projectRoot: string): MigrationChange[] {
      const file = path.join(projectRoot, 'sample.config.json');
      const contents = readFileSync(file, 'utf8');
      return contents.includes('oldName') ? [{ file: 'sample.config.json', change: 'Rename "oldName" to "newName".' }] : [];
    },
    apply(projectRoot: string): MigrationChange[] {
      const file = path.join(projectRoot, 'sample.config.json');
      const contents = readFileSync(file, 'utf8');
      if (!contents.includes('oldName')) return [];
      writeFileSync(file, contents.replace(/oldName/g, 'newName'));
      return [{ file: 'sample.config.json', change: 'Renamed "oldName" to "newName".' }];
    },
  };
}

test('runMigrate --dry-run reports the change without writing it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-migrate-'));
  writeFileSync(path.join(dir, 'sample.config.json'), '{"oldName": 1}');
  const result = runMigrate(dir, '0.3.0', { dryRun: true, migrations: [sampleMigration()] });
  assert.deepEqual(result.changes, [{ file: 'sample.config.json', change: 'Rename "oldName" to "newName".' }]);
  assert.equal(readFileSync(path.join(dir, 'sample.config.json'), 'utf8'), '{"oldName": 1}');
  rmSync(dir, { recursive: true, force: true });
});

test('runMigrate (no --dry-run) writes the change', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-migrate-'));
  writeFileSync(path.join(dir, 'sample.config.json'), '{"oldName": 1}');
  runMigrate(dir, '0.3.0', { dryRun: false, migrations: [sampleMigration()] });
  assert.equal(readFileSync(path.join(dir, 'sample.config.json'), 'utf8'), '{"newName": 1}');
  rmSync(dir, { recursive: true, force: true });
});

test('a migration is idempotent: running it twice makes no change the second time', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-migrate-'));
  writeFileSync(path.join(dir, 'sample.config.json'), '{"oldName": 1}');
  runMigrate(dir, '0.3.0', { dryRun: false, migrations: [sampleMigration()] });
  const second = runMigrate(dir, '0.3.0', { dryRun: false, migrations: [sampleMigration()] });
  assert.deepEqual(second.changes, []);
  rmSync(dir, { recursive: true, force: true });
});

test('runMigrate only runs migrations whose version is after fromVersion, in order', () => {
  const calls: string[] = [];
  const migrationAt = (version: string): Migration => ({
    version, description: version,
    dryRun: () => { calls.push(version); return []; },
    apply: () => { calls.push(version); return []; },
  });
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-migrate-'));
  runMigrate(dir, '0.4.0', { dryRun: true, migrations: [migrationAt('0.6.0'), migrationAt('0.4.0'), migrationAt('0.5.0')] });
  assert.deepEqual(calls, ['0.5.0', '0.6.0']); // 0.4.0 itself is not "after" 0.4.0
  rmSync(dir, { recursive: true, force: true });
});

test('runMigrate --json shape', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-migrate-'));
  writeFileSync(path.join(dir, 'sample.config.json'), '{"oldName": 1}');
  const result = runMigrate(dir, '0.3.0', { dryRun: true, migrations: [sampleMigration()] });
  assert.deepEqual(result, { version: 1, from: '0.3.0', changes: [{ file: 'sample.config.json', change: 'Rename "oldName" to "newName".' }], dryRun: true });
  rmSync(dir, { recursive: true, force: true });
});

test('formatMigrateHuman lists each change on its own line, or says there is nothing to do', () => {
  assert.match(formatMigrateHuman({ version: 1, from: '0.3.0', changes: [{ file: 'a.ts', change: 'Did a thing.' }], dryRun: false }), /a\.ts: Did a thing\./);
  assert.match(formatMigrateHuman({ version: 1, from: '0.3.0', changes: [], dryRun: false }), /Nothing to migrate from 0\.3\.0\./);
});
