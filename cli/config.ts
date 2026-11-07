import * as ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type DsViewerConfig } from '../config/index.ts';
import type { ResolvedConfig } from './types.ts';

const KNOWN_FIELDS = new Set<keyof DsViewerConfig>([
  'name', 'logo', 'components', 'exclude', 'tokens', 'pages', 'groupOrder', 'patternGroups', 'partGroups', 'screenGroups', 'usage', 'starterKit', 'updateCheck', 'doctor',
]);

export interface LoadConfigResult {
  config: DsViewerConfig;
  warnings: string[];
}

/**
 * Loads `ds-viewer.config.ts` with a bundled TypeScript loader. This is a guard rail, not a
 * sandbox: the transpiled module's only allowed `require` target is `@krapwoo/ds-viewer/config`
 * (design §3 — "it may import only the package's `defineConfig` and must not import app code"),
 * but the `new Function` body below still has `process`, `globalThis`, and dynamic `import()` —
 * acceptable since the design already accepts executing the user-owned config, just not app code
 * it doesn't name.
 */
export function loadConfig(configPath: string): LoadConfigResult {
  if (!existsSync(configPath)) throw new Error('No ds-viewer.config.ts found — run npx @krapwoo/ds-viewer init');
  const source = readFileSync(configPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const moduleObj: { exports: { default?: Partial<DsViewerConfig> } } = { exports: {} };
  const sandboxRequire = (specifier: string): { defineConfig: typeof defineConfig } => {
    if (specifier === '@krapwoo/ds-viewer/config') return { defineConfig };
    throw new Error(`ds-viewer.config.ts may only import from '@krapwoo/ds-viewer/config', not '${specifier}'.`);
  };
  const run = new Function('exports', 'require', 'module', transpiled.outputText) as (
    exportsArg: unknown,
    requireArg: unknown,
    moduleArg: unknown,
  ) => void;
  try {
    run(moduleObj.exports, sandboxRequire, moduleObj);
  } catch (error) {
    throw new Error(`Error evaluating ${configPath}: ${(error as Error).message}`);
  }

  const raw = moduleObj.exports.default;
  if (!raw) throw new Error(`${configPath} must have a default export from defineConfig().`);

  const warnings: string[] = [];
  for (const key of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(key as keyof DsViewerConfig)) warnings.push(`Unknown config field "${key}" is ignored.`);
  }

  let patternGroups: string[] | undefined;
  if (raw.patternGroups !== undefined) {
    if (Array.isArray(raw.patternGroups) && raw.patternGroups.every((name) => typeof name === 'string')) patternGroups = raw.patternGroups;
    else warnings.push('"patternGroups" must be an array of group names; using the default [\'Patterns\'].');
  }

  let partGroups: string[] | undefined;
  if (raw.partGroups !== undefined) {
    if (Array.isArray(raw.partGroups) && raw.partGroups.every((name) => typeof name === 'string')) partGroups = raw.partGroups;
    else warnings.push('"partGroups" must be an array of group names; every group counts as parts.');
  }

  let screenGroups: string[] | undefined;
  if (raw.screenGroups !== undefined) {
    if (Array.isArray(raw.screenGroups) && raw.screenGroups.every((name) => typeof name === 'string')) screenGroups = raw.screenGroups;
    else warnings.push('"screenGroups" must be an array of group names; using the default [\'Screens\'].');
    warnings.push('"screenGroups" is deprecated: the catalog documents components and the patterns that arrange them, not whole screens.');
  }

  // Category names the catalog no longer has: say what to do instead, once per name.
  const categoryAdvice: Record<string, string> = {
    screens: 'screens are not documented: document their components and the patterns that arrange them',
    layout: 'containers and layout wrappers are components, so they belong in a component group',
    behaviors: 'modifiers are style pages: give each its own page with pageKind: \'style\' (and a styleNote if the default style sentence doesn\'t fit)',
  };
  const reported = new Set<string>();
  for (const field of ['groupOrder', 'partGroups', 'patternGroups'] as const) {
    const names = raw[field];
    if (!Array.isArray(names)) continue;
    for (const name of names) {
      if (typeof name !== 'string') continue;
      const key = name.trim().toLowerCase();
      if (!(key in categoryAdvice) || reported.has(key)) continue;
      reported.add(key);
      warnings.push(`"${field}" names a "${name}" group: ${categoryAdvice[key]}.`);
    }
  }

  let usage: string | undefined;
  if (raw.usage !== undefined) {
    if (typeof raw.usage === 'string' && raw.usage.trim() !== '') usage = raw.usage;
    else warnings.push('"usage" must be a path to a JSON file; ignoring it.');
  }

  // `doctor.placement` needs a group that means "component": a part group that isn't a pattern or screen group.
  const placement = (raw.doctor as { placement?: unknown } | undefined)?.placement;
  if (placement !== undefined && typeof placement !== 'boolean') {
    warnings.push('"doctor.placement" must be true or false; page-placement stays off.');
  } else if (placement === true) {
    const lower = (names: readonly string[]) => names.map((name) => name.trim().toLowerCase());
    const notComponent = new Set([...lower(patternGroups ?? ['Patterns']), ...lower(['Screens', ...(screenGroups ?? [])])]);
    const componentGroups = (partGroups ?? []).filter((name) => !notComponent.has(name.trim().toLowerCase()));
    if (componentGroups.length === 0) warnings.push('"doctor.placement" needs "partGroups" to name a component group (one that is not a pattern or screen group); page-placement does nothing until it does.');
    if ((patternGroups ?? ['Patterns']).length === 0) warnings.push('"doctor.placement" with an empty "patternGroups" can never tell a page it is a pattern.');
  }

  const config: DsViewerConfig = {
    name: raw.name ?? '',
    logo: raw.logo,
    components: raw.components ?? [],
    exclude: raw.exclude ?? [],
    tokens: raw.tokens ?? [],
    pages: raw.pages ?? [],
    groupOrder: raw.groupOrder ?? [],
    patternGroups,
    partGroups,
    screenGroups,
    usage,
    starterKit: raw.starterKit,
    updateCheck: raw.updateCheck ?? true,
    doctor: raw.doctor ?? { strict: false },
  };
  return { config, warnings };
}

