/** The Node-safe half of the package — no React/React Native imports, so a user's
 *  `ds-viewer.config.ts` can import it and be loaded by the CLI with plain `ts.transpileModule`
 *  (see cli/config.ts), without pulling in react-native or any app code. */
export interface DsViewerConfig {
  /** Short product/app name — the sidebar logo and the breadcrumb root. */
  name: string;
  /** Path to a logo image asset, loaded relative to this config file. */
  logo?: string;
  /** Globs (relative to the project root) matching each component folder's entry file. */
  components: string[];
  /** Globs excluded from `components` before detection runs. */
  exclude?: string[];
  /** Globs matching token modules. */
  tokens: string[];
  /** Globs matching standalone page files (token pages, Icons, recipes, Manifest). */
  pages?: string[];
  /** Sidebar group display order; groups not listed here follow alphabetically. */
  groupOrder?: string[];
  /** Starter-kit projects only. */
  starterKit?: { version: string };
  /** @default true */
  updateCheck?: boolean;
  /** `strict: true` promotes `doctor` warnings to errors. */
  doctor?: { strict?: boolean };
}

export function defineConfig(config: DsViewerConfig): DsViewerConfig {
  return config;
}
