import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { Blocks, SectionPagerRow, type SectionPager } from './SectionBlock';
import { PropsTable } from './PropsTable';
import { presentationBlocks } from './comparison';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import { hashForId } from './catalogNavigation';
// A plain relative import, not the `#familyModel` subpath (Errata 7): that mapping exists so a
// *pure* module (like `pageApi.ts`) can satisfy both Node's test runner (which needs a real `.ts`
// specifier) and a consumer's bundler-mode `tsc` (which rejects one) for the same import. This
// file is a React component with no test of its own that imports it directly under Node, so it
// only ever goes through the bundler — the same plain extensionless import every other `.tsx` file
// here already uses for its own pure-module siblings (e.g. `CatalogShell.tsx` → `./catalogNavigation`).
import {
  ariaLevelFor,
  disclosureContent,
  disclosureLabel,
  headerRoleFor,
  linkifyRelated,
  orderedSections,
  relationshipVisible,
  resolveWhole,
  sectionFor,
  shouldRunMemberJump,
  type DisclosurePart,
  type MemberJumpState,
  type RelatedSegment,
} from './familyModel';
import type { CatalogMember, CatalogMemberSection, ComposedOfEntry, FamilyDef, PreviewWidths, PropDef, SectionDef } from './types';

/** `SectionDef`'s parts `presentationBlocks`/`Blocks` actually read, built from one family member
 *  so its own specimens render through the exact same renderers (`VariantGroup`, `ComparisonGrid`,
 *  `ComparisonList`, `SpecimenSurface`) a normal page's do, with no second copy of that logic (spec
 *  §5.2 "Member block"). A member's `hide` only ever hides `accessibility`/`props` (never
 *  `variants`/`states`), so this never sets `hide` — a member's specimens are never hidden by it. */
function memberAsSectionDef(member: CatalogMember): SectionDef {
  return {
    id: member.id,
    description: member.description,
    path: member.source,
    variants: member.variants,
    states: member.states,
    comparison: member.comparison,
    specimenSize: member.specimenSize,
    specimenSurface: member.specimenSurface,
    previewWidths: member.previewWidths,
    previewLayout: member.previewLayout,
  };
}

type HeaderRole = ReturnType<typeof headerRoleFor>;

const HEADER_TEXT_STYLE: Record<HeaderRole, object> = {
  heading1: CATALOG_TEXT.heading1,
  heading2: CATALOG_TEXT.heading2,
  heading3: CATALOG_TEXT.heading3,
  bodyStrong: CATALOG_TEXT.bodyStrong,
  body: CATALOG_TEXT.body,
};

/** A section with no members — the whole's own stand-in `section` for `relationshipVisible`,
 *  which never reads it when `isWhole` is true. */
const WHOLE_SECTION: CatalogMemberSection = { label: '', kind: 'blocks', inWhole: true, members: [] };

/** Fidelity badge (spec §5.2 "Badges"): no existing fidelity/OS badge to reuse, so this is a small
 *  pill on `microLabel`, reusing `SectionBlock`'s own OS-badge visual. `replicated` keeps that
 *  plain pill; `approximated` and `documentation-only` both get the gray/muted treatment the
 *  approved v8 bytes use for both (its final `.fidelity-approximated`/`.fidelity-doc-only` rules
 *  are identical). */
function FidelityBadge({ fidelity }: { fidelity: CatalogMember['fidelity'] }) {
  const muted = fidelity !== 'replicated';
  const label = fidelity === 'documentation-only' ? 'Documentation only' : fidelity === 'approximated' ? 'Approximated' : 'Replicated';
  return (
    <View style={[styles.badge, muted && styles.badgeMuted]}>
      <Text style={[styles.badgeText, muted && styles.badgeTextMuted]}>{label}</Text>
    </View>
  );
}

/** V2c item 8: a member's own OS-component marker, passed through to the member header — reuses
 *  `SectionBlock`'s own badge visual (`osBadge`/`osBadgeText`) so a member documented as a native
 *  control reads the same way a whole page's does. */
function OsBadge({ osComponent }: { osComponent: NonNullable<CatalogMember['osComponent']> }) {
  return (
    <View style={styles.osBadge}>
      <Text style={styles.osBadgeText}>{osComponent === 'full' ? 'OS component' : 'Partly OS component'}</Text>
    </View>
  );
}

