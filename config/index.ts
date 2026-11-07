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
  /** Sidebar groups whose pages are patterns: regions that arrange separate components (a list of
   *  rows, a form section, an empty state with its avatars and button), never whole screens. `doctor`
   *  never treats a pattern page as the whole a component is a part of. @default ['Patterns'] */
  patternGroups?: string[];
  /** Sidebar groups whose pages are components. Only a component counts as a part: a page built
   *  from something documented in another group (a style or modifier, `pageKind: 'style'`; containers and layout wrappers are components) lists it in its
   *  side panel but gives it no Parts card and no part number. Absent: every group counts. */
  partGroups?: string[];
  /** @deprecated The catalog documents components and the patterns that arrange them, not whole
   *  screens; `doctor`'s `screen-page` rule warns about a page in these groups. Still read so old
   *  configs load, and (with `partGroups` set) `page-placement` still never moves such a page.
   *  Removed in a later release. `Screens` is always included; entries here add to it. */
  screenGroups?: string[];
  /** Path (relative to the project root) to a JSON file your project generates, saying where each
   *  component is used (usage file format v1 — see the README). Adds an "Appears in" block to
   *  every page with usage. Absent: the catalog is unchanged. */
  usage?: string;
  /** Starter-kit projects only. `root` is the folder `init --new` copied the kit into (default
   *  `src/ds`); absent on a config written before 0.4, in which case `cli/kitRoot.ts` infers it
   *  from the first `components` glob instead. */
  starterKit?: { version: string; root?: string };
  /** @default true */
  updateCheck?: boolean;
  /** `strict: true` promotes `doctor` warnings to errors. `handBuiltTokenPages` lists page ids (the file
   *  name without `.catalog.tsx`, or the explicit `id`) of radius, spacing, dimensions or opacity pages
   *  that are built by hand on purpose, such as a page documenting real named tokens: `doctor` then
   *  skips its `token-page-hand-built` hint for them. `placement: true` turns on `page-placement`,
   *  which compares a page's group with its declared `composedOf` (needs `partGroups`; off by default). */
  doctor?: { strict?: boolean; handBuiltTokenPages?: string[]; placement?: boolean };
}

export function defineConfig(config: DsViewerConfig): DsViewerConfig {
  return config;
}
