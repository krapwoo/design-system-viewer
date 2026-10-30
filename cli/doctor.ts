import * as ts from 'typescript';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ComponentRecord, ResolvedConfig } from './types.ts';
import type { StaticAnatomyShape, StaticPage } from './staticPage.ts';
import { discoverAllPageFiles, resolvePageId } from './pageIndex.ts';
import { readHostTsconfigOptions } from './props.ts';
import { importedNames, readStaticPages } from './staticPage.ts';
import { resolveGlob } from './glob.ts';
import { sync } from './sync.ts';
import { gridColumnLimit, isGridAxisLabel, listGeometry, MATRIX_LAYOUT, presentationBlocks } from '../native/catalog/comparison.ts';
import { memberBlocks, toSectionDef } from './explain.ts';
import type { SpecimenSize } from '../native/catalog/types.ts';
import {
  relatedPagesUnusedMessage, resolveExternalPart, validateComposedOf, validateFamily, validateGroupIssues,
  type FamilyPageLike, type GroupPageLike, type MemberLocation,
} from '../native/catalog/pageApi.ts';
import { canonicalTokenTitle, findDuplicateIds, isTokenKind } from '../native/catalog/tokenDefinition.ts';
import type { StaticTokenDefinition } from './tokenDefinition.ts';
import type { UsageData } from '../native/catalog/usage.ts';

/** `hint` is advisory only: printed, in `--json`, counted on its own, and never failing `--ci` or
 *  promoted by `doctor.strict` (which promotes `warning` alone). */
export type DoctorSeverity = 'error' | 'warning' | 'hint';

export interface DoctorIssue {
  id: string;
  severity: DoctorSeverity;
  /** A page's resolved id (design §2's `id ?? component ?? file stem`) — absent for an issue that
   *  isn't tied to one page (`props-unreadable`, `no-token-modules`). */
  page?: string;
  file?: string;
  /** Populated only by `checkPageTypeErrors` below, from the diagnostic's own source position;
   *  every other rule leaves this `undefined` (see this task's own resolved-scope note above). */
  line?: number;
  message: string;
  fix: string;
}

function issue(fields: DoctorIssue): DoctorIssue {
  return fields;
}

function pageRef(page: StaticPage): { page: string; file: string } {
  return { page: resolvePageId(page, page.file), file: page.file };
}

/** Errata (controller, binding): a page discovered from a component folder (a `components` glob's
 *  folder, not a `pages` glob) with no explicit `component:` documents the component named by its
 *  own file (design §2; the viewer already applies this same default via `page.component ??
 *  page.id`, and the generated page index already defaults a missing `id` to the file stem). A
 *  page from a standalone `pages` glob is never touched — `componentFolders` only ever contains
 *  folders resolved from `config.components`, so a standalone page's own folder is never a member.
 *  A family page (non-empty `members`) is also never touched — same exemption the runtime applies
 *  at `pageApi.ts`'s `buildCatalogSections` (`page.members && page.members.length > 0` skips the
 *  `page.component ?? page.id` fallback entirely): a family's own guidance/examples always live on
 *  its members, never on the page itself, so a documentation-only whole (its file stem naming no
 *  real component export) must never be assigned one here either. */
export function applyComponentDefaults(pages: StaticPage[], componentFolders: Set<string>): StaticPage[] {
  return pages.map((page) =>
    page.component === undefined && componentFolders.has(path.dirname(page.file)) && !(page.members && page.members.length > 0)
      ? { ...page, component: resolvePageId(page, page.file) }
      : page,
  );
}

function checkParseErrors(pages: StaticPage[]): DoctorIssue[] {
  return pages
    .filter((p): p is StaticPage & { parseError: string } => Boolean(p.parseError))
    .map((p) => issue({ id: 'page-parse-error', severity: 'error', file: p.file, message: `Failed to parse: ${p.parseError}`, fix: 'Fix the syntax error, then rerun doctor.' }));
}

function checkNotCheckable(pages: StaticPage[]): DoctorIssue[] {
  return pages
    .filter((p) => !p.checkable && !p.parseError)
    .map((p) => issue({
      id: 'page-not-checkable', severity: 'warning', ...pageRef(p),
      message: 'Page not statically checkable — some of its layout data is not a literal doctor can read.',
      fix: 'Write rows/columns/items/propNotes as literal arrays/objects (or a same-file const), not a function call.',
    }));
}

function checkComponentExportRemoved(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const names = new Set(components.map((c) => c.name));
  return pages
    .filter((p) => p.component && !names.has(p.component))
    .map((p) => issue({
      id: 'component-export-removed', severity: 'error', ...pageRef(p),
      message: `Documents "${p.component}", which no longer exists as a component export.`,
      fix: 'Delete this page, or update "component" to the export\'s new name.',
    }));
}

/** True when a page documents at least one example by any mechanism design §4 recognizes — a
 *  grid, a `variants` item, a `states` item, or `render`. A page can be "fully covered" by
 *  `checkComponentExportRemoved`'s standard (it names a real component) and still have none of
 *  these — e.g. `init`'s own "Needs examples" draft, which sets only `component`/`group`/
 *  `description` — in which case the viewer shows the exact same "No examples documented." an
 *  undocumented component would. */
function pageHasExamples(page: StaticPage): boolean {
  return Boolean(page.comparison) || Boolean(page.variantsItems?.length) || Boolean(page.statesItems?.length) || page.hasRender === true || Boolean(page.tokenSectionTitles?.length);
}

function checkComponentNoExamples(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const byComponent = new Map<string, StaticPage[]>();
  // Plan V3: "a component documented only as a member counts as documented" — any family member
  // naming a component (regardless of which page, or whether that specific member has its own
  // examples — a member with none gets its own `component-no-examples` from `checkFamilyMembers`
  // instead) is enough to clear the component-wide "no catalog page at all" half of this rule.
  const documentedByMember = new Set<string>();
  for (const page of pages) {
    if (page.component) byComponent.set(page.component, [...(byComponent.get(page.component) ?? []), page]);
    for (const member of page.members ?? []) if (member.component) documentedByMember.add(member.component);
  }
  return components
    .filter((c) => {
      if (documentedByMember.has(c.name)) return false;
      const componentPages = byComponent.get(c.name) ?? [];
      // A not-statically-checkable page is given the benefit of the doubt here — it might have
      // real examples this reader simply couldn't read (Global Constraint: never a partial read;
      // its own `page-not-checkable` warning already covers it). Only "every page is checkable
      // and genuinely empty" (or "no page at all") fires this rule.
      return componentPages.length === 0 || componentPages.every((p) => p.checkable && !pageHasExamples(p));
    })
    .map((c) => {
      const hasPage = (byComponent.get(c.name) ?? []).length > 0;
      return issue({
        id: 'component-no-examples', severity: 'warning', page: c.name, file: c.file,
        message: hasPage
          ? `"${c.name}" has a catalog page with no variants, states, comparison, or render — it will show "No examples documented."`
          : `"${c.name}" has no catalog page — it will show "No examples documented."`,
        fix: hasPage ? `Add variants/states/comparison, or render, to ${c.name}'s catalog page.` : `Add ${c.name}.catalog.tsx beside ${c.name}'s own file.`,
      });
    });
}

/** Plan V3: the same two advisories `checkComponentPages` gives a page-level `component` —
 *  missing guidance/accessibility, and no examples — evaluated per component-bound member of a
 *  family page instead, with the member id in the message. A documentation-only member (no
 *  `component`) is exempt from all three. V2c item 9: a member whose `component` no longer
 *  resolves to a real export gets its own `component-export-removed` error here (below), naming
 *  the member, instead of being silently exempted. */
function checkFamilyMembers(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const componentsByName = new Map(components.map((c) => [c.name, c]));
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    // V2c item 6: the same "is this really a family page" predicate the runtime uses
    // (`pageApi.ts`'s `page.members && page.members.length > 0`) — an empty `members` array is a
    // normal, single-component page, never a family.
    if (!page.members || page.members.length === 0 || !page.checkable) continue; // never a partial read — see checkGridAxisKeys's own note.
    const ref = pageRef(page);
    // Members in a `list` section render as folded rows without specimens, so asking them for
    // examples would contradict `family-invalid`'s list-section rule.
    const listMemberIds = new Set((page.sections ?? []).filter((s) => s.kind === 'list').flatMap((s) => s.members));
    for (const member of page.members) {
      if (!member.component) continue; // documentation-only — exempt.
      // V2c item 9: a member naming a component that no longer exists — reported here rather than
      // silently exempted from every advisory (its props would also silently vanish at runtime).
      if (!componentsByName.has(member.component)) {
        issues.push(issue({
          id: 'component-export-removed', severity: 'error', ...ref,
          message: `Member "${member.id}" documents "${member.component}", which no longer exists as a component export.`,
          fix: `Delete this member, or update its "component" to the export's new name.`,
        }));
        continue;
      }
      if (!member.hasWhenToUse) {
        issues.push(issue({
          id: 'missing-guidance-or-a11y', severity: 'warning', ...ref,
          message: `Member "${member.id}": no "whenToUse" guidance documented.`,
          fix: `Add a one-sentence whenToUse note for "${member.id}", or omit it only when there genuinely is none.`,
        }));
      }
      if (!member.hasA11y) {
        issues.push(issue({
          id: 'missing-guidance-or-a11y', severity: 'warning', ...ref,
          message: `Member "${member.id}": no "a11y" notes documented.`,
          fix: `Add a one-sentence a11y note for "${member.id}", grounded in its real behavior.`,
        }));
      }
      if (!member.hasExamples && !listMemberIds.has(member.id)) {
        issues.push(issue({
          id: 'component-no-examples', severity: 'warning', ...ref,
          message: `Member "${member.id}" ("${member.component}") has no variants, states, or comparison — it will show no specimen.`,
          fix: `Add variants/states/comparison to the "${member.id}" member.`,
        }));
      }
    }
  }
  return issues;
}

/** #64 B5: every id/alias one page itself registers — a family's member ids/aliases plus its own
 *  page-level `aliases` (the existing universe `checkFamilyValidity` already built inline), now
 *  also including a tokenDefinition page's own `aliases` and each of its sections' own `aliases`
 *  (extending routing/uniqueness to tokenDefinition pages — #64 B5's own requirement). Keyed by
 *  each page's own resolved id; a page contributing nothing is simply absent, same as before. */
function idsRegisteredByPage(pages: StaticPage[]): Map<string, Set<string>> {
  const byId = new Map<string, Set<string>>();
  // I-B (independent review, confirmation pass): built from every page with members, not only
  // checkable ones — the same precedent `checkMemberComposedOf` above already follows for
  // `knownNames` (no `checkable` filter). A non-checkable family page still contributes a working
  // link at runtime (`pageApi.ts`'s `otherMemberIds` has no `checkable` concept either), so
  // excluding it here turned a valid `relatedPages` entry into a false CI-failing error.
  for (const page of pages) {
    const hasMembers = Boolean(page.members && page.members.length > 0);
    if (!hasMembers && !page.tokenDefinition) continue;
    const id = resolvePageId(page, page.file);
    const ids = new Set<string>();
    for (const member of page.members ?? []) {
      ids.add(member.id);
      for (const alias of member.aliases ?? []) ids.add(alias);
    }
    for (const alias of page.aliases ?? []) ids.add(alias);
    for (const section of page.tokenDefinition?.sections ?? []) for (const alias of section.aliases ?? []) ids.add(alias);
    byId.set(id, ids);
  }
  return byId;
}

