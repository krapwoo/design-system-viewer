import type React from 'react';
import type { AlsoUsedByEntry, CatalogAnatomy, CatalogMember, CatalogMemberSection, ComparisonDef, ComposedOfEntry, NavGroup, PreviewWidths, PropDef, RelatedPage, SectionDef, SpecimenSize, SpecimenSurfaceKind, TokenSection, VariantSlot } from './types.ts';
import type { TokenDefinition, TokenKind } from './tokenDefinition.ts';

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
  /** #61: an opt-in structured token definition — real entries (name/value/provenance/source) for
   *  one of the eight approved kinds, rendered through the existing token-gallery grammar
   *  (`StructuredTokenPage.tsx`, via `SectionBlock.tsx`'s own `tokenSections` block case) instead
   *  of a hand-built `render()`/`tokenSections`. Omitting it leaves every existing
   *  `tokenGallery`/`tokenSections`/`render` page unchanged. Setting it alongside an explicit
   *  `render`/`tokenGallery`/`tokenSections`/`members`, or an explicit `title` that doesn't match
   *  the kind's canonical title, is an actionable conflict (`buildCatalogSections` logs it in dev;
   *  `cli/doctor.ts` fails CI on it) rather than silent precedence — see
   *  `validateTokenDefinitionUsage`. See README's "Token pages" for the authoring shape. */
  tokenDefinition?: TokenDefinition;
  comparison?: ComparisonDef;
  specimenSize?: SpecimenSize;
  specimenSurface?: SpecimenSurfaceKind;
  previewWidths?: PreviewWidths;
  /** See `SectionDef.previewLayout`. */
  previewLayout?: 'frames' | 'table';
  hide?: SectionDef['hide'];
  composedOf?: ComposedOfEntry[];
  /** See `SectionDef.intentionalStaticPreview`. */
  intentionalStaticPreview?: { reason: string };
  /** See `SectionDef.internalProps`. */
  internalProps?: Record<string, string>;
  /** Export name this page documents; defaults to `id` for component pages. */
  component?: string;
  /** Sidebar group label. */
  group: string;
  /** Extra text per prop, appended to its generated description. A note naming a prop that no
   *  longer exists is a `doctor` error from 0.3 — 0.1 has no `doctor`, so it is silently unused. */
  propNotes?: Record<string, string>;
  /** Spec §5.1: documents a family of related declarations on one page instead of a single
   *  component. When set, the page's own `component`/`whenToUse`/`a11y`/specimens are not used —
   *  those live on the members (the whole is a member too) — and the viewer renders a `FamilyPage`
   *  (`SectionDef.family`) rather than the normal single-component layout. Requires `whole` and
   *  `sections`; validated by this file's own `validateFamily`. */
  members?: CatalogMember[];
  /** The family's whole: a member id, required when `members` is set. Its own id must equal this
   *  page's `id`. */
  whole?: string;
  /** How the family's non-whole members are grouped and rendered, required when `members` is set.
   *  Ordering only — numbering follows each member's own `parent` (`numberFor`); a Related member
   *  (outside every `inWhole` section) is never numbered. */
  sections?: CatalogMemberSection[];
  /** Extra names for the page itself (its whole) — e.g. retired page ids that are not member ids.
   *  Included in uniqueness validation, routing and search alongside `members[].aliases`. V2c item
   *  15: only takes effect on a page with `members` (a family page) — accepted but unused on a
   *  normal page, which never resolves it to anywhere. */
  aliases?: string[];
  /** Family-level "Not shown in the browser" line, under the page head. V2c item 15: only takes
   *  effect on a page with `members` — unused on a normal page. */
  notShown?: string;
  /** Label for the disclosure's API part (spec V2b item 9), e.g. `'Swift API'`. Defaults to
   *  `'API'` when absent — a generic viewer must never hardcode a host app's own wording. V2c
   *  item 15: only takes effect on a page with `members` — unused on a normal page. */
  apiLabel?: string;
  /** Slice D1 item 1: the anatomy box `FamilyPage` renders first, right after the page head —
   *  a picture of the whole with numbered pins and a legend. Only takes effect on a page with
   *  `members`. */
  anatomy?: CatalogAnatomy;
  /** Other catalog pages worth naming at the bottom of this page, under the "Related" heading,
   *  rendered after any deprecated non-`inWhole` sections — a component merely related to the
   *  whole owns its own page rather than being documented inline here. Each entry's `page` must
   *  resolve to a real catalog page, never this page's own id; `validateFamily` reports both as
   *  issues, and an entry that still fails to resolve at runtime renders its name as plain text
   *  instead of a dead link. Only takes effect on a page with `members`. */
  relatedPages?: RelatedPage[];
  /** #60 controller decision: opts this page into the "reference" browse layer instead of the
   *  default `'browse'` (omitting the field is identical to `'browse'` — no legacy page changes
   *  behavior). A reference page keeps its full address, aliases, and (on a family page) every
   *  member address — only the browse-facing sidebar/pager/hash-fallback sequence drops it; see
   *  `SectionDef.navigation`. A family page's members inherit this same layer; there is no
   *  separate per-member opt-in. */
  navigation?: 'browse' | 'reference';
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