/** The outline number + name + fidelity badge row (spec §5.2 "Outline numbers", "Header by
 *  level"): the number is shown at the header's own size, muted, and hidden from screen readers;
 *  only the name sits inside the `role="heading"` node, so assistive tech announces just the name
 *  at the right level. Used by both a whole/block member and a folded row — a folded row passes no
 *  `headingRef`/`ariaLevel` since "a folded row is a toggle button, not a heading" (spec). */
function MemberHeader({
  number,
  name,
  level,
  fidelity,
  osComponent,
  heading,
  headingRef,
}: {
  number: string;
  name: string;
  level: number;
  fidelity: CatalogMember['fidelity'];
  osComponent?: CatalogMember['osComponent'];
  /** Whether this header is a real heading (a block member) or inert text inside a folded row's
   *  own toggle button. */
  heading: boolean;
  headingRef?: React.Ref<View>;
}) {
  const role = headerRoleFor(level);
  const nameNode = <Text style={[HEADER_TEXT_STYLE[role], styles.memberName]}>{name}</Text>;
  return (
    <View style={styles.memberHead}>
      <Text {...({ 'aria-hidden': true } as Record<string, unknown>)} style={[HEADER_TEXT_STYLE[role], styles.outlineNum]}>
        {number}
      </Text>
      {heading ? (
        <View ref={headingRef} tabIndex={-1} role="heading" {...({ 'aria-level': ariaLevelFor(level) } as Record<string, unknown>)} style={styles.headingTarget}>
          {nameNode}
        </View>
      ) : (
        nameNode
      )}
      {osComponent && <OsBadge osComponent={osComponent} />}
      <FidelityBadge fidelity={fidelity} />
    </View>
  );
}

/** `[related ·] [relationship ·] source path:line` (spec §5.2 "Below the specimens"). A member
 *  name inside `related` is a link to that member's address — a real `href`, like every other
 *  in-app link, so clicking it goes through the same `hashchange` routing as typing the address or
 *  using search (`CatalogShell`). */
function BelowSpecimensLine({
  related,
  showRelationship,
  relationship,
  source,
}: {
  related?: RelatedSegment[];
  showRelationship: boolean;
  relationship: string;
  source: string;
}) {
  return (
    <Text style={styles.belowLine}>
      {related &&
        related.map((segment, i) =>
          segment.memberId ? (
            <Text key={i} role="link" style={styles.relatedLink} {...({ href: hashForId(segment.memberId) } as Record<string, unknown>)}>
              {segment.text}
            </Text>
          ) : (
            <Text key={i}>{segment.text}</Text>
          ),
        )}
      {related && ' · '}
      {showRelationship && `${relationship} · `}
      {source}
    </Text>
  );
}

/** "Uses X (role), Y (role2)" (v8's own `.uses` CSS class; V2d item 3): one caption line inside
 *  the disclosure, after notes and before Guidance. A name links — the same accent treatment
 *  `BelowSpecimensLine`'s own `related` links use — when it resolves to a real catalog address (a
 *  page, member, or alias); otherwise it shows in `codeSmall`, since there's nothing to link to. */
function UsesLine({ composedOf, resolvesAddress }: { composedOf: ComposedOfEntry[]; resolvesAddress: (name: string) => boolean }) {
  return (
    <Text style={styles.usesLine}>
      {'Uses '}
      {composedOf.map((entry, i) => (
        <Text key={i}>
          {resolvesAddress(entry.component) ? (
            <Text role="link" style={styles.relatedLink} {...({ href: hashForId(entry.component) } as Record<string, unknown>)}>
              {entry.component}
            </Text>
          ) : (
            <Text style={styles.usesCode}>{entry.component}</Text>
          )}
          {` (${entry.role})`}
          {i < composedOf.length - 1 ? ', ' : ''}
        </Text>
      ))}
    </Text>
  );
}

/** The disclosure's body (spec §5.2 "Disclosure"): notes, then Uses (V2d item 2), then Guidance,
 *  then Accessibility, then generated Props (through the existing `PropsTable`), then the Swift
 *  excerpt — in the order `disclosureContent` already decided; this only ever renders the parts it
 *  lists. V2b item 10: the Guidance/Accessibility paragraphs sit under the same short
 *  `captionStrong` leads `ReferenceDetails.tsx` already uses for `whenToUse`/`a11y`. */