/** Review F9: a page authored with neither `whole` nor `sections` — by presence (`hasWhole` /
 *  `hasSections`), never by value, so a family whose `whole`/`sections` isn't a literal (and is
 *  therefore left unset, non-checkable) is never mistaken for a group page. A hand-built
 *  `StaticPage` without the flags falls back to whether the value is set. */
function isGroupShape(p: StaticPage): boolean {
  return !(p.hasWhole ?? p.whole !== undefined) && !(p.hasSections ?? p.sections !== undefined);
}

/** #63 A5/A6: the static-side equivalent of `buildCatalogSections`'s own external-part pre-pass —
 *  built from `StaticPage[]` instead of the runtime catalog, but the same `resolveExternalPart`
 *  rule (imported, never reimplemented). Returns, per family page id, the external part ids it
 *  resolved (fed into `validateFamily`'s own `externalPartIds` exemption below) and every
 *  resolution problem as its own `family-external-part` finding. */
function collectExternalParts(pages: StaticPage[]): { externalPartIdsByPage: Map<string, Set<string>>; issues: DoctorIssue[] } {
  const memberLocations = new Map<string, MemberLocation[]>();
  for (const p of pages) {
    const pHasMembers = Boolean(p.members && p.members.length > 0);
    const pIsGroup = pHasMembers && isGroupShape(p);
    for (const member of p.members ?? []) {
      memberLocations.set(member.id, [...(memberLocations.get(member.id) ?? []), { pageId: resolvePageId(p, p.file), isGroupPage: pIsGroup, parent: member.parent }]);
    }
  }
  const externalPartIdsByPage = new Map<string, Set<string>>();
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    const hasMembers = Boolean(page.members && page.members.length > 0);
    if (!hasMembers || page.whole === undefined || page.sections === undefined || !page.checkable) continue; // not a valid family.
    const id = resolvePageId(page, page.file);
    const byIdThisPage = new Set(page.members!.map((m) => m.id));
    const external = new Set<string>();
    for (const section of page.sections) {
      if (!section.inWhole) continue;
      for (const memberId of section.members) {
        if (byIdThisPage.has(memberId) || external.has(memberId)) continue;
        const owners = memberLocations.get(memberId);
        if (!owners) continue; // genuinely unknown — `family-invalid`'s own "not a member" already covers it.
        const resolution = resolveExternalPart(memberId, owners, page.whole);
        if ('issue' in resolution) {
          issues.push(issue({
            id: 'family-external-part', severity: 'error', ...pageRef(page),
            message: `Family "${id}": ${resolution.issue}`,
            fix: 'Make the id resolve to exactly one group page\'s member, with that member\'s own "parent" equal to this family\'s "whole".',
          }));
        } else {
          external.add(memberId);
        }
      }
    }
    if (external.size > 0) externalPartIdsByPage.set(id, external);
  }
  return { externalPartIdsByPage, issues };
}

/** Plan V3's `family-invalid`: reuses `native/catalog/pageApi.ts`'s own `validateFamily` —
 *  the exact same rule `pageApi.ts`'s `buildCatalogSections` runs at runtime — against every
 *  checkable family page, with the same catalog-wide "every other page/member id" contract that
 *  function already takes. N3: `StaticPage.sections` already carries each section's real
 *  `label`/`kind`, so `validateFamily`'s messages name the real section (never an empty label),
 *  and its N6 list-section rule can tell a `list` section from a `blocks` one. #63 A5: a page with
 *  neither `whole` nor `sections` (a group) is still included in `familyPages` below, but
 *  `validateFamily` is now a no-op for it (see its own doc comment) — `checkGroupValidity` is its
 *  real validator. */
function checkFamilyValidity(pages: StaticPage[]): DoctorIssue[] {
  // V2c item 6: `members.length > 0`, the same predicate the runtime uses — an empty array is not
  // a family page.
  const familyPages = pages.filter((p) => p.members && p.members.length > 0 && p.checkable);
  const allPageIds = new Set(pages.map((p) => resolvePageId(p, p.file)));
  const familyIdsByPageId = idsRegisteredByPage(pages);
  const { externalPartIdsByPage, issues: externalIssues } = collectExternalParts(pages);

  const issues: DoctorIssue[] = [...externalIssues];
  for (const page of familyPages) {
    const id = resolvePageId(page, page.file);
    const otherPageIds = new Set([...allPageIds].filter((pageId) => pageId !== id));
    const otherMemberIds = new Set<string>();
    for (const [pageId, ids] of familyIdsByPageId) if (pageId !== id) for (const memberId of ids) otherMemberIds.add(memberId);

    const pageLike: FamilyPageLike = {
      id,
      whole: page.whole,
      // `validateFamily` does read `inWhole` now (`pageApi.ts:277`, C1's narrowing).
      // `StaticFamilySection.inWhole` is optional (unlike the real `CatalogMemberSection`) only so
      // hand-built test fixtures don't all need one, so this defaults a missing one to `false` —
      // the lenient direction (an unreadable `inWhole` must never manufacture a false "has no
      // number" the day `anatomy` joins the static read) rather than passing `undefined` where
      // `validateFamily`'s own type expects a boolean.
      sections: page.sections?.map((s) => ({ ...s, inWhole: s.inWhole ?? false })),
      members: (page.members ?? []).map((m) => ({ id: m.id, parent: m.parent, aliases: m.aliases, hasSpecimens: m.hasExamples })),
      aliases: page.aliases,
      // I2: passed through so an unresolvable or self-naming `relatedPages` entry is reported here
      // too, the same precedent `checkMemberComposedOf` below already follows for `composedOf` —
      // not only ever silently warned in a browser console (`npm run check:catalog`).
      relatedPages: page.relatedPages,
    };
    const externalPartIds = externalPartIdsByPage.get(id) ?? new Set<string>();
    for (const message of validateFamily(pageLike, otherPageIds, otherMemberIds, externalPartIds)) {
      issues.push(issue({ id: 'family-invalid', severity: 'error', ...pageRef(page), message, fix: 'Fix the family\'s members/whole/sections to satisfy the rule above.' }));
    }
  }
  return issues;
}

/** #63 A1/A3/A4/A6: the static-side equivalent of `buildCatalogSections`'s own `validateGroup`
 *  call, against every checkable group page (`members` with no `whole`/`sections`). Reuses the
 *  `family-invalid` rule id for every shape error (same class the family-shaped version already
 *  reports under), and the new `group-anatomy-member` rule id only for an embedded anatomy
 *  problem (A4) — per the controller's own decision. */
function checkGroupValidity(pages: StaticPage[]): DoctorIssue[] {
  const groupPages = pages.filter((p) => p.members && p.members.length > 0 && isGroupShape(p) && p.checkable);
  const allPageIds = new Set(pages.map((p) => resolvePageId(p, p.file)));
  const familyIdsByPageId = idsRegisteredByPage(pages);

  const issues: DoctorIssue[] = [];
  for (const page of groupPages) {
    const id = resolvePageId(page, page.file);
    const otherPageIds = new Set([...allPageIds].filter((pageId) => pageId !== id));
    const otherMemberIds = new Set<string>();
    for (const [pageId, ids] of familyIdsByPageId) if (pageId !== id) for (const memberId of ids) otherMemberIds.add(memberId);

    const pageLike: GroupPageLike = {
      id,
      members: (page.members ?? []).map((m) => ({
        id: m.id,
        parent: m.parent,
        aliases: m.aliases,
        anatomy: m.anatomy ? { groups: [{ label: '', items: m.anatomy.memberIds.map((memberId) => ({ member: memberId, description: '' })) }] } : undefined,
      })),
      aliases: page.aliases,
      anatomy: page.hasAnatomy ? {} : undefined,
      relatedPages: page.relatedPages,
    };
    for (const { rule, message } of validateGroupIssues(pageLike, otherPageIds, otherMemberIds)) {
      const isAnatomyRule = rule === 'group-anatomy-member';
      issues.push(issue({
        id: rule,
        severity: 'error', ...pageRef(page), message,
        fix: isAnatomyRule
          ? 'Name only this member\'s own descendants on this page, and set "anatomy" only on a top-level member.'
          : 'Fix the group\'s members/aliases/anatomy to satisfy the rule above.',
      }));
    }
  }
  return issues;
}

/** Deprecation (`relatedPages`): a family page still using one or more non-`inWhole` sections to
 *  document a merely-related component inline, instead of giving it its own page and naming it in
 *  the page's `relatedPages` list. One finding per page (never per section), naming every member
 *  still parked in a deprecated section so the author can act without opening the file. Always a
 *  warning — `inWhole: false` keeps working. */
function checkDeprecatedRelatedSections(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.members || page.members.length === 0 || !page.checkable) continue; // V2c item 6's own predicate.
    // Strictly `false`, never `!s.inWhole` — a test fixture (or any other caller) that omits
    // `inWhole` entirely means "not testing this", not "deprecated".
    const deprecated = (page.sections ?? []).filter((s) => s.inWhole === false);
    if (deprecated.length === 0) continue;
    const memberIds = deprecated.flatMap((s) => s.members);
    const id = resolvePageId(page, page.file);
    issues.push(issue({
      id: 'deprecated-related-section', severity: 'warning', ...pageRef(page),
      message: `Family "${id}" documents ${memberIds.length} member${memberIds.length === 1 ? '' : 's'} (${memberIds.join(', ')}) in a deprecated non-"inWhole" section.`,
      fix: `Give each of these members its own catalog page, drop the non-"inWhole" section, and name its new page in "${id}"'s relatedPages instead.`,
    }));
  }
  return issues;
}

/** V2d item 5: resolves each family member's own `composedOf` the same way `buildCatalogSections`
 *  resolves it at runtime (`native/catalog/pageApi.ts`'s own `validateComposedOf`, imported
 *  directly — the subpath-import boundary that once made importing that file from `dist/cli/`
 *  unsafe is gone), against the same known-name universe `checkFamilyValidity` already builds for
 *  member ids — every real component name, every page id, and every member id across the whole
 *  catalog — so an unknown name is reported here too, not only ever silently warned in a browser
 *  console (`npm run check:catalog`). A member whose `composedOf` wasn't itself literally readable
 *  (`undefined`) has nothing to check — the same "never a partial read" leniency the page-level
 *  field already gets. Always a warning, the same severity the runtime's own console warning
 *  carries, never an error. N8: also accepts a member alias and a page-level alias — the same
 *  universe `FamilyPage`'s own link resolution (`aliasTargets`) already accepts. */
function checkMemberComposedOf(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const knownNames = new Set<string>(components.map((c) => c.name));
  for (const page of pages) knownNames.add(resolvePageId(page, page.file));
  for (const page of pages) for (const member of page.members ?? []) knownNames.add(member.id);
  for (const page of pages) for (const member of page.members ?? []) for (const alias of member.aliases ?? []) knownNames.add(alias);
  for (const page of pages) for (const alias of page.aliases ?? []) knownNames.add(alias);

  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.members || page.members.length === 0 || !page.checkable) continue; // V2c item 6's own predicate.
    const ref = pageRef(page);
    for (const member of page.members) {
      for (const message of validateComposedOf(member.composedOf, knownNames)) {
        issues.push(issue({
          id: 'composed-of-unknown', severity: 'warning', ...ref,
          message: `Member "${member.id}": ${message}`,
          fix: 'Correct the name, or add { component: \'...\', role: \'...\', relationship: \'...\' } for a component/page/member that really does exist.',
        }));
      }
    }
  }
  return issues;
}