/** Shared by a family member's own "also used by" (legacy) and, #60, an ordinary page's own —
 *  dedupes by `component`, keeping the first role, and drops any user in `excludeIds` (a family
 *  member excludes its own family's ids; an ordinary page excludes only itself). */
function dedupeAlsoUsedBy(
  entries: ReadonlyArray<{ component: string; role: string }>,
  excludeIds: ReadonlySet<string>,
): AlsoUsedByEntry[] {
  const deduped = new Map<string, { component: string; role: string }>();
  for (const entry of entries) {
    if (excludeIds.has(entry.component)) continue;
    if (!deduped.has(entry.component)) deduped.set(entry.component, entry);
  }
  return [...deduped.values()].map((entry) => ({ component: entry.component, role: entry.role || undefined }));
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

// #61: the same canonical-title map `tokenDefinition.ts`'s own `canonicalTokenTitle` holds —
// duplicated here, deliberately, rather than value-imported: `pageApi.ts` must stay importable
// from a plain `node --experimental-strip-types` test (`pageApi.test.ts`) with no JSX/bundler
// loader, which needs a real resolvable `./tokenDefinition.ts` specifier, while the SAME file is
// also reachable from `kit-host`'s/`viewer-host`'s own "how the app actually resolves this"
// `moduleResolution: "bundler"` type-check (`npm run check:types`), which rejects a `.ts`-extension
// *value* import outright (`allowImportingTsExtensions` is off there, and that tsconfig is read-
// only). A `import type` (erased entirely, so its extension is never resolved at either runtime)
// stays fine either way — only the three lines of logic below that would otherwise need a real
// value import are kept local instead. `tokenDefinition.ts`'s own exported `canonicalTokenTitle`/
// `validateTokenDefinition`/`validateTokenDefinitionUsage` remain the canonical versions for every
// other consumer (`StructuredTokenPage.tsx`, `cli/doctor.ts`, the public `index.ts` barrel) — only
// `pageApi.ts` keeps this one local copy, and only for this one reason.
const TOKEN_KIND_TITLES: Record<TokenKind, string> = {
  colors: 'Colors', typography: 'Typography', spacing: 'Spacing', radius: 'Radius',
  dimensions: 'Dimensions', shadows: 'Shadows', opacity: 'Opacity', motion: 'Motion',
};

/** #61: resolves `page.tokenDefinition` into the page's real `title`/`tokenGallery`/`tokenSections`
 *  — the only three fields `comparison.ts`'s own `presentationBlocks` (not writable here) reads to
 *  place a token-gallery block, so an opted-in page needs zero changes anywhere in that layout
 *  pipeline. Each derived `TokenSection`'s own `render` is a trivial `() => null` placeholder, never
 *  actually called: `SectionBlock.tsx`'s own `tokenSections` block case renders this page's real
 *  `tokenDefinition` entries instead whenever it's set (`StructuredTokenPage.tsx`) — keeping every
 *  JSX-producing closure at that existing rendering boundary, never inside this plain-TS module.
 *  Conflicts (duplicate section/entry ids, a legacy `render`/`tokenGallery`/`tokenSections`/
 *  `members` set alongside it, or an explicit title that disagrees with the kind) are logged to the
 *  dev console only — the same "soft" runtime posture `validateComposedOf`/`validateFamily` already
 *  use; `cli/doctor.ts`'s own static read of the equivalent rules (`tokenDefinition.ts`'s exported
 *  `validateTokenDefinition`/`validateTokenDefinitionUsage`) is what actually fails CI on them.
 *  Undefined when the page didn't opt in — every other field keeps the author's own values
 *  untouched. */
function deriveTokenDefinition(page: {
  tokenDefinition?: TokenDefinition;
  title?: string;
  render?: () => React.ReactNode;
  tokenGallery?: boolean;
  tokenSections?: TokenSection[];
  members?: unknown[];
  id: string;
}): { title: string; tokenGallery: true; tokenSections: TokenSection[] } | undefined {
  const def = page.tokenDefinition;
  if (!def) return undefined;
  if ((globalThis as { __DEV__?: boolean }).__DEV__) {
    const issues: string[] = [];
    if (page.render !== undefined) issues.push('tokenDefinition conflicts with this page\'s own "render" — remove one of them.');
    if (page.tokenGallery === true) issues.push('tokenDefinition conflicts with this page\'s own "tokenGallery" — remove one of them.');
    if (page.tokenSections !== undefined && page.tokenSections.length > 0) issues.push('tokenDefinition conflicts with this page\'s own "tokenSections" — remove one of them.');
    if (page.members !== undefined && page.members.length > 0) issues.push('tokenDefinition conflicts with this page\'s own "members" (a family page) — remove one of them.');
    const canonicalTitle = TOKEN_KIND_TITLES[def.kind];
    if (page.title !== undefined && page.title !== canonicalTitle) {
      issues.push(`tokenDefinition: title "${page.title}" conflicts with kind "${def.kind}" (expected "${canonicalTitle}"). Omit "title" to use it automatically.`);
    }
    const duplicateIds = (ids: readonly string[]): string[] => {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
      }
      return [...duplicates];
    };
    for (const id of duplicateIds(def.sections.map((s) => s.id))) issues.push(`tokenDefinition has more than one section with id "${id}".`);
    for (const section of def.sections) {
      for (const id of duplicateIds(section.entries.map((e) => e.id))) {
        issues.push(`tokenDefinition section "${section.id}" has more than one entry with id "${id}".`);
      }
      for (const entry of section.entries) {
        if (entry.kind !== def.kind) issues.push(`tokenDefinition section "${section.id}": entry "${entry.id}" has kind "${entry.kind}", but the page's kind is "${def.kind}".`);
      }
    }
    for (const issueMsg of issues) console.error(`[Catalog] ${page.id}: ${issueMsg}`);
  }
  return {
    title: page.title ?? TOKEN_KIND_TITLES[def.kind],
    tokenGallery: true,
    tokenSections: def.sections.map((section) => ({ id: section.id, title: section.title, desc: section.desc, wide: section.wide, render: () => null })),
  };
}

