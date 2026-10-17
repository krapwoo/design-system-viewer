/**
 * Pure family-page logic (spec §5.1–§5.2) — no React or React Native imports, so it runs under
 * Node's test runner. `pageApi.ts` and `FamilyPage.tsx` both build on this module rather than
 * duplicating outline numbering or validation.
 */
import type { CatalogMember, CatalogMemberSection, PropDef } from './types.ts';

/** The subset of a family page's shape `validateFamily` and `outlineFor` need. The real page
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
  // here, rather than left to crash the renderer or silently take a letter in `outlineFor`.
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

  return issues;
}

/** Outline numbers for every member of a family page (spec §5.2): the whole is `1` at level 1.
 *  Parts (members with a parent, transitively under the whole) are numbered `parentNumber.k` in
 *  authored order, `k` level below their parent. Roots without a parent, other than the whole, are
 *  lettered `A`, `B`, … at level 2, with their own descendants nested the same way. "Authored
 *  order" is the order a member first appears scanning `sections` in order. Returns an empty map
 *  for a page without members. */
export function outlineFor(page: FamilyOutlineInput): Map<string, { number: string; level: number }> {
  const outline = new Map<string, { number: string; level: number }>();
  const { whole, sections, members } = page;
  if (!whole || !sections || !members) return outline;

  // V2c item 2: a section may list an id that isn't a real member (bad data, already reported by
  // `validateFamily`) — never let it occupy authored order (and so never a root letter), degrading
  // to a missing block instead of renumbering the real members around it.
  const memberIds = new Set(members.map((m) => m.id));
  const authoredOrder: string[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
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

  // V2c item 14: a bad parent graph (already reported by `validateFamily`) can loop back to an
  // ancestor already being numbered — `visited` makes that degrade to a partial outline instead of
  // an infinite recursion.
  const assignChildren = (parentId: string, parentNumber: string, parentLevel: number, visited: Set<string>) => {
    const kids = childrenOf.get(parentId) ?? [];
    kids.forEach((childId, index) => {
      if (visited.has(childId)) return;
      visited.add(childId);
      const number = `${parentNumber}.${index + 1}`;
      const level = parentLevel + 1;
      outline.set(childId, { number, level });
      assignChildren(childId, number, level, visited);
    });
  };

  const visited = new Set<string>([whole]);
  outline.set(whole, { number: '1', level: 1 });
  assignChildren(whole, '1', 1, visited);

  const roots = authoredOrder.filter((id) => parentOf.get(id) === undefined && !visited.has(id));
  let letterIndex = 0;
  for (const id of roots) {
    if (visited.has(id)) continue;
    visited.add(id);
    const letter = String.fromCharCode(65 + letterIndex);
    letterIndex += 1;
    outline.set(id, { number: letter, level: 2 });
    assignChildren(id, letter, 2, visited);
  }

  return outline;
}

/** The header text role for a member at a given outline level (spec §5.2 "Header by level"). */
export function headerRoleFor(level: number): 'heading1' | 'heading2' | 'heading3' | 'bodyStrong' | 'body' {
  if (level <= 1) return 'heading1';
  if (level === 2) return 'heading2';
  if (level === 3) return 'heading3';
  if (level === 4) return 'bodyStrong';
  return 'body';
}

/** `aria-level` for a member at a given outline level: the page title is 1, so every outline
 *  level is shifted down by one, capped at 6 (spec §5.2 "Heading semantics"). The whole (outline
 *  level 1) and section labels both land on 2 this way too. */
export function ariaLevelFor(level: number): number {
  return Math.min(level + 1, 6);
}

/** Whether a member's `relationship` should be shown below its specimens (spec §5.1, §5.2): never
 *  on the whole, never in a folded row, and never when it just repeats its section's label
 *  (case-insensitive). */
export function relationshipVisible(member: CatalogMember, section: CatalogMemberSection, isWhole: boolean, isFolded: boolean): boolean {
  if (isWhole || isFolded) return false;
  return member.relationship.toLowerCase() !== section.label.toLowerCase();
}

/** The disclosure's closed-state summary label (spec §5.2). V2b item 9: "Swift API" is Hermex
 *  wording and must not be hardcoded in a generic viewer — `apiLabel` is the page's own label
 *  (default `'API'`), and `hasProps` is whether the member has resolved props to show (the same
 *  condition `disclosureContent` uses for its own "props" part). V2d item 2: `composedOf` ("Uses")
 *  counts the same way `notes` already does here — either one alone (or together) gives "Notes"
 *  alone, or combines with api/props into "Notes and ${apiLabel}". */
export function disclosureLabel(member: CatalogMember, apiLabel = 'API', hasProps = false): string {
  const hasNotesOrUses = Boolean(member.notes && member.notes.length > 0) || Boolean(member.composedOf && member.composedOf.length > 0);
  const hasApiOrProps = Boolean(member.api) || hasProps;
  if (hasNotesOrUses && hasApiOrProps) return `Notes and ${apiLabel}`;
  if (hasApiOrProps) return apiLabel;
  if (hasNotesOrUses) return 'Notes';
  return 'Details';
}

export type DisclosurePart = 'notes' | 'uses' | 'whenToUse' | 'a11y' | 'props' | 'api';

/** The disclosure's content, in order (spec §5.2 "Disclosure", V2d item 2): notes, then Uses
 *  (`composedOf`, non-empty only), then Guidance (`whenToUse`), then Accessibility (`a11y`, unless
 *  `hide.accessibility`), then the generated Props table (unless `hide.props`), then the Swift
 *  excerpt (`api`). Omits any part whose data is absent. Errata 6: `props` is listed only when the
 *  caller actually has resolved props to show — `resolvedProps` is the member's own generated
 *  `props` (from its `component`, if any) — never merely because `hide.props` is unset; a
 *  documentation-only member with no component has no props to omit from, so it never shows an
 *  (empty) Props table. */
export function disclosureContent(member: CatalogMember, resolvedProps?: readonly PropDef[]): DisclosurePart[] {
  const parts: DisclosurePart[] = [];
  if (member.notes && member.notes.length > 0) parts.push('notes');
  if (member.composedOf && member.composedOf.length > 0) parts.push('uses');
  if (member.whenToUse) parts.push('whenToUse');
  if (member.a11y && !member.hide?.accessibility) parts.push('a11y');
  if (resolvedProps && resolvedProps.length > 0 && !member.hide?.props) parts.push('props');
  if (member.api) parts.push('api');
  return parts;
}

/** Family sections in page order (spec §5.2): `inWhole` sections first, in authored order, then
 *  the rest, also in authored order. Ordering only — numbering and lettering follow each member's
 *  `parent` (`outlineFor`), not this order. */
export function orderedSections(sections: readonly CatalogMemberSection[]): CatalogMemberSection[] {
  return [...sections.filter((section) => section.inWhole), ...sections.filter((section) => !section.inWhole)];
}

/** The section a member id belongs to, or `undefined` for the whole (which is in no section) or an
 *  unknown id. Used both for `relationshipVisible`'s `section` argument and to decide whether
 *  addressing a member should open a folded row (its section's `kind` is `'list'`). */
export function sectionFor(sections: readonly CatalogMemberSection[], memberId: string): CatalogMemberSection | undefined {
  return sections.find((section) => section.members.includes(memberId));
}

/** N7: the whole member, resolved from `family.whole` against `family.members` — `undefined` for
 *  bad data (a `whole` that isn't one of its own members, already reported by `validateFamily`),
 *  so `FamilyPage` can skip rendering the whole block instead of crashing on an absent member.
 *  Generic over the member's own shape so `FamilyPage` keeps its resolved `props`/`path` fields
 *  (`FamilyDef.members`'s own type) through the lookup. */
export function resolveWhole<T>(members: ReadonlyMap<string, T>, whole: string): T | undefined {
  return members.get(whole);
}

/** V2c item 1 (one-shot jump) + item 11 (repeat activation): in-flight state for a member-address
 *  scroll/focus jump, reset fresh on every new activation (`FamilyPage`'s own effect, keyed by a
 *  nonce from `CatalogShell` so a repeat activation of the SAME member still counts as new).
 *  `passesLeft` starts at 2 for a folded (`list`) row — the row's first, still-closed layout, then
 *  its second, now-open one (V2b item 8) — or 1 for a block member, which has only one layout to
 *  scroll against. */
export interface MemberJumpState {
  memberId: string;
  passesLeft: number;
}

/** Whether a member-address scroll/focus pass should run right now: only while `state` still
 *  belongs to the member currently addressed and still has a pass left. Once every pass for the
 *  current activation has run, toggling an unrelated (or even the same) row afterwards — which
 *  changes nothing this state tracks — must never make this true again. */
export function shouldRunMemberJump(state: MemberJumpState | undefined, memberId: string): boolean {
  return state !== undefined && state.memberId === memberId && state.passesLeft > 0;
}

/** One segment of a `related` sentence (spec §5.2): plain text, or a member id that should render
 *  as a link to that member's address (`RelatedSegment.memberId` is also that member's display
 *  name — see `CatalogMember.id`'s own doc comment). */
export interface RelatedSegment {
  text: string;
  memberId?: string;
}

/** Escapes a string for literal use inside a `RegExp` (the characters the regex engine would
 *  otherwise treat as metacharacters). A Swift declaration name never contains any of these, but
 *  this keeps `linkifyRelated` correct even if one ever did. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits a `related` sentence (spec §5.1 `CatalogMember.related`) into segments, turning every
 *  whole-word occurrence of another member's id into a linked segment; every other run of text is
 *  a plain segment. Matches the longest id first, so a shorter id that is a prefix of a longer one
 *  (e.g. "BotAvatarView" inside "BotAvatarViewLegacy") never splits the longer one apart. Returns
 *  the whole text as one plain segment when there are no ids, or no match. */
export function linkifyRelated(text: string, memberIds: readonly string[]): RelatedSegment[] {
  if (memberIds.length === 0) return [{ text }];
  const ids = [...memberIds].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(?:${ids.map(escapeRegExp).join('|')})\\b`, 'g');
  const segments: RelatedSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) });
    segments.push({ text: match[0], memberId: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments.length > 0 ? segments : [{ text }];
}
