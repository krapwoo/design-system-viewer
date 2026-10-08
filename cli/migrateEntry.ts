// cli/migrateEntry.ts
//
// A standalone, dependency-free CLI entry — imports only `migrate.ts` (and, transitively,
// `migrations/`/`semver.ts`), never `main.ts` (whose `config.ts`/`doctor.ts`/`init.ts`/
// `explain.ts` imports each pull in the `typescript` npm package at module load). `updatePlan.ts`
// (Task 9) runs this file's own compiled `dist/cli/migrateEntry.js` directly from an `npm
// pack`-extracted tarball, which has no `node_modules` of its own — `main.js` would fail there
// with `ERR_MODULE_NOT_FOUND` for `'typescript'` (Critical finding, Fable correction pass, proven
// for real in `spikes/migrate-entry/`: see this plan's own final report).
import { formatMigrateHuman, runMigrate } from './migrate.ts';

const args = process.argv.slice(2);
const fromIndex = args.indexOf('--from');
const fromVersion = fromIndex !== -1 ? args[fromIndex + 1] : undefined;
if (!fromVersion) {
  console.error('Usage: migrateEntry --from <version> [--dry-run] [--json]');
  process.exit(1);
}
const result = runMigrate(process.cwd(), fromVersion, { dryRun: args.includes('--dry-run') });
console.log(args.includes('--json') ? JSON.stringify(result) : formatMigrateHuman(result));