function DisclosureBody({
  member,
  parts,
  resolvedProps,
  resolvesAddress,
}: {
  member: CatalogMember;
  parts: DisclosurePart[];
  resolvedProps?: PropDef[];
  resolvesAddress: (name: string) => boolean;
}) {
  return (
    <View style={styles.disclosureBody}>
      {parts.includes('notes') &&
        member.notes!.map((note, i) => (
          <Text key={i} style={styles.note}>
            {'• '}
            {note}
          </Text>
        ))}
      {parts.includes('uses') && <UsesLine composedOf={member.composedOf!} resolvesAddress={resolvesAddress} />}
      {parts.includes('whenToUse') && (
        <Text style={styles.disclosureText}>
          <Text style={styles.disclosureLead}>Guidance </Text>
          {member.whenToUse}
        </Text>
      )}
      {parts.includes('a11y') && (
        <Text style={styles.disclosureText}>
          <Text style={styles.disclosureLead}>Accessibility </Text>
          {member.a11y}
        </Text>
      )}
      {parts.includes('props') && resolvedProps && <PropsTable props={resolvedProps} />}
      {parts.includes('api') && (
        <View style={styles.apiBlock}>
          <Text style={styles.apiText}>{member.api}</Text>
        </View>
      )}
    </View>
  );
}

/** V2b item 6: the disclosure toggle shows a chevron before its label (`›` closed, `⌄` open, as
 *  v8 does), on the `icon` role, hidden from screen readers (the toggle's own accessible name is
 *  its text label — Errata 4's `accessibilityState`/`aria-expanded` already say whether it's
 *  open). No animation. */
function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <Text {...({ 'aria-hidden': true } as Record<string, unknown>)} style={styles.chevron}>
      {open ? '⌄' : '›'}
    </Text>
  );
}

interface MemberRenderProps {
  member: CatalogMember & { props?: PropDef[]; path: string };
  number: string;
  level: number;
  section: CatalogMemberSection;
  isWhole: boolean;
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  /** V2b item 9: the page's own label for the disclosure's API part (`FamilyDef.apiLabel`,
   *  default `'API'`). */
  apiLabel: string;
  /** V2d item 3: whether a name (a `composedOf` entry's `component`) resolves to a real catalog
   *  address — a page, member, or alias — so `UsesLine` knows which names to link. */
  resolvesAddress: (name: string) => boolean;
  // Pressable forwards its ref to its underlying `View` (react-native's own `Pressable.d.ts`), so
  // a registered node is always a `View` instance whether it came from a block member's `View`
  // heading target or a folded row's `Pressable`.
  registerNode: (id: string, node: View | null) => void;
}

/** A whole or block-section member (spec §5.2 "Member block"): header → description → specimens
 *  (through `Blocks`, when the member has any — "a block member with none simply has no specimen
 *  card") → below-the-specimens line → a closed-by-default disclosure. */
function MemberBlock({ member, number, level, section, isWhole, allMemberIds, defaultPreviewWidths, apiLabel, resolvesAddress, registerNode }: MemberRenderProps) {
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [disclosureFocused, setDisclosureFocused] = useState(false);
  const surface = member.specimenSurface ?? DEFAULT_SPECIMEN_SURFACE;
  const memberDef = useMemo(() => memberAsSectionDef(member), [member]);
  const blocks = useMemo(
    () => presentationBlocks(memberDef, { defaultPreviewWidths }).filter((block) => block.kind !== 'empty'),
    [memberDef, defaultPreviewWidths],
  );
  const related = member.related ? linkifyRelated(member.related, allMemberIds) : undefined;
  const parts = disclosureContent(member, member.props);
  const label = disclosureLabel(member, apiLabel, parts.includes('props'));

  return (
    <View style={styles.memberBlock}>
      <MemberHeader
        number={number}
        name={member.id}
        level={level}
        fidelity={member.fidelity}
        osComponent={member.osComponent}
        heading
        headingRef={(node) => registerNode(member.id, node)}
      />
      <Text style={styles.memberDesc}>{member.description}</Text>
      {blocks.length > 0 && (
        // V2b item 5: a member's own specimen card sits CATALOG_SPACE.lg above the line below it
        // — this wrapper supplies the extra margin beyond `memberBlock`'s own uniform
        // CATALOG_SPACE.sm gap, instead of double-stacking with `Blocks`' own page-level
        // marginBottom (`trimOuterMargin`), which together measured ~44px (v8: 16px).
        <View style={styles.memberSpecimens}>
          {/* V2b item 4: no uppercase "Variants"/"States" block label inside a member — v8 has none. */}
          <Blocks blocks={blocks} def={memberDef} surface={surface} showLabels={false} trimOuterMargin />
        </View>
      )}
      {member.notShown && <Text style={styles.belowLine}>{member.notShown}</Text>}
      <BelowSpecimensLine
        related={related}
        showRelationship={relationshipVisible(member, section, isWhole, false)}
        relationship={member.relationship}
        source={member.source}
      />
      {parts.length > 0 && (
        <Pressable
          onPress={() => setDisclosureOpen((open) => !open)}
          onFocus={() => setDisclosureFocused(true)}
          onBlur={() => setDisclosureFocused(false)}
          accessibilityRole="button"
          accessibilityState={{ expanded: disclosureOpen }}
          {...({ 'aria-expanded': disclosureOpen } as Record<string, unknown>)}
          style={[styles.disclosureToggle, disclosureFocused && styles.focusRing]}
        >
          <DisclosureChevron open={disclosureOpen} />
          <Text style={styles.disclosureToggleLabel}>{label}</Text>
        </Pressable>
      )}
      {disclosureOpen && parts.length > 0 && (
        <DisclosureBody member={member} parts={parts} resolvedProps={member.props} resolvesAddress={resolvesAddress} />
      )}
    </View>
  );
}

