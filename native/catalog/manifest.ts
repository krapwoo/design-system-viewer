import type { NavGroup, PropDef, SectionDef } from './types';

/** One documented variant/state instance, stripped of its `node` (a React element isn't JSON-
 *  serializable, and isn't useful to a consumer that only wants to know what's demonstrated). */
export interface ManifestExample {
  key: string;
  name: string;
  /** Present only for examples tagged via `VariantExample.props` — see types.ts. */
  props?: Record<string, unknown>;
}

/** One component's structured documentation — everything `SectionDef` carries, minus the JSX. */
export interface ComponentManifestEntry {
  id: string;
  path: string;
  description: string;
  /** The deciding question against this component's closest look-alike, if it has one — see
   *  WHEN_TO_USE.md for the full reasoning this is condensed from. */
  whenToUse?: string;
  a11y?: string;
  props: PropDef[];
  category: string;
  variants: ManifestExample[];
  states: ManifestExample[];
}

const stripNode = ({ key, name, props }: { key: string; name: string; props?: Record<string, unknown> }): ManifestExample =>
  props ? { key, name, props } : { key, name };

/**
 * Serializes a catalog's `sections` (+ the `groups` that categorize them) into plain, JSON-safe
 * data — no React elements, so it's directly usable outside the app: fed to another tool, diffed
 * in CI to catch undocumented API changes, or handed to an LLM as ground truth for which props/
 * variants/states a component actually supports, instead of it guessing from the source alone.
 * Token-gallery sections (Colors, Spacing, …) are skipped — they document values, not a component
 * API. `render`-based sections (interactive demos with local state) keep their static `props`/
 * `a11y` metadata but naturally have no `variants`/`states` items to list, since those live inside
 * the render function rather than as data.
 */
export function buildComponentManifest<TId extends string>(
  sections: SectionDef<TId>[],
  groups: NavGroup<TId>[],
): ComponentManifestEntry[] {
  const categoryById = new Map<TId, string>();
  for (const group of groups) {
    for (const id of group.ids) categoryById.set(id, group.label);
  }

  return sections
    .filter((def) => !def.tokenGallery)
    .map((def) => ({
      id: def.id,
      path: def.path,
      description: def.description,
      whenToUse: def.whenToUse,
      a11y: def.a11y,
      props: def.props ?? [],
      category: categoryById.get(def.id) ?? 'Uncategorized',
      variants: (def.variants?.items ?? []).map(stripNode),
      states: (def.states?.items ?? []).map(stripNode),
    }));
}
