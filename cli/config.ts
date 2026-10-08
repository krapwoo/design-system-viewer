import * as ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type DsViewerConfig } from '../config/index.ts';
import type { ResolvedConfig } from './types.ts';

const KNOWN_FIELDS = new Set<keyof DsViewerConfig>([
  'name', 'logo', 'components', 'exclude', 'tokens', 'pages', 'groupOrder', 'starterKit', 'updateCheck', 'doctor',
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

  const config: DsViewerConfig = {
    name: raw.name ?? '',
    logo: raw.logo,
    components: raw.components ?? [],
    exclude: raw.exclude ?? [],
    tokens: raw.tokens ?? [],
    pages: raw.pages ?? [],
    groupOrder: raw.groupOrder ?? [],
    starterKit: raw.starterKit,
    updateCheck: raw.updateCheck ?? true,
    doctor: raw.doctor ?? { strict: false },
  };
  return { config, warnings };
}

/** Design §1 Ownership table — a missing `logo` file is a warning, never a hard error: the
 *  sidebar simply falls back to the name-only header. Resolved relative to `projectRoot`, the same
 *  way `components`/`tokens`/`pages` globs are. */
export function validateLogo(projectRoot: string, logo: string | undefined): { logo?: string; warning?: string } {
  if (!logo) return {};
  const resolved = path.join(projectRoot, logo);
  if (!existsSync(resolved)) {
    return { warning: `Logo not found: ${logo} — showing the name instead.` };
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
