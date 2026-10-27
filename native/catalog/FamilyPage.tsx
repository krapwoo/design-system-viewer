import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { CatalogButton } from './CatalogButton';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { Blocks, SectionPagerRow, type SectionPager } from './SectionBlock';
import { PropsTable } from './PropsTable';
import { presentationBlocks } from './comparison';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import { hashForId } from './catalogNavigation';
import { referenceLinkProps, type ReferenceNavigation } from './catalogReferences';
// A plain extensionless import — the same one every other `.tsx` file here already uses for its
// own pure-module siblings (e.g. `CatalogShell.tsx` → `./catalogNavigation`): this file is a React
// component with no test of its own that imports it directly under Node, so it only ever goes
// through the bundler.
import {
  alsoUsedBySegments,
  anatomyColumns,
  anatomyLayout,
  anatomyPinFor,
  ariaLevelFor,
  buildPartTree,
  disclosureContent,
  disclosureLabel,
  linkifyRelated,
  resolveWhole,
  sectionFor,
  shouldRunMemberJump,
  type DisclosurePart,
  type MemberJumpState,
  type PartTreeEntry,
  type RelatedSegment,
} from './familyModel';
import type { AlsoUsedByEntry, CatalogAnatomy, CatalogAnatomyGroup, CatalogMember, CatalogMemberSection, ComposedOfEntry, FamilyDef, PreviewWidths, PropDef, RelatedPage, SectionDef } from './types';

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

const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;

/** The one muted line under a family/group page's description: what kind of page this is and how
 *  it differs from a page of variants. The same wording on every page of that kind. */
const PAGE_KIND_EXPLAINER = {
  group: {
    lead: 'Group page.',
    text: 'These are separate components shown together because they’re used in the same place. Each has its own API, unlike variants, which are one component changed by its props.',
  },
  family: {
    lead: 'Family page.',
    text: 'One component and the parts it’s built from. Each part is its own component, unlike variants, which are one component changed by its props.',
  },
} as const;

/** #63 R2: the shared page head both `FamilyPage` and `GroupPage` render — breadcrumb, banner,
 *  title/description (plus an optional "Not shown in the browser" note) and the pager. Pulled out
 *  of `FamilyPage`'s own top-level render rather than duplicated, per the contract's "factor the
 *  head into a small shared piece rather than duplicating markup". */
export function FamilyPageHead<TId extends string>({
  def, kind, groupLabel, breadcrumbRoot, banner, pager, headingRef, notShown,
}: {
  /** Which page kind this head introduces — adds that kind's one-line explainer under the
   *  description (`PAGE_KIND_EXPLAINER`). */
  kind: 'family' | 'group';
  def: Pick<SectionDef<TId>, 'id' | 'title' | 'description'>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  banner?: React.ReactNode;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  /** See `FamilyDef.notShown`. */
  notShown?: string;
}) {
  return (
    <>
      {groupLabel && <Text style={styles.breadcrumb}>{breadcrumbRoot ? `${breadcrumbRoot} / ${groupLabel}` : groupLabel}</Text>}
      {banner}
      <View style={styles.pageHead}>
        <View style={styles.titlebar}>
          <View style={styles.titleText}>
            <View ref={headingRef} tabIndex={-1} role="heading" {...({ 'aria-level': 1 } as Record<string, unknown>)} style={styles.headingTarget}>
              <Text style={styles.title}>{def.title ?? def.id}</Text>
            </View>
            <Text style={styles.desc}>{def.description}</Text>
            <View style={styles.kindNote}>
              <Text style={styles.kindNoteText}>
                <Text style={styles.kindNoteLead}>{PAGE_KIND_EXPLAINER[kind].lead} </Text>
                {PAGE_KIND_EXPLAINER[kind].text}
              </Text>
            </View>
            {notShown && (
              <Text style={styles.notShown}>
                <Text style={styles.notShownLead}>Not shown in the browser: </Text>
                {notShown}
              </Text>
            )}
          </View>
          {pager && <SectionPagerRow pager={pager} />}
        </View>
      </View>
    </>
  );
}

/** Task 2B2: one path for every one of this file's own link producers (below-specimens/whole
 *  lines, Uses, related pages, anatomy legend) — `navigation` supplied: resolve+activate through
 *  the shell's own real `CatalogShell` journey (`referenceLinkProps`), the canonical address, even
 *  when it differs from `name` (an alias, or a component binding). `navigation` omitted (a
 *  standalone-mounted `FamilyPage`, this framework's own catalog demo included): keep the prior
 *  plain-`href`-only behavior, gated by the member's own `resolvesAddress` (sibling member ids,
 *  plus whatever `knownAddressIds` the caller passed) — never a dead link, same as before. */
function familyLink(
  navigation: ReferenceNavigation | undefined,
  resolvesAddress: (name: string) => boolean,
  name: string,
  /** Task 2B2 correction: the Part/whole that actually owns this call site (its Uses/related/
   *  "also used by" line) — see `ReferenceNavigation.open`'s own doc comment. Omitted for a
   *  page-level link producer (`relatedPages`, an anatomy "other page" entry, or the anatomy
   *  legend's own member row, which already names its destination). */
  sourceMemberId?: string,
): { href: string; onPress?: (event?: { preventDefault?: () => void }) => void } | undefined {
  if (navigation) {
    const activation = referenceLinkProps(navigation, name, sourceMemberId);
    return activation ? { href: hashForId(activation.memberId ?? activation.pageId), onPress: activation.onPress } : undefined;
  }
  return resolvesAddress(name) ? { href: hashForId(name) } : undefined;
}

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

/** Slice D1 item 7: a numbered pin, a filled accent pill — used both by a Part's own header and by
 *  the anatomy legend/picture (`AnatomyPin`, which also allows the dashed, no-area-of-their-own
 *  style spec §"Pins" describes). Decorative: the member's own name (not the number) is what
 *  assistive tech announces. */
function Pin({ number, dashed }: { number: string; dashed?: boolean }) {
  return (
    <View style={[styles.pin, dashed && styles.pinDashed]} {...ARIA_HIDDEN}>
      <Text style={[styles.pinText, dashed && styles.pinTextDashed]}>{number}</Text>
    </View>
  );
}

/** Slice D1 items 7–8: the name + badges row. Every part uses the same "18/24 bold" role
 *  regardless of nesting depth (item 10 removes the old per-depth header ladder) — only
 *  `aria-level` still reflects the member's real nesting depth, so assistive tech keeps an
 *  accurate outline even though the visual size no longer shrinks with it. */