/** Human-readable problems with a page's (or, V2d, a family member's own) `composedOf`, in
 *  declaration order: one line per entry whose `component` isn't in `knownNames` (every real
 *  component name, documented or not, plus every page id and family member id — the full catalog
 *  inventory `buildCatalogSections` already has on hand). Empty when every name resolves,
 *  including when `composedOf` itself is omitted. Takes only the `component` field (never the
 *  narrower `ComposedOfEntry[]` type) so `cli/doctor.ts`'s own statically-read `{ component:
 *  string }[]` shape — which never carries `role`/`relationship` — satisfies it too. */
export function validateComposedOf(composedOf: { component: string }[] | undefined, knownNames: ReadonlySet<string>): string[] {
  if (!composedOf) return [];
  return composedOf
    .filter((entry) => !knownNames.has(entry.component))
    .map((entry) => `composedOf references unknown component "${entry.component}".`);
}

/** The subset of a family page's shape `validateFamily` and `numberFor` need. The real page
 *  carries full `CatalogMember` records; these functions only ever read `id`/`parent`/`aliases`. */
export interface FamilyOutlineInput {
  whole?: string;
  sections?: CatalogMemberSection[];
  members?: Array<Pick<CatalogMember, 'id' | 'parent'>>;
}

export interface FamilyPageLike extends FamilyOutlineInput {
  id: string;
  /** N6: `hasSpecimens` is not a `CatalogMember` field — each caller computes it (a non-empty
   *  `variants`/`states`/`comparison` at runtime, `StaticMember.hasExamples` in `doctor`) so
   *  `validateFamily` can flag a `list`-section member authored with a specimen that `FoldedRow`
   *  never renders. */
  members?: Array<Pick<CatalogMember, 'id' | 'parent' | 'aliases'> & { hasSpecimens?: boolean }>;
  aliases?: string[];
  /** Slice D1 item 3: the minimal shape `validateFamily` needs from `CatalogPageInput.anatomy` —
   *  decoupled from the full `CatalogAnatomy` type (which carries a `picture` React node this pure
   *  module never touches). */
  anatomy?: FamilyAnatomyLike;
  /** See `CatalogPageInput.relatedPages`. */
  relatedPages?: RelatedPage[];
}

/** Slice D1 item 3. */
export interface FamilyAnatomyLike {
  groups: ReadonlyArray<{ label: string; items: ReadonlyArray<{ member: string } | { other: string }> }>;
}

