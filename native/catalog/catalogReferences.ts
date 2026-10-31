/**
 * #60 "Source reference" layer — pure data/navigation foundation (plan Task 1). No React or React
 * Native imports, so it runs under Node's test runner, the same reasoning `catalogNavigation.ts`
 * documents for itself. Everything here derives from the catalog's own registered `SectionDef[]`
 * (and the ordering/alias primitives `catalogNavigation.ts` already owns) — never a second,
 * hand-maintained registry.
 */
import type { SectionDef } from './types.ts';
import type { AliasTarget } from './catalogNavigation.ts';
import type { ThumbnailSource } from './overviewModel.ts';

/** True once any page in the catalog opts into the `'reference'` layer — the controller's trigger
 *  for showing the separate Source reference affordance at all. A catalog with no such page keeps
 *  its present sidebar/page set unchanged. */
export function hasReferenceNavigation<TId extends string>(sections: readonly SectionDef<TId>[]): boolean {
  return sections.some((section) => section.navigation === 'reference');
}

/** Every page id whose own `navigation` is not `'reference'` (omitted counts as `'browse'`) — the
 *  browse-facing subset the sidebar, pager, and hash fallback show. Pass this as `orderedIds`'s own
 *  `availableIds` to drop reference-only pages from the browse sequence while leaving the complete
 *  routing universe (every id, alias, and member address) untouched — a reference page, and every
 *  member of a reference family, stays fully routable; only this browse-facing presentation filter
 *  ever excludes it. */
export function browsableIds<TId extends string>(sections: readonly SectionDef<TId>[]): Set<TId> {
  const ids = new Set<TId>();
  for (const section of sections) if (section.navigation !== 'reference') ids.add(section.id);
  return ids;
}

/** One address the catalog-wide Source reference search can find: a whole page, or (for a family
 *  page) one of its non-whole members — the whole is never listed twice (see `aliasTargets`'s own
 *  precedent of skipping the whole among member addresses). `title` is the page's own displayed
 *  title for a page-level entry, or the member's own `title` (else its id) for a member entry, the
 *  same convention `MemberSearchEntry`'s `label` uses. `component` is set only from an actual detected binding (`SectionDef.component` /
 *  `CatalogMember.component`), never guessed. */
export interface ReferenceEntry<TId extends string = string> {
  pageId: TId;
  /** Present only for a family member other than its own whole. */
  memberId?: string;
  title: string;
  component?: string;
  aliases: readonly string[];
  /** Authored declaration source, when distinct from the detected implementation path. */
  source?: string;
  path: string;
}

/** Builds the catalog-wide reference index from the registered `SectionDef[]` — one entry per
 *  page (its own id/title/component/path, plus its family-level aliases, when any), and one per
 *  non-whole family member (its own id/component/aliases/path). Never a second, hand-authored
 *  registry: every field here already exists on the runtime catalog record. */
export function buildReferenceIndex<TId extends string>(sections: readonly SectionDef<TId>[]): ReferenceEntry<TId>[] {
  const entries: ReferenceEntry<TId>[] = [];
  for (const section of sections) {
    const family = section.family;
    // Family members carry the implementation binding/path and authored declaration source;
    // section.path may instead point to the catalog page. Keep the whole in the single page entry,
    // retaining both locations when they differ. Documentation-only wholes keep no binding.
    // Merge aliases without mutating either authored array.
    const whole = family?.members.find((member) => member.id === family.whole);
    entries.push({
      pageId: section.id,
      title: section.title ?? section.id,
      component: whole?.component ?? section.component,
      aliases: [...new Set([...(family?.aliases ?? []), ...(whole?.aliases ?? [])])],
      path: whole?.path ?? section.path,
      ...(whole?.source && whole.source !== (whole.path ?? section.path) ? { source: whole.source } : {}),
    });
    for (const documented of section.documents ?? []) {
      entries.push({ pageId: section.id, memberId: documented.component, title: documented.title, component: documented.component, aliases: [], path: documented.path ?? section.path });
    }
    if (!family) continue;
    for (const member of family.members) {
      if (member.id === family.whole) continue; // the whole already has its own page-level entry above
      entries.push({
        pageId: section.id,
        memberId: member.id,
        title: member.title ?? member.id,
        component: member.component,
        aliases: member.aliases ?? [],
        path: member.path,
        ...(member.source !== member.path ? { source: member.source } : {}),
      });
    }
  }
  return entries;
}

