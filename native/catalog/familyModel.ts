/**
 * Pure family-page UI logic (spec §5.1–§5.2) — no React or React Native imports, so it runs under
 * Node's test runner. `FamilyPage.tsx` builds on this module rather than duplicating its own tree
 * building, disclosure content, and link/pin lookups. Outline numbering (`numberFor`) and family
 * validation (`validateFamily`) live in `pageApi.ts` instead — see that file's own comments.
 */
import type { AlsoUsedByEntry, CatalogMember, CatalogMemberSection, PropDef } from './types.ts';

/** One node of a `blocks` section's own Part tree (Slice D1 item 7 "Tree line"). */
export interface PartTreeEntry {
  id: string;
  children: PartTreeEntry[];
}

/** E1: moved from `FamilyPage.tsx` so it runs under Node's test runner — pure logic that alone
 *  decides how a `blocks` section's own members nest and in what order its Parts render.
 *  Reconstructs parentage mechanically from the already-computed `numberFor` outline (a child's
 *  number is its parent's number plus one more `.` segment), scoped to the member ids given, not a
 *  second copy of `numberFor`'s own nesting decision. Scoping to one section's own ids (rather than
 *  every member of the page) is how family data is authored — a section's `members` already lists
 *  a full parent/children subtree together — so a parent belonging to a *different* section is
 *  simply absent from `memberIds`, and the would-be child becomes a root of this tree instead of
 *  nesting under a part this call never sees. */
export function buildPartTree(memberIds: readonly string[], outline: ReadonlyMap<string, { number: string; level: number }>): PartTreeEntry[] {
  const idByNumber = new Map<string, string>();
  for (const id of memberIds) {
    const number = outline.get(id)?.number;
    if (number) idByNumber.set(number, id);
  }
  const childrenOf = new Map<string, string[]>();
  const roots: string[] = [];
  for (const id of memberIds) {
    const number = outline.get(id)?.number;
    const parentNumber = number?.includes('.') ? number.slice(0, number.lastIndexOf('.')) : undefined;
    const parentId = parentNumber ? idByNumber.get(parentNumber) : undefined;
    if (parentId) childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), id]);
    else roots.push(id);
  }
  const build = (id: string): PartTreeEntry => ({ id, children: (childrenOf.get(id) ?? []).map(build) });
  return roots.map(build);
}

/** Slice D1 item 5: an anatomy pin's number and style, looked up by member id — the pure lookup
 *  behind `AnatomyPin` (which reads this through React context so a page's `anatomy.picture` never
 *  hardcodes a number). `undefined` for an unknown member, or one with no number (outside any
 *  `inWhole` section, or under an unnumbered parent — `numberFor` never assigns those one;
 *  `validateFamily`'s D2 item A2 now reports any anatomy item naming such a member, but this stays
 *  defensive for a caller outside the anatomy legend/picture, which that rule doesn't cover). A
 *  dashed pin marks a `documentation-only` member — spec: "no area of their own". */
export function anatomyPinFor(
  memberId: string,
  members: ReadonlyMap<string, Pick<CatalogMember, 'fidelity'>>,
  outline: ReadonlyMap<string, { number: string }>,
): { number: string; dashed: boolean } | undefined {
  const member = members.get(memberId);
  if (!member) return undefined;
  const entry = outline.get(memberId);
  if (!entry) return undefined;
  return { number: entry.number, dashed: member.fidelity === 'documentation-only' };
}

/** The anatomy stage's own padding on each side — equal to `CATALOG_SPACE.xl` (asserted against
 *  that token in familyModel.test.ts), not a second, independent constant. A side-by-side legend
 *  only fits once the card is wide enough for the picture's own measured width plus this padding
 *  on both sides, plus one readable legend column. */
export const ANATOMY_STAGE_PADDING = 24;

/** A legend column — whether the single column beside the picture, or one of the stacked legend's
 *  own balanced columns — is never narrower than this: the longest observed member name (~203px)
 *  plus its row's own pin gutter and padding (~74px). Below it, the legend drops to fewer columns,
 *  or (when there's no room even for one column beside the stage) the whole card stacks instead. */
export const ANATOMY_LEGEND_MIN_COLUMN_WIDTH = 280;

/** How many columns a stacked legend uses at a given measured card width, up to 3 — the same
 *  minimum-column-width budget a side-by-side legend's own single column keeps. */
function anatomyLegendColumns(cardWidth: number): 1 | 2 | 3 {
  const fits = (n: number) => cardWidth >= n * ANATOMY_LEGEND_MIN_COLUMN_WIDTH;
  if (fits(3)) return 3;
  if (fits(2)) return 2;
  return 1;
}

