import type React from 'react';
import type { ComparisonDef, ComposedOfEntry, NavGroup, PreviewWidths, PropDef, SectionDef, SpecimenSize, SpecimenSurfaceKind, TokenSection, VariantSlot } from './types';

/** `SectionDef` without the derived fields (`id`/`path`/`props` come from detection and
 *  generated props), plus the three fields design §1 "Page shape" adds. */
export interface CatalogPageInput<TId extends string = string> {
  /** Optional — design §2 "Page id": defaults to `component` (the export name) for component
   *  pages, or the page file's stem for standalone pages. `writePageIndex` (Task 9) resolves the
   *  default when writing the generated page index, so an authored page never has to repeat a name
   *  already implied by its file. */
  id?: TId;
  /** Display name; see `SectionDef.title`. */
  title?: string;
  /** Project-relative file shown as the page's Source when the page documents something other
   *  than a component, e.g. a token page pointing at `src/design-system/tokens.ts`. A component's
   *  own file always wins. */
  source?: string;
  /** See `SectionDef.osComponent`. */
  osComponent?: 'full' | 'partial';
  description: string;
  whenToUse?: string;
  a11y?: string;
  variants?: VariantSlot;
  states?: VariantSlot;
  render?: () => React.ReactNode;
  tokenGallery?: boolean;
  tokenSections?: TokenSection[];
  tokenColumns?: 1 | 2 | 3;
  fullWidthLabel?: string;
  comparison?: ComparisonDef;
  specimenSize?: SpecimenSize;
  specimenSurface?: SpecimenSurfaceKind;
  previewWidths?: PreviewWidths;
  hide?: SectionDef['hide'];
  composedOf?: ComposedOfEntry[];
  /** Export name this page documents; defaults to `id` for component pages. */
  component?: string;
  /** Sidebar group label. */
  group: string;
  /** Extra text per prop, appended to its generated description. A note naming a prop that no
   *  longer exists is a `doctor` error from 0.3 — 0.1 has no `doctor`, so it is silently unused. */
  propNotes?: Record<string, string>;
}

export interface CatalogPage<TId extends string = string> extends CatalogPageInput<TId> {
  /** Marks this as produced by `defineCatalogPage`, not a plain object literal that happens to
   *  share its shape. */
  readonly __dsViewerPage: true;
}

export function defineCatalogPage<TId extends string = string>(page: CatalogPageInput<TId>): CatalogPage<TId> {
  return { ...page, __dsViewerPage: true };
}

export interface GeneratedPropRecord {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  desc: string;
  /** Coverage-target option values (design §3 — "Options for coverage"); see `PropRecord.options`
   *  (`cli/types.ts`, Task 2). Unused by the viewer in 0.1. */
  options?: string[];
}

export interface GeneratedComponent {
  name: string;
  file: string;
  props: GeneratedPropRecord[];
  inheritedFrom: string[];
}

function mergePropNotes(component: GeneratedComponent, propNotes: Record<string, string> | undefined): PropDef[] {
  const own = component.props.map((prop) => ({
    name: prop.name,
    type: prop.type,
    required: prop.required,
    default: prop.default,
    desc: propNotes?.[prop.name] ? `${prop.desc} ${propNotes[prop.name]}`.trim() : prop.desc,
  }));
  // Design §3: props inherited from node_modules (e.g. `extends TextInputProps`) are summarised as
  // one row per source instead of being listed individually.
  const inherited = component.inheritedFrom.map((source) => ({
    name: `${source} props`,
    type: 'inherited',
    required: true,
    desc: `Plus all ${source} props, not listed individually.`,
  }));
  return [...own, ...inherited];
}

/** Human-readable problems with a page's `composedOf`, in declaration order: one line per entry
 *  whose `component` isn't in `knownNames` (every real component name, documented or not, plus
 *  every page id — the full catalog inventory `buildCatalogSections` already has on hand). Empty
 *  when every name resolves, including when `composedOf` itself is omitted. */
export function validateComposedOf(composedOf: ComposedOfEntry[] | undefined, knownNames: ReadonlySet<string>): string[] {
  if (!composedOf) return [];
  return composedOf
    .filter((entry) => !knownNames.has(entry.component))
    .map((entry) => `composedOf references unknown component "${entry.component}".`);
}