/** Design §1 Ownership table — a missing `logo` file is a warning, never a hard error: the
 *  sidebar simply falls back to the name-only header. Resolved relative to `projectRoot` with
 *  `path.resolve` — the same way `cli/workspace.ts` resolves `config.logo` to actually `require`
 *  it — not `path.join`, which nests an absolute `logo` value *under* `projectRoot` instead of
 *  using it directly, misreporting a real file as "not found" (Minor finding, Fable's
 *  implementation review, cli/config.ts:74 vs cli/workspace.ts:134). A `logo` that resolves
 *  outside `projectRoot` is also rejected here, with its own clear warning: `cli/workspace.ts`
 *  only watches folders under `projectRoot`, so letting it through would surface later as an
 *  unclear Metro bundling error instead. */
export function validateLogo(projectRoot: string, logo: string | undefined): { logo?: string; warning?: string } {
  if (!logo) return {};
  const resolved = path.resolve(projectRoot, logo);
  if (!existsSync(resolved)) {
    return { warning: `Logo not found: ${logo} — showing the name instead.` };
  }
  const relativeToRoot = path.relative(projectRoot, resolved);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return { warning: `Logo is outside the project root: ${logo} — showing the name instead.` };
  }
  return { logo };
}

/** Loads `<projectRoot>/ds-viewer.config.ts`, attaches where it came from, and prints any
 *  "unknown field" warning so every CLI command that resolves a config reports them the same way. */
export function resolveConfig(projectRoot: string): ResolvedConfig {
  const configPath = path.join(projectRoot, 'ds-viewer.config.ts');
  const { config, warnings } = loadConfig(configPath);
  for (const warning of warnings) console.warn(warning);
  const { logo, warning: logoWarning } = validateLogo(projectRoot, config.logo);
  if (logoWarning) console.warn(logoWarning);
  return { ...config, logo, projectRoot, configPath };
}
