// cli/migrations/types.ts
//
// This file, and every file `cli/migrateEntry.ts` transitively imports through `Migration` values
// placed in `cli/migrations/index.ts` (`migrate.ts`, `migrations/index.ts`, `semver.ts`), must
// never import the `typescript` npm package (directly or transitively) — `migrateEntry.ts` is the
// one thing this plan runs from inside an `npm pack`-extracted tarball that has no `node_modules`
// of its own, and `typescript` is a real `dependencies` entry (Task 9's own `buildUpdatePlan`,
// spiked for real in `spikes/migrate-entry/`).

/** One file a migration touched (or, from `dryRun`, would touch) and a one-line, human-readable
 *  description of the change — shown in the update panel's file list and `update`'s own output. */
export interface MigrationChange {
  file: string;
  change: string;
}

/** Design §5 "Update plan" step 2 / decision 5 (brief): "a registry of migrations keyed by the
 *  version that introduced them... each declares the files it would change and is idempotent."
 *  `version` is the release that *introduced* this migration — `migrationsAfter` runs every
 *  migration whose `version` is strictly after the installed version, so a project upgrading
 *  across several releases at once still gets every migration it needs, in order. */
export interface Migration {
  version: string;
  description: string;
  dryRun(projectRoot: string): MigrationChange[];
  apply(projectRoot: string): MigrationChange[];
}
