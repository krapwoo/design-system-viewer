// cli/migrate.ts
import { migrationsAfter } from './migrations/index.ts';
import { compareVersions, parseVersion } from './semver.ts';
import type { Migration, MigrationChange } from './migrations/types.ts';

export interface MigrateResult {
  version: 1;
  from: string;
  changes: MigrationChange[];
  dryRun: boolean;
}

export interface RunMigrateOptions {
  dryRun: boolean;
  /** Test-only — the real `migrate` command always uses `migrationsAfter(fromVersion)`; this plan's
   *  own fixture migration is only ever passed here, never added to the real registry. */
  migrations?: Migration[];
}

/** Design §5 "`npx ds-viewer update`" step 4, and the endpoint's own call to the newly-downloaded
 *  version's `migrate --from <installed> --dry-run --json` (Task 9's plan step). Runs every
 *  applicable migration in order, concatenating each one's reported changes — one broken migration
 *  still lets the rest report (design's Error-handling rule), though in practice a migration that
 *  throws here means the whole upgrade fails loudly, since there is no "partial migration" state
 *  worth leaving a project in; `cli/update.ts` (Task 10) treats any thrown error from this as the
 *  "failure" result, not a silently-skipped migration. */
export function runMigrate(projectRoot: string, fromVersion: string, options: RunMigrateOptions): MigrateResult {
  // Always filter/sort by fromVersion here, even for an explicitly-injected `migrations` list —
  // `migrationsAfter` already does this for the real registry, but a test-only injected list (out
  // of order, including versions at or before fromVersion) needs the same treatment to match this
  // function's documented "runs every migration after fromVersion, in order" contract.
  const from = parseVersion(fromVersion);
  const migrations = (options.migrations ?? migrationsAfter(fromVersion))
    .filter((migration) => compareVersions(parseVersion(migration.version), from) > 0)
    .sort((a, b) => compareVersions(parseVersion(a.version), parseVersion(b.version)));
  const changes: MigrationChange[] = [];
  for (const migration of migrations) {
    changes.push(...(options.dryRun ? migration.dryRun(projectRoot) : migration.apply(projectRoot)));
  }
  return { version: 1, from: fromVersion, changes, dryRun: options.dryRun };
}

export function formatMigrateHuman(result: MigrateResult): string {
  if (result.changes.length === 0) return `Nothing to migrate from ${result.from}.`;
  return result.changes.map((change) => `${change.file}: ${change.change}`).join('\n');
}