/** Validates a family page (spec §5.1): exactly one whole belonging to no section; every other
 *  member in exactly one section; every parent resolving within the page with no cycles; member
 *  and alias ids unique catalog-wide and never colliding with a page id, except the whole (whose
 *  id equals its own page's id). Returns `[]` for a page without `members`. `allPageIds` and
 *  `otherMemberIds` are the ids used by every *other* page/member in the catalog. */
export function validateFamily(page: FamilyPageLike, allPageIds: ReadonlySet<string>, otherMemberIds: ReadonlySet<string>): string[] {
  const { members } = page;
  if (!members || members.length === 0) return [];
  const issues: string[] = [];

  if (!page.whole || !page.sections) {
    issues.push(`Family "${page.id}": "members" requires both "whole" and "sections".`);
    return issues;
  }
  const whole = page.whole;
  const byId = new Map(members.map((m) => [m.id, m]));

  if (!byId.has(whole)) {
    issues.push(`Family "${page.id}": whole "${whole}" is not one of its members.`);
  }
  if (whole !== page.id) {
    issues.push(`Family "${page.id}": whole "${whole}" must have the same id as the page.`);
  }

  // V2c item 2: a section listing an id that is not one of the page's own members — reported
  // here, rather than left to crash the renderer or silently occupy authored order in `numberFor`.
  // N6: a `list`-section member authored with a specimen — `FoldedRow` never renders one, so this
  // degrades to a silently dropped specimen rather than a crash, same as the unknown-id case.
  for (const section of page.sections) {
    for (const id of section.members) {
      const resolved = byId.get(id);
      if (!resolved) {
        issues.push(`Family "${page.id}": section "${section.label}" lists "${id}", which is not a member of this page.`);
        continue;
      }
      if (section.kind === 'list' && resolved.hasSpecimens) {
        issues.push(`Family "${page.id}": "${id}" has specimens, but list sections show members as folded rows without specimens.`);
      }
    }
  }

  const sectionCountById = new Map<string, number>();
  for (const section of page.sections) {
    for (const id of section.members) sectionCountById.set(id, (sectionCountById.get(id) ?? 0) + 1);
  }
  if (sectionCountById.has(whole)) {
    issues.push(`Family "${page.id}": the whole "${whole}" must not appear in any section.`);
  }
  for (const m of members) {
    if (m.id === whole) continue;
    const count = sectionCountById.get(m.id) ?? 0;
    if (count === 0) issues.push(`Family "${page.id}": member "${m.id}" is not in any section.`);
    else if (count > 1) issues.push(`Family "${page.id}": member "${m.id}" is in more than one section.`);
  }

  for (const m of members) {
    if (m.parent === undefined) continue;
    if (!byId.has(m.parent)) {
      issues.push(`Family "${page.id}": member "${m.id}" has an unknown parent "${m.parent}".`);
      continue;
    }
    const seen = new Set([m.id]);
    let current: string | undefined = m.parent;
    let cycle = false;
    while (current !== undefined) {
      if (seen.has(current)) {
        cycle = true;
        break;
      }
      seen.add(current);
      current = byId.get(current)?.parent;
    }
    if (cycle) issues.push(`Family "${page.id}": member "${m.id}" has a parent cycle.`);
  }

  const seenInPage = new Set<string>();
  const checkId = (id: string, isWhole: boolean) => {
    if (seenInPage.has(id)) issues.push(`Family "${page.id}": id "${id}" is used more than once on this page.`);
    seenInPage.add(id);
    if (isWhole) return;
    if (allPageIds.has(id)) issues.push(`Family "${page.id}": id "${id}" collides with another page's id.`);
    if (otherMemberIds.has(id)) issues.push(`Family "${page.id}": id "${id}" collides with another member or alias elsewhere in the catalog.`);
  };
  for (const m of members) {
    checkId(m.id, m.id === whole);
    for (const alias of m.aliases ?? []) checkId(alias, false);
  }
  for (const alias of page.aliases ?? []) checkId(alias, false);

  // Slice D1 item 3: an anatomy `member` item must name a real, non-whole member of this page, and
  // each member may be pinned to the picture's legend at most once.
  // D2 item A2, narrowed per review C1: a member item is reported only when it sits inside an
  // `inWhole` section but still has no number — i.e. its parent isn't itself numbered. Left
  // unchecked, such a part renders indistinguishably from a Related row and its `AnatomyPin`
  // renders nothing at all. A member outside every `inWhole` section (Related) is legitimately
  // unnumbered by design (APPROVED.md: related members have no number) and must not be reported
  // here.
  if (page.anatomy) {
    const numbered = numberFor(page);
    const inWholeMemberIds = new Set<string>();
    for (const section of page.sections ?? []) {
      if (section.inWhole) for (const id of section.members) inWholeMemberIds.add(id);
    }
    const seenAnatomyMembers = new Set<string>();
    for (const group of page.anatomy.groups) {
      for (const item of group.items) {
        if (!('member' in item)) continue;
        if (item.member === whole) {
          issues.push(`Family "${page.id}": anatomy item "${item.member}" names the whole.`);
          continue;
        }
        if (!byId.has(item.member)) {
          issues.push(`Family "${page.id}": anatomy item "${item.member}" is not a member of this page.`);
          continue;
        }
        if (seenAnatomyMembers.has(item.member)) {
          issues.push(`Family "${page.id}": anatomy lists member "${item.member}" more than once.`);
          continue;
        }
        seenAnatomyMembers.add(item.member);
        if (inWholeMemberIds.has(item.member) && !numbered.has(item.member)) {
          issues.push(`Family "${page.id}": anatomy item "${item.member}" has no number.`);
        }
      }
    }
  }

  // `relatedPages`: each entry must name a real catalog page, other than this one, and the list
  // must not repeat a page. An unresolvable or self-naming entry still renders (plain text, never
  // a dead link), but is always reported here so `doctor` fails in CI. N8: `allPageIds` ∪
  // `otherMemberIds` is the same universe `FamilyPage`'s own `resolvesAddress` accepts as a
  // working link — page ids, member ids, and both page-level and member aliases — so an entry
  // naming another page's alias or another family's member address is accepted too.
  if (page.relatedPages) {
    const seenRelatedPages = new Set<string>();
    for (const entry of page.relatedPages) {
      if (seenRelatedPages.has(entry.page)) {
        issues.push(`Family "${page.id}": relatedPages lists "${entry.page}" more than once.`);
        continue;
      }
      seenRelatedPages.add(entry.page);
      if (entry.page === page.id) {
        issues.push(`Family "${page.id}": relatedPages entry "${entry.page}" names this page itself.`);
        continue;
      }
      if (byId.has(entry.page)) {
        issues.push(`Family "${page.id}": relatedPages entry "${entry.page}" is a member of this page, not another page.`);
        continue;
      }
      if (!allPageIds.has(entry.page) && !otherMemberIds.has(entry.page)) {
        issues.push(`Family "${page.id}": relatedPages entry "${entry.page}" is not a catalog page.`);
      }
    }
  }

  return issues;
}

