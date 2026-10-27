import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { CATALOG_SPACE } from './tokens';
import type { SectionPager } from './SectionBlock';
import { hashForId } from './catalogNavigation';
import { referenceLinkProps, type ReferenceNavigation } from './catalogReferences';
import { JumpRow, type JumpItem } from './JumpRow';
import { AppearsIn } from './AppearsIn';
import { UsageContext } from './usageContext';
import { pageLevelUsage, type UsageData } from './usage';
import { AnatomyBox, FamilyPageHead, FamilyPart, MemberPanelHost, PartOfLine, PartTreeBranch, scrollAndFocusMember, type FamilyMember } from './FamilyPage';
import { buildPartTree } from './familyModel';
import type { CatalogAnatomy, FamilyDef, PreviewWidths, SectionDef } from './types';

/** #63 R2: the same "resolve, then build a real link" `FamilyPage.tsx`'s own module-private
 *  `familyLink` already implements for a same-family member address — duplicated here as a small
 *  function (rather than exporting that private helper) since a group page's own jump chip is the
 *  only call site that needs it outside that file. */
function memberLink(
  navigation: ReferenceNavigation | undefined,
  resolvesAddress: (name: string) => boolean,
  memberId: string,
): { href: string; onPress?: (event?: { preventDefault?: () => void }) => void } | undefined {
  if (navigation) {
    const activation = referenceLinkProps(navigation, memberId);
    return activation ? { href: hashForId(activation.memberId ?? activation.pageId), onPress: activation.onPress } : undefined;
  }
  return resolvesAddress(memberId) ? { href: hashForId(memberId) } : undefined;
}

type GroupMember = FamilyMember & { partOf?: { pageId: string; title: string; number: string }; anatomy?: CatalogAnatomy };

/** #63 R2: one top-level member's own section — its name row/specimens/disclosure (`FamilyPart`,
 *  unnumbered, the same piece a family's own Related member uses), its own "Part N of <Family>"
 *  link when it's an external part, its own embedded-family anatomy box (if any), and its own
 *  parts nested underneath (the same `PartTreeBranch` tree a family's Parts section renders). Its
 *  own component (rather than inline in `GroupPage`'s own `.map()`) so its tree-line `pinNodesRef`
 *  is a fresh hook per member, the same reason `FamilySectionGroup` is its own component in
 *  `FamilyPage.tsx`. */
