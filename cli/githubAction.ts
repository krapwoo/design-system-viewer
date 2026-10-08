import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Design §4 "GitHub Action" + §5's lockfile-detection assumption. `checkout`/`setup-node` pins
// reused verbatim from this repository's own `.github/workflows/ci.yml` (Global Constraints);
// `pnpm/action-setup` is the one new SHA this plan resolves (`gh api
// repos/pnpm/action-setup/git/refs/tags/v6.1.0`, dereferenced to its commit). `node-version: '20'`
// matches the package's own published `engines` floor (`>=20.19.0`): a user's project only ever
// runs the compiled `dist/cli/main.js` via `npx ds-viewer`, which needs no type-stripping (unlike
// this repo's own CI, which type-strips its *source* and therefore needs Node 22).

// Errata #5: `pnpm/action-setup` needs an explicit pnpm version — it has no lockfile to infer one
// from. Read the project's own `packageManager` field (`"pnpm@9.1.0"`) when present; otherwise
// default to 10, matching the pin's own major version line.
function pnpmVersion(projectRoot: string): string {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) return '10';
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { packageManager?: string };
  const match = packageJson.packageManager?.match(/^pnpm@(\d+)/);
  return match ? match[1] : '10';
}

// Important finding 6 (Fable's review): Yarn 1 (still the common Expo lockfile) has no
// `--immutable` flag — its equivalent is `--frozen-lockfile`. Yarn Berry needs `corepack enable`
// first, since `actions/setup-node` ships Yarn 1 on `ubuntu-latest`. A v1 lockfile's own first line
// is always exactly `# yarn lockfile v1`; anything else (Berry's own header/`__metadata`) is Berry.
function yarnInstallStep(projectRoot: string): string {
  const firstLine = readFileSync(path.join(projectRoot, 'yarn.lock'), 'utf8').split('\n', 1)[0];
  if (firstLine === '# yarn lockfile v1') return '      - run: yarn install --frozen-lockfile\n';
  return '      - run: corepack enable\n      - run: yarn install --immutable\n';
}

function installStep(projectRoot: string): string {
  if (existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    return `      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0\n        with:\n          version: ${pnpmVersion(projectRoot)}\n      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0\n        with:\n          node-version: '20'\n      - run: pnpm install --frozen-lockfile\n`;
  }
  const setupNode = `      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0\n        with:\n          node-version: '20'\n`;
  if (existsSync(path.join(projectRoot, 'yarn.lock'))) return `${setupNode}${yarnInstallStep(projectRoot)}`;
  // `package-lock.json`, or no lockfile at all (a fresh project before its first commit) — `npm
  // ci` is npm's own documented behavior for the latter: it installs from `package.json` and
  // writes a fresh lockfile, exactly like a plain `npm install` would.
  return `${setupNode}      - run: npm ci\n`;
}

function workflowContent(projectRoot: string): string {
  return `name: DS Viewer

on:
  pull_request:

jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
${installStep(projectRoot)}      - run: npx ds-viewer doctor --ci
`;
}

/** Design §4 "GitHub Action", §1 Ownership: written once, never overwritten — a user's own edits
 *  to this file (or a differently-named workflow they wrote instead) are never touched again. The
 *  install step is picked from whichever lockfile is present *right now*, at `init` time — never
 *  re-picked later, since this function never runs again once the file exists. */
export function ensureGithubAction(projectRoot: string): string[] {
  const workflowPath = path.join(projectRoot, '.github', 'workflows', 'ds-viewer.yml');
  if (existsSync(workflowPath)) return [];
  mkdirSync(path.dirname(workflowPath), { recursive: true });
  writeFileSync(workflowPath, workflowContent(projectRoot));
  return [workflowPath];
}