/** Reference search hits (spec #60's "Search IDs, human titles, component names where known,
 *  aliases and source paths"): case-insensitive substring over every one of those fields. Mirrors
 *  `catalogNavigation.ts`'s own `searchResults`/`filterGroups` convention — trimmed, empty query
 *  returns no hits. */
export function searchReferenceIndex<TId extends string>(
  entries: readonly ReferenceEntry<TId>[],
  query: string,
): ReferenceEntry<TId>[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entries.filter((entry) =>
    entry.pageId.toLowerCase().includes(q)
    || (entry.memberId?.toLowerCase().includes(q) ?? false)
    || entry.title.toLowerCase().includes(q)
    || (entry.component?.toLowerCase().includes(q) ?? false)
    || entry.aliases.some((alias) => alias.toLowerCase().includes(q))
    || (entry.source?.toLowerCase().includes(q) ?? false)
    || entry.path.toLowerCase().includes(q));
}

/** Where a name (not a URL fragment — see `catalogNavigation.ts`'s own `resolveRoute` for that)
 *  resolves, for #60's reference journey: a real address, found to be claimed by more than one
 *  entry's component binding (never guessed — the caller must say so rather than silently picking
 *  one), or not found at all. */
export type ReferenceResolution<TId extends string> =
  | { kind: 'address'; pageId: TId; memberId?: string }
  | { kind: 'ambiguous' }
  | { kind: 'unresolved' };

/** Resolves `name` to its one catalog address: an exact registered page id or member/page alias
 *  always wins first (reusing the same `order`/`aliases` the viewer's own routing already derives
 *  — see `catalogNavigation.ts`'s `orderedIds`/`aliasTargets`, never duplicated here), falling back
 *  to the one unambiguous reference-index entry whose own `component` binding names it. Lets a
 *  normal page be found by its component export even when that name differs from the page's own
 *  id — but never invents a new global URL alias from it: a component name shared by more than one
 *  entry resolves to `'ambiguous'`, not a guess. */
export function resolveReference<TId extends string>(
  name: string,
  order: readonly TId[],
  aliases: ReadonlyMap<string, AliasTarget>,
  entries: readonly ReferenceEntry<TId>[],
): ReferenceResolution<TId> {
  if ((order as readonly string[]).includes(name)) return { kind: 'address', pageId: name as TId };
  const aliasTarget = aliases.get(name);
  if (aliasTarget) return { kind: 'address', pageId: aliasTarget.pageId as TId, memberId: aliasTarget.memberId };
  const matches = entries.filter((entry) => entry.component === name);
  if (matches.length === 0) return { kind: 'unresolved' };
  if (matches.length > 1) return { kind: 'ambiguous' };
  const [match] = matches;
  return { kind: 'address', pageId: match.pageId, memberId: match.memberId };
}

/** Task 2B2: the smallest shared contract `CatalogShell` hands its own ordinary/family renderers
 *  (`SectionBlock` → `ReferenceDetails`, `FamilyPage`) so an existing reference fact (a Composition
 *  name, an "also used by" user, a `related`/anatomy name) can become a real, canonical,
 *  activatable link — through the one accepted resolver above, never a second lookup. Explicit
 *  props, not a global context: a standalone demo renderer (this very framework's own catalog
 *  pages included) never receives one unless its own caller passes it, so it can never accidentally
 *  inherit an outer catalog's registry. Omitted everywhere it's optional — a caller with no
 *  `navigation` keeps its own prior resolution/activation default untouched (see each call site's
 *  own doc comment, e.g. `FamilyPage`'s `resolvesAddress`). */
