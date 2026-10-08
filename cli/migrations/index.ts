// cli/migrations/index.ts
import { compareVersions, parseVersion } from '../semver.ts';
import type { Migration } from './types.ts';

/** The real, production migration registry. Empty in 0.4 — design §5 "Versioning": "From 0.4,
 *  every breaking change ships an automatic migration" describes the *mechanism* this plan builds,
 *  not a requirement to invent a breaking change 0.4 does not have. The framework itself is proven
 *  by a test-only fixture migration (`cli/__tests__/migrate.test.ts`) that is never added here. */
export const MIGRATIONS: Migration[] = [];

/** Every migration after `fromVersion`, oldest first. */
export function migrationsAfter(fromVersion: string): Migration[] {
  const from = parseVersion(fromVersion);
  return MIGRATIONS
    .filter((migration) => compareVersions(parseVersion(migration.version), from) > 0)
    .sort((a, b) => compareVersions(parseVersion(a.version), parseVersion(b.version)));
}