function MemberNameRow({
  name,
  fidelity,
  osComponent,
  heading,
  ariaLevel,
  headingRef,
}: {
  name: string;
  fidelity: CatalogMember['fidelity'];
  osComponent?: CatalogMember['osComponent'];
  /** Whether this name sits inside a real heading (a block member) or inert text inside a folded
   *  row's own toggle button. */
  heading: boolean;
  ariaLevel?: number;
  headingRef?: React.Ref<View>;
}) {
  const nameNode = <Text style={[CATALOG_TEXT.heading2, styles.memberName]}>{name}</Text>;
  return (
    <View style={styles.memberHead}>
      {heading ? (
        <View ref={headingRef} tabIndex={-1} role="heading" {...({ 'aria-level': ariaLevel } as Record<string, unknown>)} style={styles.headingTarget}>
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

/** `[related ·] [relationship ·] source [· Also used by …]` (spec §5.2 "Below the specimens",
 *  derived "also used by" slice). A member name inside `related`, and a resolvable component in
 *  the derived "Also used by" segment, both link to that address — a real `href`, like every other
 *  in-app link, so clicking it goes through the same `hashchange` routing as typing the address or
 *  using search (`CatalogShell`). An unresolvable user (a declared user with no catalog page of its
 *  own) renders as plain text instead, the same way `UsesLine` treats an unresolvable name. */
function BelowSpecimensLine({
  related,
  showRelationship,
  relationship,
  source,
  alsoUsedBy,
  resolvesAddress,
  navigation,
  sourceMemberId,
}: {
  related?: RelatedSegment[];
  showRelationship: boolean;
  relationship: string;
  source: string;
  alsoUsedBy: AlsoUsedByEntry[];
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
  /** Task 2B2 correction: this line's own owning member — threaded into every link it renders, so
   *  a Back return lands on this member, not just the page (`familyLink`'s own doc comment). */
  sourceMemberId?: string;
}) {
  const usedBy = alsoUsedBySegments(alsoUsedBy);
  return (
    <Text style={styles.belowLine}>
      {related &&
        related.map((segment, i) => {
          const link = segment.memberId ? familyLink(navigation, resolvesAddress, segment.memberId, sourceMemberId) : undefined;
          return link ? (
            <Text key={i} role="link" style={styles.relatedLink} {...link}>
              {segment.text}
            </Text>
          ) : (
            <Text key={i}>{segment.text}</Text>
          );
        })}
      {related && ' · '}
      {showRelationship && `${relationship} · `}
      {source}
      {usedBy.length > 0 && ' · '}
      {usedBy.map((segment, i) => {
        const link = segment.component ? familyLink(navigation, resolvesAddress, segment.component, sourceMemberId) : undefined;
        return link ? (
          <Text key={i} role="link" style={styles.relatedLink} {...link}>
            {segment.text}
          </Text>
        ) : (
          <Text key={i}>{segment.text}</Text>
        );
      })}
    </Text>
  );
}

/** Slice D1 item 6: the whole's own one-line summary — `<name> · <fidelity badge> · <source>
 *  [· Also used by …]` — in place of the below-specimens line (the whole has no
 *  `relationship`/`related` to show, but it is still a member, so it still derives users). */
function WholeBelowLine({
  name,
  fidelity,
  source,
  alsoUsedBy,
  resolvesAddress,
  navigation,
}: {
  name: string;
  fidelity: CatalogMember['fidelity'];
  source: string;
  alsoUsedBy: AlsoUsedByEntry[];
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
}) {
  const usedBy = alsoUsedBySegments(alsoUsedBy);
  return (
    <View style={styles.wholeBelowRow}>
      <Text style={styles.wholeName}>{name}</Text>
      <Text style={styles.belowLine}> · </Text>
      <FidelityBadge fidelity={fidelity} />
      <Text style={styles.belowLine}> · </Text>
      <Text style={styles.belowLine}>{source}</Text>
      {usedBy.length > 0 && <Text style={styles.belowLine}> · </Text>}
      {usedBy.map((segment, i) => {
        // The whole's own inverse use returns to the whole wrapper, not just the page — `name` is
        // this very member's own id (the whole is a member like any other).
        const link = segment.component ? familyLink(navigation, resolvesAddress, segment.component, name) : undefined;
        return link ? (
          <Text key={i} role="link" style={styles.relatedLink} {...link}>
            {segment.text}
          </Text>
        ) : (
          <Text key={i} style={styles.belowLine}>
            {segment.text}
          </Text>
        );
      })}
    </View>
  );
}

/** "Uses X (role), Y (role2)" (v8's own `.uses` CSS class; V2d item 3): one caption line inside
 *  the disclosure, after notes and before Guidance. A name links — the same accent treatment
 *  `BelowSpecimensLine`'s own `related` links use — when it resolves to a real catalog address (a
 *  page, member, or alias); otherwise it shows in `codeSmall`, since there's nothing to link to. */
function UsesLine({
  composedOf,
  resolvesAddress,
  navigation,
  sourceMemberId,
}: {
  composedOf: ComposedOfEntry[];
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
  sourceMemberId?: string;
}) {
  return (
    <Text style={styles.usesLine}>
      {'Uses '}
      {composedOf.map((entry, i) => {
        const link = familyLink(navigation, resolvesAddress, entry.component, sourceMemberId);
        return (
          <Text key={i}>
            {link ? (
              <Text role="link" style={styles.relatedLink} {...link}>
                {entry.component}
              </Text>
            ) : (
              <Text style={styles.usesCode}>{entry.component}</Text>
            )}
            {` (${entry.role})`}
            {i < composedOf.length - 1 ? ', ' : ''}
          </Text>
        );
      })}
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
  navigation,
}: {
  member: CatalogMember;
  parts: DisclosurePart[];
  resolvedProps?: PropDef[];
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
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
      {parts.includes('uses') && <UsesLine composedOf={member.composedOf!} resolvesAddress={resolvesAddress} navigation={navigation} sourceMemberId={member.id} />}
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

/** The disclosure trigger's trailing chevron (`›`), on the `icon` role, hidden from screen readers
 *  (the trigger's own accessible name is its text label). Always `›`: the content opens in a side
 *  panel, never expands in place. */
function DisclosureChevron() {
  return (
    <Text {...ARIA_HIDDEN} style={styles.chevron}>
      ›
    </Text>
  );
}

/** What the one shared side panel shows: the member's disclosure, headed by its trigger's label. */
interface MemberPanelRequest {
  member: CatalogMember & { props?: PropDef[] };
  parts: DisclosurePart[];
  label: string;
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
}

interface MemberPanelControl {
  /** The member whose panel is open, if any — a trigger's `aria-expanded`. */
  activeId?: string;
  show: (request: MemberPanelRequest) => void;
  hide: () => void;
}

const MemberPanelContext = createContext<MemberPanelControl | null>(null);

const PANEL_WIDTH = 440;
/** At or below this window width the panel takes the full width, as the approved design shows at
 *  768 (the viewer has no shared narrow breakpoint constant to reuse). */
const PANEL_FULL_WIDTH_AT_OR_BELOW = 768;
/** The light scrim behind the panel — no `CATALOG_COLOR` is a translucent overlay. */
const PANEL_SCRIM = 'rgba(20,20,20,.28)';

/** The member side panel: `role="dialog"`, `aria-modal`, named by the member, one at a time, no
 *  animation. On web, `Modal` (transparent) supplies the dialog role, Esc to close, Tab
 *  containment, and returning focus to the trigger on close. React Native's own `Modal` does none
 *  of those on native (only `onRequestClose` for the hardware back button), so on native the panel
 *  moves screen-reader focus to the × itself on open (`AccessibilityInfo.setAccessibilityFocus`);
 *  it does not return focus to the trigger on close — that is left to the platform. Following a
 *  link inside it closes it first (`navigation` is wrapped), then navigates. */
function MemberPanel({ request, onClose }: { request: MemberPanelRequest; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const headingId = useId();
  const closeRef = useRef<View>(null);
  const focusClose = useCallback(() => {
    const node = closeRef.current;
    if (!node) return;
    if (Platform.OS === 'web') {
      node.focus?.();
      return;
    }
    const handle = findNodeHandle(node);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);
  const { member, parts, label, resolvesAddress, navigation } = request;
  const closingNavigation = useMemo<ReferenceNavigation | undefined>(
    () =>
      navigation && {
        resolve: (name) => navigation.resolve(name),
        open: (pageId, memberId, sourceMemberId) => {
          onClose();
          navigation.open(pageId, memberId, sourceMemberId);
        },
      },
    [navigation, onClose],
  );
  // Locks the document's own scroll while the panel is open, for hosts whose body scrolls. The
  // shell's own pane needs nothing: `Modal` portals outside it, so wheel chaining from the scrim
  // never reaches it. Restores the previous overflow on close and on unmount. (iOS Safari ignores
  // body overflow for touch scrolling.)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => { body.style.overflow = previous; };
  }, []);
  // A plain-`href` link (no shell navigation) just changes the hash — close the panel on that too.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.addEventListener('hashchange', onClose);
    return () => window.removeEventListener('hashchange', onClose);
  }, [onClose]);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} onShow={focusClose} {...({ 'aria-labelledby': headingId } as Record<string, unknown>)}>
      <View style={styles.panelRoot}>
        {/* On web, a plain View, not a Pressable: the Modal's focus trap `focus()`es descendants in turn, and
            even a tabindex=-1 scrim would take focus — an unnamed, ringless stop. Press-to-close there is a
            click handler only (the × and Esc are the keyboard paths). */}
        {Platform.OS === 'web' ? (
          <View testID="member-panel-scrim" style={styles.panelScrim} {...({ onClick: onClose } as Record<string, unknown>)} />
        ) : (
          // Native has no DOM focus trap, so a Pressable is safe there and gives tap-to-close.
          <Pressable testID="member-panel-scrim" style={styles.panelScrim} onPress={onClose} accessible={false} />
        )}
        <View style={[styles.panel, width <= PANEL_FULL_WIDTH_AT_OR_BELOW && styles.panelFull]}>
          <View style={styles.panelHead}>
            <View style={styles.panelTitle}>
              <Text style={styles.panelKicker}>{label}</Text>
              <Text nativeID={headingId} role="heading" {...({ 'aria-level': 2 } as Record<string, unknown>)} style={styles.panelName}>
                {member.id}
              </Text>
            </View>
            <CatalogButton ref={closeRef} label="×" accessibilityLabel="Close" variant="secondary" onPress={onClose} />
          </View>
          <ScrollView style={styles.panelBody} contentContainerStyle={styles.panelBodyContent}>
            <DisclosureBody member={member} parts={parts} resolvedProps={member.props} resolvesAddress={resolvesAddress} navigation={closingNavigation} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Owns the one shared side panel for a page: every member trigger below it opens it, a second
 *  trigger swaps its content, and only one is ever open. */
export function MemberPanelHost({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<MemberPanelRequest | null>(null);
  const hide = useCallback(() => setRequest(null), []);
  const control = useMemo<MemberPanelControl>(() => ({ activeId: request?.member.id, show: setRequest, hide }), [request?.member.id, hide]);
  return (
    <MemberPanelContext.Provider value={control}>
      {children}
      {request && <MemberPanel request={request} onClose={hide} />}
    </MemberPanelContext.Provider>
  );
}

/** Slice D1 item 9: "Notes and API" (using `apiLabel`) as a link-style trigger that opens the
 *  member's side panel — shared by the whole, every Part/Related member, and an open folded row.
 *  Renders nothing for a member with nothing to disclose. */
function MemberDisclosureToggle({
  member,
  apiLabel,
  resolvesAddress,
  navigation,
}: {
  member: CatalogMember & { props?: PropDef[] };
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
}) {
  const panel = useContext(MemberPanelContext);
  const [focused, setFocused] = useState(false);
  const parts = disclosureContent(member, member.props);
  if (parts.length === 0) return null;
  // A member rendered outside a page's own host still gets a working panel.
  if (!panel) {
    return (
      <MemberPanelHost>
        <MemberDisclosureToggle member={member} apiLabel={apiLabel} resolvesAddress={resolvesAddress} navigation={navigation} />
      </MemberPanelHost>
    );
  }
  const label = disclosureLabel(member, apiLabel, parts.includes('props'));
  const open = panel.activeId === member.id;
  return (
    <Pressable
      onPress={() => panel.show({ member, parts, label, resolvesAddress, navigation })}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      {...({ 'aria-expanded': open, 'aria-haspopup': 'dialog' } as Record<string, unknown>)}
      style={[styles.disclosureToggle, focused && styles.focusRing]}
    >
      <Text style={styles.disclosureToggleLabel}>{label}</Text>
      <DisclosureChevron />
    </Pressable>
  );
}

/** #63 R2: exported so `GroupPage.tsx` can type its own `byId`/member records the same way
 *  `FamilyPage`'s internals already do — a group's own `FamilyDef.members` carries the same shape
 *  plus an optional `partOf` (`types.ts`), which this type simply doesn't need to name to stay
 *  assignable. */
export type FamilyMember = CatalogMember & { props?: PropDef[]; path: string; alsoUsedBy?: AlsoUsedByEntry[] };

interface MemberRenderProps {
  member: FamilyMember;
  /** Undefined for a Related member (spec §"Related": no pin, no gutter) — `numberFor` never
   *  assigns a number outside an `inWhole` section. */
  number?: string;
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  /** V2b item 9: the page's own label for the disclosure's API part (`FamilyDef.apiLabel`,
   *  default `'API'`). */
  apiLabel: string;
  /** V2d item 3: whether a name (a `composedOf` entry's `component`) resolves to a real catalog
   *  address — a page, member, or alias — so `UsesLine` knows which names to link. */
  resolvesAddress: (name: string) => boolean;
  /** Task 2B2: `CatalogShell`'s own shared reference navigation — see `familyLink`'s own doc
   *  comment above for how it and `resolvesAddress` combine. */
  navigation?: ReferenceNavigation;
  // Pressable forwards its ref to its underlying `View` (react-native's own `Pressable.d.ts`), so
  // a registered node is always a `View` instance whether it came from a block member's `View`
  // heading target or a folded row's `Pressable`.
  registerNode: (id: string, node: View | null) => void;
  /** Slice D1 item 7 "Tree line": reports this Part's pin node, the same callback-ref pattern as
   *  `registerNode`, so a `Branch` can measure where to end its line without a `RefObject` having
   *  to be allocated and threaded down from an ancestor that doesn't yet know this part exists. */
  pinRef?: (node: View | null) => void;
}

/** Slice D1 items 7–8: a Part (numbered, with a 52px gutter for its pin and tree line) or a
 *  Related member (no pin, no gutter) — otherwise the same header and body: name, description,
 *  specimens (through `Blocks`, when the member has any), the below-specimens line, and a
 *  closed-by-default disclosure. */
/** #63 R2: exported so `GroupPage.tsx` can render a top-level group member through the exact same
 *  piece a family's own Part/Related member uses, with no second copy of its name row/specimens/
 *  below-line/disclosure rendering. `afterNameRow` is additive (`undefined` elsewhere, unchanged
 *  behavior for every existing family-page call site) — a group's own "Part N of <Family>" link
 *  (`PartOfLine`, below) renders there, right under the member's own name row and before its
 *  description, per the contract's own ordering. */
export function FamilyPart({ member, number, level, allMemberIds, defaultPreviewWidths, apiLabel, resolvesAddress, navigation, registerNode, pinRef, afterNameRow }: MemberRenderProps & { level: number; afterNameRow?: React.ReactNode }) {
  const surface = member.specimenSurface ?? DEFAULT_SPECIMEN_SURFACE;
  const memberDef = useMemo(() => memberAsSectionDef(member), [member]);
  const blocks = useMemo(
    () => presentationBlocks(memberDef, { defaultPreviewWidths }).filter((block) => block.kind !== 'empty'),
    [memberDef, defaultPreviewWidths],
  );
  const related = member.related ? linkifyRelated(member.related, allMemberIds) : undefined;
  const numbered = number !== undefined;

  return (
    <View>
      <View style={styles.partHeadRow}>
        {numbered && (
          <View style={styles.pinBox}>
            {/* The tree line measures this wrapper, so it hugs the pin itself, not the gutter. */}
            <View ref={pinRef ?? undefined}>
              <Pin number={number} />
            </View>
          </View>
        )}
        <View style={styles.partHeadMain}>
          <MemberNameRow
            name={member.id}
            fidelity={member.fidelity}
            osComponent={member.osComponent}
            heading
            ariaLevel={ariaLevelFor(level)}
            headingRef={(node) => registerNode(member.id, node)}
          />
        </View>
      </View>
      {afterNameRow}
      {/* D2 item A1: `partBody`'s own rhythm gap applies to every member, numbered or not — only
          the gutter indent (`partBodyIndented`) is conditional — so a Related member (never
          numbered) still gets the same spacing between its own description/specimens/below-line/
          disclosure as a numbered Part does. */}
      <View style={[styles.partBody, numbered && styles.partBodyIndented]}>
        <Text style={styles.memberDesc}>{member.description}</Text>
        {blocks.length > 0 && (
          // V2b item 5: a member's own specimen card sits CATALOG_SPACE.lg above the line below it
          // — this wrapper supplies the extra margin beyond `partBody`'s own uniform CATALOG_SPACE.sm
          // gap, instead of double-stacking with `Blocks`' own page-level marginBottom
          // (`trimOuterMargin`), which together measured ~44px (v8: 16px).
          <View style={styles.memberSpecimens}>
            {/* V2b item 4: no uppercase "Variants"/"States" block label inside a member — v8 has none. */}
            <Blocks blocks={blocks} def={memberDef} surface={surface} showLabels={false} trimOuterMargin />
          </View>
        )}
        {member.notShown && <Text style={styles.belowLine}>{member.notShown}</Text>}
        <BelowSpecimensLine
          related={related}
          showRelationship={false}
          relationship={member.relationship}
          source={member.source}
          alsoUsedBy={member.alsoUsedBy ?? []}
          resolvesAddress={resolvesAddress}
          navigation={navigation}
          sourceMemberId={member.id}
        />
        <View style={styles.disclosureSpacer}>
          <MemberDisclosureToggle member={member} apiLabel={apiLabel} resolvesAddress={resolvesAddress} navigation={navigation} />
        </View>
      </View>
    </View>
  );
}

/** One row of a folded `list` section (spec §5.2 "Folded row"): the row's header — pin, name and
 *  description — is the toggle, and the open body is a sibling *outside* that button, so a related
 *  link or the PropsTable never sits inside a `role="button"` and never bubbles its own click back
 *  into the toggle. Closed, it shows only the header and description; open, it adds the below-the-
 *  specimens line and the disclosure body directly (no nested second toggle). Folded rows never
 *  show specimens (spec's v8 reference keeps every folded-row example documentation-only). Slice
 *  D1: no gutter either way — a folded row's own pin (when it has a number) sits inline with its
 *  name, never offsetting the row's body. */
function FoldedRow({ member, number, allMemberIds, apiLabel, resolvesAddress, navigation, open, onToggle, registerNode }: MemberRenderProps & { open: boolean; onToggle: () => void }) {
  const [focused, setFocused] = useState(false);
  const related = member.related ? linkifyRelated(member.related, allMemberIds) : undefined;
  return (
    <View style={styles.foldedRow}>
      <Pressable
        ref={(node) => registerNode(member.id, node)}
        onPress={onToggle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        {...({ 'aria-expanded': open } as Record<string, unknown>)}
        style={[styles.foldedRowToggle, focused && styles.focusRing]}
      >
        <View style={styles.foldedRowHead}>
          {number !== undefined && <Pin number={number} />}
          <MemberNameRow name={member.id} fidelity={member.fidelity} osComponent={member.osComponent} heading={false} />
        </View>
        <Text style={styles.memberDesc}>{member.description}</Text>
      </Pressable>
      {/* Sibling of the toggle `Pressable`, same pattern `MemberDisclosureToggle` uses above — a
          related link (or the PropsTable) here must never sit inside a `role="button"`, and on
          web must never bubble its own click into this row's own press handler and close it. */}
      {open && (
        <View style={styles.foldedRowBody}>
          <BelowSpecimensLine
            related={related}
            showRelationship={false}
            relationship={member.relationship}
            source={member.source}
            alsoUsedBy={member.alsoUsedBy ?? []}
            resolvesAddress={resolvesAddress}
            navigation={navigation}
            sourceMemberId={member.id}
          />
          <MemberDisclosureToggle member={member} apiLabel={apiLabel} resolvesAddress={resolvesAddress} navigation={navigation} />
        </View>
      )}
    </View>
  );
}

/** Slice D1 item 7 "Tree line": the elbow from a parent's pin down to each direct child's pin —
 *  measured (`View.measureLayout`, so it keeps working after wrapping/resizing) rather than
 *  computed from styling constants, the same technique `CatalogShell`'s own DOM-only escape
 *  hatches use for layout that CSS alone can't express. A border-left + border-bottom elbow with a
 *  24px radius turn, in the approved reference's own subtle-accent line color. Decorative: hidden
 *  from accessibility. */
function Branch({
  parentId,
  childIds,
  pinNodesRef,
  children,
}: {
  parentId: string;
  childIds: readonly string[];
  pinNodesRef: React.RefObject<Map<string, View | null>>;
  children: React.ReactNode;
}) {
  const containerRef = useRef<View>(null);
  const [lines, setLines] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);

  const measure = () => {
    const container = containerRef.current;
    // Web: measure from the rendered boxes, so the vertical line sits exactly under the centre of
    // the parent's pin (`measureLayout` reports offsets from the nearest positioned ancestor there,
    // which put the line to the right of the pin). The line is 2px wide, so it starts 1px left.
    if (Platform.OS === 'web') {
      type Box = { getBoundingClientRect?: () => { left: number; top: number; width: number; height: number } };
      const box = (node: unknown) => (node as Box | null | undefined)?.getBoundingClientRect?.();
      const c = box(container), p = box(pinNodesRef.current.get(parentId));
      if (!c || !p || childIds.length === 0) return;
      const x = p.left + p.width / 2 - c.left - 1;
      const top = p.top + p.height - c.top + 4;
      const next: Array<{ left: number; top: number; width: number; height: number }> = [];
      for (const childId of childIds) {
        const k = box(pinNodesRef.current.get(childId));
        if (!k) return;
        const y = k.top + k.height / 2 - c.top + 1;
        next.push({ left: x, top, width: Math.max(0, k.left - c.left - x - 4), height: Math.max(0, y - top) });
      }
      setLines(next);
      return;
    }
    const parentPin = pinNodesRef.current.get(parentId) as unknown as MeasurableNode | undefined;
    if (!container || !parentPin?.measureLayout || childIds.length === 0) return;
    parentPin.measureLayout(
      container as unknown as number,
      (px: number, py: number, pw: number, ph: number) => {
        const x = px + pw / 2;
        const top = py + ph + 4;
        const next: Array<{ left: number; top: number; width: number; height: number }> = [];
        for (const childId of childIds) {
          const childPin = pinNodesRef.current.get(childId) as unknown as MeasurableNode | undefined;
          childPin?.measureLayout?.(
            container as unknown as number,
            (cx: number, cy: number, _cw: number, ch: number) => {
              const y = cy + ch / 2;
              next.push({ left: x, top, width: Math.max(0, cx - x), height: Math.max(0, y - top) });
              if (next.length === childIds.length) setLines(next);
            },
            () => {},
          );
        }
      },
      () => {},
    );
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, []);

  return (
    <View ref={containerRef} style={styles.branch} onLayout={measure}>
      {children}
      {lines.map((line, i) => (
        <View key={i} {...ARIA_HIDDEN} style={[styles.treeLine, line]} />
      ))}
    </View>
  );
}

/** A node with `measureLayout` (every mounted `View`'s native handle) — narrower than RN's own
 *  `View` type, which doesn't expose this method in its public TypeScript surface even though
 *  every platform implements it. */
interface MeasurableNode {
  measureLayout?: (relativeToNativeNode: number, onSuccess: (left: number, top: number, width: number, height: number) => void, onFail: () => void) => void;
}

/** A node with `focus` (every mounted web host node's real DOM method) — narrower than RN's own
 *  `Text`/`View` ref types, the same reason `MeasurableNode` above exists for `measureLayout`. */
interface FocusableNode {
  focus?: (options?: { preventScroll?: boolean }) => void;
}

/** Anatomy-narrow-layout focus fix: lets a legend row (`AnatomyMemberRow`/`AnatomyOtherRow`)
 *  register its own focusable name link and report when it gains focus, without either of them
 *  needing to know *why* — `AnatomyBox` is the only thing that reads `legendNodesRef`, after a
 *  layout-mode or balanced-column change remounts the row that currently holds focus at a new
 *  tree position (switching `anatomyLegend` <-> `anatomyColumns`, or redistributing columns)
 *  disconnects it and the browser drops focus to `<body>`. `register`'s `key` is stable across
 *  that remount (a member id, or `other:<name>` for an "Other page" row), so the *replacement*
 *  node at the same address can be found and refocused. */
interface LegendFocus {
  register: (key: string, node: FocusableNode | null) => void;
  onFocus: (key: string) => void;
  onBlur: (key: string) => void;
}

/** #63 R3: a family's own stub row for an *external part* — a member defined on a group page
 *  rather than this family's own `members` (`FamilyDef.externalParts`). Same pin/gutter as a real
 *  `FamilyPart`, but no specimens, description, or disclosure: only the name and a "Details on
 *  <group title>" link to that member's own address (`familyLink`, the same resolve-and-activate
 *  convention every other canonical link here uses — plain text, never a dead link, when it
 *  doesn't resolve). */
function ExternalPartRow({
  memberId, number, groupTitle, resolvesAddress, navigation,
}: {
  memberId: string;
  number?: string;
  groupTitle: string;
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
}) {
  const link = familyLink(navigation, resolvesAddress, memberId);
  return (
    <View>
      <View style={styles.partHeadRow}>
        {number !== undefined && (
          <View style={styles.pinBox}>
            <Pin number={number} />
          </View>
        )}
        <View style={styles.partHeadMain}>
          <Text style={[CATALOG_TEXT.heading2, styles.memberName]}>{memberId}</Text>
        </View>
      </View>
      <View style={[styles.partBody, number !== undefined && styles.partBodyIndented]}>
        <Text style={styles.belowLine}>
          {link ? (
            <Text role="link" style={styles.relatedLink} {...link}>
              {`Details on ${groupTitle}`}
            </Text>
          ) : (
            <Text>{`Details on ${groupTitle}`}</Text>
          )}
        </Text>
      </View>
    </View>
  );
}

/** One Part in its tree position: rendered through `FamilyPart` as always, wrapped in a `Branch`
 *  only when it has children (a leaf costs nothing extra), with its children nested inside its own
 *  block (spec: "so the lines don't cross other parts") at one more 52px gutter. #63 R2: exported
 *  so `GroupPage.tsx` can nest a top-level group member's own parts underneath it, the same tree
 *  (pins, tree lines, numbering) a family's own Parts section already renders. */
export function PartTreeBranch({
  node,
  byId,
  outline,
  allMemberIds,
  defaultPreviewWidths,
  apiLabel,
  resolvesAddress,
  navigation,
  registerNode,
  pinNodesRef,
  externalParts,
}: {
  node: PartTreeEntry;
  byId: ReadonlyMap<string, FamilyMember>;
  outline: FamilyDef['outline'];
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
  registerNode: (id: string, node: View | null) => void;
  pinNodesRef: React.RefObject<Map<string, View | null>>;
  /** #63 R3: every id this family's own `inWhole` sections list that is actually a group-page
   *  member rather than one of `byId` above — rendered as `ExternalPartRow` instead of
   *  `FamilyPart`. Omitted (the default) outside a family page's own Parts tree — `GroupPage.tsx`'s
   *  own use of this same component never passes one, since a group never has external parts of
   *  its own. */
  externalParts?: FamilyDef['externalParts'];
}) {
  const member = byId.get(node.id);
  const part = member ? (
    <FamilyPart
      member={member}
      number={outline.get(node.id)?.number}
      level={outline.get(node.id)?.level ?? 2}
      allMemberIds={allMemberIds}
      defaultPreviewWidths={defaultPreviewWidths}
      apiLabel={apiLabel}
      resolvesAddress={resolvesAddress}
      navigation={navigation}
      registerNode={registerNode}
      pinRef={(pinNode) => {
        if (pinNode) pinNodesRef.current.set(node.id, pinNode);
        else pinNodesRef.current.delete(node.id);
      }}
    />
  ) : (() => {
    const external = externalParts?.get(node.id);
    return external ? (
      <ExternalPartRow memberId={node.id} number={outline.get(node.id)?.number} groupTitle={external.title} resolvesAddress={resolvesAddress} navigation={navigation} />
    ) : null;
  })();
  if (part === null) return null;
  if (node.children.length === 0) return part;
  return (
    <Branch parentId={node.id} childIds={node.children.map((child) => child.id)} pinNodesRef={pinNodesRef}>
      {part}
      <View style={styles.subparts}>
        {node.children.map((child) => (
          <PartTreeBranch
            key={child.id}
            node={child}
            byId={byId}
            outline={outline}
            allMemberIds={allMemberIds}
            defaultPreviewWidths={defaultPreviewWidths}
            apiLabel={apiLabel}
            resolvesAddress={resolvesAddress}
            navigation={navigation}
            registerNode={registerNode}
            pinNodesRef={pinNodesRef}
            externalParts={externalParts}
          />
        ))}
      </View>
    </Branch>
  );
}

/** Slice D1 item 4: one `inWhole` or Related section's members, rendered without its own authored
 *  label (only the umbrella "Parts"/"Related" label shows — `FamilyPage` renders that once per
 *  bucket). `kind` alone still decides full blocks versus one folded list card. */
function FamilySectionGroup({
  section,
  members,
  outline,
  allMemberIds,
  defaultPreviewWidths,
  apiLabel,
  resolvesAddress,
  navigation,
  openRows,
  onToggleRow,
  registerNode,
  externalParts,
}: {
  section: CatalogMemberSection;
  members: FamilyMember[];
  outline: FamilyDef['outline'];
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
  openRows: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  registerNode: (id: string, node: View | null) => void;
  /** #63 R3: see `PartTreeBranch`'s own doc comment. Omitted for the "Related" bucket — A5 only
   *  ever applies to an `inWhole` section. */
  externalParts?: FamilyDef['externalParts'];
}) {
  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const pinNodesRef = useRef<Map<string, View | null>>(new Map());
  // #63 R3: `section.members` may list an external part — present in `externalParts` but never in
  // `byId` (it isn't one of this family's own `members`) — kept here (unlike a genuinely unknown
  // id, still dropped) so it gets its own `ExternalPartRow` stub below.
  const ids = section.members.filter((id) => byId.has(id) || externalParts?.has(id));
  if (section.kind === 'blocks') {
    const tree = buildPartTree(ids, outline);
    return (
      <View style={styles.blocksSection}>
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
            externalParts={externalParts}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.foldedList}>
      {ids.map((id, i) => {
        const member = byId.get(id);
        const external = member ? undefined : externalParts?.get(id);
        return (
          <View key={id} style={[styles.foldedListRow, i < ids.length - 1 && styles.foldedListRowDivider]}>
            {member ? (
              <FoldedRow
                member={member}
                number={outline.get(id)?.number}
                allMemberIds={allMemberIds}
                defaultPreviewWidths={defaultPreviewWidths}
                apiLabel={apiLabel}
                resolvesAddress={resolvesAddress}
                navigation={navigation}
                open={openRows.has(id)}
                onToggle={() => onToggleRow(id)}
                registerNode={registerNode}
              />
            ) : external ? (
              <ExternalPartRow memberId={id} number={outline.get(id)?.number} groupTitle={external.title} resolvesAddress={resolvesAddress} navigation={navigation} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** One row of the bottom-of-page `relatedPages` list (field spec, item 3 "Rendering"): the named
 *  page's own id as a link when it resolves to a real catalog address, plain text when not — never
 *  a dead link — then its note, when authored. No specimens, no disclosure, no source line, no
 *  number, no pin. */
function RelatedPageRow({ entry, resolvesAddress, navigation }: { entry: RelatedPage; resolvesAddress: (name: string) => boolean; navigation?: ReferenceNavigation }) {
  const link = familyLink(navigation, resolvesAddress, entry.page);
  return (
    <Text style={styles.belowLine}>
      {link ? (
        <Text role="link" style={styles.relatedPageName} {...link}>
          {entry.page}
        </Text>
      ) : (
        <Text style={[styles.relatedPageName, styles.relatedPageNameUnresolved]}>{entry.page}</Text>
      )}
      {entry.note ? ` — ${entry.note}` : null}
    </Text>
  );
}

function RelatedPagesList({ items, resolvesAddress, navigation }: { items: readonly RelatedPage[]; resolvesAddress: (name: string) => boolean; navigation?: ReferenceNavigation }) {
  return (
    <View style={styles.relatedPagesList}>
      {items.map((entry, i) => (
        <RelatedPageRow key={i} entry={entry} resolvesAddress={resolvesAddress} navigation={navigation} />
      ))}
    </View>
  );
}

/** Slice D1 item 4: the two umbrella labels — "Parts" groups every `inWhole` section, "Related"
 *  every other one (plus, on "Related" only, the page's own `relatedPages` list, rendered after
 *  every deprecated section — field spec item 3: "render the deprecated sections first and the
 *  links after, under the single Related heading"). A divider sits above each, and nothing else
 *  renders between the authored sections it covers (item 10: authored `section.label`s stay in the
 *  data, never on screen). */
function FamilyLabeledGroup({
  label,
  sections,
  relatedPages,
  outline,
  byId,
  allMemberIds,
  defaultPreviewWidths,
  apiLabel,
  resolvesAddress,
  navigation,
  openRows,
  onToggleRow,
  registerNode,
  externalParts,
}: {
  label: 'Parts' | 'Related';
  sections: CatalogMemberSection[];
  /** Only ever set for the "Related" group — "Parts" has no equivalent. */
  relatedPages?: RelatedPage[];
  outline: FamilyDef['outline'];
  byId: ReadonlyMap<string, FamilyMember>;
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
  openRows: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  registerNode: (id: string, node: View | null) => void;
  /** #63 R3: see `PartTreeBranch`'s own doc comment — only ever passed for the "Parts" group
   *  (A5 only applies to an `inWhole` section). */
  externalParts?: FamilyDef['externalParts'];
}) {
  // Field spec item 3: "a page with no relatedPages and no Related sections renders exactly as it
  // does today — no heading, no divider, nothing."
  if (sections.length === 0 && (!relatedPages || relatedPages.length === 0)) return null;
  return (
    <View style={styles.labeledGroup}>
      {/* Spec §5.2 "Heading semantics": "Parts"/"Related" are aria-level 2 headings — one level
          under the page title (1). Slice D1 removed the whole's own heading, so this level is no
          longer shared with it. */}
      <Text role="heading" {...({ 'aria-level': 2 } as Record<string, unknown>)} style={styles.sectionLabel}>
        {label}
      </Text>
      <View style={styles.labeledGroupBody}>
        {sections.map((section, index) => (
          // V2c item 14: keyed by index, not the section's own label — two sections sharing a
          // label (an already-reported, degenerate shape) must never collide as React keys.
          <FamilySectionGroup
            key={index}
            section={section}
            // V2c item 2: a section listing an id that isn't a real member (already reported by
            // `validateFamily`) must degrade to a missing block, never a crash reading `byId.get(id)!`.
            members={section.members.flatMap((id) => { const member = byId.get(id); return member ? [member] : []; })}
            outline={outline}
            allMemberIds={allMemberIds}
            defaultPreviewWidths={defaultPreviewWidths}
            apiLabel={apiLabel}
            resolvesAddress={resolvesAddress}
            navigation={navigation}
            openRows={openRows}
            onToggleRow={onToggleRow}
            registerNode={registerNode}
            externalParts={externalParts}
          />
        ))}
        {relatedPages && relatedPages.length > 0 && <RelatedPagesList items={relatedPages} resolvesAddress={resolvesAddress} navigation={navigation} />}
      </View>
    </View>
  );
}

/** What an anatomy pin looks up by member id: only the `fidelity` (dashed or solid). An own member
 *  satisfies it as is; an external part is represented by a stub carrying its owner's fidelity
 *  (`pinMembersWithExternal`). */
type PinMembers = ReadonlyMap<string, Pick<FamilyMember, 'fidelity'>>;

/** `byId` plus one fidelity-only entry per external part (a member documented on a group page), so
 *  its anatomy pin is dashed or solid by its owner's fidelity, exactly like an own part's. */
function pinMembersWithExternal(byId: ReadonlyMap<string, FamilyMember>, externalParts: FamilyDef['externalParts']): PinMembers {
  if (!externalParts || externalParts.size === 0) return byId;
  const merged = new Map<string, Pick<FamilyMember, 'fidelity'>>(byId);
  for (const [id, external] of externalParts) if (!merged.has(id) && external.fidelity) merged.set(id, { fidelity: external.fidelity });
  return merged;
}

/** Slice D1 item 5: the family page's own member records and computed outline, read by `AnatomyPin`
 *  so a page's `anatomy.picture` (author-supplied markup, possibly arbitrarily positioned) never
 *  hardcodes a number. `undefined` outside a family page's own anatomy box. */
const FamilyAnatomyContext = createContext<{ byId: PinMembers; outline: FamilyDef['outline'] } | undefined>(undefined);

/** Slice D1 item 5: a pin for use inside `anatomy.picture`. `member` names one of this page's
 *  members and shows its number (dashed when it has no area of its own), looked up through
 *  `FamilyAnatomyContext` — renders nothing for an unknown member, one outside a family page's own
 *  anatomy box (no context), or one with no number — the last is a `validateFamily` issue only
 *  when the member sits inside an `inWhole` section (D2 item A2, narrowed per review C1); for a
 *  member outside every `inWhole` section it's legal, deliberately silent, and reported by nobody.
 *  `other` marks a component documented on another page with the unnumbered ↗ pin the legend
 *  uses, and always renders it — it needs no context, with or without a family page in scope. */
export function AnatomyPin({ member, other }: { member?: string; other?: string }) {
  const context = useContext(FamilyAnatomyContext);
  if (other !== undefined) {
    return (
      <View style={styles.extPin} {...ARIA_HIDDEN}>
        <Text style={styles.extPinText}>↗</Text>
      </View>
    );
  }
  const pin = context && member !== undefined ? anatomyPinFor(member, context.byId, context.outline) : undefined;
  if (!pin) return null;
  return <Pin number={pin.number} dashed={pin.dashed} />;
}

/** Slice D1 item 5: one legend row naming a member of this page — a pin (looked up the same way
 *  `AnatomyPin` does), its name linked to the member's address, and the row's own description.
 *  Defect fix (APPROVED.md "the legend is not indented"): the pin's 34px gutter is only reserved
 *  when there's a pin to show — a member with no number (outside every `inWhole` section) gets no
 *  gutter either, so its name starts flush at the row's own left edge instead of under blank
 *  space. */
function AnatomyMemberRow({ memberId, description, byId, outline, legendFocus, resolvesAddress, navigation }: { memberId: string; description: string; byId: PinMembers; outline: FamilyDef['outline']; legendFocus: LegendFocus; resolvesAddress: (name: string) => boolean; navigation?: ReferenceNavigation }) {
  const pin = anatomyPinFor(memberId, byId, outline);
  // `familyLink` already resolves this row's own member (`resolvesAddress`'s sibling ids, at
  // minimum, cover it) — an explicitly supplied `navigation` that still can't resolve it must stay
  // honest plain text, never a raw `hashForId(memberId)` escape hatch around that refusal.
  const link = familyLink(navigation, resolvesAddress, memberId);
  return (
    <View style={styles.legendRow}>
      {pin && (
        // `testID` exists only so a renderer test can assert the slot's presence without
        // depending on class names — react-native-web renders it to the DOM as `data-testid`;
        // native ignores it.
        <View style={styles.legendPinSlot} testID="legend-pin-slot">
          <Pin number={pin.number} dashed={pin.dashed} />
        </View>
      )}
      <View style={styles.legendBody}>
        {link ? (
          <Text
            role="link"
            style={styles.legendName}
            ref={(node) => legendFocus.register(memberId, node as unknown as FocusableNode)}
            {...({ ...link, onFocus: () => legendFocus.onFocus(memberId), onBlur: () => legendFocus.onBlur(memberId) } as Record<string, unknown>)}
          >
            {memberId}
          </Text>
        ) : (
          <Text style={styles.legendName}>{memberId}</Text>
        )}
        <Text style={styles.legendDesc}>{description}</Text>
      </View>
    </View>
  );
}

/** Slice D1 item 5: one legend row naming a component documented elsewhere — never numbered; its
 *  own name links only when it resolves to a real catalog address. The ↗ marker keeps its own
 *  gutter: the defect this slice fixes is a gutter reserved for a pin that *isn't there*, and an
 *  "other page" row always shows its ↗, so the slot is never blank. Keeping it also keeps
 *  APPROVED.md's "the description ... starts at the name's left edge" — pulling the marker inline
 *  instead left each description hanging 26px to the left of its own name. */
function AnatomyOtherRow({ name, description, resolvesAddress, navigation, legendFocus }: { name: string; description: string; resolvesAddress: (name: string) => boolean; navigation?: ReferenceNavigation; legendFocus: LegendFocus }) {
  const link = familyLink(navigation, resolvesAddress, name);
  // No member id of its own (it names a component documented elsewhere), so it needs its own
  // namespace to never collide with a real member id sharing the same text.
  const focusKey = `other:${name}`;
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendPinSlot} {...ARIA_HIDDEN} testID="legend-pin-slot">
        <View style={styles.extPin}>
          <Text style={styles.extPinText}>↗</Text>
        </View>
      </View>
      <View style={styles.legendBody}>
        <View style={styles.legendNameRow}>
          {link ? (
            <Text
              role="link"
              style={styles.legendName}
              ref={(node) => legendFocus.register(focusKey, node as unknown as FocusableNode)}
              {...({ ...link, onFocus: () => legendFocus.onFocus(focusKey), onBlur: () => legendFocus.onBlur(focusKey) } as Record<string, unknown>)}
            >
              {name}
            </Text>
          ) : (
            <Text style={styles.legendName}>{name}</Text>
          )}
          <Text style={styles.legendExt}>Other page</Text>
        </View>
        <Text style={styles.legendDesc}>{description}</Text>
      </View>
    </View>
  );
}

function AnatomyGroup({ group, byId, outline, resolvesAddress, navigation, legendFocus }: { group: CatalogAnatomyGroup; byId: PinMembers; outline: FamilyDef['outline']; resolvesAddress: (name: string) => boolean; navigation?: ReferenceNavigation; legendFocus: LegendFocus }) {
  return (
    <View>
      <Text style={styles.legendGroupLabel}>{group.label}</Text>
      {group.items.map((item, i) =>
        'member' in item ? (
          <AnatomyMemberRow key={i} memberId={item.member} description={item.description} byId={byId} outline={outline} legendFocus={legendFocus} resolvesAddress={resolvesAddress} navigation={navigation} />
        ) : (
          <AnatomyOtherRow key={i} name={item.other} description={item.description} resolvesAddress={resolvesAddress} navigation={navigation} legendFocus={legendFocus} />
        ),
      )}
    </View>
  );
}

/** Slice D1 item 5, narrow-layout fix: the anatomy box — always first (right after the page head),
 *  a plain-card "Anatomy" label above the picture (the same label-outside-card treatment the
 *  specimen grids below it use), and a legend beside it or below it, decided by `anatomyLayout`
 *  from the card's own measured width and the picture's own measured intrinsic width (web only —
 *  see `onCardLayout`/`onPictureLayout` below), in up to three balanced columns when stacked.
 *
 *  The stage (and the picture inside it) renders at the same position in this tree whether the
 *  legend sits beside it or below it — only the wrapper's own `flexDirection` and the legend's own
 *  shape change around it — so toggling between the two never remounts the picture and discards
 *  its own authored state or focus.
 *
 *  #63 R2: exported so `GroupPage.tsx` can render an embedded family's own anatomy box — several
 *  may exist on one group page (one per top-level member that has one), each its own independent
 *  instance of this component (its own `FamilyAnatomyContext`/measurement state), not a
 *  page-singleton. */
export function AnatomyBox({ anatomy, byId, outline, resolvesAddress, navigation }: { anatomy: CatalogAnatomy; byId: PinMembers; outline: FamilyDef['outline']; resolvesAddress: (name: string) => boolean; navigation?: ReferenceNavigation }) {
  const totalItems = anatomy.groups.reduce((sum, group) => sum + group.items.length, 0);
  const [cardWidth, setCardWidth] = useState(0);
  const [pictureWidth, setPictureWidth] = useState(0);
  // Width-driven layout is a web-only concern (field spec: native keeps its existing item-count
  // decision) — `onLayout` itself is the same RN-compatible API either platform would use, but
  // these handlers simply never update state off web, so `anatomyLayout` always sees an
  // unmeasured (0) width on native and keeps falling back to the original `totalItems > 6` rule.
  // `onCardLayout` sits on the card's own interior wrapper (below), not the bordered card itself,
  // so the measured width is the interior content width `anatomyLayout`'s budget already assumes
  // — the bordered card's own box would overstate it by its own 2px (1px each side) border.
  const onCardLayout = (event: LayoutChangeEvent) => {
    if (Platform.OS !== 'web') return;
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== cardWidth) setCardWidth(next);
  };
  const onPictureLayout = (event: LayoutChangeEvent) => {
    if (Platform.OS !== 'web') return;
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== pictureWidth) setPictureWidth(next);
  };
  const { stacked, legendColumns } = anatomyLayout(totalItems, cardWidth, pictureWidth);
  const contextValue = useMemo(() => ({ byId, outline }), [byId, outline]);

  // Focus fix: a legend row's own focusable name link, keyed by its stable address (a member id,
  // or `other:<name>`), registered by whichever row currently renders it — see `LegendFocus`'s own
  // comment above. Refs/plain mutable state, not React state: recording "who last had focus"
  // must never itself trigger a render.
  const legendNodesRef = useRef<Map<string, FocusableNode | null>>(new Map());
  const focusedLegendKeyRef = useRef<string | undefined>(undefined);
  const legendFocus: LegendFocus = useMemo(
    () => ({
      register: (key, node) => {
        if (node) legendNodesRef.current.set(key, node);
        else legendNodesRef.current.delete(key);
      },
      onFocus: (key) => {
        focusedLegendKeyRef.current = key;
      },
      onBlur: (key) => {
        if (focusedLegendKeyRef.current === key) focusedLegendKeyRef.current = undefined;
      },
    }),
    [],
  );
  // A layout-mode switch (`anatomyLegend` <-> `anatomyColumns`) or a balanced-column count change
  // can remount the legend row that currently holds focus at a different tree position — the
  // browser then drops focus to `<body>` (web's own behavior for a removed focused node). Restore
  // it to the replacement row at the same address, right after that same render commits, the same
  // web-only `.focus()` convention `scrollAndFocusMember` already uses below. Guarded on
  // `document.activeElement === document.body` so another control's focus is never overridden.
  // Explicit blur clears the recorded key, so clicking page background cannot revive stale focus;
  // disconnecting an active anchor during reflow does not dispatch that blur event.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = focusedLegendKeyRef.current;
    if (!key) return;
    if (document.activeElement !== document.body) return;
    legendNodesRef.current.get(key)?.focus?.({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacked, legendColumns]);

  const stage = (
    <View style={styles.anatomyStage}>
      {/* Measures the picture's own intrinsic width, not the stage: the stage stretches to the
          card's full width when stacked (a plain View's default cross-axis stretch in a column
          layout), but this wrapper's own `alignItems: 'center'` parent never stretches it in turn,
          so the picture's measured width stays the same whichever layout is in effect. Web only:
          this measuring wrapper would otherwise give an authored picture (e.g. one already using
          `alignSelf: 'stretch'` or percentage sizing) a new containing block it never had before —
          native keeps receiving `anatomy.picture` directly, as it always did. */}
      {Platform.OS === 'web' ? (
        // `testID` exists only so a renderer test can trigger a real resize on exactly this node
        // without depending on the author's own picture markup — see `legendPinSlot`'s comment.
        <View onLayout={onPictureLayout} testID="anatomy-picture-measure">
          {anatomy.picture}
        </View>
      ) : (
        anatomy.picture
      )}
    </View>
  );

  return (
    <FamilyAnatomyContext.Provider value={contextValue}>
      <View style={styles.anatomy}>
        <Text style={styles.anatomyHeadText}>Anatomy</Text>
        <View style={styles.anatomyCard}>
          {anatomy.picture == null ? (
            // No picture (e.g. mutually exclusive parts that never share one frame): the legend
            // takes the card's full width instead of sitting beside an empty picture column.
            <View style={styles.anatomyLegendAlone} testID="anatomy-legend">
              {anatomy.groups.map((group, i) => (
                <AnatomyGroup key={i} group={group} byId={byId} outline={outline} resolvesAddress={resolvesAddress} navigation={navigation} legendFocus={legendFocus} />
              ))}
            </View>
          ) : (
          <View style={stacked ? undefined : styles.anatomyBody} onLayout={onCardLayout} testID="anatomy-body">
            {stage}
            {stacked ? (
              // `testID` exists only so a renderer test can assert which layout rendered without
              // depending on geometry jsdom can't provide (no ResizeObserver there — `onLayout`
              // never fires), the same reason `legendPinSlot` carries one above.
              <View style={styles.anatomyColumns} testID="anatomy-columns">
                {anatomyColumns(anatomy.groups, legendColumns).map((column, i) => (
                  <View key={i} style={styles.anatomyColumn}>
                    {column.map((group, j) => (
                      <AnatomyGroup key={j} group={group} byId={byId} outline={outline} resolvesAddress={resolvesAddress} navigation={navigation} legendFocus={legendFocus} />
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.anatomyLegend} testID="anatomy-legend">
                {anatomy.groups.map((group, i) => (
                  <AnatomyGroup key={i} group={group} byId={byId} outline={outline} resolvesAddress={resolvesAddress} navigation={navigation} legendFocus={legendFocus} />
                ))}
              </View>
            )}
          </View>
          )}
        </View>
      </View>
    </FamilyAnatomyContext.Provider>
  );
}

/** #63 R2: a group member that is also an external part of some family's own outline — a plain
 *  link line, "Part N of <Family>", to the family page (never to a specific member address — the
 *  family page has no separate address for one of its own parts). Reuses this file's own
 *  `belowLine`/`relatedLink` styles rather than a new visual; renders through `familyLink` so it
 *  resolves and activates exactly like every other canonical link `FamilyPage`'s own pieces
 *  produce (plain text, never a dead link, when it doesn't resolve). */
export function PartOfLine({
  partOf, resolvesAddress, navigation,
}: {
  partOf: { pageId: string; title: string; number: string };
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
}) {
  const link = familyLink(navigation, resolvesAddress, partOf.pageId);
  return (
    <Text style={styles.belowLine}>
      {`Part ${partOf.number} of `}
      {link ? (
        <Text role="link" style={styles.relatedLink} {...link}>
          {partOf.title}
        </Text>
      ) : (
        <Text>{partOf.title}</Text>
      )}
    </Text>
  );
}

/** Scrolls a member's node into view and moves focus to it (spec §5.3 "Member address"). The jump
 *  is always instant, like a normal anchor link: a smooth `scrollIntoView` does not reliably move
 *  the shell's nested scroll container on web (the same limitation `CatalogShell`'s
 *  `resetMainScroll` works around), and an instant jump also satisfies Reduce Motion. Native has
 *  no scroll-into-view of its own; `AccessibilityInfo`'s focus call is enough there.
 *
 *  #63 R2: exported so `GroupPage.tsx` reuses the exact same jump mechanics for its own member
 *  addresses, rather than a second implementation. */
export function scrollAndFocusMember(node: View): void {
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
 * A family page (spec §5, Slice D1): the page head, the anatomy box (if `anatomy` is set), the
 * whole's own specimens with no header of its own, then Parts and Related — the only two section
 * labels (item 10; authored `section.label`s stay in the data, never on screen). Renders exactly
 * like a normal page's head (breadcrumb, title, summary, pager) when `def.family` is set, in place
 * of `SectionBlock`'s usual single-component layout (`CatalogShell`).
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
  navigation,
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
  /** Task 2B2: `CatalogShell`'s own shared reference navigation (see `catalogReferences.ts`'s
   *  `ReferenceNavigation`/`referenceLinkProps`) — every one of this page's own link producers
   *  (below-specimens/whole lines, Uses, related pages, anatomy legend) resolves and activates
   *  through it when supplied, retaining this family's own sibling-member addresses exactly as
   *  `resolvesAddress` below already does. Omitted (a standalone-mounted `FamilyPage`, this
   *  framework's own catalog demo included) keeps every one of them at its prior plain-`href`-only
   *  behavior, unchanged. */
  navigation?: ReferenceNavigation<TId>;
}) {
  const family = def.family!;
  const apiLabel = family.apiLabel ?? 'API';
  const byId = useMemo(() => new Map(family.members.map((member) => [member.id, member])), [family.members]);
  const anatomyById = useMemo(() => pinMembersWithExternal(byId, family.externalParts), [byId, family.externalParts]);
  // N7: a `whole` that isn't one of its own members (bad data, already reported by
  // `validateFamily`) must degrade to a missing block, never a crash reading an absent member.
  const wholeMember = resolveWhole(byId, family.whole);
  const partSections = useMemo(() => family.sections.filter((section) => section.inWhole), [family.sections]);
  const relatedSections = useMemo(() => family.sections.filter((section) => !section.inWhole), [family.sections]);
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
    <MemberPanelHost>
    <View>
      <FamilyPageHead kind="family" def={def} groupLabel={groupLabel} breadcrumbRoot={breadcrumbRoot} banner={banner} pager={pager} headingRef={headingRef} notShown={family.notShown} />

      {family.anatomy && <AnatomyBox anatomy={family.anatomy} byId={anatomyById} outline={family.outline} resolvesAddress={resolvesAddress} navigation={navigation} />}

      {wholeMember && (
        <View style={styles.whole} ref={(node) => registerNode(wholeMember.id, node)} tabIndex={-1}>
          {(() => {
            const surface = wholeMember.specimenSurface ?? DEFAULT_SPECIMEN_SURFACE;
            const wholeDef = memberAsSectionDef(wholeMember);
            const blocks = presentationBlocks(wholeDef, { defaultPreviewWidths }).filter((block) => block.kind !== 'empty');
            return (
              <>
                {blocks.length > 0 && (
                  <View style={styles.memberSpecimens}>
                    <Blocks blocks={blocks} def={wholeDef} surface={surface} showLabels={false} trimOuterMargin />
                  </View>
                )}
                {wholeMember.notShown && <Text style={styles.belowLine}>{wholeMember.notShown}</Text>}
                <WholeBelowLine
                  name={wholeMember.id}
                  fidelity={wholeMember.fidelity}
                  source={wholeMember.source}
                  alsoUsedBy={wholeMember.alsoUsedBy ?? []}
                  resolvesAddress={resolvesAddress}
                  navigation={navigation}
                />
                <View style={styles.disclosureSpacer}>
                  <MemberDisclosureToggle member={wholeMember} apiLabel={apiLabel} resolvesAddress={resolvesAddress} navigation={navigation} />
                </View>
              </>
            );
          })()}
        </View>
      )}

      <FamilyLabeledGroup
        label="Parts"
        sections={partSections}
        outline={family.outline}
        byId={byId}
        allMemberIds={allMemberIds}
        defaultPreviewWidths={defaultPreviewWidths}
        apiLabel={apiLabel}
        resolvesAddress={resolvesAddress}
        navigation={navigation}
        openRows={openRows}
        onToggleRow={toggleRow}
        registerNode={registerNode}
        externalParts={family.externalParts}
      />
      <FamilyLabeledGroup
        label="Related"
        sections={relatedSections}
        relatedPages={family.relatedPages}
        outline={family.outline}
        byId={byId}
        allMemberIds={allMemberIds}
        defaultPreviewWidths={defaultPreviewWidths}
        apiLabel={apiLabel}
        resolvesAddress={resolvesAddress}
        navigation={navigation}
        openRows={openRows}
        onToggleRow={toggleRow}
        registerNode={registerNode}
      />
    </View>
    </MemberPanelHost>
  );
}

const PART_GAP = 64;
const LABEL_GAP = 80;
const PIN_GUTTER = 52;

const styles = StyleSheet.create({
  breadcrumb: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  pageHead: { paddingBottom: CATALOG_SPACE.xl, marginBottom: CATALOG_SPACE['2xl'], borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.borderStrong },
  titlebar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: CATALOG_SPACE.xl, marginTop: 14 },
  titleText: { flex: 1 },
  headingTarget: { alignSelf: 'flex-start' },
  title: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text, marginBottom: 5 },
  desc: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  notShown: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, maxWidth: 700, marginTop: CATALOG_SPACE.sm },
  kindNote: { maxWidth: 700, marginTop: CATALOG_SPACE.sm, borderLeftWidth: 2, borderLeftColor: CATALOG_COLOR.borderStrong, paddingLeft: CATALOG_SPACE.md, paddingVertical: 2 },
  kindNoteText: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  kindNoteLead: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  notShownLead: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },

  // Slice D1 item 5: the anatomy box's own "Anatomy" label sits outside, above a plain card —
  // the same treatment the specimen grids below it use (SectionBlock's blockLabel and
  // ComparisonList's card).
  anatomy: { marginTop: CATALOG_SPACE.xl, marginBottom: CATALOG_LAYOUT.blockGap },
  anatomyCard: { backgroundColor: CATALOG_COLOR.surface, borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, borderRadius: CATALOG_RADIUS.card, overflow: 'hidden' },
  anatomyHeadText: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text, marginBottom: CATALOG_LAYOUT.blockLabelGap },
  anatomyBody: { flexDirection: 'row', alignItems: 'flex-start' },
  anatomyStage: { padding: CATALOG_SPACE.xl, alignItems: 'center', justifyContent: 'center' },
  anatomyLegend: { flex: 1, borderLeftWidth: 1, borderLeftColor: CATALOG_COLOR.border, paddingVertical: CATALOG_SPACE.sm },
  anatomyLegendAlone: { paddingVertical: CATALOG_SPACE.sm },
  anatomyColumns: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  anatomyColumn: { flex: 1, borderLeftWidth: 1, borderLeftColor: CATALOG_COLOR.border, paddingVertical: CATALOG_SPACE.sm },
  // Host-authored text (`anatomy.groups[].label`) — never a transforming role like `microLabel`,
  // so the author's own casing survives; see tokens.ts's role table.
  legendGroupLabel: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.textMuted, paddingHorizontal: CATALOG_SPACE.lg, paddingTop: CATALOG_SPACE.md, paddingBottom: CATALOG_SPACE.xs },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: CATALOG_SPACE.sm, paddingHorizontal: CATALOG_SPACE.lg, paddingVertical: CATALOG_SPACE.sm, borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  legendPinSlot: { width: 34, alignItems: 'center' },
  legendBody: { flex: 1, gap: 2 },
  legendNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: CATALOG_SPACE.xs },
  legendName: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  legendDesc: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  legendExt: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.textMuted },
  extPin: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, borderWidth: 1.5, borderColor: CATALOG_COLOR.accent, backgroundColor: CATALOG_COLOR.surface, alignItems: 'center', justifyContent: 'center' },
  extPinText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.accent },

  // Slice D1 item 7: a filled accent pin; dashed when the member has no area of its own
  // (documentation-only).
  pin: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: CATALOG_COLOR.accent, alignItems: 'center', justifyContent: 'center' },
  pinDashed: { backgroundColor: CATALOG_COLOR.surface, borderWidth: 1.5, borderColor: CATALOG_COLOR.accent, borderStyle: 'dashed' },
  pinText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.surface },
  pinTextDashed: { color: CATALOG_COLOR.accent },

  // Same body rhythm as a part (`partBody`), so the whole's disclosure sits below its line too.
  whole: { marginTop: CATALOG_SPACE.xl, gap: CATALOG_SPACE.sm },

  partHeadRow: { flexDirection: 'row', alignItems: 'center' },
  // Slice D1 item 7: the fixed 52px gutter for a Part's pin and tree line.
  pinBox: { width: PIN_GUTTER, alignItems: 'flex-start' },
  partHeadMain: { flex: 1 },
  // D2 item A1: the body's own rhythm gap applies to every member (numbered or not); only the
  // gutter indent is conditional on `numbered`, so a Related member (never numbered) still gets
  // the same spacing as a numbered Part's own body.
  partBody: { gap: CATALOG_SPACE.sm },
  partBodyIndented: { marginLeft: PIN_GUTTER },

  // Slice D1 item 7 "Tree line": a child's whole block (its pin and all) sits one more 52px gutter
  // right of its parent, so the parent's own pin-to-body gutter and the child's nesting read as
  // the same 52px step; the elbow itself is drawn in `Branch`'s own measured absolute overlay.
  branch: { position: 'relative' },
  subparts: { marginTop: PART_GAP, marginLeft: PIN_GUTTER, gap: PART_GAP },
  treeLine: { position: 'absolute', borderLeftWidth: 2, borderBottomWidth: 2, borderColor: CATALOG_COLOR.treeLine, borderBottomLeftRadius: 24 },

  memberHead: { flexDirection: 'row', alignItems: 'baseline', gap: CATALOG_SPACE.sm, flexWrap: 'wrap' },
  memberName: { color: CATALOG_COLOR.text },
  memberDesc: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, maxWidth: 700, marginTop: CATALOG_SPACE.xs },
  // V2b item 5: `partBody`'s own gap already contributes CATALOG_SPACE.sm after this wrapper; this
  // adds just enough (lg - sm) on top of it so the total gap to the next line is exactly
  // CATALOG_SPACE.lg, instead of double-stacking with `Blocks`' own page-level marginBottom.
  memberSpecimens: { marginTop: CATALOG_SPACE.sm, marginBottom: CATALOG_SPACE.lg - CATALOG_SPACE.sm },
  belowLine: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  relatedLink: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.accent },
  // relatedPages (field spec item 3 "Rendering"): one row per entry, under the Related heading.
  relatedPagesList: { gap: CATALOG_SPACE.sm },
  relatedPageName: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
  relatedPageNameUnresolved: { color: CATALOG_COLOR.text },
  wholeBelowRow: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.xs, marginTop: CATALOG_SPACE.sm, flexWrap: 'wrap' },
  wholeName: { ...CATALOG_TEXT.codeSmallStrong, color: CATALOG_COLOR.text },
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

  // Slice D1 item 9: "Notes and API" is now 12/18 regular in the accent color, 4px under the line
  // below the specimens — `partBody`'s own CATALOG_SPACE.sm gap already contributes 8px, so this
  // subtracts the difference (sm - xs = 4) the same way `memberSpecimens` does above.
  disclosureSpacer: { marginTop: CATALOG_SPACE.xs - CATALOG_SPACE.sm },
  disclosureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATALOG_SPACE.xs,
    alignSelf: 'flex-start',
    minHeight: CATALOG_LAYOUT.controlSize,
    justifyContent: 'center',
  },
  chevron: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.accent },
  panelRoot: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  panelScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: PANEL_SCRIM },
  panel: { width: PANEL_WIDTH, maxWidth: '100%', height: '100%', backgroundColor: CATALOG_COLOR.surface, borderLeftWidth: 1, borderLeftColor: CATALOG_COLOR.borderStrong },
  panelFull: { width: '100%' },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: CATALOG_SPACE.md, padding: CATALOG_SPACE.lg, borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  panelTitle: { flex: 1, gap: 2 },
  panelKicker: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.textMuted },
  panelName: { ...CATALOG_TEXT.heading3, color: CATALOG_COLOR.text },
  panelBody: { flex: 1 },
  panelBodyContent: { padding: CATALOG_SPACE.lg },
  disclosureToggleLabel: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.accent },
  disclosureBody: { gap: CATALOG_SPACE.sm, paddingTop: CATALOG_SPACE.xs },
  note: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.text },
  disclosureText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  disclosureLead: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  apiBlock: { backgroundColor: CATALOG_COLOR.codeSurface, borderRadius: CATALOG_RADIUS.md, padding: CATALOG_SPACE.md, marginTop: CATALOG_SPACE.xs },
  apiText: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.codeOnSurface },

  // Slice D1 item 4: "Parts"/"Related" are the only two section labels — 80px above each, 64px
  // between each authored section's own group within a bucket.
  labeledGroup: { marginTop: LABEL_GAP, paddingTop: CATALOG_SPACE.xl, borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border },
  sectionLabel: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.lg },
  labeledGroupBody: { gap: PART_GAP },
  blocksSection: { gap: PART_GAP },

  foldedList: { backgroundColor: CATALOG_COLOR.surface, borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, borderRadius: CATALOG_RADIUS.card, overflow: 'hidden' },
  foldedListRow: { paddingHorizontal: CATALOG_SPACE.lg, paddingVertical: CATALOG_SPACE.md },
  foldedListRowDivider: { borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  foldedRow: { gap: CATALOG_SPACE.xs },
  foldedRowToggle: { minHeight: CATALOG_LAYOUT.controlSize, justifyContent: 'center' },
  foldedRowHead: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.sm },
  foldedRowBody: { gap: CATALOG_SPACE.sm, paddingTop: CATALOG_SPACE.sm },
});