export interface ReferenceNavigation<TId extends string = string> {
  /** Resolves `name` to its one real catalog address through `resolveReference`'s own order —
   *  `undefined` for `'ambiguous'`/`'unresolved'` (never a guess). Method syntax (not a
   *  property-typed arrow function), deliberately, so a `ReferenceNavigation<TId>` built with the
   *  catalog's own real union type stays assignable to the plain `ReferenceNavigation` (its default
   *  `TId = string`) every non-generic internal renderer below this file declares — `FamilyPage.tsx`
   *  already keeps the same page/member ids as plain `string` once past its own top-level props. */
  resolve(name: string): { pageId: TId; memberId?: string } | undefined;
  /** Opens the resolved address through the shell's own real activation, recording the real
   *  page/member origin and focusing the destination exactly like every other navigation.
   *  `sourceMemberId`, when supplied, names the family member (or whole) that actually owns the
   *  activated reference (e.g. a Part's own Uses/related/"also used by" line) — the shell validates
   *  it against the current page's own family before trusting it, so the recorded origin is the
   *  part itself rather than just the page. Omitted (a page-level reference, e.g. `relatedPages` or
   *  an anatomy "other page" entry): the origin is the page alone. */
  open(pageId: TId, memberId?: string, sourceMemberId?: string): void;
  /** Whether `pageId` is a component page, so what it documents counts as a part (the shell's
   *  `partGroups`). Optional: without it every page does. */
  isPart?(pageId: TId, memberId?: string): boolean;
  /** What a card for `pageId` shows: the page's title and its first specimen (`source` is absent
   *  when the page has none, e.g. a token page). Optional: without it a Parts card falls back to
   *  the name it was declared with and an empty thumbnail frame. */
  page?(pageId: TId): { title: string; source?: ThumbnailSource } | undefined;
}

/** `name`'s resolved activation — its real target address plus the activation handler — or
 *  `undefined` when `navigation` is omitted (the caller's own prior default; never fabricate one)
 *  or `name` doesn't resolve (honest plain text). One path for every call site that today repeats
 *  its own "resolve, then build a link" — `ReferenceDetails.tsx`'s Composition facts, and
 *  `FamilyPage.tsx`'s below-specimens/whole/uses/related-page/anatomy links.
 *
 *  Deliberately returns the target, not a ready-made `href` string: this file's own cross-module
 *  imports (`catalogNavigation.ts`) stay type-only (see the `.ts`-suffixed `import type` above),
 *  which is what lets it run both under Node's direct `--experimental-strip-types` test execution
 *  (which requires that suffix on a relative import) and under the published package's own
 *  consumer-facing bundler typecheck (which forbids a *value* import with that same suffix,
 *  `allowImportingTsExtensions` being off) — a plain value import of `hashForId` here could only
 *  ever satisfy one of the two. Every caller is already a `.tsx` file with its own ordinary,
 *  extension-less `hashForId` import, so building the real `href` (`hashForId(memberId ??
 *  pageId)`) stays one line at each call site rather than a second, duplicated implementation. */
/** A modified click (open in a new tab/window) or a non-primary button must reach the browser's
 *  own anchor handling untouched — the same check `SourceReferencePicker.tsx`'s own `ResultRow`
 *  already makes for its result links, duplicated here (rather than exported from there) because
 *  that file is a React component this pure module never imports. */
function isModifiedPress(event: unknown): boolean {
  const e = event as { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number } | null | undefined;
  return Boolean(e?.metaKey || e?.ctrlKey || e?.shiftKey || (typeof e?.button === 'number' && e.button !== 0));
}

export function referenceLinkProps<TId extends string>(
  navigation: ReferenceNavigation<TId> | undefined,
  name: string,
  /** The family member (or whole) that owns this particular reference, when the call site is
   *  scoped to one — see `ReferenceNavigation.open`'s own doc comment. */
  sourceMemberId?: string,
): { pageId: TId; memberId?: string; onPress: (event?: { preventDefault?: () => void; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number }) => void } | undefined {
  if (!navigation) return undefined;
  const target = navigation.resolve(name);
  if (!target) return undefined;
  return {
    pageId: target.pageId,
    memberId: target.memberId,
    onPress: (event) => {
      if (isModifiedPress(event)) return; // let the browser open it in a new tab/window
      // The shell owns normal activation and its own URL synchronization — the native anchor
      // default must never race it, embedded or not (an embedded shell additionally never lets
      // that synchronization touch the host document's own address).
      event?.preventDefault?.();
      navigation.open(target.pageId, target.memberId, sourceMemberId);
    },
  };
}
