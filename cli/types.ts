import type { DsViewerConfig } from '../config/index.ts';

/** `DsViewerConfig` plus where it came from. Every CLI command after config loading works with
 *  this, not the raw `DsViewerConfig`, so paths are always resolved against the right project. */
export interface ResolvedConfig extends DsViewerConfig {
  projectRoot: string;
  configPath: string;
}

export interface PropRecord {
  name: string;
  /** Kept as a short, readable type string (alias names preserved, not expanded unions). */
  type: string;
  required: boolean;
  /** Default value's source text (e.g. `"'primary'"`, `"false"`), from a JSDoc `@default` tag or
   *  the component's own parameter destructuring. Undefined when neither is present. */
  default?: string;
  desc: string;
  /** Coverage-target option values (design §3 — "Options for coverage"): present only for a
   *  2-or-more-member string-literal union declared inside a configured component or token
   *  folder (see `ReadComponentsOptions.optionRoots` in `cli/props.ts`, Task 6). A single literal
   *  and a union declared elsewhere (e.g. the 44-member `IconName` from `icons/`) have no options.
   *  Unused in 0.1; recorded now so `doctor` (0.3) needs no `components.json` format change. */
  options?: string[];
}

export interface ComponentRecord {
  name: string;
  /** Path to the file that declares the component, relative to the process's cwd at read time. */
  file: string;
  props: PropRecord[];
  /** Folder names of `node_modules` types this component's props extend (e.g. `["TextInput"]`),
   *  rendered as "plus all TextInput props" instead of listing every inherited prop. */
  inheritedFrom: string[];
}