function checkDuplicatePageId(pages: StaticPage[]): DoctorIssue[] {
  const byId = new Map<string, StaticPage[]>();
  for (const page of pages) {
    const id = resolvePageId(page, page.file);
    byId.set(id, [...(byId.get(id) ?? []), page]);
  }
  const issues: DoctorIssue[] = [];
  for (const [id, group] of byId) {
    if (group.length < 2) continue;
    for (const page of group) {
      const others = group.filter((p) => p !== page).map((p) => p.file).join(', ');
      issues.push(issue({
        id: 'duplicate-page-id', severity: 'error', page: id, file: page.file,
        message: `Page id "${id}" is also used by ${others}.`,
        fix: 'Give one of these pages its own "id".',
      }));
    }
  }
  return issues;
}

function checkGridAxisKeys(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    // Global Constraints: "never a partial read" — a not-checkable page gets only
    // `page-not-checkable` (`checkNotCheckable` above); a *different* field on it happening to be
    // literal (e.g. its grid, while its `propNotes` wasn't) is never grounds for a second opinion.
    if (!page.checkable || !page.comparison) continue;
    for (const [axisName, axis] of [['row', page.comparison.rows], ['column', page.comparison.columns]] as const) {
      const seen = new Set<string>();
      for (const item of axis.items) {
        if (item.key === '') {
          issues.push(issue({ id: 'grid-axis-key-invalid', severity: 'error', ...pageRef(page), message: `A ${axisName} has an empty key.`, fix: `Give every ${axisName} a non-empty, unique key.` }));
        } else if (seen.has(item.key)) {
          issues.push(issue({ id: 'grid-axis-key-invalid', severity: 'error', ...pageRef(page), message: `Duplicate ${axisName} key "${item.key}".`, fix: `Give each ${axisName} its own key.` }));
        }
        seen.add(item.key);
      }
    }
  }
  return issues;
}

function checkGridColumnLimit(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.checkable || !page.comparison) continue; // same "never a partial read" reasoning as checkGridAxisKeys above.
    const size = (page.comparison.size ?? page.specimenSize ?? 'regular') as SpecimenSize;
    const limit = gridColumnLimit(size);
    const count = page.comparison.columns.items.length;
    if (count > limit) {
      issues.push(issue({
        id: 'grid-column-limit', severity: 'error', ...pageRef(page),
        message: `Grid has ${count} columns; at most ${limit} ${size} columns fit a 1280px laptop.`,
        fix: 'Swap the axes, use two lists, or pick a smaller specimenSize.',
      }));
    }
  }
  return issues;
}

/** Guided intelligence design §2 / plan Task 3 — `degenerate-grid-axis`: warns (never errors) when
 *  a grid's row or column axis has exactly one item — it then reads as a one-axis list, not a real
 *  two-axis comparison. Deliberately its own, separate advisory from the existing hard grid-validity
 *  errors above (`grid-axis-key-invalid`, `grid-column-limit`): authors keep full authority to leave
 *  it as authored; this never silently rewrites the matrix and never promotes to an error. */
function checkDegenerateGridAxis(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.checkable || !page.comparison) continue; // never a partial read — see checkGridAxisKeys's own note.
    const { rows, columns } = page.comparison;
    for (const [axisName, axis] of [['row', rows], ['column', columns]] as const) {
      if (axis.items.length === 1) {
        issues.push(issue({
          id: 'degenerate-grid-axis', severity: 'warning', ...pageRef(page),
          message: `This grid's ${axisName} axis has only 1 item; it reads as a one-axis list, not a two-axis comparison.`,
          fix: `If this axis genuinely only ever has one value, consider a Variants/States list instead; otherwise add more items to it.`,
        }));
      }
    }
  }
  return issues;
}

/** `comparison-hides-variants`: a `comparison` grid replaces the page's (or member's) Variants
 *  list, and only keeps `variants.axis` as its heading when that names one of the grid's own axes.
 *  A page that authors both with an axis the grid doesn't cover loses those variants from the page
 *  with nothing saying so (the first is still the Overview thumbnail). A warning, since the author
 *  may simply have left the variants behind, or kept them for the thumbnail. Skipped when either
 *  side couldn't be read literally — never a partial read — and for a page with `hide.variants`,
 *  which shows neither the grid nor the variants (a member has no `hide`). */
function checkComparisonHidesVariants(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  const check = (
    ref: { page: string; file: string },
    owner: string,
    hasVariants: boolean,
    axis: string | undefined,
    axisUnreadable: boolean | undefined,
    labels: { rowLabel?: string; columnLabel?: string } | undefined,
  ) => {
    if (!hasVariants || !labels || axisUnreadable) return;
    const { rowLabel, columnLabel } = labels;
    if (rowLabel === undefined || columnLabel === undefined) return;
    if (isGridAxisLabel(axis, rowLabel, columnLabel)) return;
    issues.push(issue({
      id: 'comparison-hides-variants', severity: 'warning', ...ref,
      message: `${owner}'s variants${axis ? ` (${axis})` : ''} are not shown on the page: its comparison grid replaces them and covers ${rowLabel} × ${columnLabel}. The first is still the Overview thumbnail.`,
      fix: `Fold the variants into the grid, move them to a member of their own, set variants.axis to "${rowLabel}" or "${columnLabel}" if they are one of the grid's axes, or remove them if they are only there for the thumbnail.`,
    }));
  };
  for (const page of pages) {
    if (!page.checkable) continue; // never a partial read — see checkGridAxisKeys's own note.
    const ref = pageRef(page);
    if (!page.hideVariants) check(ref, `"${ref.page}"`, Boolean(page.variantsItems?.length), page.variantsAxis, page.variantsAxisUnreadable, page.comparison);
    for (const member of page.members ?? []) {
      check(ref, `Member "${member.id}"`, Boolean(member.variantsItems?.length), member.variantsAxis, member.variantsAxisUnreadable, member.comparison);
    }
  }
  return issues;
}

/** Guided intelligence design §4 / plan Task 3 — `missing-composition-suggestion`: compares each
 *  documented component's optional, additive `composedOfCandidates` (`cli/props.ts`, real JSX
 *  source evidence) against the page's own authored `composedOf` names, and suggests — never
 *  confirms — a candidate the author hasn't named. Conservative by construction: a candidate's own
 *  `component`/`file`/`line` is all the message ever states, never an invented role or relationship
 *  (that stays the author's own call via `composedOf`). Never fires when `composedOf` was authored
 *  but isn't itself literally readable (`page.hasComposedOf && page.composedOf === undefined`) —
 *  the candidate might already be named there; this rule must never risk a false "missing" claim.
 *  Only suggests a name the viewer itself would accept in `composedOf` — a detected component or a
 *  page id (`buildCatalogSections`' own check); anything else (a plain helper such as a starter
 *  kit's `Icon`) would only trade this warning for an "unknown component" one. One issue per
 *  component per page, citing its first call site. */
function checkMissingComposition(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const componentsByName = new Map(components.map((c) => [c.name, c]));
  const knownNames = new Set<string>([...componentsByName.keys(), ...pages.map((p) => p.id).filter((id): id is string => Boolean(id))]);
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.component || !page.checkable) continue;
    if (page.hasComposedOf && page.composedOf === undefined) continue;
    const component = componentsByName.get(page.component);
    const candidates = component?.composedOfCandidates;
    if (!candidates || candidates.length === 0) continue;
    const authored = new Set((page.composedOf ?? []).map((entry) => entry.component));
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (authored.has(candidate.component) || !knownNames.has(candidate.component) || seen.has(candidate.component)) continue;
      seen.add(candidate.component);
      issues.push(issue({
        id: 'missing-composition-suggestion', severity: 'warning', ...pageRef(page),
        message: `"${component!.name}" renders "${candidate.component}" (${candidate.file}:${candidate.line}), which composedOf doesn't name.`,
        fix: `Add { component: '${candidate.component}', ... } to composedOf with the role/relationship you choose, if this reflects real composition — or leave it if it's incidental.`,
      }));
    }
  }
  return issues;
}

/** #66: a page is a family or group (it has `members`) — presence, so a page whose `members` could
 *  not be read is still never treated as a plain page. */
function hasMembers(page: StaticPage): boolean {
  return page.hasMembers === true || Boolean(page.members && page.members.length > 0);
}

/** #66: a token page — a `tokenDefinition`, a token gallery, or token sections, by presence. */
function isTokenPage(page: StaticPage): boolean {
  return page.hasTokenDefinition === true || page.tokenDefinition !== undefined || page.tokenGallery === true
    || page.hasExplicitTokenGallery === true || page.hasExplicitTokenSections === true || Boolean(page.tokenSectionTitles?.length);
}

/** #66: a non-blank `standalone` reason opts a page out of `part-own-page` and `nothing-to-show`. */
function hasStandaloneReason(page: StaticPage): boolean {
  return page.standalone !== undefined && page.standalone.trim() !== '';
}

/** #66: the pages `part-own-page` considers — readable, plain (no members, not a token page),
 *  browse-listed, and without a recorded `standalone` reason. */
function isStructureCandidate(page: StaticPage): boolean {
  return page.checkable && !hasMembers(page) && !isTokenPage(page) && page.navigation !== 'reference' && !hasStandaloneReason(page);
}

/** #66: the default `patternGroups` — the starter kit's own group for example screens. */
export const DEFAULT_PATTERN_GROUPS: readonly string[] = ['Patterns'];

/** #66: whether a page sits in a pattern group (case-insensitive). A pattern page uses components; it
 *  is never the whole they are parts of. */
function isPatternPage(page: StaticPage, patternGroups: readonly string[]): boolean {
  const group = page.group?.trim().toLowerCase();
  return group !== undefined && patternGroups.some((name) => name.trim().toLowerCase() === group);
}

/** #66 `standalone-reason-empty`: a `standalone` that is blank or whitespace records no reason, so it
 *  is not an opt-out. */
function checkStandaloneReason(pages: StaticPage[]): DoctorIssue[] {
  return pages
    .filter((page) => page.standalone !== undefined && page.standalone.trim() === '')
    .map((page) => issue({
      id: 'standalone-reason-empty', severity: 'warning', ...pageRef(page),
      message: '`standalone` is empty, so it does not opt this page out of the structure checks.',
      fix: "Write the reason, e.g. standalone: 'Not a part of GitFileCard; it draws its own counts.', or remove the field.",
    }));
}

/** #66: one page's use of another component, from its own page-level `composedOf` or from one of
 *  its family/group members' `composedOf` (families keep composition on their members). */
interface StructureUse { host: StaticPage; relationship?: string }

/** #66: every page that uses one of `names`, excluding `self`, deduplicated by host page (a page
 *  counts once however many of its entries name the component). A built-in entry anywhere on the
 *  host wins over a non-built-in one. */