/** One row of a folded `list` section (spec §5.2 "Folded row"): the whole row is itself the
 *  toggle — closed, it shows only the header and description; open, it adds the below-the-
 *  specimens line and the disclosure body directly (no nested second toggle). Folded rows never
 *  show specimens (spec's v8 reference keeps every folded-row example documentation-only). */
function FoldedRow({ member, number, level, allMemberIds, resolvesAddress, open, onToggle, registerNode }: MemberRenderProps & { open: boolean; onToggle: () => void }) {
  const [focused, setFocused] = useState(false);
  const related = member.related ? linkifyRelated(member.related, allMemberIds) : undefined;
  const parts = disclosureContent(member, member.props);
  return (
    <Pressable
      ref={(node) => registerNode(member.id, node)}
      onPress={onToggle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      {...({ 'aria-expanded': open } as Record<string, unknown>)}
      style={[styles.foldedRow, focused && styles.focusRing]}
    >
      <MemberHeader number={number} name={member.id} level={level} fidelity={member.fidelity} osComponent={member.osComponent} heading={false} />
      <Text style={styles.memberDesc}>{member.description}</Text>
      {open && (
        <View style={styles.foldedRowBody}>
          <BelowSpecimensLine related={related} showRelationship={false} relationship={member.relationship} source={member.source} />
          {parts.length > 0 && (
            <DisclosureBody member={member} parts={parts} resolvedProps={member.props} resolvesAddress={resolvesAddress} />
          )}
        </View>
      )}
    </Pressable>
  );
}

/** One section of blocks or a folded list card (spec §5.2 "Section label", "Folded row"): a rule
 *  above, the label, then either every member as its own block, or one card of folded rows with
 *  dividers only between them. */
function FamilySection({
  section,
  members,
  outline,
  allMemberIds,
  defaultPreviewWidths,
  apiLabel,
  resolvesAddress,
  openRows,
  onToggleRow,
  registerNode,
}: {
  section: CatalogMemberSection;
  members: Array<CatalogMember & { props?: PropDef[]; path: string }>;
  outline: FamilyDef['outline'];
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  openRows: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  registerNode: (id: string, node: View | null) => void;
}) {
  return (
    <View style={styles.section}>
      {/* Spec §5.2 "Heading semantics": section labels sit at the same level as the whole (2). */}
      <Text role="heading" {...({ 'aria-level': 2 } as Record<string, unknown>)} style={styles.sectionLabel}>
        {section.label}
      </Text>
      {section.kind === 'blocks' ? (
        <View style={styles.blocksSection}>
          {members.map((member) => (
            <MemberBlock
              key={member.id}
              member={member}
              number={outline.get(member.id)?.number ?? ''}
              level={outline.get(member.id)?.level ?? 2}
              section={section}
              isWhole={false}
              allMemberIds={allMemberIds}
              defaultPreviewWidths={defaultPreviewWidths}
              apiLabel={apiLabel}
              resolvesAddress={resolvesAddress}
              registerNode={registerNode}
            />
          ))}
        </View>
      ) : (
        <View style={styles.foldedList}>
          {members.map((member, i) => (
            <View key={member.id} style={[styles.foldedListRow, i < members.length - 1 && styles.foldedListRowDivider]}>
              <FoldedRow
                member={member}
                number={outline.get(member.id)?.number ?? ''}
                level={outline.get(member.id)?.level ?? 2}
                section={section}
                isWhole={false}
                allMemberIds={allMemberIds}
                defaultPreviewWidths={defaultPreviewWidths}
                apiLabel={apiLabel}
                resolvesAddress={resolvesAddress}
                open={openRows.has(member.id)}
                onToggle={() => onToggleRow(member.id)}
                registerNode={registerNode}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Scrolls a member's node into view and moves focus to it (spec §5.3 "Member address"). The jump
 *  is always instant, like a normal anchor link: a smooth `scrollIntoView` does not reliably move
 *  the shell's nested scroll container on web (the same limitation `CatalogShell`'s
 *  `resetMainScroll` works around), and an instant jump also satisfies Reduce Motion. Native has
 *  no scroll-into-view of its own; `AccessibilityInfo`'s focus call is enough there. */
function scrollAndFocusMember(node: View): void {
  if (Platform.OS === 'web') {
    const dom = node as unknown as { scrollIntoView?: (options: { behavior: 'auto'; block: 'start' }) => void; focus?: (options?: { preventScroll?: boolean }) => void };
    dom.scrollIntoView?.({ behavior: 'auto', block: 'start' });
    dom.focus?.({ preventScroll: true });
    return;
  }
  const handle = findNodeHandle(node as unknown as View);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}

/**
 * A family page (spec §5): the whole, then its sections in order (`inWhole` sections first), each
 * either full member blocks or one folded list card. Renders exactly like a normal page's head
 * (breadcrumb, title, summary, pager) when `def.family` is set, in place of `SectionBlock`'s usual
 * single-component layout (`CatalogShell`).
 */
export function FamilyPage<TId extends string>({
  def,
  groupLabel,
  breadcrumbRoot,
  banner,
  pager,
  headingRef,
  defaultPreviewWidths,
  focusMemberId,
  focusNonce,
  knownAddressIds,
}: {
  def: SectionDef<TId>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  banner?: React.ReactNode;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  defaultPreviewWidths?: PreviewWidths;
  /** Spec §5.3 "Member address": the member to scroll to, open (if it's a folded row) and focus
   *  once this page has rendered — set by `CatalogShell` from `resolveRoute`'s `member` route.
   *  `undefined` for a plain family-address visit, which focuses the page head instead, like any
   *  other page. */
  focusMemberId?: string;
  /** V2c item 11: bumped by `CatalogShell` on every activation of `focusMemberId`, even a repeat
   *  one — a plain string/value comparison would otherwise never re-trigger the jump for
   *  re-selecting the same member address twice in a row. */
  focusNonce?: number;
  /** V2d item 3: every real catalog address outside this family — every other page's own id, plus
   *  every member id/alias `catalogNavigation.ts`'s `aliasTargets` already resolves — so a
   *  member's `composedOf` can link to a name belonging to a different family, or a plain
   *  component/page, not only to a sibling member of this same family (`allMemberIds`, always
   *  included below regardless of this prop). `CatalogShell` passes its own catalog-wide set;
   *  omitted when `FamilyPage` is used standalone (e.g. this very page's own live demo), where
   *  only this family's own members can resolve. */
  knownAddressIds?: ReadonlySet<string>;
}) {
  const family = def.family!;
  const apiLabel = family.apiLabel ?? 'API';
  const byId = useMemo(() => new Map(family.members.map((member) => [member.id, member])), [family.members]);
  // N7: a `whole` that isn't one of its own members (bad data, already reported by
  // `validateFamily`) must degrade to a missing block, never a crash reading an absent member.
  const wholeMember = resolveWhole(byId, family.whole);
  const sections = useMemo(() => orderedSections(family.sections), [family.sections]);
  const allMemberIds = useMemo(() => family.members.map((member) => member.id), [family.members]);
  const resolvesAddress = useMemo(() => {
    const ids = new Set<string>([...(knownAddressIds ?? []), ...allMemberIds]);
    return (name: string) => ids.has(name);
  }, [knownAddressIds, allMemberIds]);

  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(() => new Set());
  const toggleRow = (id: string) => setOpenRows((prev) => (prev.has(id) ? new Set([...prev].filter((x) => x !== id)) : new Set(prev).add(id)));

  const nodesRef = useRef<Map<string, View | null>>(new Map());
  const registerNode = (id: string, node: View | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  };

  // V2c item 1 (one-shot jump) + item 11 (repeat activation): `jumpRef` tracks how many scroll
  // passes are still owed to the CURRENT activation of `focusMemberId` (keyed by `focusNonce`, so
  // re-selecting the same member again still counts as a fresh activation). Opening a folded row
  // (so it has something to scroll to) is kept separate from the scroll/focus effect below (V2b
  // item 8) so a row that needs opening first gets a *second* run of that effect, after React has
  // committed its now-open (and taller) layout, rather than scrolling against the still-closed one.
  const jumpRef = useRef<MemberJumpState | undefined>(undefined);
  useEffect(() => {
    if (!focusMemberId) return;
    const owningSection = sectionFor(family.sections, focusMemberId);
    // Two passes only when this activation actually opens a currently-closed row (so its layout
    // really does change between them) — a repeat activation (V2c item 11) of an already-open row,
    // or any block member, only ever needs the one pass, so a later, unrelated toggle never finds
    // a stray second pass still owed.
    const needsOpen = owningSection?.kind === 'list' && !openRows.has(focusMemberId);
    jumpRef.current = { memberId: focusMemberId, passesLeft: needsOpen ? 2 : 1 };
    if (owningSection?.kind === 'list') setOpenRows((prev) => new Set(prev).add(focusMemberId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMemberId, focusNonce]);

  useEffect(() => {
    if (!focusMemberId || !shouldRunMemberJump(jumpRef.current, focusMemberId)) return;
    const node = nodesRef.current.get(focusMemberId);
    if (node) scrollAndFocusMember(node);
    // Re-running on `openRows` is what makes the re-run above matter: the first pass (the row
    // still closed) and the second (now open) both scroll, and only the second's measurement —
    // taken from the committed, open layout — is the one that actually lands near the top.
    // `focusNonce` (V2c item 11) is also a dependency so a repeat activation of a block member (or
    // an already-open row — see the previous effect's `needsOpen`) still re-runs this even when
    // `openRows` itself never changes. Once every owed pass has run, `shouldRunMemberJump` stops
    // this from firing again — toggling any row afterwards must never scroll or move focus again.
    jumpRef.current = { memberId: focusMemberId, passesLeft: jumpRef.current!.passesLeft - 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMemberId, openRows, focusNonce]);

  return (
    <View>
      {groupLabel && <Text style={styles.breadcrumb}>{breadcrumbRoot ? `${breadcrumbRoot} / ${groupLabel}` : groupLabel}</Text>}
      {banner}
      <View style={styles.pageHead}>
        <View style={styles.titlebar}>
          <View style={styles.titleText}>
            <View ref={headingRef} tabIndex={-1} role="heading" {...({ 'aria-level': 1 } as Record<string, unknown>)} style={styles.headingTarget}>
              <Text style={styles.title}>{def.title ?? def.id}</Text>
            </View>
            <Text style={styles.desc}>{def.description}</Text>
            {family.notShown && (
              <Text style={styles.notShown}>
                <Text style={styles.notShownLead}>Not shown in the browser: </Text>
                {family.notShown}
              </Text>
            )}
          </View>
          {pager && <SectionPagerRow pager={pager} />}
        </View>
      </View>

      {wholeMember && (
        <MemberBlock
          member={wholeMember}
          number="1"
          level={1}
          section={WHOLE_SECTION}
          isWhole
          allMemberIds={allMemberIds}
          defaultPreviewWidths={defaultPreviewWidths}
          apiLabel={apiLabel}
          resolvesAddress={resolvesAddress}
          registerNode={registerNode}
        />
      )}

      {sections.map((section, index) => (
        <FamilySection
          // V2c item 14: keyed by index, not the section's own label — two sections sharing a
          // label (an already-reported, degenerate shape) must never collide as React keys.
          key={index}
          section={section}
          // V2c item 2: a section listing an id that isn't a real member (already reported by
          // `validateFamily`) must degrade to a missing block, never a crash reading `byId.get(id)!`.
          members={section.members.flatMap((id) => { const member = byId.get(id); return member ? [member] : []; })}
          outline={family.outline}
          allMemberIds={allMemberIds}
          defaultPreviewWidths={defaultPreviewWidths}
          apiLabel={apiLabel}
          resolvesAddress={resolvesAddress}
          openRows={openRows}
          onToggleRow={toggleRow}
          registerNode={registerNode}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  pageHead: { paddingBottom: CATALOG_SPACE.xl, marginBottom: CATALOG_SPACE['2xl'], borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.borderStrong },
  titlebar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: CATALOG_SPACE.xl, marginTop: 14 },
  titleText: { flex: 1 },
  headingTarget: { alignSelf: 'flex-start' },
  title: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text, marginBottom: 5 },
  desc: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  notShown: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, maxWidth: 700, marginTop: CATALOG_SPACE.sm },
  notShownLead: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },

  section: { marginTop: CATALOG_LAYOUT.blockGap, paddingTop: CATALOG_SPACE.xl, borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  sectionLabel: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.lg },
  blocksSection: { gap: CATALOG_LAYOUT.blockGap * 1.5 },

  memberBlock: { gap: CATALOG_SPACE.sm },
  memberHead: { flexDirection: 'row', alignItems: 'baseline', gap: CATALOG_SPACE.sm, flexWrap: 'wrap' },
  outlineNum: { color: CATALOG_COLOR.textMuted },
  memberName: { color: CATALOG_COLOR.text },
  memberDesc: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  // V2b item 5: `memberBlock`'s own gap already contributes CATALOG_SPACE.sm after this wrapper;
  // this adds just enough (lg - sm) on top of it so the total gap to the next line is exactly
  // CATALOG_SPACE.lg, instead of double-stacking with `Blocks`' own page-level marginBottom.
  memberSpecimens: { marginBottom: CATALOG_SPACE.lg - CATALOG_SPACE.sm },
  belowLine: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  relatedLink: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.accent },
  // V2d item 3: v8's own `.uses` line, inside the disclosure.
  usesLine: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.text, maxWidth: 700 },
  usesCode: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.text },

  badge: {
    alignSelf: 'center',
    paddingHorizontal: CATALOG_SPACE.sm,
    paddingVertical: 3,
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  badgeMuted: { backgroundColor: CATALOG_COLOR.surfaceMuted },
  badgeText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.text },
  badgeTextMuted: { color: CATALOG_COLOR.textMuted },

  // V2c item 8: the same visual `SectionBlock`'s own page-level OS badge uses.
  osBadge: {
    alignSelf: 'center',
    paddingHorizontal: CATALOG_SPACE.sm,
    paddingVertical: 3,
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  osBadgeText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.text },

  // V2c item 4: the same `focused && styles.focusRing` pattern every other catalog control uses
  // (`PagerButton`, `CatalogSidebar`'s nav/footer links) — outline-based, so focusing never shifts
  // layout.
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },

  disclosureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATALOG_SPACE.xs,
    alignSelf: 'flex-start',
    minHeight: CATALOG_LAYOUT.controlSize,
    justifyContent: 'center',
  },
  chevron: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.accent },
  disclosureToggleLabel: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.accent },
  disclosureBody: { gap: CATALOG_SPACE.sm, paddingTop: CATALOG_SPACE.xs },
  note: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.text },
  disclosureText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  disclosureLead: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  apiBlock: { backgroundColor: '#1d1d1f', borderRadius: CATALOG_RADIUS.md, padding: CATALOG_SPACE.md, marginTop: CATALOG_SPACE.xs },
  apiText: { ...CATALOG_TEXT.codeSmall, color: '#e8e8e8' },

  foldedList: { backgroundColor: CATALOG_COLOR.surface, borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, borderRadius: CATALOG_RADIUS.card, overflow: 'hidden' },
  foldedListRow: { paddingHorizontal: CATALOG_SPACE.lg, paddingVertical: CATALOG_SPACE.md },
  foldedListRowDivider: { borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  foldedRow: { gap: CATALOG_SPACE.xs, minHeight: CATALOG_LAYOUT.controlSize, justifyContent: 'center' },
  foldedRowBody: { gap: CATALOG_SPACE.sm, paddingTop: CATALOG_SPACE.sm },
});