function orderGroups<TId extends string>(groupIds: Map<string, TId[]>, groupOrder: string[] | undefined): NavGroup<TId>[] {
  const listed = groupOrder ?? [];
  const labels = [...groupIds.keys()];
  const ordered = [...listed.filter((label) => groupIds.has(label)), ...labels.filter((label) => !listed.includes(label)).sort()];
  return ordered.map((label) => ({ label, ids: groupIds.get(label) ?? [] }));
}

/**
 * Builds the viewer's `sections`/`groups` from authored pages plus generated component data — the
 * logic the generated entry file (Task 12) runs on every bundle. A documented component's page
 * supplies everything page-authored; its props always come from `components` (never authored by
 * hand). A component with no page still appears, with "No examples documented." (design §2).
 */
export function buildCatalogSections<TId extends string>(
  // The generated page index (Task 9) always fills in `id` (`id ?? component ?? file stem`) and
  // `file` (the page's own project-relative path), so pages arriving here have both even though
  // authors may omit them.
  pages: Array<CatalogPage<TId> & { id: TId; file: string }>,
  components: GeneratedComponent[],
  groupOrder?: string[],
): { sections: SectionDef<TId>[]; groups: NavGroup<TId>[] } {
  const componentByName = new Map(components.map((c) => [c.name, c]));
  const documented = new Set(pages.map((page) => page.component ?? page.id));
  const groupIds = new Map<string, TId[]>();
  const addToGroup = (group: string, id: TId) => groupIds.set(group, [...(groupIds.get(group) ?? []), id]);
  // Every name a page's `composedOf` could legitimately point at: every real component (documented
  // or not — an undocumented one is still a real part of the design system) plus every page id
  // (token pages, standalone recipes, …).
  const knownComposedOfNames = new Set<string>([...componentByName.keys(), ...pages.map((page) => page.id)]);

  // Design §4 "duplicate-page-id" rule's viewer-side equivalent — this is the one place in the
  // whole viewer that already resolves every page's id to build sections/groups, so it costs
  // nothing extra to also notice two pages claiming the same one (`sectionsById` in
  // `CatalogShell.tsx` would otherwise just let the last one silently win).
  const seenIds = new Set<TId>();
  const sections: SectionDef<TId>[] = pages.map((page) => {
    if ((globalThis as { __DEV__?: boolean }).__DEV__) {
      if (seenIds.has(page.id)) console.warn(`[Catalog] Page id "${page.id}" is used by more than one page; only the last one will show. Give one of them its own "id".`);
      seenIds.add(page.id);
      for (const issue of validateComposedOf(page.composedOf, knownComposedOfNames)) console.warn(`[Catalog] ${page.id}: ${issue}`);
    }
    const componentName = page.component ?? page.id;
    const component = componentByName.get(componentName);
    addToGroup(page.group, page.id);
    // Important finding 4: a standalone page (no matching component record) has no props to show
    // and nothing to say "This component takes no props" about — hide the Props box, and fall back
    // to the page's own file as its Source instead of an empty path.
    return {
      id: page.id,
      title: page.title,
      osComponent: page.osComponent,
      description: page.description,
      path: component?.file ?? page.source ?? page.file,
      whenToUse: page.whenToUse,
      props: component ? mergePropNotes(component, page.propNotes) : undefined,
      a11y: page.a11y,
      variants: page.variants,
      states: page.states,
      render: page.render,
      // `tokenSections` makes a page a token gallery by itself.
      tokenGallery: page.tokenGallery || (page.tokenSections !== undefined && page.tokenSections.length > 0) || undefined,
      tokenSections: page.tokenSections,
      tokenColumns: page.tokenColumns,
      fullWidthLabel: page.fullWidthLabel,
      comparison: page.comparison,
      specimenSize: page.specimenSize,
      specimenSurface: page.specimenSurface,
      previewWidths: page.previewWidths,
      hide: component ? page.hide : { ...page.hide, props: true },
      composedOf: page.composedOf,
    };
  });

  const undocumented = components.filter((component) => !documented.has(component.name)).sort((a, b) => a.name.localeCompare(b.name));
  for (const component of undocumented) {
    const id = component.name as TId;
    sections.push({ id, description: 'No examples documented.', path: component.file, props: mergePropNotes(component, undefined) });
    addToGroup('Components', id);
  }

  return { sections, groups: orderGroups(groupIds, groupOrder) };
}