function usesOf(pages: StaticPage[], self: StaticPage, names: ReadonlySet<string>): StructureUse[] {
  const byHost = new Map<StaticPage, StructureUse>();
  for (const host of pages) {
    if (host === self) continue;
    const entries = [...(host.composedOf ?? []), ...(host.members ?? []).flatMap((member) => member.composedOf ?? [])];
    for (const entry of entries) {
      if (!names.has(entry.component)) continue;
      const known = byHost.get(host);
      if (!known || (known.relationship !== 'built-in' && entry.relationship === 'built-in')) byHost.set(host, { host, relationship: entry.relationship });
    }
  }
  return [...byHost.values()];
}

/** #66: the names a page answers to — its id and its component. */
function pageNames(page: StaticPage): Set<string> {
  return new Set([resolvePageId(page, page.file), ...(page.component ? [page.component] : [])]);
}

/** #66: whether some other page has composition this reader couldn't read — a page-level or
 *  member-level `composedOf`, or a `members` list that wasn't read at all — so "only" and "nothing
 *  uses it" can't be claimed outright. */
function hasUnreadableComposition(pages: StaticPage[], self: StaticPage): boolean {
  return pages.some((other) => other !== self && (
    (other.hasComposedOf === true && other.composedOf === undefined)
    || (other.hasMembers === true && other.members === undefined)
    || Boolean(other.members?.some((member) => member.hasComposedOf === true && member.composedOf === undefined))
  ));
}

const pageList = (pages: StaticPage[]): string => [...new Set(pages.map((p) => `\`${resolvePageId(p, p.file)}\``))].join(', ');

/** #66 `part-own-page`: a candidate page whose component is declared `{ relationship: 'built-in' }`
 *  (at page or member level) by exactly one other non-pattern page, which doesn't already list it
 *  as a member (by member id, component or alias). Two or more users can't give it one owner, so it
 *  is exempt; `slot`/`related`/missing/non-literal relationships never count. Reports; never infers
 *  an owner or a relationship. */
function checkPartOwnPage(pages: StaticPage[], patternGroups: readonly string[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!isStructureCandidate(page)) continue;
    const names = pageNames(page);
    const owners = usesOf(pages, page, names)
      .filter((use) => use.relationship === 'built-in' && !isPatternPage(use.host, patternGroups))
      .map((use) => use.host);
    if (owners.length !== 1) continue;
    const owner = owners[0];
    if (owner.members?.some((member) => names.has(member.id) || (member.component !== undefined && names.has(member.component))
      || member.aliases?.some((alias) => names.has(alias)))) continue;
    const ownerId = resolvePageId(owner, owner.file);
    const id = resolvePageId(page, page.file);
    const caveat = hasUnreadableComposition(pages, page) ? ' (Some pages\' `composedOf` could not be read, so another user may exist.)' : '';
    issues.push(issue({
      id: 'part-own-page', severity: 'warning', ...pageRef(page),
      message: `\`${id}\` is a built-in part of \`${ownerId}\` only, but has its own page.${caveat}`,
      fix: `List it as a part in ${ownerId}'s family (\`members\`/\`sections\`), or set \`standalone: '<reason>'\` if it is not really part of ${ownerId}.`,
    }));
  }
  return issues;
}

/** #66: the pages `nothing-to-show` considers — readable, not a token page, browse-listed and without
 *  a recorded `standalone` reason. Unlike the other structure rule, a family or group page (`members`)
 *  is a candidate too. */
function isNothingToShowCandidate(page: StaticPage): boolean {
  return page.checkable && !isTokenPage(page) && page.navigation !== 'reference' && !hasStandaloneReason(page);
}

/** #66 `nothing-to-show`: a candidate page with no variants, states, comparison or `render`. A family
 *  or group page is flagged only when it AND every member show nothing (a member's own `variants`,
 *  `states` or `comparison`; members have no `render`). A page this reader could not fully read —
 *  members included — is never a candidate (`checkable`), so "nothing" is only claimed about a page
 *  that was read in full. `previewWidths` alone is not content: it only sizes `render`. */
function checkNothingToShow(pages: StaticPage[], patternGroups: readonly string[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!isNothingToShowCandidate(page)) continue;
    const hasSpecimens = Boolean(page.comparison) || Boolean(page.variantsItems?.length) || Boolean(page.statesItems?.length) || page.hasRender === true
      || Boolean(page.members?.some((member) => member.hasExamples));
    if (hasSpecimens) continue;
    const id = resolvePageId(page, page.file);
    const hosts = usesOf(pages, page, pageNames(page)).map((use) => use.host);
    const users = hosts.filter((host) => !isPatternPage(host, patternGroups));
    const patternUsers = hosts.filter((host) => isPatternPage(host, patternGroups));
    const unreadable = hasUnreadableComposition(pages, page);
    const base = { id: 'nothing-to-show' as const, severity: 'warning' as const, ...pageRef(page) };
    const fix = 'Add a specimen, list it as a documentation-only part of a page that uses it, or remove the page (record why in your own docs).';
    if (users.length > 0) {
      const alsoPatterns = patternUsers.length > 0 ? ` Pattern pages also use it (${pageList(patternUsers)}).` : '';
      issues.push(issue({ ...base,
        message: `\`${id}\` shows no specimens. It is used by ${pageList(users)}.${alsoPatterns}`,
        fix,
      }));
    } else if (patternUsers.length > 0) {
      issues.push(issue({ ...base, message: `\`${id}\` shows no specimens. Only pattern pages use it (${pageList(patternUsers)}).`, fix }));
    } else {
      issues.push(issue({ ...base,
        message: unreadable
          ? `\`${id}\` shows no specimens, and no page whose \`composedOf\` doctor could read uses it.`
          : `\`${id}\` shows no specimens and no other page uses it.`,
        fix,
      }));
    }
  }
  return issues;
}

/** `usage-unknown-page` (U4/U5): a key in the usage file that names no page id, page component,
 *  family/group member id or member component — and no detected component, since the viewer gives
 *  one without a page its own stub page, which does show that key's usage. Such a key's numbers
 *  are never displayed, usually because a component was renamed. Not tied to one page, so it is
 *  listed under "General". */
function checkUsageUnknownPage(pages: StaticPage[], components: ComponentRecord[], usage: UsageData): DoctorIssue[] {
  const known = new Set<string>(components.map((component) => component.name));
  for (const page of pages) {
    known.add(resolvePageId(page, page.file));
    if (page.component) known.add(page.component);
    for (const member of page.members ?? []) {
      known.add(member.id);
      if (member.component) known.add(member.component);
    }
  }
  return Object.keys(usage.components)
    .filter((key) => !known.has(key))
    .map((key) =>
      issue({
        id: 'usage-unknown-page',
        severity: 'warning',
        message: `Usage key "${key}" matches no page id, component, or family member id, so its usage is not shown.`,
        fix: 'Rename the key in the usage file to a page id, component or member id from the catalog, or remove it.',
      }),
    );
}

/** The viewer exports that frame an example as a phone (or another bounded document), so an
 *  overlay that portals to the document body opens inside it instead of over the catalog. */
const DEVICE_FRAME_EXPORTS = ['PhoneFrame', 'OverlayDemo', 'PhoneScreen', 'BoundedOverlayViewport'];

/** Whether a component's own source imports React Native's `Modal` (by its imported name, so an
 *  alias still counts and an unrelated local `Modal` doesn't). Conservative by design: it can't see
 *  `import * as RN`, a re-exported `Modal`, or a Modal opened by a sub-component. */
function importsModal(file: string): boolean {
  try {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    return [...importedNames(source, 'react-native').values()].includes('Modal');
  } catch {
    return false;
  }
}

/** `overlay-without-device-frame`: a page whose component opens a React Native `Modal` (which
 *  portals to the document body on the web, covering the whole catalog) but whose page imports no
 *  device frame. A page whose imports couldn't be read is skipped, never assumed unframed.
 *  V2c item 3 (CLI side): deliberately exempts a family member's own `component` — this check
 *  keys off `page.component`/`page.viewerImports` (the page file's own top-level imports), neither
 *  of which a family page sets; a member naming a Modal-opening component would need its OWN
 *  device-frame-import evidence, which `cli/staticPage.ts`'s member reader doesn't currently carry.
 *  Left as a gap rather than guessed at — a family member wrapping a Modal in a device frame is
 *  rare enough (and the resulting miss only an advisory, never an error) that this is the smallest
 *  honest fix here. */
export function checkOverlaysFramed(pages: StaticPage[], components: ComponentRecord[], projectRoot: string): DoctorIssue[] {
  const byName = new Map(components.map((c) => [c.name, c]));
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.component || page.viewerImports === undefined) continue;
    if (page.viewerImports.some((name) => DEVICE_FRAME_EXPORTS.includes(name))) continue;
    const component = byName.get(page.component);
    if (!component || !importsModal(path.resolve(projectRoot, component.file))) continue;
    issues.push(issue({
      id: 'overlay-without-device-frame', severity: 'warning', ...pageRef(page),
      message: `"${component.name}" opens a React Native Modal, which covers the whole catalog page unless its example is inside a phone.`,
      fix: 'Wrap the example in <PhoneFrame> (or use <OverlayDemo>), so it opens inside the phone.',
    }));
  }
  return issues;
}

/** A function-typed prop's printed type always contains `=>` (`cli/props.ts`'s own displayed type
 *  strings — "(value: string) => void", "() => void", …); a plain data prop's never does. */
function isFunctionPropType(type: string): boolean {
  return type.includes('=>');
}

/** Guided intelligence design §3 / plan Task 3 — finds a component's controlled state/event pair:
 *  a non-function prop `x` paired with a function-typed prop named `onXChange` (PascalCase), or the
 *  universal `value`/`onChange` pair. "Confidently identifiable" by naming convention alone — never
 *  a claim about actual behavior (that's `checkMissingWorkingPreview`'s own job, from the page's
 *  examples). Undefined when no such pair exists. */
function findControlledPair(component: ComponentRecord): { valueProp: string; changeProp: string } | undefined {
  for (const prop of component.props) {
    if (isFunctionPropType(prop.type)) continue;
    const expectedChangeProp = prop.name === 'value' ? 'onChange' : `on${prop.name.charAt(0).toUpperCase()}${prop.name.slice(1)}Change`;
    const changeProp = component.props.find((p) => p.name === expectedChangeProp);
    if (changeProp && isFunctionPropType(changeProp.type)) return { valueProp: prop.name, changeProp: changeProp.name };
  }
  return undefined;
}

/** Guided intelligence design §3 / plan Task 3 — `missing-working-preview`: recommends a real,
 *  stateful preview only when BOTH hold: the documented component has a controlled state/event pair
 *  (`findControlledPair`), AND every example that directly renders it (`nodeDirectComponent`)
 *  confidently demonstrates a fixed value with a no-op/omitted callback. Conservative by
 *  construction — never fires when:
 *   - the page already has its own `render()` (design's own escape hatch for live demos, never
 *     statically inspectable here);
 *   - the author declared `intentionalStaticPreview` with a reason (tolerated, not overridden);
 *   - any example is a confidently-identified genuine stateful wrapper (`nodeStatefulWrapper`) —
 *     positive evidence the page is already interactive;
 *   - no example directly renders the component at all, or any direct example's value/callback is
 *     `'unknown'` — genuinely uncheckable, and "uncheckable" must never be reported as "inert".
 *  Never a newly-fatal gate: always a warning, same as every other advisory in this file. */
