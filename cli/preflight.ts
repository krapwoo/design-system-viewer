import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface PreflightIssue {
  package: string;
  /** What is wrong, when it is more than "missing" (for example, an Expo SDK that is too old). */
  problem?: string;
  installCommand: string;
}

/** One line per issue: the problem (or "Missing <package>.") and the command that fixes it. */
export function formatPreflightIssue(issue: PreflightIssue): string {
  return `${issue.problem ?? `Missing ${issue.package}.`} Run: ${issue.installCommand}`;
}

export interface PreflightResult {
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
}

const REQUIRED_PACKAGES = ['react-native-web', 'react-dom'];
// @expo/metro-runtime is recommended, not required: Expo web works without it (verified in the
// 0.1 spike and in native-preview's own node_modules, which has no @expo/metro-runtime installed
// either) — design §1 "Host requirements" only warns when it is missing.
const RECOMMENDED_PACKAGES: Record<string, string> = {
  '@expo/metro-runtime': 'npx expo install @expo/metro-runtime',
  typescript: 'npm install --save-dev typescript',
};
const MIN_NODE: [number, number, number] = [20, 19, 0];
// Lowered from 57 in 0.4.2 (owner-approved): sync, doctor, the viewer and Update now were verified
// end to end on a fresh Expo SDK 54 app and on Skiffr (Expo 54).
const MIN_EXPO: [number, number, number] = [54, 0, 0];

/** Accepts `x.y.z`, and a version with a missing minor/patch (e.g. `"57"`, `"^57"`) by defaulting
 *  the missing segments to 0 — a range specifier like `"^57"` must not be flagged as older than 57. */
function parseVersion(version: string): [number, number, number] | undefined {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : undefined;
}

function atLeast(version: string, min: [number, number, number]): boolean {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  for (let i = 0; i < 3; i += 1) {
    if (parsed[i] !== min[i]) return parsed[i] > min[i];
  }
  return true;
}

/** Host-requirements check from design §1's table. Missing required items are returned as
 *  `errors` with the exact install command; missing TypeScript is a `warning` only. */
export function preflight(projectRoot: string): PreflightResult {
  const errors: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  if (!atLeast(process.version, MIN_NODE)) {
    errors.push({ package: 'node', installCommand: 'Install Node 20.19 or later (e.g. with nvm: nvm install 20.19).' });
  }

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    errors.push({ package: 'package.json', installCommand: 'Run this inside an Expo project (no package.json found).' });
    return { errors, warnings };
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  const expoVersion = deps.expo;
  if (!expoVersion) {
    errors.push({ package: 'expo', installCommand: 'npx expo install expo' });
  } else if (!atLeast(expoVersion, MIN_EXPO)) {
    errors.push({ package: 'expo', problem: `Expo SDK 54 or later is required (found ${expoVersion}).`, installCommand: 'npx expo install expo@^54' });
  }

  for (const name of REQUIRED_PACKAGES) {
    if (!deps[name]) errors.push({ package: name, installCommand: `npx expo install ${name}` });
  }
  for (const [name, installCommand] of Object.entries(RECOMMENDED_PACKAGES)) {
    if (!deps[name]) warnings.push({ package: name, installCommand });
  }
  return { errors, warnings };
}
