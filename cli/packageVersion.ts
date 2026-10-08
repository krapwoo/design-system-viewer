// cli/packageVersion.ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Walks up from `startDir` looking for the `package.json` named `@krapwoo/ds-viewer` — needed
 *  because this file sits one level under the repo root as `cli/packageVersion.ts` (how tests and
 *  `init`/`main` run it from source) but two levels under it once compiled, as
 *  `dist/cli/packageVersion.js`. Throws when it reaches the filesystem root without finding one,
 *  which should never happen for a real install (`readOwnVersion` is only ever called from code
 *  that is itself inside the installed/running package). */
export function readOwnVersion(startDir: string): string {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, 'package.json');
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string; version?: string };
      if (pkg.name === '@krapwoo/ds-viewer' && pkg.version) return pkg.version;
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Could not find @krapwoo/ds-viewer's own package.json to read its version.");
    dir = parent;
  }
}