/** A component page whose only examples are a free-form `render()` preview: nothing is named, so
 *  the reader sees one picture instead of the component's real variants and states, and several
 *  other rules here (`missing-working-preview`, the option-coverage rules) are skipped because
 *  they have no named example to read. A token gallery is exempt — raw token data has no variants
 *  — and so is a page that says `intentionalStaticPreview` with a reason. */
function checkPreviewOnlyPages(pages: StaticPage[]): DoctorIssue[] {
  return pages
    .filter((page) =>
      page.component !== undefined && page.checkable && page.hasRender === true && !page.tokenGallery
      && !page.intentionalStaticPreviewReason
      && !page.comparison && !page.variantsItems?.length && !page.statesItems?.length && !page.tokenSectionTitles?.length)
    .map((page) => issue({
      id: 'preview-only-component-page', severity: 'warning', ...pageRef(page),
      message: `"${page.component}" is documented by a render() preview alone, with no named variants, states or comparison.`,
      fix: 'Give the page variants (and states, where they differ) naming each real configuration, so every example has a caption and the other checks can read them. Keep render() for token galleries and whole-page layouts.',
    }));
}

function checkMissingWorkingPreview(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const componentsByName = new Map(components.map((c) => [c.name, c]));
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.component || !page.checkable || page.hasRender) continue;
    if (page.intentionalStaticPreviewReason) continue;
    const component = componentsByName.get(page.component);
    if (!component) continue;
    const pair = findControlledPair(component);
    if (!pair) continue;
    const items = [...(page.variantsItems ?? []), ...(page.statesItems ?? [])];
    if (items.some((i) => i.nodeStatefulWrapper)) continue;
    const directItems = items.filter((i) => i.nodeDirectComponent === component.name);
    if (directItems.length === 0) continue;
    const allStaticInert = directItems.every((i) => {
      const valueAttr = i.nodeAttributes?.[pair.valueProp];
      const changeAttr = i.nodeAttributes?.[pair.changeProp];
      return valueAttr?.kind === 'literal' && (changeAttr === undefined || changeAttr.kind === 'no-op-callback');
    });
    if (!allStaticInert) continue;
    issues.push(issue({
      id: 'missing-working-preview', severity: 'warning', ...pageRef(page),
      message:
        `"${component.name}" has a controlled "${pair.valueProp}"/"${pair.changeProp}" pair, but every example passes a fixed "${pair.valueProp}" ` +
        'with no working callback.',
      fix: `Add a working example using local state (useState) that wires "${pair.valueProp}" to "${pair.changeProp}", ` +
        'or declare intentionalStaticPreview with a reason if the examples are deliberately static.',
    }));
  }
  return issues;
}

/** Everything that needs a page's own matching `ComponentRecord` to check: `propNotes`, bound
 *  axes, tagged list items, coverage, grouped-state matching, and guidance/a11y presence. One
 *  function because every one of these checks shares the same per-page `component`/`propsByName`
 *  lookup — splitting it further would only duplicate that lookup, not clarify anything. */
function checkComponentPages(pages: StaticPage[], components: ComponentRecord[]): DoctorIssue[] {
  const componentsByName = new Map(components.map((c) => [c.name, c]));
  const issues: DoctorIssue[] = [];

  for (const page of pages) {
    if (!page.component) continue;
    // Plan V3: a family page's own guidance always lives on its members, never on the page
    // itself — even if `applyComponentDefaults` (or, in principle, the author) ends up giving it
    // a page-level `component` matching a real export, this page-level advisory must still defer
    // entirely to `checkFamilyMembers`'s own per-member one. V2c item 6: `members.length > 0`,
    // the same predicate the runtime uses — an empty array is not a family page.
    if (page.members && page.members.length > 0) continue;
    if (!page.checkable) continue; // never a partial read — see checkGridAxisKeys's own note.
    const component = componentsByName.get(page.component);
    if (!component) continue; // already reported by checkComponentExportRemoved
    const ref = pageRef(page);
    const propsByName = new Map(component.props.map((p) => [p.name, p]));

    for (const key of page.propNoteKeys ?? []) {
      if (!propsByName.has(key)) {
        issues.push(issue({
          id: 'propnotes-prop-removed', severity: 'error', ...ref,
          message: `propNotes names "${key}", which is no longer a prop of ${component.name}.`,
          fix: `Delete the "${key}" entry from propNotes, or rename it to the prop's new name.`,
        }));
      }
    }

    if (page.comparison) {
      for (const [axisName, axis] of [['row', page.comparison.rows], ['column', page.comparison.columns]] as const) {
        if (axis.prop === undefined) continue;
        const prop = propsByName.get(axis.prop);
        if (!prop) {
          issues.push(issue({
            id: 'bound-axis-prop-removed', severity: 'error', ...ref,
            message: `The ${axisName} axis is bound to "${axis.prop}", which is no longer a prop of ${component.name}.`,
            fix: 'Update "prop" to the prop\'s new name, or unbind this axis.',
          }));
          continue;
        }
        if (!prop.options) {
          issues.push(issue({
            id: 'bound-axis-not-union', severity: 'error', ...ref,
            message: `The ${axisName} axis is bound to "${axis.prop}", which is not a string-literal-union prop.`,
            fix: 'Only a prop with a fixed set of string options can be bound; unbind this axis.',
          }));
          continue;
        }
        for (const item of axis.items) {
          if (!prop.options.includes(item.key)) {
            issues.push(issue({
              id: 'bound-option-removed', severity: 'error', ...ref,
              message: `The ${axisName} "${item.key}" is bound to "${axis.prop}", which no longer has that option.`,
              fix: `Delete this ${axisName}, or update its key to a current option of "${axis.prop}".`,
            }));
          }
        }
      }
    }

    const listItems = [...(page.variantsItems ?? []), ...(page.statesItems ?? [])];
    for (const item of listItems) {
      for (const [propName, value] of Object.entries(item.props ?? {})) {
        if (typeof value !== 'string') continue;
        const prop = propsByName.get(propName);
        if (!prop) {
          // A name missing from `props` is only real drift when the component has nothing
          // inherited to explain it — `component.props` deliberately omits a node_modules-declared
          // prop (cli/props.ts:200), so e.g. `autoCapitalize` on a `TextInput`-extending component
          // is expected to be absent here, not a removed prop (design: `inheritedFrom` summarises
          // those instead of listing them).
          if (component.inheritedFrom.length > 0) continue;
          // The tagged prop *name* itself no longer exists — arguably the same drift as
          // `bound-axis-prop-removed`, but a tagged list item (unlike a bound axis) has no
          // "prop" field of its own to report that id against, so it's reported here instead.
          // Previously silently skipped (`!prop?.options` was true for both "prop missing" and
          // "prop exists but isn't a union"), masking exactly the drift this rule exists to catch.
          issues.push(issue({
            id: 'bound-option-removed', severity: 'error', ...ref,
            message: `"${item.name}" is tagged props.${propName} = "${value}", but "${propName}" is no longer a prop of ${component.name}.`,
            fix: 'Delete the tag, or update it to a current prop name.',
          }));
          continue;
        }
        if (!prop.options || prop.options.includes(value)) continue;
        issues.push(issue({
          id: 'bound-option-removed', severity: 'error', ...ref,
          message: `"${item.name}" is tagged props.${propName} = "${value}", which is no longer an option of "${propName}".`,
          fix: 'Update the tagged value, or delete this item if the option no longer exists.',
        }));
      }
    }

    // Props the page declares as plumbing the reader never picks (with a reason) are not expected
    // to have an example per option; see `internalProps`.
    const internalProps = new Set(page.internalProps ?? []);
    // A misspelled key silently exempts nothing, so the author sees the warnings it was meant to
    // settle and no reason why — the same reasoning as propNotes' own key check.
    for (const name of internalProps) {
      // `component.props` deliberately omits a node_modules-declared prop (cli/props.ts), so an
      // inherited name such as `autoCapitalize` is expected to be absent rather than misspelled —
      // the same exemption the tagged-item check above makes.
      if (!propsByName.has(name) && component.inheritedFrom.length === 0) {
        issues.push(issue({
          id: 'internal-prop-unknown', severity: 'warning', ...ref,
          message: `internalProps names "${name}", which is not a prop of ${component.name}.`,
          fix: `Correct the spelling, or delete the "${name}" entry — it exempts nothing as written.`,
        }));
      }
    }
    for (const prop of component.props) {
      if (!prop.options || internalProps.has(prop.name)) continue;
      const covered = new Set<string>();
      if (page.comparison) {
        for (const axis of [page.comparison.rows, page.comparison.columns]) {
          if (axis.prop === prop.name) for (const item of axis.items) covered.add(item.key);
        }
      }
      for (const item of listItems) {
        const value = item.props?.[prop.name];
        if (typeof value === 'string') covered.add(value);
      }
      for (const option of prop.options.filter((o) => !covered.has(o))) {
        issues.push(issue({
          id: 'option-not-covered', severity: 'warning', ...ref,
          message: `"${prop.name}" option "${option}" has no bound or tagged example.`,
          fix: `Bind a grid axis to "${prop.name}", or add { props: { ${prop.name}: '${option}' } } to a variants/states item.`,
        }));
      }
    }

    const variantKeys = new Set((page.variantsItems ?? []).map((i) => i.key));
    for (const item of page.statesItems ?? []) {
      if (item.group !== undefined && !variantKeys.has(item.group)) {
        issues.push(issue({
          id: 'group-unmatched', severity: 'warning', ...ref,
          message: `"${item.name}" names group "${item.group}", which matches no variant key; it will show under "Other configurations".`,
          fix: 'Fix the group value, or remove it if this item isn\'t tied to a specific variant.',
        }));
      }
    }

    // Design §4 names this one rule, "missing guidance or accessibility notes" — one id, and (per
    // the controller) both halves: a missing `whenToUse` and a missing `a11y` each get their own
    // message under `missing-guidance-or-a11y`, since the viewer renders a visible placeholder
    // ("No usage guidance documented."/"No accessibility notes documented.") for either gap, not
    // just the second. Never invented content — both messages only ever point the author at
    // writing their own, real sentence.
    if (!page.tokenGallery && page.hasWhenToUse === false) {
      issues.push(issue({
        id: 'missing-guidance-or-a11y', severity: 'warning', ...ref,
        message: 'No "whenToUse" guidance documented.',
        fix: 'Add a one-sentence whenToUse note disambiguating this component from its closest look-alike(s), or omit it only when there genuinely is none.',
      }));
    }
    // `hide: { accessibility: true }` is a display choice, not an exemption from documenting the
    // component: hiding the section only removes the visible placeholder, so without this the gap
    // becomes invisible to both the reader and the doctor.
    if (!page.tokenGallery && page.hasA11y === false) {
      issues.push(issue({
        id: 'missing-guidance-or-a11y', severity: 'warning', ...ref,
        message: page.hidesAccessibility
          ? 'No "a11y" notes documented, and the page hides the accessibility section.'
          : 'No "a11y" notes documented.',
        fix: 'Add a one-sentence a11y note, grounded in the component\'s real behavior — even "no explicit handling beyond defaults" is better than leaving it blank.',
      }));
    }
  }
  return issues;
}

