// cli/packageManager.ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry';

/** The same lockfile-sniffing `cli/githubAction.ts`'s own `installStep` already did inline (0.3)
 *  — promoted here so `cli/update.ts` (Task 10) can detect the same thing without duplicating it.
 *  A v1 yarn.lock's own first line is always exactly `# yarn lockfile v1`; anything else (Berry's
 *  own header/`__metadata`) is Berry. */
export function detectPackageManager(projectRoot: string): PackageManager {
  if (existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  const yarnLockPath = path.join(projectRoot, 'yarn.lock');
  if (existsSync(yarnLockPath)) {
    const firstLine = readFileSync(yarnLockPath, 'utf8').split('\n', 1)[0];
    return firstLine === '# yarn lockfile v1' ? 'yarn-classic' : 'yarn-berry';
  }
  return 'npm'; // package-lock.json, or no lockfile at all (npm's own documented default either way).
}

/** The one command `cli/update.ts`'s "Upgrades with the project's package manager" step (design
 *  §5 "`npx ds-viewer update`" step 3) runs, for whichever manager `detectPackageManager` found.
 *  Yarn (classic and Berry both) use the same `yarn add --dev` syntax for upgrading a single
 *  package to an exact version. */
export function installUpgradeCommand(pm: PackageManager, pkg: string, version: string): { command: string; args: string[] } {
  const spec = `${pkg}@${version}`;
  if (pm === 'npm') return { command: 'npm', args: ['install', '--save-dev', spec] };
  if (pm === 'pnpm') return { command: 'pnpm', args: ['add', '--save-dev', spec] };
  return { command: 'yarn', args: ['add', '--dev', spec] };
}

const WINDOWS_SHIMS = new Set(['npm', 'npx', 'pnpm', 'yarn']);

/** On Windows, `npm`, `npx`, `pnpm` and `yarn` are `.cmd` shims, which Node refuses to run
 *  without a shell (the CVE-2024-27980 fix). With a shell, Node joins the arguments with spaces,
 *  so any argument containing a space or a shell metacharacter (a temp folder under
 *  `C:\Users\Jane Doe\…`) is wrapped in double quotes. Real executables (`node`, `tar`, `git`)
 *  and every other platform keep running without a shell. */
export function platformCommand(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
): { command: string; args: string[]; shell: boolean } {
  if (platform !== 'win32' || !WINDOWS_SHIMS.has(command)) return { command, args, shell: false };
  return { command, args: args.map((arg) => (/[\s"&|<>^()]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg)), shell: true };
}