function GroupTopLevelMember({
  member, byId, outline, descendantIds, allMemberIds, defaultPreviewWidths, apiLabel, resolvesAddress, navigation, registerNode,
}: {
  member: GroupMember;
  byId: ReadonlyMap<string, FamilyMember>;
  outline: FamilyDef['outline'];
  /** Every one of this member's own descendants on the page (not only its direct children) — the
   *  same full-subtree input `buildPartTree` expects (`FamilySectionGroup`'s own precedent). */
  descendantIds: readonly string[];
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
  registerNode: (id: string, node: View | null) => void;
}) {
  const pinNodesRef = useRef<Map<string, View | null>>(new Map());
  const tree = useMemo(() => buildPartTree(descendantIds, outline), [descendantIds, outline]);
  return (
    <View>
      <FamilyPart
        member={member}
        number={undefined}
        level={1}
        allMemberIds={allMemberIds}
        defaultPreviewWidths={defaultPreviewWidths}
        apiLabel={apiLabel}
        resolvesAddress={resolvesAddress}
        navigation={navigation}
        registerNode={registerNode}
        afterNameRow={member.partOf ? <PartOfLine partOf={member.partOf} resolvesAddress={resolvesAddress} navigation={navigation} /> : undefined}
      />
      {member.anatomy && <AnatomyBox anatomy={member.anatomy} byId={byId} outline={outline} resolvesAddress={resolvesAddress} navigation={navigation} />}
      {tree.length > 0 && (
        <View style={styles.subparts}>
          {tree.map((node) => (
            <PartTreeBranch
              key={node.id}
              node={node}
              byId={byId}
              outline={outline}
              allMemberIds={allMemberIds}
              defaultPreviewWidths={defaultPreviewWidths}
              apiLabel={apiLabel}
              resolvesAddress={resolvesAddress}
              navigation={navigation}
              registerNode={registerNode}
              pinNodesRef={pinNodesRef}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * A group page (#63 A9/R2, layout B): the same page head a family page renders, a jump row (one
 * chip per top-level member), then one section per top-level member in authored order — no Compare
 * block, no page-level whole. Every visual piece is reused from `FamilyPage.tsx`; this file only
 * decides which members are top-level and how their own parts nest under them.
 */
export function GroupPage<TId extends string>({
  def,
  groupLabel,
  breadcrumbRoot,
  banner,
  pager,
  headingRef,
  defaultPreviewWidths,
  /** Spec §5.3 "Member address", same meaning as `FamilyPage`'s own prop: the member to scroll to
   *  and focus once this page has rendered. */
  focusMemberId,
  focusNonce,
  knownAddressIds,
  navigation,
  usage,
}: {
  def: SectionDef<TId>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  banner?: React.ReactNode;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  defaultPreviewWidths?: PreviewWidths;
  /** Same meaning as `FamilyPage`'s own prop. */
  usage?: UsageData | null;
  focusMemberId?: string;
  focusNonce?: number;
  knownAddressIds?: ReadonlySet<string>;
  navigation?: ReferenceNavigation<TId>;
}) {
  const family = def.family!;
  const apiLabel = family.apiLabel ?? 'API';
  const byId = useMemo(() => new Map(family.members.map((member) => [member.id, member])), [family.members]);
  const allMemberIds = useMemo(() => family.members.map((member) => member.id), [family.members]);
  const resolvesAddress = useMemo(() => {
    const ids = new Set<string>([...(knownAddressIds ?? []), ...allMemberIds]);
    return (name: string) => ids.has(name);
  }, [knownAddressIds, allMemberIds]);

  // #63 A3: a top-level member has no parent, or a parent that isn't one of this page's own
  // members (the cross-page case `validateGroup` already accepts) — authored (array) order, the
  // same "no sections to scan" order every other group derivation already uses.
  const topLevel = useMemo(() => family.members.filter((member) => member.parent === undefined || !byId.has(member.parent)), [family.members, byId]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const member of family.members) {
      if (member.parent !== undefined && byId.has(member.parent)) map.set(member.parent, [...(map.get(member.parent) ?? []), member.id]);
    }
    return map;
  }, [family.members, byId]);

  // Every one of a top-level member's own descendants, flattened (not only its direct children) —
  // both the jump row's own "+k parts" count and `GroupTopLevelMember`'s own `buildPartTree` input
  // need the full subtree.
  const descendantsByTopLevel = useMemo(() => {
    const descendantsOf = (id: string): string[] => {
      const kids = childrenOf.get(id) ?? [];
      return [...kids, ...kids.flatMap(descendantsOf)];
    };
    return new Map(topLevel.map((member) => [member.id, descendantsOf(member.id)]));
  }, [topLevel, childrenOf]);

  // A9/R2 item 2: one jump chip per top-level member — its qualifier is "Part N of <Family>" for
  // an external part, "+k parts" for an embedded family with parts on this page, otherwise none.
  const jumpItems: JumpItem[] = useMemo(
    () =>
      topLevel.map((member) => {
        const link = memberLink(navigation, resolvesAddress, member.id);
        const partOf = (member as GroupMember).partOf;
        const descendantCount = descendantsByTopLevel.get(member.id)?.length ?? 0;
        const qualifier = partOf
          ? `Part ${partOf.number} of ${partOf.title}`
          : descendantCount > 0
            ? `+${descendantCount} part${descendantCount === 1 ? '' : 's'}`
            : undefined;
        return { id: member.id, title: member.id, qualifier, href: link?.href, onPress: link?.onPress };
      }),
    [topLevel, navigation, resolvesAddress, descendantsByTopLevel],
  );

  const nodesRef = useRef<Map<string, View | null>>(new Map());
  const registerNode = (id: string, node: View | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  };

  // No folded (`list`-kind) rows exist on a group page (layout B: every top-level member and its
  // own parts render as blocks) — unlike `FamilyPage`'s own two-phase jump, a member address here
  // is always already laid out, so one scroll/focus pass per activation is enough.
  useEffect(() => {
    if (!focusMemberId) return;
    const node = nodesRef.current.get(focusMemberId);
    if (node) scrollAndFocusMember(node);
  }, [focusMemberId, focusNonce]);

  const pageUsage = pageLevelUsage(usage, def, family.members);

  return (
    <UsageContext.Provider value={usage ?? null}>
    <MemberPanelHost>
    <View>
      <FamilyPageHead kind="group" def={def} groupLabel={groupLabel} breadcrumbRoot={breadcrumbRoot} banner={banner} pager={pager} headingRef={headingRef} notShown={family.notShown} />

      {jumpItems.length > 0 && <JumpRow items={jumpItems} />}

      <View style={styles.members}>
        {topLevel.map((member) => (
          <GroupTopLevelMember
            key={member.id}
            member={member as GroupMember}
            byId={byId}
            outline={family.outline}
            descendantIds={descendantsByTopLevel.get(member.id) ?? []}
            allMemberIds={allMemberIds}
            defaultPreviewWidths={defaultPreviewWidths}
            apiLabel={apiLabel}
            resolvesAddress={resolvesAddress}
            navigation={navigation}
            registerNode={registerNode}
          />
        ))}
      </View>
      {/* A usage key that names the page itself shows after the members, not above the first one. */}
      {pageUsage?.uses.length ? <View style={styles.pageUsage}><AppearsIn entry={pageUsage} /></View> : null}
    </View>
    </MemberPanelHost>
    </UsageContext.Provider>
  );
}

const MEMBER_GAP = 64;
const PIN_GUTTER = 52;

const styles = StyleSheet.create({
  pageUsage: { marginTop: CATALOG_SPACE['2xl'] },
  // Same rhythm as `FamilyPage`'s own "Parts"/"Related" group body (`labeledGroupBody`) — one
  // top-level member's section to the next.
  members: { marginTop: CATALOG_SPACE.xl, gap: MEMBER_GAP },
  // Same nesting gutter `FamilyPage`'s own `subparts` style uses for a Part's own children.
  subparts: { marginTop: MEMBER_GAP, marginLeft: PIN_GUTTER, gap: MEMBER_GAP },
});