/** #61: errors for an opted-in `tokenDefinition` that is provably malformed, conflicts with an
 *  explicit legacy `render`/`tokenGallery`/`tokenSections`/`members` recipe on the same page, has a
 *  duplicate section id or a duplicate entry id within one section, or has an explicit page `title`
 *  that conflicts with its kind's canonical title (design R4's own severity list). A `tokenDefinition`
 *  that isn't itself statically readable (non-literal `kind`/`sections`) already made the whole page
 *  `checkable: false` in `cli/staticPage.ts` — `checkNotCheckable` reports that case as the established
 *  `page-not-checkable` warning; this rule only ever runs against a definition that WAS readable. */
/** Opted-in token pages whose sections take their entries from runtime imports — the intended
 *  authoring path, since values come from the app's own token modules. Doctor never executes them,
 *  so those sections are listed as not statically validated. Informational only, like the
 *  "unbound examples" count: it never becomes an issue, never changes the exit code, and is not
 *  promoted by `doctor.strict`. `undefined` when there are none, so legacy output is unchanged. */
function runtimeOnlyTokenSections(pages: StaticPage[]): { page: string; sections: string[] }[] | undefined {
  // #64 B1: a section counts as runtime-only when its own entries are opaque, OR its own `groups`
  // couldn't be read, OR any one group's own entries are opaque — groups are read the same
  // lenient way as a section's own entries (`cli/tokenDefinition.ts`'s own `readStaticTokenDefinition`).
  const isOpaque = (section: StaticTokenDefinition['sections'][number]) =>
    section.entriesOpaque || Boolean(section.groupsOpaque) || (section.groups ?? []).some((g) => g.entriesOpaque);
  const found = pages.flatMap((page) => {
    const sections = page.tokenDefinition?.sections.filter(isOpaque).map((section) => section.id) ?? [];
    return sections.length > 0 ? [{ page: resolvePageId(page, page.file), sections }] : [];
  });
  return found.length > 0 ? found : undefined;
}

function checkTokenDefinition(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.hasTokenDefinition || !page.tokenDefinition) continue;
    const ref = pageRef(page);
    const def = page.tokenDefinition;

    if (!isTokenKind(def.kind)) {
      issues.push(issue({
        id: 'token-definition-invalid-kind', severity: 'error', ...ref,
        message: `tokenDefinition has an unknown kind "${def.kind}".`,
        fix: 'Use one of: colors, typography, spacing, radius, dimensions, shadows, opacity, motion.',
      }));
      continue; // The canonical-title check below needs a valid kind to compare against.
    }

    if (page.hasRender) {
      issues.push(issue({ id: 'token-definition-conflict', severity: 'error', ...ref, message: 'tokenDefinition conflicts with this page\'s own "render".', fix: 'Remove one of them.' }));
    }
    if (page.hasExplicitTokenGallery) {
      issues.push(issue({ id: 'token-definition-conflict', severity: 'error', ...ref, message: 'tokenDefinition conflicts with this page\'s own "tokenGallery".', fix: 'Remove one of them.' }));
    }
    if (page.hasExplicitTokenSections) {
      issues.push(issue({ id: 'token-definition-conflict', severity: 'error', ...ref, message: 'tokenDefinition conflicts with this page\'s own "tokenSections".', fix: 'Remove one of them.' }));
    }
    if (page.hasMembers) {
      issues.push(issue({ id: 'token-definition-conflict', severity: 'error', ...ref, message: 'tokenDefinition conflicts with this page\'s own "members" (a family page).', fix: 'Remove one of them.' }));
    }
    if (page.title !== undefined && page.title !== canonicalTokenTitle(def.kind)) {
      issues.push(issue({
        id: 'token-definition-title-conflict', severity: 'error', ...ref,
        message: `tokenDefinition: title "${page.title}" conflicts with kind "${def.kind}" (expected "${canonicalTokenTitle(def.kind)}").`,
        fix: 'Omit "title" to use the kind\'s canonical title automatically, or change it to match.',
      }));
    }

    for (const id of findDuplicateIds(def.sections.map((s) => s.id))) {
      issues.push(issue({ id: 'token-definition-duplicate-id', severity: 'error', ...ref, message: `tokenDefinition has more than one section with id "${id}".`, fix: 'Give each section its own id.' }));
    }
    for (const section of def.sections) {
      for (const id of findDuplicateIds(section.entryIds)) {
        issues.push(issue({
          id: 'token-definition-duplicate-id', severity: 'error', ...ref,
          message: `tokenDefinition section "${section.id}" has more than one entry with id "${id}".`,
          fix: 'Give each entry within this section its own id (the same id may still be reused in a different section).',
        }));
      }
      // #64 B1: a section's own groups — group ids unique within the section, entry ids unique
      // within their own group (the same scoping `native/catalog/tokenDefinition.ts`'s own
      // `validateTokenDefinition` enforces at runtime).
      for (const id of findDuplicateIds((section.groups ?? []).map((g) => g.id))) {
        issues.push(issue({
          id: 'token-definition-duplicate-id', severity: 'error', ...ref,
          message: `tokenDefinition section "${section.id}" has more than one group with id "${id}".`,
          fix: 'Give each group within this section its own id.',
        }));
      }
      for (const group of section.groups ?? []) {
        for (const id of findDuplicateIds(group.entryIds)) {
          issues.push(issue({
            id: 'token-definition-duplicate-id', severity: 'error', ...ref,
            message: `tokenDefinition section "${section.id}" group "${group.id}" has more than one entry with id "${id}".`,
            fix: 'Give each entry within this group its own id (the same id may still be reused in a different group or in the section\'s own entries).',
          }));
        }
      }
    }
  }
  return issues;
}

/** #64 B4: a literal `tokenDefinition.kind` shared by two or more pages — one issue per page in
 *  the group (every one of them is reported, each naming the other page(s)). A page with no
 *  `tokenDefinition` at all is never involved. */
function checkTokenDefinitionDuplicateKind(pages: StaticPage[]): DoctorIssue[] {
  const byKind = new Map<string, StaticPage[]>();
  for (const page of pages) {
    if (!page.tokenDefinition) continue;
    const kind = page.tokenDefinition.kind;
    byKind.set(kind, [...(byKind.get(kind) ?? []), page]);
  }
  const issues: DoctorIssue[] = [];
  for (const [kind, group] of byKind) {
    if (group.length < 2) continue;
    for (const page of group) {
      const others = group.filter((p) => p !== page).map((p) => resolvePageId(p, p.file)).join(', ');
      issues.push(issue({
        id: 'token-definition-duplicate-kind', severity: 'error', ...pageRef(page),
        message: `tokenDefinition kind "${kind}" is also used by ${others}.`,
        fix: 'Give one of these pages its own kind, or merge them into one page.',
      }));
    }
  }
  return issues;
}

/** #64 B5: a tokenDefinition page's own page-level `aliases`, and each of its sections' own
 *  `aliases`, join the exact same catalog-wide "one owner" pool `family-invalid` already checks
 *  family ids/aliases against (`idsRegisteredByPage`) — reusing that rule id rather than adding a
 *  second alias-collision rule. */
function checkTokenDefinitionAliases(pages: StaticPage[]): DoctorIssue[] {
  const allPageIds = new Set(pages.map((p) => resolvePageId(p, p.file)));
  const idsByPage = idsRegisteredByPage(pages);
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.tokenDefinition) continue;
    const id = resolvePageId(page, page.file);
    const otherPageIds = new Set([...allPageIds].filter((pid) => pid !== id));
    const otherIds = new Set<string>();
    for (const [pid, ids] of idsByPage) if (pid !== id) for (const x of ids) otherIds.add(x);

    const seen = new Set<string>();
    const checkAlias = (alias: string) => {
      if (seen.has(alias)) {
        issues.push(issue({ id: 'family-invalid', severity: 'error', ...pageRef(page), message: `Page "${id}": id "${alias}" is used more than once on this page.`, fix: 'Give each alias its own name.' }));
      }
      seen.add(alias);
      if (otherPageIds.has(alias)) {
        issues.push(issue({ id: 'family-invalid', severity: 'error', ...pageRef(page), message: `Page "${id}": id "${alias}" collides with another page's id.`, fix: 'Choose a different alias.' }));
      }
      if (otherIds.has(alias)) {
        issues.push(issue({ id: 'family-invalid', severity: 'error', ...pageRef(page), message: `Page "${id}": id "${alias}" collides with another member or alias elsewhere in the catalog.`, fix: 'Choose a different alias.' }));
      }
    };
    for (const alias of page.aliases ?? []) checkAlias(alias);
    for (const section of page.tokenDefinition.sections) for (const alias of section.aliases ?? []) checkAlias(alias);
  }
  return issues;
}

/** A family member that is a style or modifier of the whole (a `ButtonStyle`, a `Modifier`) is not
 *  a part: it has no area of its own to number, so a numbered section is the wrong home for it.
 *  Read from the member's literal `relationship` ("Style"/"Modifier", any case), which always
 *  counts, or from its id or component ending in `Style`/`Modifier`, which counts only for a
 *  member that isn't a real component of its own (no `component`, or `documentation-only`) — a
 *  stepper component called `QuantityModifier` is a part. Checked for members in an `inWhole: true`
 *  section of a family page, and for group members with a `parent` that resolves on the page (a
 *  group numbers those as parts of that parent). */
function checkStyleAsPart(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.checkable || !page.members || page.members.length === 0) continue;
    const ids = new Set(page.members.map((m) => m.id));
    const inWhole = new Set((page.sections ?? []).filter((s) => s.inWhole === true).flatMap((s) => s.members));
    for (const member of page.members) {
      const numbered = inWhole.has(member.id) || (isGroupShape(page) && member.parent !== undefined && ids.has(member.parent));
      if (!numbered) continue;
      const relationship = member.relationship?.trim().toLowerCase();
      const byRelationship = relationship === 'style' || relationship === 'modifier';
      const notAComponent = member.component === undefined || member.fidelity === 'documentation-only';
      const byName = notAComponent && [member.id, member.component].some((name) => name !== undefined && /(Style|Modifier)$/.test(name));
      if (!byRelationship && !byName) continue;
      issues.push(issue({
        id: 'style-as-part', severity: 'warning', ...pageRef(page),
        message: `Member "${member.id}" is a style, not a part: give it its own page and name it in \`relatedPages\` on a family page.`,
        fix: `Move "${member.id}" out of its numbered place onto a catalog page of its own, and list that page in relatedPages on a family page (relatedPages renders nowhere else). If it really is a part, set its relationship to "Part".`,
      }));
    }
  }
  return issues;
}

/** `relatedPages` renders only on a family page; on a page with no `members` it is dropped without
 *  a word, which is the trap the `style-as-part` advice ("name it in relatedPages") would
 *  otherwise walk an author into. A group page reports it as an error already. */
function checkRelatedPagesUnused(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.checkable || (page.members?.length ?? 0) > 0) continue;
    if (page.hasMembers && page.members === undefined) continue; // `members` can't be read statically: stay quiet.
    const message = relatedPagesUnusedMessage({ id: resolvePageId(page, page.file), relatedPages: page.relatedPages });
    if (!message) continue;
    issues.push(issue({
      id: 'related-pages-unused', severity: 'warning', ...pageRef(page), message,
      fix: 'Give the page `members` (a family page renders the Related list), or name the related page in `composedOf` and drop `relatedPages`.',
    }));
  }
  return issues;
}

