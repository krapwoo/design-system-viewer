import type React from 'react';
import type { AlsoUsedByEntry, CatalogAnatomy, DocumentedComponent, CatalogMember, CatalogMemberSection, ComparisonDef, ComposedOfEntry, NavGroup, PreviewWidths, PropDef, RelatedPage, SectionDef, SpecimenSize, SpecimenSurfaceKind, TokenSection, VariantSlot } from './types.ts';
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
  /** Page-level notes, shown as a "Notes" entry in the page's Quick reference (the page-level
   *  counterpart of a family member's `notes`). */
  notes?: string[];
  /** Why this page stands on its own. Opts it out of `doctor`'s `part-own-page` and
   *  `nothing-to-show` checks and records the decision in source; the viewer does not render it. */
  standalone?: string;
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
   *  a picture of the whole with numbered pins and a legend. Drawn on a family page and on a
   *  standalone page (one without `members`); a group page takes it on a top-level member instead.
   *  A standalone page has no members, so only its `other` items make sense there — a `member` item
   *  renders as an unpinned plain row (and warns in development). */
  anatomy?: CatalogAnatomy;
  /** Other catalog pages worth naming at the bottom of this page, under the "Related" heading,
   *  rendered after any deprecated non-`inWhole` sections — a component merely related to the
   *  whole owns its own page rather than being documented inline here. Each entry's `page` must
   *  resolve to a real catalog page, never this page's own id; `validateFamily` reports both as
   *  issues, and an entry that still fails to resolve at runtime renders its name as plain text
   *  instead of a dead link. Only takes effect on a page with `members`; on any other page
   *  `relatedPagesUnusedMessage` reports it (`doctor`: `related-pages-unused`). */
  relatedPages?: RelatedPage[];
  /** #60 controller decision: opts this page into the "reference" browse layer instead of the
   *  default `'browse'` (omitting the field is identical to `'browse'` — no legacy page changes
   *  behavior). A reference page keeps its full address, aliases, and (on a family page) every
   *  member address — only the browse-facing sidebar/pager/hash-fallback sequence drops it; see
   *  `SectionDef.navigation`. A family page's members inherit this same layer; there is no
   *  separate per-member opt-in. */
  navigation?: 'browse' | 'reference';
  /** Lists this page in the sidebar under another page of the same group instead of at its own
   *  alphabetical place: indented, sorted by title among its siblings, and joined to the parent by
   *  connector lines. The parent is an ordinary page (for example a category overview) and must be
   *  a page id in the same `group` that has no `sidebarParent` of its own — one level only — and is
   *  listed in the sidebar (not `navigation: 'reference'`).
   *  Selecting the child highlights the child; the ← → pager and the filter follow the nested
   *  order. Only the sidebar changes: the page keeps its own address. An unknown parent, a parent
   *  in another group, a parent that is itself nested, or a page naming itself is an error
   *  (`validateSidebarParents`; `doctor`: `sidebar-parent-invalid`). */
  sidebarParent?: string;
  /** Components this (token) page documents instead of a component page of their own, e.g. the
   *  small icon components shown as tiles on an Iconography page. Each counts as catalogued (no
   *  "needs a page" finding, no `exclude`), keeps component discovery, usage and Appears-in, and
   *  is owned by this page. Everything that names the component — anatomy items and pins,
   *  `composedOf`, Uses / Also used by / Related links, search — opens this page at that tile and
   *  shows `title`. `component` is the export name and doubles as the stable anchor
   *  (`#HeaderLogo`); bind a tile to it with `<TokenTile documents="HeaderLogo">` or
   *  `<DocumentedAnchor component="HeaderLogo">`. Not used on a family or group page.
   *  Validated by `validateDocuments` (`doctor`: `documents-invalid`). */
  documents?: DocumentedComponent[];
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
      // #64 B1: groups inside a category — the same duplicate-id/kind-mismatch checks, scoped to
      // each group's own entries, mirroring `tokenDefinition.ts`'s own `validateTokenDefinition`.
      for (const id of duplicateIds((section.groups ?? []).map((g) => g.id))) {
        issues.push(`tokenDefinition section "${section.id}" has more than one group with id "${id}".`);
      }
      for (const group of section.groups ?? []) {
        for (const id of duplicateIds(group.entries.map((e) => e.id))) {
          issues.push(`tokenDefinition section "${section.id}" group "${group.id}" has more than one entry with id "${id}".`);
        }
        for (const entry of group.entries) {
          if (entry.kind !== def.kind) issues.push(`tokenDefinition section "${section.id}" group "${group.id}": entry "${entry.id}" has kind "${entry.kind}", but the page's kind is "${def.kind}".`);
        }
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
  members?: Array<Pick<CatalogMember, 'id' | 'parent' | 'aliases' | 'title'> & { hasSpecimens?: boolean }>;
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

/** A member's `title` is its displayed name, so an empty or whitespace-only one would show a blank
 *  heading and unlabeled links: it must be omitted (the id shows) or say something. */
function blankMemberTitles(kind: 'Family' | 'Group', pageId: string, members: ReadonlyArray<{ id: string; title?: string }>): string[] {
  return members
    .filter((member) => member.title !== undefined && member.title.trim() === '')
    .map((member) => `${kind} "${pageId}": member "${member.id}" has a blank title — omit "title" to show the id, or give it a name.`);
}

/** Validates a family page (spec §5.1): exactly one whole belonging to no section; every other
 *  member in exactly one section; every parent resolving within the page with no cycles; member
 *  and alias ids unique catalog-wide and never colliding with a page id, except the whole (whose
 *  id equals its own page's id). Returns `[]` for a page without `members`. `allPageIds` and
 *  `otherMemberIds` are the ids used by every *other* page/member in the catalog. #63 A1: a page
 *  with neither `whole` nor `sections` is a *group* page, not a family — validated instead by
 *  `validateGroup`; this function is a no-op for it (its own "both present" behavior and messages
 *  are otherwise unchanged). A page with exactly one of the two stays a family-shape error, as
 *  before. #63 A5: `externalPartIds` names every id this family's own `inWhole` sections list that
 *  was resolved (catalog-wide, by the caller) to a real, validly-parented group-page member —
 *  these are exempted from the "not a member of this page" check below; omit it (the default, `[]`)
 *  to keep every existing call site's behavior byte-for-byte unchanged. */
export function validateFamily(
  page: FamilyPageLike,
  allPageIds: ReadonlySet<string>,
  otherMemberIds: ReadonlySet<string>,
  externalPartIds: ReadonlySet<string> = new Set(),
): string[] {
  const { members } = page;
  if (!members || members.length === 0) return [];
  const issues: string[] = [];

  if (!page.whole && !page.sections) return issues; // A group page — see `validateGroup`.
  if (!page.whole || !page.sections) {
    issues.push(`Family "${page.id}": "members" requires both "whole" and "sections".`);
    return issues;
  }
  const whole = page.whole;
  const byId = new Map(members.map((m) => [m.id, m]));

  for (const message of blankMemberTitles('Family', page.id, members)) issues.push(message);

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
  const externalCountById = new Map<string, number>();
  for (const section of page.sections) {
    for (const id of section.members) {
      const resolved = byId.get(id);
      if (!resolved) {
        // #63 A5: a validly-resolved external part — a group-page member, already checked by the
        // caller against `memberLocations`/parent — is never reported as missing.
        if (section.inWhole && externalPartIds.has(id)) {
          externalCountById.set(id, (externalCountById.get(id) ?? 0) + 1);
          continue;
        }
        issues.push(`Family "${page.id}": section "${section.label}" lists "${id}", which is not a member of this page.`);
        continue;
      }
      if (section.kind === 'list' && resolved.hasSpecimens) {
        issues.push(`Family "${page.id}": "${id}" has specimens, but list sections show members as folded rows without specimens.`);
      }
    }
  }

  // An external part rendered twice would duplicate its row, React key and registered node.
  for (const [id, count] of externalCountById) {
    if (count > 1) issues.push(`Family "${page.id}": member "${id}" is in more than one section.`);
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
          // #63 A5: a resolved external part (numbered by the catalog-wide pre-pass, documented on a
          // group page) may be named in the anatomy, exactly as its `inWhole` section may list it.
          if (externalPartIds.has(item.member)) {
            if (seenAnatomyMembers.has(item.member)) {
              issues.push(`Family "${page.id}": anatomy lists member "${item.member}" more than once.`);
            }
            seenAnatomyMembers.add(item.member);
            continue;
          }
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

/** #63 A4: numbers one group member's own parts — authored (array) order among siblings, `1`,
 *  `2`, then `1.1`, … for children, exactly like `numberFor`'s own child assignment under a
 *  family's whole — scoped to `topLevelId`'s own descendants among `members` (a group page has no
 *  `sections` to scan, so "authored order" is simply the `members` array's own order). `topLevelId`
 *  itself gets no number, the same way a family's whole never does. Lifted, not reimplemented, from
 *  `numberFor`'s own `assignChildren`/cycle guard, re-anchored on one top-level member instead of
 *  one page-wide whole. */
export function numberForGroupMember(
  topLevelId: string,
  members: ReadonlyArray<Pick<CatalogMember, 'id' | 'parent'>>,
): Map<string, { number: string; level: number }> {
  const outline = new Map<string, { number: string; level: number }>();
  const childrenOf = new Map<string, string[]>();
  for (const m of members) {
    if (m.parent === undefined) continue;
    childrenOf.set(m.parent, [...(childrenOf.get(m.parent) ?? []), m.id]);
  }
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
  const visited = new Set<string>([topLevelId]);
  const kids = childrenOf.get(topLevelId) ?? [];
  kids.forEach((childId, index) => {
    if (visited.has(childId)) return;
    visited.add(childId);
    const number = String(index + 1);
    outline.set(childId, { number, level: 2 });
    assignChildren(childId, number, 2, visited);
  });
  return outline;
}

/** #63 A3/A6: the minimal shape `validateGroup` needs from a group page's own `members`. */
export interface GroupMemberLike {
  id: string;
  /** See `CatalogMember.title`. */
  title?: string;
  parent?: string;
  aliases?: string[];
  /** #63 A4: only meaningful on a top-level member — see `CatalogMember.anatomy`. */
  anatomy?: FamilyAnatomyLike;
}

export interface GroupPageLike {
  id: string;
  members?: GroupMemberLike[];
  aliases?: string[];
  /** #63 A1: forbidden on a group page — only ever checked for presence here, never for shape
   *  (an author who sets a family-shaped `anatomy` object here still gets this one message, not a
   *  second, confusing shape error). */
  anatomy?: unknown;
  /** Review F8: a group page has no "Related" layer, so a non-empty list here would silently never
   *  render — reported as unused instead. Presence only, never shape. */
  relatedPages?: readonly unknown[];
}

/** One group-page problem with the doctor rule it belongs to, decided where the issue is raised
 *  (never by matching its message text): `group-anatomy-member` for an embedded `anatomy` problem
 *  (A4), `family-invalid` for every other shape error. */
export interface GroupIssue {
  rule: 'family-invalid' | 'group-anatomy-member';
  message: string;
}

/** A non-empty `relatedPages` on a page without `members` renders nothing (only a family page
 *  shows the Related list), so the author is told instead of left to wonder. Undefined when there
 *  is nothing to report. A group page has its own message in `validateGroupIssues`. */
export function relatedPagesUnusedMessage(page: { id: string; members?: readonly unknown[]; relatedPages?: readonly unknown[] }): string | undefined {
  if (page.members && page.members.length > 0) return undefined;
  if (!page.relatedPages || page.relatedPages.length === 0) return undefined;
  return `Page "${page.id}": "relatedPages" is not used on a page without members (it renders no Related list) — make this a family page, or name the related page in "composedOf" instead.`;
}

/** Validates a group page (#63 A1/A3/A4/A6): no page-level `anatomy` and no `relatedPages` (a group page renders no Related list, so it is reported as unused); every `parent` resolves
 *  either to a same-page member (checked for cycles, the same guard `validateFamily` already
 *  lifts) or — A3's cross-page case — to a member known catalog-wide (`otherMemberIds`), never to
 *  neither; member and alias ids unique catalog-wide, with no privileged "whole" exemption (a group
 *  has none); and `anatomy` set only on a top-level member (one with no parent, or whose parent
 *  isn't one of this page's own members), naming only that member's own descendants on this page.
 *  Returns `[]` for a page without `members`. Mirrors `validateFamily`'s own contract and the same
 *  `allPageIds`/`otherMemberIds` meaning (every *other* page's/member's id in the catalog). */
export function validateGroupIssues(page: GroupPageLike, allPageIds: ReadonlySet<string>, otherMemberIds: ReadonlySet<string>): GroupIssue[] {
  const { members } = page;
  if (!members || members.length === 0) return [];
  const issues: GroupIssue[] = [];
  const shapeIssue = (message: string) => issues.push({ rule: 'family-invalid', message });
  const anatomyIssue = (message: string) => issues.push({ rule: 'group-anatomy-member', message });
  const byId = new Map(members.map((m) => [m.id, m]));

  for (const message of blankMemberTitles('Group', page.id, members)) shapeIssue(message);

  if (page.anatomy !== undefined) {
    shapeIssue(`Group "${page.id}": page-level "anatomy" is not used on a group page — move it to the relevant top-level member instead.`);
  }

  if (page.relatedPages && page.relatedPages.length > 0) {
    shapeIssue(`Group "${page.id}": "relatedPages" is not used on a group page (it renders no Related list) — name the related page in a member's "related" text or "composedOf" instead.`);
  }

  for (const m of members) {
    if (m.parent === undefined) continue;
    if (!byId.has(m.parent) && !otherMemberIds.has(m.parent)) {
      shapeIssue(`Group "${page.id}": member "${m.id}" has an unknown parent "${m.parent}".`);
      continue;
    }
    // Lifted verbatim from `validateFamily`'s own cycle guard: `byId.get(current)?.parent` already
    // degrades to `undefined` (loop ends, no cycle) the moment `current` resolves off this page —
    // exactly A3's cross-page top-level case, so no change is needed for that case here.
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
    if (cycle) shapeIssue(`Group "${page.id}": member "${m.id}" has a parent cycle.`);
  }

  const seenInPage = new Set<string>();
  const checkId = (id: string, isMemberOrMemberAlias = true) => {
    // `allPageIds` excludes this page, and `resolveRoute` matches page ids before aliases — so a
    // member (or its alias) named like its own page could never be addressed.
    if (isMemberOrMemberAlias && id === page.id) shapeIssue(`Group "${page.id}": id "${id}" collides with this group page's own id.`);
    if (seenInPage.has(id)) shapeIssue(`Group "${page.id}": id "${id}" is used more than once on this page.`);
    seenInPage.add(id);
    if (allPageIds.has(id)) shapeIssue(`Group "${page.id}": id "${id}" collides with another page's id.`);
    if (otherMemberIds.has(id)) shapeIssue(`Group "${page.id}": id "${id}" collides with another member or alias elsewhere in the catalog.`);
  };
  for (const m of members) {
    checkId(m.id);
    for (const alias of m.aliases ?? []) checkId(alias);
  }
  for (const alias of page.aliases ?? []) checkId(alias, false);

  // A3/A4: a top-level member has no parent, or a parent not among this page's own members
  // (resolved cross-page above). `anatomy` is only ever meaningful there.
  const isTopLevel = (m: GroupMemberLike) => m.parent === undefined || !byId.has(m.parent);
  const descendantsOf = (topLevelId: string): Set<string> => {
    const result = new Set<string>();
    const stack = [topLevelId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const m of members) {
        if (m.parent === current && m.id !== topLevelId && !result.has(m.id)) {
          result.add(m.id);
          stack.push(m.id);
        }
      }
    }
    return result;
  };
  for (const m of members) {
    if (!m.anatomy) continue;
    if (!isTopLevel(m)) {
      anatomyIssue(`Group "${page.id}": member "${m.id}" has "anatomy", but anatomy is only used on a top-level member.`);
      continue;
    }
    const descendants = descendantsOf(m.id);
    const seenAnatomyMembers = new Set<string>();
    for (const group of m.anatomy.groups) {
      for (const item of group.items) {
        if (!('member' in item)) continue;
        if (item.member === m.id) {
          anatomyIssue(`Group "${page.id}": member "${m.id}": anatomy item "${item.member}" names itself.`);
          continue;
        }
        if (!descendants.has(item.member)) {
          anatomyIssue(`Group "${page.id}": member "${m.id}": anatomy item "${item.member}" is not one of its descendants on this page.`);
          continue;
        }
        if (seenAnatomyMembers.has(item.member)) {
          anatomyIssue(`Group "${page.id}": member "${m.id}": anatomy lists member "${item.member}" more than once.`);
          continue;
        }
        seenAnatomyMembers.add(item.member);
      }
    }
  }

  return issues;
}

export function validateGroup(page: GroupPageLike, allPageIds: ReadonlySet<string>, otherMemberIds: ReadonlySet<string>): string[] {
  return validateGroupIssues(page, allPageIds, otherMemberIds).map((issue) => issue.message);
}

/** #63 A5/A6: where one catalog member id lives — every page that declares it as one of its own
 *  `members` (never an alias), whether that page is itself a group page, and that member's own
 *  `parent`. Built catalog-wide, once, by the caller (`buildCatalogSections`'s own pre-pass, or
 *  `cli/doctor.ts`'s equivalent over `StaticPage[]`) — never a second, independent registry. */
export interface MemberLocation {
  pageId: string;
  isGroupPage: boolean;
  parent?: string;
}

/** #63 A5/A6: resolves one family `inWhole` section id that is not one of that family's own
 *  `members` — a candidate external part — against `owners`, every catalog location that id
 *  resolves to as a real member. Exactly one owner, itself a group page, whose own `parent` equals
 *  `familyWhole`, is the only success; anything else is the validation issue A6 requires (zero or
 *  multiple owners, an owner that isn't a group page, or a parent that doesn't match). Pure and
 *  catalog-shape-agnostic — shared between `buildCatalogSections` (runtime) and `cli/doctor.ts`
 *  (static), which each build `owners` from their own page representation. */
export function resolveExternalPart(
  id: string,
  owners: ReadonlyArray<MemberLocation>,
  familyWhole: string,
): { pageId: string } | { issue: string } {
  if (owners.length === 0) return { issue: `"${id}" is not a member of this page, and is not defined on any group page either.` };
  if (owners.length > 1) {
    return { issue: `"${id}" is defined as a member on more than one page (${owners.map((o) => o.pageId).join(', ')}).` };
  }
  const [owner] = owners;
  if (!owner.isGroupPage) return { issue: `"${id}" is a member of "${owner.pageId}", which is not a group page.` };
  if (owner.parent !== familyWhole) {
    return { issue: `"${id}"'s parent on "${owner.pageId}" ("${owner.parent ?? 'none'}") does not equal this family's whole "${familyWhole}".` };
  }
  return { pageId: owner.pageId };
}

/** One `sidebarParent` problem, tied to the page that declares it. */
export interface SidebarParentIssue {
  page: string;
  message: string;
}

/** Checks every page's `sidebarParent`: it must name a real page (not the page itself) in the same
 *  group, and that parent must not be nested itself — the sidebar nests one level only. A page's
 *  group is compared only when both pages' groups are known (`doctor` cannot always read one).
 *  Pure, so the viewer's development console and `doctor` report the same problems. */
export function validateSidebarParents(
  pages: ReadonlyArray<{ id: string; group?: string; sidebarParent?: string; navigation?: 'browse' | 'reference' }>,
): SidebarParentIssue[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const issues: SidebarParentIssue[] = [];
  for (const page of pages) {
    if (page.sidebarParent === undefined) continue;
    const parentId = page.sidebarParent;
    if (parentId === page.id) {
      issues.push({ page: page.id, message: `Page "${page.id}": sidebarParent names the page itself.` });
      continue;
    }
    const parent = byId.get(parentId);
    if (!parent) {
      issues.push({ page: page.id, message: `Page "${page.id}": sidebarParent "${parentId}" is not a page id.` });
      continue;
    }
    if (page.group !== undefined && parent.group !== undefined && page.group !== parent.group) {
      issues.push({ page: page.id, message: `Page "${page.id}": sidebarParent "${parentId}" is in the group "${parent.group}", not "${page.group}". A child sits under its parent in the sidebar, so both must share a group.` });
      continue;
    }
    if (parent.navigation === 'reference') {
      issues.push({ page: page.id, message: `Page "${page.id}": sidebarParent "${parentId}" is not listed in the sidebar (it is a navigation: 'reference' page), so there is no row to nest under.` });
      continue;
    }
    if (parent.sidebarParent !== undefined) {
      issues.push({ page: page.id, message: `Page "${page.id}": sidebarParent "${parentId}" is itself listed under "${parent.sidebarParent}". The sidebar nests one level only.` });
    }
  }
  return issues;
}

/** One `documents` problem, tied to the page that declares it. */
export interface DocumentsIssue {
  page: string;
  message: string;
}

/** Checks every page's `documents`: each entry names a real component (`componentNames`, when the
 *  caller knows them), has a non-blank title, is listed once, is documented by one page only, has no
 *  component page of its own, and does not reuse an id or alias another page or member already owns.
 *  A family or group page (one with `members`) cannot document components this way. Pure, so the
 *  viewer's development console and `doctor` report the same problems. */
export function validateDocuments(
  pages: ReadonlyArray<{ id: string; component?: string; documents?: ReadonlyArray<{ component: string; title: string }>; members?: ReadonlyArray<{ id: string; component?: string; aliases?: string[] }>; aliases?: string[]; tokenDefinition?: { sections?: ReadonlyArray<{ aliases?: string[] }> } }>,
  componentNames?: ReadonlySet<string>,
): DocumentsIssue[] {
  const issues: DocumentsIssue[] = [];
  const documentedBy = new Map<string, string>();
  // The component each page is the component page of: its own `component` (default: its id), or
  // each member's `component` on a family or group page.
  const ownPages = new Map<string, string>();
  const claimedIds = new Map<string, string>();
  for (const page of pages) {
    const hasMembers = page.members !== undefined && page.members.length > 0;
    if (hasMembers) {
      for (const member of page.members!) {
        if (member.component) ownPages.set(member.component, page.id);
        claimedIds.set(member.id, page.id);
        for (const alias of member.aliases ?? []) claimedIds.set(alias, page.id);
      }
    } else if (!page.documents || page.documents.length === 0 || page.component !== undefined) {
      ownPages.set(page.component ?? page.id, page.id);
    }
    for (const alias of page.aliases ?? []) claimedIds.set(alias, page.id);
    for (const section of page.tokenDefinition?.sections ?? []) for (const alias of section.aliases ?? []) claimedIds.set(alias, page.id);
  }
  const pageIds = new Map(pages.map((page) => [page.id, page.id]));
  for (const page of pages) {
    if (!page.documents || page.documents.length === 0) continue;
    const here = (message: string) => issues.push({ page: page.id, message: `Page "${page.id}": ${message}` });
    if (page.members && page.members.length > 0) here('"documents" is not used on a family or group page — move the component to a member, or to a token page.');
    const seen = new Set<string>();
    for (const entry of page.documents) {
      if (typeof entry.title !== 'string' || entry.title.trim() === '') here(`documents entry "${entry.component}" has a blank title — give it the name links and search should show.`);
      if (seen.has(entry.component)) {
        here(`documents lists "${entry.component}" more than once.`);
        continue;
      }
      seen.add(entry.component);
      if (componentNames && !componentNames.has(entry.component)) {
        here(`documents entry "${entry.component}" is not a component export of this project (check the name, and that the config's "exclude" does not drop it).`);
        continue;
      }
      const other = documentedBy.get(entry.component);
      if (other !== undefined) {
        here(`documents entry "${entry.component}" is already documented by page "${other}" — a component belongs to one page.`);
        continue;
      }
      documentedBy.set(entry.component, page.id);
      const own = ownPages.get(entry.component);
      if (own !== undefined) {
        here(`documents entry "${entry.component}" also has its own page ("${own}") — keep one: remove the entry, or the component's own page.`);
        continue;
      }
      const claimed = claimedIds.get(entry.component);
      if (claimed !== undefined) here(`documents entry "${entry.component}" collides with an id or alias on page "${claimed}".`);
      else if (pageIds.has(entry.component)) here(`documents entry "${entry.component}" collides with a page id.`);
    }
  }
  return issues;
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
    // A token page's `documents` own their components too, so none gets a "No examples documented."
    // stub page of its own.
    for (const entry of page.documents ?? []) documented.add(entry.component);
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
    ...pages.flatMap((page) => (page.documents ?? []).map((entry) => entry.component)),
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
    // A documented component is an exact address of its own (a tile on the documenting page).
    for (const entry of page.documents ?? []) canonicalMemberIdByAlias.set(entry.component, entry.component);
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
  // page's ids. #64 B5: also a tokenDefinition page's own `aliases` and each of its sections' own
  // `aliases` (extending this same catalog-wide pool to tokenDefinition pages).
  const allPageIds = new Set(pages.map((page) => page.id));
  const familyIdsByPage = new Map<TId, Set<string>>();
  for (const page of pages) {
    if (!page.members && !page.tokenDefinition && !(page.documents && page.documents.length > 0)) continue;
    const ids = new Set<string>();
    for (const entry of page.documents ?? []) ids.add(entry.component);
    for (const member of page.members ?? []) {
      ids.add(member.id);
      for (const alias of member.aliases ?? []) ids.add(alias);
    }
    for (const alias of page.aliases ?? []) ids.add(alias);
    for (const section of page.tokenDefinition?.sections ?? []) for (const alias of section.aliases ?? []) ids.add(alias);
    familyIdsByPage.set(page.id, ids);
  }

  // #63 A5/A6: catalog-wide — where every member id lives, so each family's `inWhole` sections can
  // tell an external part (a group-page member) from a genuinely unknown id. Built once, up front,
  // the same way `familyIdsByPage` already is above.
  const memberLocations = new Map<string, MemberLocation[]>();
  for (const p of pages) {
    const pHasMembers = p.members !== undefined && p.members.length > 0;
    const pIsGroup = pHasMembers && p.whole === undefined && p.sections === undefined;
    for (const member of p.members ?? []) {
      memberLocations.set(member.id, [...(memberLocations.get(member.id) ?? []), { pageId: p.id, isGroupPage: pIsGroup, parent: member.parent }]);
    }
  }

  // #63 A5: resolved once, per valid family, before the per-page pass below assembles any section
  // — never by mutating an already-built section a second time (per the controller's own decision).
  // `outlineByFamily` is this same pre-pass's own `numberFor` call, including a synthetic stub
  // (`parent: page.whole`) per resolved external id so `numberFor`'s existing authored-order scan
  // (which already walks each `inWhole` section's own `members` list) numbers it exactly like an
  // own part, with no change to `numberFor` itself.
  const externalIssues: string[] = [];
  const externalPartsByFamily = new Map<TId, Map<string, { pageId: TId; title: string; fidelity?: CatalogMember['fidelity'] }>>();
  const partOfByMemberId = new Map<string, { pageId: TId; title: string; number: string }>();
  const outlineByFamily = new Map<TId, Map<string, { number: string; level: number }>>();
  for (const page of pages) {
    const pHasMembers = page.members !== undefined && page.members.length > 0;
    if (!pHasMembers || page.whole === undefined || page.sections === undefined) continue; // not a valid family.
    const byIdThisPage = new Set(page.members!.map((m) => m.id));
    const externalResolutions = new Map<string, { pageId: TId }>();
    for (const section of page.sections) {
      if (!section.inWhole) continue;
      for (const id of section.members) {
        if (byIdThisPage.has(id) || externalResolutions.has(id)) continue;
        const owners = memberLocations.get(id);
        if (!owners) continue; // genuinely unknown — `validateFamily`'s own "not a member" error covers it.
        const resolution = resolveExternalPart(id, owners, page.whole);
        if ('issue' in resolution) externalIssues.push(`Family "${page.id}": ${resolution.issue}`);
        else externalResolutions.set(id, { pageId: resolution.pageId as TId });
      }
    }
    const membersForNumbering = [...page.members!, ...[...externalResolutions.keys()].map((id) => ({ id, parent: page.whole }))];
    const outline = numberFor({ ...page, members: membersForNumbering });
    outlineByFamily.set(page.id, outline);
    if (externalResolutions.size === 0) continue;
    const familyTitle = String(page.title ?? page.id);
    const externalMap = new Map<string, { pageId: TId; title: string; fidelity?: CatalogMember['fidelity'] }>();
    for (const [id, resolution] of externalResolutions) {
      const ownerPage = pages.find((p) => p.id === resolution.pageId);
      externalMap.set(id, {
        pageId: resolution.pageId,
        title: String(ownerPage?.title ?? resolution.pageId),
        fidelity: ownerPage?.members?.find((m) => m.id === id)?.fidelity,
      });
      const number = outline.get(id)?.number;
      if (number) partOfByMemberId.set(id, { pageId: page.id, title: familyTitle, number });
    }
    externalPartsByFamily.set(page.id, externalMap);
  }
  if ((globalThis as { __DEV__?: boolean }).__DEV__) {
    for (const issueMsg of externalIssues) console.error(`[Catalog] ${issueMsg}`);
  }

  // #64 B4: every page whose `tokenDefinition.kind` matches another page's — one page per kind.
  const tokenKindPages = new Map<TokenKind, TId[]>();
  for (const page of pages) {
    if (!page.tokenDefinition) continue;
    tokenKindPages.set(page.tokenDefinition.kind, [...(tokenKindPages.get(page.tokenDefinition.kind) ?? []), page.id]);
  }

  // Design §4 "duplicate-page-id" rule's viewer-side equivalent — this is the one place in the
  // whole viewer that already resolves every page's id to build sections/groups, so it costs
  // nothing extra to also notice two pages claiming the same one (`sectionsById` in
  // `CatalogShell.tsx` would otherwise just let the last one silently win).
  const seenIds = new Set<TId>();
  if ((globalThis as { __DEV__?: boolean }).__DEV__) {
    for (const parentIssue of validateSidebarParents(pages)) console.error(`[Catalog] ${parentIssue.message}`);
  }
  if ((globalThis as { __DEV__?: boolean }).__DEV__) {
    for (const documentsIssue of validateDocuments(pages, new Set(componentByName.keys()))) console.error(`[Catalog] ${documentsIssue.message}`);
  }
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
      if (page.anatomy && !(page.members && page.members.length > 0)) {
        for (const group of page.anatomy.groups) {
          for (const anatomyItem of group.items) {
            if ('member' in anatomyItem) console.warn(`[Catalog] ${page.id}: anatomy item "${anatomyItem.member}" names a member, but this page has no members, so it shows as a plain row without a pin. Use "other" for a component documented elsewhere.`);
          }
        }
      }
      const unusedRelated = relatedPagesUnusedMessage(page);
      if (unusedRelated) console.warn(`[Catalog] ${unusedRelated}`);
      // V2d item 4: the same validation, per family member's own `composedOf`.
      for (const member of page.members ?? []) {
        for (const issue of validateComposedOf(member.composedOf, knownComposedOfNames)) {
          console.warn(`[Catalog] ${page.id}.${member.id}: ${issue}`);
        }
      }
      if (page.tokenDefinition) {
        // #64 B4: one page per kind — mirrors `cli/doctor.ts`'s `token-definition-duplicate-kind`.
        const samekind = (tokenKindPages.get(page.tokenDefinition.kind) ?? []).filter((id) => id !== page.id);
        if (samekind.length > 0) {
          console.error(`[Catalog] ${page.id}: tokenDefinition kind "${page.tokenDefinition.kind}" is also used by ${samekind.join(', ')}.`);
        }
        // #64 B5: a tokenDefinition page's own page-level/section aliases join the same
        // catalog-wide "one owner" pool a family's own ids/aliases already check against —
        // mirrors `cli/doctor.ts`'s own `checkTokenDefinitionAliases` (rule id `family-invalid`).
        const otherPageIdsForTokenDef = new Set<string>([...allPageIds].filter((id) => id !== page.id));
        const otherIdsForTokenDef = new Set<string>();
        for (const [id, ids] of familyIdsByPage) if (id !== page.id) for (const x of ids) otherIdsForTokenDef.add(x);
        const seenAliases = new Set<string>();
        const checkTokenDefAlias = (alias: string) => {
          if (seenAliases.has(alias)) console.error(`[Catalog] Page "${page.id}": id "${alias}" is used more than once on this page.`);
          seenAliases.add(alias);
          if (otherPageIdsForTokenDef.has(alias)) console.error(`[Catalog] Page "${page.id}": id "${alias}" collides with another page's id.`);
          if (otherIdsForTokenDef.has(alias)) console.error(`[Catalog] Page "${page.id}": id "${alias}" collides with another member or alias elsewhere in the catalog.`);
        };
        for (const alias of page.aliases ?? []) checkTokenDefAlias(alias);
        for (const section of page.tokenDefinition.sections) for (const alias of section.aliases ?? []) checkTokenDefAlias(alias);
      }
    }
    const hasMembers = page.members !== undefined && page.members.length > 0;
    // #63 A1: a page with neither `whole` nor `sections` is a group, not a family; a page with
    // exactly one of the two stays the same family-shape error `validateFamily` already reports,
    // via `isFamily` (unchanged from before this field existed).
    const isGroup = hasMembers && page.whole === undefined && page.sections === undefined;
    const isFamily = hasMembers && !isGroup;
    const componentName = hasMembers ? undefined : (page.component ?? page.id);
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
      const externalPartIds = new Set(externalPartsByFamily.get(page.id)?.keys() ?? []);
      const issues = validateFamily({ ...page, members, anatomy: page.anatomy, relatedPages: page.relatedPages }, otherPageIds, otherMemberIds, externalPartIds);
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
        // #63 A5: the pre-pass above already ran `numberFor` with every valid external part's
        // synthetic stub included; the "exactly one of whole/sections" invalid shape never reaches
        // that pre-pass, so it falls back to the same plain `numberFor(page)` call this always was.
        outline: outlineByFamily.get(page.id) ?? numberFor(page),
        notShown: page.notShown,
        aliases: page.aliases,
        apiLabel: page.apiLabel,
        anatomy: page.anatomy,
        relatedPages: page.relatedPages,
        externalParts: externalPartsByFamily.get(page.id),
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
    } else if (isGroup) {
      const otherPageIds = new Set([...allPageIds].filter((id) => id !== page.id));
      const otherMemberIds = new Set<string>();
      for (const [id, ids] of familyIdsByPage) if (id !== page.id) for (const memberId of ids) otherMemberIds.add(memberId);
      const groupMembers = page.members!.map((member) => ({
        ...member,
        hasSpecimens: Boolean(member.variants?.items?.length || member.states?.items?.length || member.comparison),
      }));
      const groupIssues = validateGroup({ id: page.id, members: groupMembers, aliases: page.aliases, anatomy: page.anatomy, relatedPages: page.relatedPages }, otherPageIds, otherMemberIds);
      if ((globalThis as { __DEV__?: boolean }).__DEV__) {
        for (const issue of groupIssues) console.error(`[Catalog] ${issue}`);
      }
      // #63 A4: one top-level member is any member with no parent, or whose parent isn't one of
      // this page's own members (A3's cross-page case) — its own parts are numbered independently
      // of every other top-level member's (`numberForGroupMember`), then merged into one outline
      // map the same shape a family's own `outline` already has.
      const byIdThisPage = new Set(page.members!.map((m) => m.id));
      const groupOutline = new Map<string, { number: string; level: number }>();
      for (const m of page.members!) {
        if (m.parent !== undefined && byIdThisPage.has(m.parent)) continue; // not top-level.
        for (const [id, entry] of numberForGroupMember(m.id, page.members!)) groupOutline.set(id, entry);
      }
      const pageMemberIds = new Set(page.members!.map((m) => m.id));
      family = {
        kind: 'group',
        whole: undefined,
        sections: [],
        outline: groupOutline,
        notShown: page.notShown,
        aliases: page.aliases,
        apiLabel: page.apiLabel,
        relatedPages: page.relatedPages,
        members: page.members!.map((member) => {
          const memberComponent = member.component ? componentByName.get(member.component) : undefined;
          const alsoUsedBy = dedupeAlsoUsedBy(usedByTarget.get(member.id) ?? [], pageMemberIds);
          const partOf = partOfByMemberId.get(member.id);
          return {
            ...member,
            props: memberComponent ? mergePropNotes(memberComponent, undefined) : undefined,
            path: memberComponent?.file ?? member.source,
            alsoUsedBy,
            ...(partOf ? { partOf } : {}),
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
      notes: page.notes,
      variants: page.variants,
      states: page.states,
      render: page.render,
      // `tokenSections` makes a page a token gallery by itself.
      tokenGallery: derivedTokenDefinition?.tokenGallery ?? (page.tokenGallery || (page.tokenSections !== undefined && page.tokenSections.length > 0) || undefined),
      tokenSections: derivedTokenDefinition?.tokenSections ?? page.tokenSections,
      // #61: the real entry data `SectionBlock.tsx` renders instead of the placeholder sections
      // above, when set — see `SectionDef.tokenDefinition`'s own doc comment.
      tokenDefinition: page.tokenDefinition,
      // #64 B5: extends `page.aliases` to a tokenDefinition page too (see `SectionDef.tokenDefinitionAliases`).
      tokenDefinitionAliases: page.tokenDefinition ? page.aliases : undefined,
      tokenColumns: page.tokenColumns,
      fullWidthLabel: page.fullWidthLabel,
      comparison: page.comparison,
      specimenSize: page.specimenSize,
      specimenSurface: page.specimenSurface,
      previewWidths: page.previewWidths,
      previewLayout: page.previewLayout,
      hide: component ? page.hide : { ...page.hide, props: true },
      composedOf: page.composedOf,
      ...(page.anatomy && !hasMembers ? { anatomy: page.anatomy } : {}),
      internalProps: page.internalProps,
      intentionalStaticPreview: page.intentionalStaticPreview,
      family,
      navigation: page.navigation,
      sidebarParent: page.sidebarParent,
      // Family and group pages alike carry their own component binding per member
      // (`FamilyDef.members[].component` isn't a field — a member names its binding via
      // `CatalogMember.component` itself); only a normal page's own single binding is surfaced here.
      component: hasMembers ? undefined : component?.name,
      // #60: see `SectionDef.alsoUsedBy` (rendered by `ReferenceDetails`'s `AlsoUsedByFact`) — a family or group
      // page's "also used by" lives per member instead (`family.members[].alsoUsedBy`, above).
      alsoUsedBy: hasMembers ? undefined : dedupeAlsoUsedBy(
        [...(usedByTarget.get(page.id) ?? []), ...(page.documents ?? []).flatMap((entry) => usedByTarget.get(entry.component) ?? [])],
        new Set([page.id]),
      ),
      ...(page.documents && page.documents.length > 0 && !hasMembers ? { documents: page.documents.map((entry) => ({ ...entry, path: componentByName.get(entry.component)?.file })) } : {}),
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