/** Slice fix (anatomy-narrow-layout): whether the anatomy box puts its legend beside the picture
 *  or below it, and how many columns a stacked legend uses, at a measured anatomy-card width and
 *  picture width. More than six items always stacks (unchanged), but its own legend still narrows
 *  to 2 or 1 columns rather than staying cramped at 3. Six or fewer items stay side by side only
 *  while the card has room for BOTH the intact picture stage (the picture's own measured width
 *  plus `ANATOMY_STAGE_PADDING` on each side) AND one readable legend column
 *  (`ANATOMY_LEGEND_MIN_COLUMN_WIDTH`); otherwise they stack too, with the same column budget as
 *  the >6 path. `cardWidth`/`pictureWidth` of 0 (nothing measured yet, e.g. native's first frame,
 *  or a platform that never measures at all) falls back to the original item-count-only decision,
 *  the same one this whole page used before width ever mattered — that decision never oscillates,
 *  being a pure function of its own inputs. */
export function anatomyLayout(totalItems: number, cardWidth: number, pictureWidth: number): { stacked: boolean; legendColumns: 1 | 2 | 3 } {
  if (cardWidth <= 0 || pictureWidth <= 0) return { stacked: totalItems > 6, legendColumns: 3 };
  if (totalItems > 6) return { stacked: true, legendColumns: anatomyLegendColumns(cardWidth) };
  const sideBySideWidth = pictureWidth + 2 * ANATOMY_STAGE_PADDING + ANATOMY_LEGEND_MIN_COLUMN_WIDTH;
  if (cardWidth >= sideBySideWidth) return { stacked: false, legendColumns: 1 };
  return { stacked: true, legendColumns: anatomyLegendColumns(cardWidth) };
}

/** Distributes a legend's groups into up to `maxColumns` columns so the columns end as close to
 *  level as possible: each group, in authored order, goes into the column that is currently
 *  shortest (the leftmost on a tie). A group's height is its items plus one row for its label. A
 *  group never splits across columns, and the groups in each column keep their authored order. */
export function anatomyColumns<T extends { items: ReadonlyArray<unknown> }>(groups: readonly T[], maxColumns = 3): T[][] {
  if (groups.length === 0) return [];
  const columnCount = Math.min(maxColumns, groups.length);
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array<number>(columnCount).fill(0);
  for (const group of groups) {
    let shortest = 0;
    for (let i = 1; i < columnCount; i += 1) if (heights[i] < heights[shortest]) shortest = i;
    columns[shortest].push(group);
    heights[shortest] += group.items.length + 1;
  }
  return columns;
}

/** `aria-level` for a member at a given outline level: the page title is 1, so every outline
 *  level is shifted down by one, capped at 6 (spec §5.2 "Heading semantics"). The whole (outline
 *  level 1) and section labels both land on 2 this way too. */
export function ariaLevelFor(level: number): number {
  return Math.min(level + 1, 6);
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

/** The section a member id belongs to, or `undefined` for the whole (which is in no section) or an
 *  unknown id. Used to decide whether addressing a member should open a folded row (its section's
 *  `kind` is `'list'`). */
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

/** One segment of an "Also used by" line: plain text, or another component's own id, rendered as a
 *  link when it resolves to a real catalog address and plain text otherwise (`FamilyPage`'s own
 *  `resolvesAddress`, the same test `UsesLine` already uses). */
export interface UsedBySegment {
  text: string;
  component?: string;
}

/** Builds the "Also used by …" segments (field spec "Rendering") from a member's derived
 *  `alsoUsedBy` list: `[]` for none (the caller renders nothing), one user with its own role in
 *  parentheses when non-empty, two or three joined with commas and "and" (no roles — they bloat the
 *  line), or the first three plus a plain-text "+N more" beyond that. */
export function alsoUsedBySegments(entries: readonly AlsoUsedByEntry[]): UsedBySegment[] {
  if (entries.length === 0) return [];
  const segments: UsedBySegment[] = [{ text: 'Also used by ' }];
  if (entries.length === 1) {
    const [entry] = entries;
    segments.push({ text: entry.component, component: entry.component });
    if (entry.role) segments.push({ text: ` (${entry.role})` });
    return segments;
  }
  const shown = entries.slice(0, 3);
  shown.forEach((entry, i) => {
    segments.push({ text: entry.component, component: entry.component });
    if (i < shown.length - 2) segments.push({ text: ', ' });
    else if (i === shown.length - 2) segments.push({ text: ' and ' });
  });
  if (entries.length > 3) segments.push({ text: ` +${entries.length - 3} more` });
  return segments;
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