/** The anatomies the viewer draws, with the words that name them: a standalone or family page's own
 *  (`SectionBlock` renders `def.anatomy` for every page without group members), and each top-level
 *  member's on a group page. A family member's own anatomy and a nested group member's are never
 *  rendered (the last is already an error). */
function renderedAnatomies(page: StaticPage): { shape: StaticAnatomyShape | undefined; where: string }[] {
  if (!hasMembers(page) || !isGroupShape(page)) return [{ shape: page.anatomyShape, where: 'The anatomy' }];
  const ids = new Set((page.members ?? []).map((m) => m.id));
  return (page.members ?? [])
    .filter((m) => m.parent === undefined || !ids.has(m.parent))
    .map((m) => ({ shape: m.anatomyShape, where: `The anatomy of member "${m.id}"` }));
}

/** An anatomy that lists parts a reader should be able to see, with no `picture` to see them in.
 *  A part counts as visible unless its member is `documentation-only` (no area of its own — the
 *  dashed pin); an `{ other }` item is a component documented on its own page and counts. A
 *  `{ member }` item this page can't resolve (an external part) is not counted, so the rule never
 *  guesses. `picture: null` is the author saying the omission is deliberate, and a `picture` the
 *  reader can't see statically (a spread) is not reported. */
function checkAnatomyWithoutPicture(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.checkable) continue;
    const byId = new Map((page.members ?? []).map((m) => [m.id, m]));
    for (const { shape, where } of renderedAnatomies(page)) {
      if (!shape || shape.hasPicture || shape.pictureOptOut || shape.pictureUnknown) continue;
      const visibleMembers = shape.memberIds.filter((id) => {
        const fidelity = byId.get(id)?.fidelity;
        return fidelity !== undefined && fidelity !== 'documentation-only';
      });
      const visible = visibleMembers.length + shape.otherCount;
      if (visible === 0) continue;
      issues.push(issue({
        id: 'anatomy-no-picture', severity: 'warning', ...pageRef(page),
        message: `${where} lists ${visible} visible part${visible === 1 ? '' : 's'} but has no picture.`,
        fix: 'Draw the whole with AnatomySpecimen and pin the parts with AnatomyPin; the legend alone cannot show where each part is. If the parts really never share one frame, set `picture: null` to say so.',
      }));
    }
  }
  return issues;
}

/** An anatomy `picture` whose root element is not `AnatomySpecimen` is drawn at whatever width its
 *  own markup has, instead of the page's phone width centred like the variant cells, and its pins
 *  float wherever the author put them. A same-file component whose own root is `AnatomySpecimen`
 *  passes; a root that can't be read statically (an imported component, a call, a conditional) is
 *  skipped rather than guessed at. */
function checkAnatomyPictureRoot(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  for (const page of pages) {
    if (!page.checkable) continue;
    for (const { shape, where } of renderedAnatomies(page)) {
      if (!shape?.hasPicture || shape.pictureRoot !== 'other') continue;
      const root = !shape.pictureTag ? 'not AnatomySpecimen'
        : shape.pictureVia ? `<${shape.pictureVia}> (renders <${shape.pictureTag}>), not AnatomySpecimen`
          : `<${shape.pictureTag}>, not AnatomySpecimen`;
      issues.push(issue({
        id: 'anatomy-picture-not-specimen', severity: 'warning', ...pageRef(page),
        message: `${where} picture's root is ${root}.`,
        fix: "Wrap the picture in AnatomySpecimen so it is drawn at the page's phone width, centred like the variant cells, with pins beside it.",
      }));
    }
  }
  return issues;
}

/** A list block with an odd item count laid out two across at the default width, where
 *  `specimenSize: 'regular'` would fit it three across with no new empty cell. Uses the same
 *  layout maths `explain` reports (`listGeometry` at the laptop content width), not the browser. A
 *  block with an explicit `maxColumns` is left alone: the cap is the author's own decision, a
 *  page or member with exactly two blocks is left alone (the viewer may seat them side by side),
 *  and a page that imports a device frame is left alone too (see below). A hint,
 *  never a warning, because wider cells are a taste call. */
function checkEmptyCellInGrid(pages: StaticPage[]): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  const width = MATRIX_LAYOUT.laptopContentWidth;
  for (const page of pages) {
    // A page showing examples inside a phone needs the phone-width cell on purpose: a regular cell
    // would scale the device down, which the viewer itself warns about.
    if (!page.checkable || page.viewerImports?.some((name) => DEVICE_FRAME_EXPORTS.includes(name))) continue;
    const scopes = [
      { where: '', blocks: presentationBlocks(toSectionDef(page), { defaultPreviewWidths: [402] }) },
      ...(page.members ?? []).map((member) => ({ where: `member "${member.id}", `, blocks: memberBlocks(member) })),
    ];
    for (const { where, blocks } of scopes) {
      // The viewer may put exactly two blocks side by side at about half the row, where wide and
      // regular are both one column; the full-row maths below would then give wrong advice.
      if (blocks.length === 2) continue;
      for (const block of blocks) {
        if (block.kind !== 'list' || block.items.length % 2 === 0 || block.maxColumns !== undefined) continue;
        const now = listGeometry(block.items.length, width, block.size);
        const regular = listGeometry(block.items.length, width, 'regular');
        if (now.columns !== 2 || regular.columns !== 3 || regular.fillers > now.fillers) continue;
        issues.push(issue({
          id: 'grid-empty-cell', severity: 'hint', ...pageRef(page),
          message: `${block.items.length} items in a 2-wide grid leave an empty cell; consider specimenSize: 'regular' (${where}"${block.title}").`,
          fix: "Set specimenSize: 'regular' so the items sit three across (it applies to the whole page or member, not just this block), or add or remove one item so the grid fills.",
        }));
      }
    }
  }
  return issues;
}

/** Every page-scoped issue, from every rule above. */
export function collectIssues(
  pages: StaticPage[],
  components: ComponentRecord[],
  options: { patternGroups?: readonly string[]; usage?: UsageData } = {},
): DoctorIssue[] {
  const patternGroups = options.patternGroups ?? DEFAULT_PATTERN_GROUPS;
  return [
    ...checkParseErrors(pages),
    ...checkNotCheckable(pages),
    ...checkComponentExportRemoved(pages, components),
    ...checkComponentNoExamples(pages, components),
    ...checkDuplicatePageId(pages),
    ...checkGridAxisKeys(pages),
    ...checkGridColumnLimit(pages),
    ...checkDegenerateGridAxis(pages),
    ...checkComparisonHidesVariants(pages),
    ...checkComponentPages(pages, components),
    ...checkMissingComposition(pages, components),
    ...checkStandaloneReason(pages),
    ...checkPartOwnPage(pages, patternGroups),
    ...checkNothingToShow(pages, patternGroups),
    ...(options.usage ? checkUsageUnknownPage(pages, components, options.usage) : []),
    ...checkMissingWorkingPreview(pages, components),
    ...checkPreviewOnlyPages(pages),
    ...checkFamilyMembers(pages, components),
    ...checkFamilyValidity(pages),
    ...checkGroupValidity(pages),
    ...checkMemberComposedOf(pages, components),
    ...checkDeprecatedRelatedSections(pages),
    ...checkTokenDefinition(pages),
    ...checkTokenDefinitionDuplicateKind(pages),
    ...checkTokenDefinitionAliases(pages),
    ...checkStyleAsPart(pages),
    ...checkRelatedPagesUnused(pages),
    ...checkAnatomyWithoutPicture(pages),
    ...checkAnatomyPictureRoot(pages),
    ...checkEmptyCellInGrid(pages),
  ];
}

/** Issues that aren't tied to one page: `sync`'s own "Could not read" warnings, and a configured
 *  project with no token modules at all. */
export function collectGlobalIssues(input: { syncWarnings: string[]; tokenFileCount: number }): DoctorIssue[] {
  const issues: DoctorIssue[] = input.syncWarnings.map((warning) =>
    issue({ id: 'props-unreadable', severity: 'warning', message: warning, fix: 'Fix the file so sync can read it, or exclude it from the components/tokens globs.' }),
  );
  if (input.tokenFileCount === 0) {
    issues.push(issue({ id: 'no-token-modules', severity: 'warning', message: 'No token modules are configured.', fix: 'Add a tokens glob to ds-viewer.config.ts.' }));
  }
  return issues;
}

/** Design §4's other half of "fails to parse or typecheck" — the half `cli/staticPage.ts` (Task 3)
 *  deliberately never attempts, since it has no type checker and no module resolution at all.
 *  This builds exactly one `ts.Program` over every page file, using the identical compiler-host
 *  construction `cli/props.ts`'s `createComponentReader` already uses for component files (same
 *  `compilerOptions` shape, same `fallbackPaths` mechanism for a page outside the project root —
 *  `runDoctor`, Task 5, computes `fallbackPaths` the same way `cli/sync.ts` already does for
 *  component files), and reports every syntactic *and* semantic diagnostic as `page-parse-error`,
 *  with a real `line` (unlike every other rule in this file — see this task's own resolved-scope
 *  note above). Errata (controller, binding): a page that already has a `parseError` from
 *  `cli/staticPage.ts`'s own syntactic reader is skipped here — its syntax error was already
 *  reported once by `checkParseErrors`, and this program would otherwise report it again (its own
 *  syntactic diagnostics are a superset of what `ts.transpileModule` already found). A spike
 *  against the real kit (`spikes/page-typecheck/` in this plan's spike folder) found exactly one
 *  real, previously-uncaught diagnostic, fixed in Task 2. */
export function checkPageTypeErrors(
  pages: StaticPage[],
  options: {
    fallbackPaths?: Record<string, string[]>;
    /** The host project's root. Its tsconfig decides the options, wherever the pages live (a host
     *  whose pages sit in a sibling folder, e.g. kit-host's `../starter-kit`, would otherwise pick
     *  up whatever tsconfig is above that folder). Without it, the first page's nearest tsconfig. */
    hostRoot?: string;
  } = {},
): DoctorIssue[] {
  const checkablePages = pages.filter((p) => !p.parseError);
  const pageFiles = checkablePages.map((p) => p.file);
  if (pageFiles.length === 0) return [];
  const byFile = new Map(checkablePages.map((p) => [p.file, p]));
  // Important finding 2 (Fable's review): the host project's own tsconfig decides every option —
  // its ambient declarations (expo-env.d.ts's `*.png`/`*.svg` modules, a project's own
  // declarations.d.ts) and its `strict`/`lib`/etc. settings — not a fixed set copied from
  // `createComponentReader` (where a mismatch only degrades prop reading silently; here it would
  // produce CI-failing errors the host's own `tsc` would never raise). Only `noEmit`,
  // `skipLibCheck`, and the merged `paths` are forced on top.
  // `readHostTsconfigOptions` searches upward from the given file's folder; a file name inside
  // `hostRoot` starts that search at the host's own root.
  const host = readHostTsconfigOptions(options.hostRoot ? path.join(options.hostRoot, 'ds-viewer.config.ts') : pageFiles[0]);
  const compilerOptions: ts.CompilerOptions = {
    ...host.options,
    noEmit: true,
    skipLibCheck: true,
    paths: { ...options.fallbackPaths, ...host.paths },
  };
  const program = ts.createProgram([...pageFiles, ...host.declarationFiles], compilerOptions);
  const issues: DoctorIssue[] = [];
  for (const file of pageFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;
    const diagnostics = [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)];
    const page = byFile.get(file);
    const ref = page ? pageRef(page) : { file };
    for (const d of diagnostics) {
      const line = d.start !== undefined ? sourceFile.getLineAndCharacterOfPosition(d.start).line + 1 : undefined;
      issues.push(issue({
        id: 'page-parse-error', severity: 'error', ...ref, line,
        message: `Failed to typecheck: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`,
        fix: 'Fix the error, then rerun doctor.',
      }));
    }
  }
  return issues;
}

