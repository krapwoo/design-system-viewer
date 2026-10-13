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

/** Which section of `package.json` a dependency is declared in. An upgrade keeps it where it is,
 *  rather than moving it: a host app that deliberately ships the package as a runtime dependency
 *  should not silently become a devDependency because it accepted an update. */
export type DependencySection = 'dependencies' | 'devDependencies';

export interface DeclaredDependency {
  section: DependencySection;
  /** Exactly what `package.json` says, e.g. `^0.6.7`, `file:..`, `workspace:*`. */
  spec: string;
}

/** How `pkg` is declared in this project, or undefined when it is not declared at all.
 *  `dependencies` wins when both sections name it, matching npm's own resolution. */
export function declaredDependency(projectRoot: string, pkg: string): DeclaredDependency | undefined {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) return undefined;
  let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return undefined; // An unreadable package.json is not this function's error to report.
  }
  const fromDeps = parsed.dependencies?.[pkg];
  if (typeof fromDeps === 'string') return { section: 'dependencies', spec: fromDeps };
  const fromDevDeps = parsed.devDependencies?.[pkg];
  if (typeof fromDevDeps === 'string') return { section: 'devDependencies', spec: fromDevDeps };
  return undefined;
}

/** A spec that resolves to something other than a published version: the local source tree, a
 *  linked folder, or another package in the same workspace. Installing a registry version over one
 *  of these replaces the thing the project is deliberately pointing at, so `update` refuses rather
 *  than doing it silently. `npm:` aliases and plain ranges are registry-backed and not local. */
export function isLocalSpec(spec: string): boolean {
  const value = spec.trim();
  if (/^(file|link|workspace|portal):/i.test(value)) return true;
  // A bare relative or absolute path is a file dependency too — npm accepts `../pkg` unprefixed.
  return value.startsWith('./') || value.startsWith('../') || value.startsWith('/') || value.startsWith('~/');
}

/** The one command `cli/update.ts`'s "Upgrades with the project's package manager" step (design
 *  §5 "`npx ds-viewer update`" step 3) runs, for whichever manager `detectPackageManager` found.
 *  Yarn (classic and Berry both) use the same `yarn add` syntax for upgrading a single package to
 *  an exact version. `section` keeps the package in the section it is already declared in; it
 *  defaults to `devDependencies`, which is where `init` puts it. */
export function installUpgradeCommand(
  pm: PackageManager,
  pkg: string,
  version: string,
  section: DependencySection = 'devDependencies',
): { command: string; args: string[] } {
  const spec = `${pkg}@${version}`;
  const dev = section === 'devDependencies';
  if (pm === 'npm') return { command: 'npm', args: ['install', dev ? '--save-dev' : '--save-prod', spec] };
  if (pm === 'pnpm') return { command: 'pnpm', args: ['add', dev ? '--save-dev' : '--save-prod', spec] };
  // Yarn has no --save-prod: a plain `yarn add` is already a production dependency.
  return { command: 'yarn', args: dev ? ['add', '--dev', spec] : ['add', spec] };
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