/** Slice D1 item 2: anatomy-first numbering — the only numbering rule for every family page (not
 *  only one with `anatomy` set; it superseded the earlier whole-and-letters rule outright). The
 *  whole gets no number. A **top-level part** is any member of an `inWhole` section whose `parent`
 *  is the whole, or who has no `parent` at all (an in-whole root with no Swift parent edge is still
 *  top-level) — numbered `1`, `2`, `3`… in authored order (the order a member first appears
 *  scanning `inWhole` sections, in section order). A child takes its parent's number plus `.1`,
 *  `.2`, … in authored order. Members outside any `inWhole` section (Related) get no number at
 *  all. Returns an empty map for a page without members. */
export function numberFor(page: FamilyOutlineInput): Map<string, { number: string; level: number }> {
  const outline = new Map<string, { number: string; level: number }>();
  const { whole, sections, members } = page;
  if (!whole || !sections || !members) return outline;

  const memberIds = new Set(members.map((m) => m.id));
  // Only `inWhole` sections contribute to numbering — a Related section's members are never
  // top-level parts, and never occupy authored order (so they can't be skipped-over roots either).
  const authoredOrder: string[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    if (!section.inWhole) continue;
    for (const id of section.members) {
      if (!seen.has(id) && memberIds.has(id)) {
        seen.add(id);
        authoredOrder.push(id);
      }
    }
  }

  const parentOf = new Map(members.map((m) => [m.id, m.parent]));
  const childrenOf = new Map<string, string[]>();
  for (const id of authoredOrder) {
    const parent = parentOf.get(id);
    if (parent === undefined) continue;
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), id]);
  }

  // V2c item 14's cycle guard: bad data already reported by `validateFamily` must degrade to a
  // partial outline, never an infinite recursion.
  const assignChildren = (parentId: string, parentNumber: string, level: number, visited: Set<string>) => {
    const kids = childrenOf.get(parentId) ?? [];
    kids.forEach((childId, index) => {
      if (visited.has(childId)) return;
      visited.add(childId);
      const number = `${parentNumber}.${index + 1}`;
      outline.set(childId, { number, level: level + 1 });
      assignChildren(childId, number, level + 1, visited);
    });
  };

  const visited = new Set<string>([whole]);
  const topLevel = authoredOrder.filter((id) => {
    const parent = parentOf.get(id);
    return parent === undefined || parent === whole;
  });
  let next = 0;
  for (const id of topLevel) {
    if (visited.has(id)) continue;
    visited.add(id);
    next += 1;
    const number = String(next);
    outline.set(id, { number, level: 2 });
    assignChildren(id, number, 2, visited);
  }

  return outline;
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
  // A page with `members` documents every member's own `component` instead of `page.component ??
  // page.id` — that fallback never applies to a family page (spec §5.1).
  const documented = new Set<string>();
  for (const page of pages) {
    if (page.members && page.members.length > 0) {
      for (const member of page.members) if (member.component) documented.add(member.component);
    } else {
      documented.add(page.component ?? page.id);
    }
  }
  const groupIds = new Map<string, TId[]>();
  const addToGroup = (group: string, id: TId) => groupIds.set(group, [...(groupIds.get(group) ?? []), id]);
  // Every name a page's (or, V2d, a family member's own) `composedOf` could legitimately point
  // at: every real component (documented or not — an undocumented one is still a real part of the
  // design system), every page id (token pages, standalone recipes, …), every family member id
  // (a member's composedOf may point at a sibling member, or a member of another family), and —
  // N8 — every member alias and page-level alias: `FamilyPage`'s own `resolvesAddress` already
  // treats these as working links (`aliasTargets`), so this warning must accept the same names.
  const knownComposedOfNames = new Set<string>([
    ...componentByName.keys(),
    ...pages.map((page) => page.id),
    ...pages.flatMap((page) => (page.members ?? []).map((member) => member.id)),
    ...pages.flatMap((page) => (page.members ?? []).flatMap((member) => member.aliases ?? [])),
    ...pages.flatMap((page) => page.aliases ?? []),
  ]);

  // A member only ever looks itself up (below) by its own canonical `id`, but `knownComposedOfNames`
  // (N8, above) deliberately lets a `composedOf` entry's own `component` name a member's *alias*, or
  // the member's `component` field instead of its `id` — both resolve as working links through
  // `FamilyPage`'s own `resolvesAddress`. Without resolving through the same map here, an
  // alias-named or component-named entry would link fine going forward but derive nothing going
  // back: a missing "Also used by" line looks identical to "nothing uses this".
  // C1 fix: every page's own id and every member's own id is itself an exact registered address —
  // it must win over any same-named `component` binding elsewhere, including the common case where
  // a page's own id already equals its component name (so it never gets a chance to appear as a
  // "claimant" in the ambiguity pass below). Registering these identities first, before any
  // binding-name guessing runs, is what makes that guessing unable to ever shadow an exact address.
  const canonicalMemberIdByAlias = new Map<string, string>();
  for (const page of pages) {
    canonicalMemberIdByAlias.set(page.id, page.id);
    for (const member of page.members ?? []) {
      canonicalMemberIdByAlias.set(member.id, member.id);
      for (const alias of member.aliases ?? []) canonicalMemberIdByAlias.set(alias, member.id);
    }
    for (const alias of page.aliases ?? []) canonicalMemberIdByAlias.set(alias, page.id);
  }
  // #60/C1: a `composedOf` entry may instead name a component export rather than its page/member's
  // own id or alias — an ordinary page's own `component` (when it differs from its `id`) or a family
  // member's own `component` (when it differs from its `id`) are the same kind of claim, so both
  // feed the one shared ambiguity pass below: a name already owned by an exact address above is
  // never reconsidered, and a name claimed by more than one binding (ordinary-vs-ordinary,
  // member-vs-member, or ordinary-vs-member alike) is never guessed — it is left unresolved, not
  // silently decided by whichever binding happened to be declared first.
  const componentBindingOwners = new Map<string, string[]>();
  const addComponentBindingOwner = (name: string, ownerId: string) => {
    if (canonicalMemberIdByAlias.has(name)) return;
    componentBindingOwners.set(name, [...(componentBindingOwners.get(name) ?? []), ownerId]);
  };
  for (const page of pages) {
    if (page.members && page.members.length > 0) {
      for (const member of page.members) {
        if (member.component && member.component !== member.id) addComponentBindingOwner(member.component, member.id);
      }
      continue;
    }
    const componentName = page.component ?? page.id;
    if (componentName !== page.id) addComponentBindingOwner(componentName, page.id);
  }
  for (const [name, owners] of componentBindingOwners) {
    if (owners.length !== 1) continue;
    canonicalMemberIdByAlias.set(name, owners[0]);
  }
  const canonicalUsedByTarget = (name: string) => canonicalMemberIdByAlias.get(name) ?? name;

  // "Also used by" (derived, never authored): the inverse of every `composedOf` entry in the
  // catalog whose `relationship` is `'built-in'` — the forward direction renders as "Uses X"
  // (`UsesLine`); this is that same relationship read from the other end, keyed by the entry's own
  // `component` (the used thing) — gathered once, up front, so a family member just looks up its
  // own id below. A page's own `composedOf` attributes to that page's id (its address, e.g. a
  // family's whole); a family member's own `composedOf` attributes to that member's own id.
  const usedByTarget = new Map<string, Array<{ component: string; role: string }>>();
  const addUsedBy = (target: string, component: string, role: string) => {
    const list = usedByTarget.get(target);
    if (list) list.push({ component, role });
    else usedByTarget.set(target, [{ component, role }]);
  };
  for (const page of pages) {
    for (const entry of page.composedOf ?? []) {
      if (entry.relationship === 'built-in') addUsedBy(canonicalUsedByTarget(entry.component), page.id, entry.role);
    }
    for (const member of page.members ?? []) {
      for (const entry of member.composedOf ?? []) {
        if (entry.relationship === 'built-in') addUsedBy(canonicalUsedByTarget(entry.component), member.id, entry.role);
      }
    }
  }

  // Every id/alias a family page's own `members` and `aliases` use, keyed by page id — gathered up
  // front so `validateFamily` (above) can check catalog-wide uniqueness against every *other*
  // page's ids.
  const allPageIds = new Set(pages.map((page) => page.id));
  const familyIdsByPage = new Map<TId, Set<string>>();
  for (const page of pages) {
    if (!page.members) continue;
    const ids = new Set<string>();
    for (const member of page.members) {
      ids.add(member.id);
      for (const alias of member.aliases ?? []) ids.add(alias);
    }
    for (const alias of page.aliases ?? []) ids.add(alias);
    familyIdsByPage.set(page.id, ids);
  }

  // Design §4 "duplicate-page-id" rule's viewer-side equivalent — this is the one place in the
  // whole viewer that already resolves every page's id to build sections/groups, so it costs
  // nothing extra to also notice two pages claiming the same one (`sectionsById` in
  // `CatalogShell.tsx` would otherwise just let the last one silently win).
  const seenIds = new Set<TId>();
  const sections: SectionDef<TId>[] = pages.map((page) => {
    // N2: `seenIds` must be populated (and consulted, below in the undocumented-component loop)
    // regardless of `__DEV__` — only the `console.warn` calls are development-only diagnostics;
    // a production bundle (Metro's `__DEV__ = false`) still needs the stub-skip to work.
    if (seenIds.has(page.id)) {
      if ((globalThis as { __DEV__?: boolean }).__DEV__) {
        console.warn(`[Catalog] Page id "${page.id}" is used by more than one page; only the last one will show. Give one of them its own "id".`);
      }
    }
    seenIds.add(page.id);
    if ((globalThis as { __DEV__?: boolean }).__DEV__) {
      for (const issue of validateComposedOf(page.composedOf, knownComposedOfNames)) console.warn(`[Catalog] ${page.id}: ${issue}`);
      // V2d item 4: the same validation, per family member's own `composedOf`.
      for (const member of page.members ?? []) {
        for (const issue of validateComposedOf(member.composedOf, knownComposedOfNames)) {
          console.warn(`[Catalog] ${page.id}.${member.id}: ${issue}`);
        }
      }
    }
    const isFamily = page.members !== undefined && page.members.length > 0;
    const componentName = isFamily ? undefined : (page.component ?? page.id);
    const component = componentName ? componentByName.get(componentName) : undefined;
    addToGroup(page.group, page.id);

    let family: SectionDef<TId>['family'];
    if (isFamily) {
      const otherPageIds = new Set([...allPageIds].filter((id) => id !== page.id));
      const otherMemberIds = new Set<string>();
      for (const [id, ids] of familyIdsByPage) if (id !== page.id) for (const memberId of ids) otherMemberIds.add(memberId);
      // `hasSpecimens` is computed here, as doctor does, so the list-section rule also fires in
      // the development console, not only in `ds-viewer doctor`.
      const members = page.members!.map((member) => ({
        ...member,
        hasSpecimens: Boolean(member.variants?.items?.length || member.states?.items?.length || member.comparison),
      }));
      const issues = validateFamily({ ...page, members, anatomy: page.anatomy, relatedPages: page.relatedPages }, otherPageIds, otherMemberIds);
      if ((globalThis as { __DEV__?: boolean }).__DEV__) {
        for (const issue of issues) console.error(`[Catalog] ${issue}`);
      }
      // "Also used by": every id this page's own members (the whole included) use is excluded
      // from its own members' derived users — a sibling (or the whole) composing a part is still
      // the same family tree, already expressed by `parent`/the page itself, not a second user.
      const pageMemberIds = new Set(page.members!.map((m) => m.id));
      family = {
        whole: page.whole!,
        sections: page.sections!,
        outline: numberFor(page),
        notShown: page.notShown,
        aliases: page.aliases,
        apiLabel: page.apiLabel,
        anatomy: page.anatomy,
        relatedPages: page.relatedPages,
        members: page.members!.map((member) => {
          const memberComponent = member.component ? componentByName.get(member.component) : undefined;
          // Dedupe by `component`, keeping the first role: page-level and whole-member `composedOf`
          // attribute to the same string for a family's whole (`validateFamily` forces
          // `whole === page.id`), and `validateComposedOf` has no duplicate check of its own, so the
          // same user declared twice would otherwise render "Also used by P and P".
          const alsoUsedBy = dedupeAlsoUsedBy(usedByTarget.get(member.id) ?? [], pageMemberIds);
          return {
            ...member,
            props: memberComponent ? mergePropNotes(memberComponent, undefined) : undefined,
            path: memberComponent?.file ?? member.source,
            alsoUsedBy,
          };
        }),
      };
    }

    // Important finding 4: a standalone page (no matching component record) has no props to show
    // and nothing to say "This component takes no props" about — hide the Props box, and fall back
    // to the page's own file as its Source instead of an empty path.
    // #61: resolved once so `title`/`tokenGallery`/`tokenSections` below can each fall back to it.
    const derivedTokenDefinition = deriveTokenDefinition(page);
    return {
      id: page.id,
      title: derivedTokenDefinition?.title ?? page.title,
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
      tokenGallery: derivedTokenDefinition?.tokenGallery ?? (page.tokenGallery || (page.tokenSections !== undefined && page.tokenSections.length > 0) || undefined),
      tokenSections: derivedTokenDefinition?.tokenSections ?? page.tokenSections,
      // #61: the real entry data `SectionBlock.tsx` renders instead of the placeholder sections
      // above, when set — see `SectionDef.tokenDefinition`'s own doc comment.
      tokenDefinition: page.tokenDefinition,
      tokenColumns: page.tokenColumns,
      fullWidthLabel: page.fullWidthLabel,
      comparison: page.comparison,
      specimenSize: page.specimenSize,
      specimenSurface: page.specimenSurface,
      previewWidths: page.previewWidths,
      previewLayout: page.previewLayout,
      hide: component ? page.hide : { ...page.hide, props: true },
      composedOf: page.composedOf,
      internalProps: page.internalProps,
      intentionalStaticPreview: page.intentionalStaticPreview,
      family,
      navigation: page.navigation,
      // Family pages carry their own component binding per member (`FamilyDef.members[].component`
      // isn't a field — a member names its binding via `CatalogMember.component` itself); only a
      // normal page's own single binding is surfaced here.
      component: isFamily ? undefined : component?.name,
      // #60: see `SectionDef.alsoUsedBy` (rendered by `ReferenceDetails`'s `AlsoUsedByFact`) — a family page's "also
      // used by" lives per member instead (`family.members[].alsoUsedBy`, above).
      alsoUsedBy: isFamily ? undefined : dedupeAlsoUsedBy(usedByTarget.get(page.id) ?? [], new Set([page.id])),
    };
  });

  const undocumented = components.filter((component) => !documented.has(component.name)).sort((a, b) => a.name.localeCompare(b.name));
  for (const component of undocumented) {
    const id = component.name as TId;
    // V2c item 7: a component with no page of its own, whose name happens to collide with an
    // authored page's own id (most likely a family page, which never resolves `documented` via the
    // `page.component ?? page.id` fallback) — its stub must never win that id in `sections`.
    if (seenIds.has(id)) {
      if ((globalThis as { __DEV__?: boolean }).__DEV__) {
        console.warn(`[Catalog] Component "${id}" has no catalog page of its own, and "${id}" is already used by another page's id; skipping its stub.`);
      }
      continue;
    }
    sections.push({
      id, description: 'No examples documented.', path: component.file, props: mergePropNotes(component, undefined),
      component: component.name,
      alsoUsedBy: dedupeAlsoUsedBy(usedByTarget.get(id) ?? [], new Set([id])),
    });
    addToGroup('Components', id);
  }

  return { sections, groups: orderGroups(groupIds, groupOrder) };
}