export interface DoctorSummary {
  errors: number;
  warnings: number;
  /** Advisory `hint` findings; absent when there are none, so legacy output is unchanged. */
  hints?: number;
  components: number;
  withExamples: number;
  unboundExamples: number;
  /** Token sections whose entries are runtime imports and so were not statically validated.
   *  Informational; absent when there are none. */
  runtimeOnlyTokenSections?: { page: string; sections: string[] }[];
}

export interface DoctorJsonResult {
  version: 1;
  summary: DoctorSummary;
  /** `null` when the check didn't run (disabled, `--ci`, or offline with nothing cached);
   *  otherwise filled by `cli/main.ts`'s `runDoctorCommand` — `runDoctor` itself never calls the
   *  update check (it stays pure/synchronous; see this task's own note in Global Constraints). */
  update: { current: string; latest: string; breaking: boolean } | null;
  issues: DoctorIssue[];
}

export interface DoctorRunResult extends DoctorJsonResult {
  /** 1 when `summary.errors > 0`, else 0 — what `--ci` exits with; a plain `doctor` run (no
   *  `--ci`) never uses this (design §4: "local work is never blocked"). */
  exitCode: number;
  /** Page id → project-relative page file (not part of `--json`), for findings added later
   *  (`doctor --render`). */
  pageFiles: Map<string, string>;
}

/** Adds findings to a finished result: applies `doctor.strict`, recounts errors and warnings, and
 *  resets the exit code. */
export function withExtraIssues(result: Omit<DoctorRunResult, 'pageFiles'> & { pageFiles?: Map<string, string> }, extra: DoctorIssue[], strict: boolean) {
  const added = strict ? extra.map((i) => (i.severity === 'warning' ? { ...i, severity: 'error' as const } : i)) : extra;
  const issues = [...result.issues, ...added];
  const errors = issues.filter((i) => i.severity === 'error').length;
  const hints = issues.filter((i) => i.severity === 'hint').length;
  const { hints: _previous, ...rest } = result.summary;
  const summary = { ...rest, errors, warnings: issues.length - errors - hints, ...(hints > 0 ? { hints } : {}) };
  return { ...result, issues, summary, exitCode: errors > 0 ? 1 : 0 };
}

/** "With examples" means what `checkComponentNoExamples` (Task 4) checks the *absence* of: at
 *  least one checkable page with a real example, not merely "has a page" (an `init`-drafted
 *  "Needs examples" page has one, with none). */
function countWithExamples(pages: StaticPage[], components: ComponentRecord[]): number {
  const byComponent = new Map<string, StaticPage[]>();
  for (const page of pages) {
    if (page.component) byComponent.set(page.component, [...(byComponent.get(page.component) ?? []), page]);
  }
  return components.filter((c) => (byComponent.get(c.name) ?? []).some((p) => p.checkable && pageHasExamples(p))).length;
}

function countUnboundExamples(pages: StaticPage[]): number {
  let count = 0;
  for (const page of pages) {
    if (page.comparison) {
      if (page.comparison.rows.prop === undefined) count += page.comparison.rows.items.length;
      if (page.comparison.columns.prop === undefined) count += page.comparison.columns.items.length;
    }
    for (const item of [...(page.variantsItems ?? []), ...(page.statesItems ?? [])]) {
      if (!item.props || Object.keys(item.props).length === 0) count += 1;
    }
  }
  return count;
}

/** Runs `sync`, reads every page `cli/staticPage.ts` can find (`discoverAllPageFiles` —
 *  deliberately wider than the viewer's own page list, so a renamed/removed component's orphaned
 *  page is still seen), applies the component-folder default (Errata, `applyComponentDefaults`
 *  above), and applies every rule from Task 4. `config.doctor.strict` promotes every warning to an
 *  error for both the summary counts and the exit code (design §2 Config: "`strict: true` promotes
 *  `doctor` warnings to errors"). */
export function runDoctor(config: ResolvedConfig): DoctorRunResult {
  const syncResult = sync(config);
  const components = JSON.parse(readFileSync(path.join(syncResult.generatedDir, 'components.json'), 'utf8')) as ComponentRecord[];
  // Same exclusion `sync` already applies to `componentEntryFiles` (cli/sync.ts:29-30) — without
  // it, an excluded folder's own `*.catalog.tsx` is still discovered below (`discoverAllPageFiles`)
  // even though its component never makes it into `components.json`, firing a false
  // `component-export-removed`.
  const excluded = new Set((config.exclude ?? []).flatMap((pattern) => resolveGlob(config.projectRoot, pattern)));
  const componentFolders = [
    ...new Set(
      config.components
        .flatMap((pattern) => resolveGlob(config.projectRoot, pattern))
        .filter((file) => !excluded.has(file))
        .map((file) => path.dirname(file)),
    ),
  ];
  const tokenFileCount = config.tokens.flatMap((pattern) => resolveGlob(config.projectRoot, pattern)).length;
  const pageFiles = discoverAllPageFiles({ componentFolders, standalonePageGlobs: config.pages ?? [], projectRoot: config.projectRoot });
  const pages = applyComponentDefaults(readStaticPages(pageFiles), new Set(componentFolders));

  // Same "a page outside the project root needs a fallback paths entry" rule `cli/sync.ts` already
  // applies to component entry files (e.g. `kit-host`'s own component pages, which physically live
  // in the sibling `../starter-kit/`) — mirrored here for page files, since `checkPageTypeErrors`
  // below needs it for the identical reason `createComponentReader` does. `@krapwoo/ds-viewer`
  // itself resolves from `../starter-kit` pages through Node's own self-name resolution (the repo
  // root `package.json`'s `name` + `exports`), not this fallback — never a `starter-kit/package.json`.
  const hasPageOutsideProjectRoot = pageFiles.some((file) => !file.startsWith(`${config.projectRoot}${path.sep}`));
  const fallbackPaths = hasPageOutsideProjectRoot
    ? { '*': [path.join(config.projectRoot, 'node_modules', '@types', '*'), path.join(config.projectRoot, 'node_modules', '*')] }
    : undefined;

  let issues = [
    ...collectIssues(pages, components, { patternGroups: config.patternGroups, usage: syncResult.usage }),
    ...checkPageTypeErrors(pages, { fallbackPaths, hostRoot: config.projectRoot }),
    ...checkOverlaysFramed(pages, components, config.projectRoot),
    ...collectGlobalIssues({ syncWarnings: syncResult.warnings, tokenFileCount }),
  ];
  // Design's own `--json` example gives a project-relative `file`; `StaticPage.file` is absolute
  // (`discoverAllPageFiles`) and `ComponentRecord.file` is cwd-relative (`cli/props.ts`) — cwd
  // equals `config.projectRoot` for every real CLI invocation, so resolving against one and
  // re-relativizing against the other normalizes both to the same, documented shape.
  issues = issues.map((i) => (i.file ? { ...i, file: path.relative(config.projectRoot, path.resolve(config.projectRoot, i.file)) } : i));
  if (config.doctor?.strict) issues = issues.map((i) => (i.severity === 'warning' ? { ...i, severity: 'error' as const } : i));

  const summary: DoctorSummary = {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    ...(issues.some((i) => i.severity === 'hint') ? { hints: issues.filter((i) => i.severity === 'hint').length } : {}),
    components: components.length,
    withExamples: countWithExamples(pages, components),
    unboundExamples: countUnboundExamples(pages),
  };
  const runtimeOnly = runtimeOnlyTokenSections(pages);
  if (runtimeOnly) summary.runtimeOnlyTokenSections = runtimeOnly;
  const pageFileById = new Map(pages.map((p) => [resolvePageId(p, p.file), path.relative(config.projectRoot, p.file)]));
  return { version: 1, summary, update: null, issues, exitCode: summary.errors > 0 ? 1 : 0, pageFiles: pageFileById };
}

export function toDoctorJson(result: Omit<DoctorRunResult, 'pageFiles'>): DoctorJsonResult {
  const { version, summary, update, issues } = result;
  return { version, summary, update, issues };
}

/** Human report (design §4 "Output"): grouped by page, each issue with its one-line fix; issues
 *  with no `page` (`props-unreadable`, `no-token-modules`) are listed under "General". Ends with
 *  the same counts `--json`'s `summary` carries. */
export function formatHuman(result: DoctorJsonResult): string {
  const byPage = new Map<string, DoctorIssue[]>();
  const general: DoctorIssue[] = [];
  for (const issue of result.issues) {
    if (issue.page) byPage.set(issue.page, [...(byPage.get(issue.page) ?? []), issue]);
    else general.push(issue);
  }
  const lines: string[] = [];
  const renderIssue = (issue: DoctorIssue) => {
    const location = issue.file ? ` (${issue.file}${issue.line ? `:${issue.line}` : ''})` : '';
    lines.push(`  [${issue.severity}] ${issue.id}: ${issue.message}${location}`);
    lines.push(`    Fix: ${issue.fix}`);
  };
  for (const [page, issues] of [...byPage].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(page);
    for (const issue of issues) renderIssue(issue);
    lines.push('');
  }
  if (general.length > 0) {
    lines.push('General');
    for (const issue of general) renderIssue(issue);
    lines.push('');
  }
  const { errors, warnings, hints, components, withExamples, unboundExamples, runtimeOnlyTokenSections: runtimeOnly } = result.summary;
  if (runtimeOnly && runtimeOnly.length > 0) {
    const count = runtimeOnly.reduce((sum, entry) => sum + entry.sections.length, 0);
    const where = runtimeOnly.map((entry) => `${entry.page} (${entry.sections.join(', ')})`).join('; ');
    lines.push(`${count} token section${count === 1 ? '' : 's'} with runtime-only entries (not statically validated): ${where}.`, '');
  }
  lines.push(
    `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}${hints ? `, ${hints} hint${hints === 1 ? '' : 's'}` : ''} — ` +
      `${components} components (${withExamples} with examples), ${unboundExamples} unbound examples.`,
  );
  return lines.join('\n');
}

/** `formatHuman`'s own output always ends with its one summary line (design §4's own example: "0
 *  errors, 15 warnings — 37 components (37 with examples), 130 unbound examples.") — every issue
 *  and its fix come before it. Used by `dev.ts`/`update.ts` to shrink the `doctor` step's captured
 *  stdout down to that one line for the update panel's success state (Minor finding, raised to
 *  Important by the controller: the mockup's own success page shows one line, not the whole
 *  report). Never throws on empty input — falls back to the trimmed input itself. */
export function lastSummaryLine(output: string): string {
  const lines = output.split('\n').map((line) => line.trimEnd()).filter((line) => line.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : output.trim();
}
