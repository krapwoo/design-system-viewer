import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { Blocks, SectionPagerRow, type SectionPager } from './SectionBlock';
import { PropsTable } from './PropsTable';
import { presentationBlocks } from './comparison';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import { hashForId } from './catalogNavigation';
// A plain extensionless import — the same one every other `.tsx` file here already uses for its
// own pure-module siblings (e.g. `CatalogShell.tsx` → `./catalogNavigation`): this file is a React
// component with no test of its own that imports it directly under Node, so it only ever goes
// through the bundler.
import {
  anatomyColumns,
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
import type { CatalogAnatomy, CatalogAnatomyGroup, CatalogMember, CatalogMemberSection, ComposedOfEntry, FamilyDef, PreviewWidths, PropDef, RelatedPage, SectionDef } from './types';

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

/** Slice D1 item 6: the whole's own one-line summary — `<name> · <fidelity badge> · <source>` — in
 *  place of the below-specimens line (the whole has no `relationship`/`related` to show). */
function WholeBelowLine({ name, fidelity, source }: { name: string; fidelity: CatalogMember['fidelity']; source: string }) {
  return (
    <View style={styles.wholeBelowRow}>
      <Text style={styles.wholeName}>{name}</Text>
      <Text style={styles.belowLine}> · </Text>
      <FidelityBadge fidelity={fidelity} />
      <Text style={styles.belowLine}> · </Text>
      <Text style={styles.belowLine}>{source}</Text>
    </View>
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
    <Text {...ARIA_HIDDEN} style={styles.chevron}>
      {open ? '⌄' : '›'}
    </Text>
  );
}

/** Slice D1 item 9: "Notes and API" (using `apiLabel`) as a controlled toggle, closed by default —
 *  shared by the whole and every Part/Related member (never by a folded row, which has no second,
 *  nested toggle of its own: its own open state already decides whether its disclosure body shows). */
function MemberDisclosureToggle({
  member,
  apiLabel,
  resolvesAddress,
}: {
  member: CatalogMember & { props?: PropDef[] };
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const parts = disclosureContent(member, member.props);
  if (parts.length === 0) return null;
  const label = disclosureLabel(member, apiLabel, parts.includes('props'));
  return (
    <>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        {...({ 'aria-expanded': open } as Record<string, unknown>)}
        style={[styles.disclosureToggle, focused && styles.focusRing]}
      >
        <DisclosureChevron open={open} />
        <Text style={styles.disclosureToggleLabel}>{label}</Text>
      </Pressable>
      {open && <DisclosureBody member={member} parts={parts} resolvedProps={member.props} resolvesAddress={resolvesAddress} />}
    </>
  );
}

type FamilyMember = CatalogMember & { props?: PropDef[]; path: string };

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
function FamilyPart({ member, number, level, allMemberIds, defaultPreviewWidths, apiLabel, resolvesAddress, registerNode, pinRef }: MemberRenderProps & { level: number }) {
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
        />
        <View style={styles.disclosureSpacer}>
          <MemberDisclosureToggle member={member} apiLabel={apiLabel} resolvesAddress={resolvesAddress} />
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
function FoldedRow({ member, number, allMemberIds, resolvesAddress, open, onToggle, registerNode }: MemberRenderProps & { open: boolean; onToggle: () => void }) {
  const [focused, setFocused] = useState(false);
  const related = member.related ? linkifyRelated(member.related, allMemberIds) : undefined;
  const parts = disclosureContent(member, member.props);
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
          <BelowSpecimensLine related={related} showRelationship={false} relationship={member.relationship} source={member.source} />
          {parts.length > 0 && (
            <DisclosureBody member={member} parts={parts} resolvedProps={member.props} resolvesAddress={resolvesAddress} />
          )}
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

/** One Part in its tree position: rendered through `FamilyPart` as always, wrapped in a `Branch`
 *  only when it has children (a leaf costs nothing extra), with its children nested inside its own
 *  block (spec: "so the lines don't cross other parts") at one more 52px gutter. */
function PartTreeBranch({
  node,
  byId,
  outline,
  allMemberIds,
  defaultPreviewWidths,
  apiLabel,
  resolvesAddress,
  registerNode,
  pinNodesRef,
}: {
  node: PartTreeEntry;
  byId: ReadonlyMap<string, FamilyMember>;
  outline: FamilyDef['outline'];
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  registerNode: (id: string, node: View | null) => void;
  pinNodesRef: React.RefObject<Map<string, View | null>>;
}) {
  const member = byId.get(node.id);
  if (!member) return null;
  const part = (
    <FamilyPart
      member={member}
      number={outline.get(node.id)?.number}
      level={outline.get(node.id)?.level ?? 2}
      allMemberIds={allMemberIds}
      defaultPreviewWidths={defaultPreviewWidths}
      apiLabel={apiLabel}
      resolvesAddress={resolvesAddress}
      registerNode={registerNode}
      pinRef={(pinNode) => {
        if (pinNode) pinNodesRef.current.set(node.id, pinNode);
        else pinNodesRef.current.delete(node.id);
      }}
    />
  );
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
            registerNode={registerNode}
            pinNodesRef={pinNodesRef}
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
  openRows,
  onToggleRow,
  registerNode,
}: {
  section: CatalogMemberSection;
  members: FamilyMember[];
  outline: FamilyDef['outline'];
  allMemberIds: readonly string[];
  defaultPreviewWidths?: PreviewWidths;
  apiLabel: string;
  resolvesAddress: (name: string) => boolean;
  openRows: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  registerNode: (id: string, node: View | null) => void;
}) {
  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const pinNodesRef = useRef<Map<string, View | null>>(new Map());
  if (section.kind === 'blocks') {
    const tree = buildPartTree(members.map((member) => member.id), outline);
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
            registerNode={registerNode}
            pinNodesRef={pinNodesRef}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.foldedList}>
      {members.map((member, i) => (
        <View key={member.id} style={[styles.foldedListRow, i < members.length - 1 && styles.foldedListRowDivider]}>
          <FoldedRow
            member={member}
            number={outline.get(member.id)?.number}
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
  );
}

/** One row of the bottom-of-page `relatedPages` list (field spec, item 3 "Rendering"): the named
 *  page's own id as a link when it resolves to a real catalog address, plain text when not — never
 *  a dead link — then its note, when authored. No specimens, no disclosure, no source line, no
 *  number, no pin. */
function RelatedPageRow({ entry, resolvesAddress }: { entry: RelatedPage; resolvesAddress: (name: string) => boolean }) {
  const resolved = resolvesAddress(entry.page);
  return (
    <Text style={styles.belowLine}>
      {resolved ? (
        <Text role="link" style={styles.relatedPageName} {...({ href: hashForId(entry.page) } as Record<string, unknown>)}>
          {entry.page}
        </Text>
      ) : (
        <Text style={[styles.relatedPageName, styles.relatedPageNameUnresolved]}>{entry.page}</Text>
      )}
      {entry.note ? ` — ${entry.note}` : null}
    </Text>
  );
}

function RelatedPagesList({ items, resolvesAddress }: { items: readonly RelatedPage[]; resolvesAddress: (name: string) => boolean }) {
  return (
    <View style={styles.relatedPagesList}>
      {items.map((entry, i) => (
        <RelatedPageRow key={i} entry={entry} resolvesAddress={resolvesAddress} />
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
  openRows,
  onToggleRow,
  registerNode,
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
  openRows: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  registerNode: (id: string, node: View | null) => void;
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
            openRows={openRows}
            onToggleRow={onToggleRow}
            registerNode={registerNode}
          />
        ))}
        {relatedPages && relatedPages.length > 0 && <RelatedPagesList items={relatedPages} resolvesAddress={resolvesAddress} />}
      </View>
    </View>
  );
}

/** Slice D1 item 5: the family page's own member records and computed outline, read by `AnatomyPin`
 *  so a page's `anatomy.picture` (author-supplied markup, possibly arbitrarily positioned) never
 *  hardcodes a number. `undefined` outside a family page's own anatomy box. */
const FamilyAnatomyContext = createContext<{ byId: ReadonlyMap<string, FamilyMember>; outline: FamilyDef['outline'] } | undefined>(undefined);

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
function AnatomyMemberRow({ memberId, description, byId, outline }: { memberId: string; description: string; byId: ReadonlyMap<string, FamilyMember>; outline: FamilyDef['outline'] }) {
  const pin = anatomyPinFor(memberId, byId, outline);
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
        <Text role="link" style={styles.legendName} {...({ href: hashForId(memberId) } as Record<string, unknown>)}>
          {memberId}
        </Text>
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
function AnatomyOtherRow({ name, description, resolvesAddress }: { name: string; description: string; resolvesAddress: (name: string) => boolean }) {
  const resolved = resolvesAddress(name);
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendPinSlot} {...ARIA_HIDDEN} testID="legend-pin-slot">
        <View style={styles.extPin}>
          <Text style={styles.extPinText}>↗</Text>
        </View>
      </View>
      <View style={styles.legendBody}>
        <View style={styles.legendNameRow}>
          {resolved ? (
            <Text role="link" style={styles.legendName} {...({ href: hashForId(name) } as Record<string, unknown>)}>
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

function AnatomyGroup({ group, byId, outline, resolvesAddress }: { group: CatalogAnatomyGroup; byId: ReadonlyMap<string, FamilyMember>; outline: FamilyDef['outline']; resolvesAddress: (name: string) => boolean }) {
  return (
    <View>
      <Text style={styles.legendGroupLabel}>{group.label}</Text>
      {group.items.map((item, i) =>
        'member' in item ? (
          <AnatomyMemberRow key={i} memberId={item.member} description={item.description} byId={byId} outline={outline} />
        ) : (
          <AnatomyOtherRow key={i} name={item.other} description={item.description} resolvesAddress={resolvesAddress} />
        ),
      )}
    </View>
  );
}

/** Slice D1 item 5: the anatomy box — always first (right after the page head), a plain-card
 *  "Anatomy" label above the picture (the same label-outside-card treatment the specimen grids
 *  below it use), and a legend beside it (six items or fewer) or below it in up to three balanced
 *  columns (more than six). */
function AnatomyBox({ anatomy, byId, outline, resolvesAddress }: { anatomy: CatalogAnatomy; byId: ReadonlyMap<string, FamilyMember>; outline: FamilyDef['outline']; resolvesAddress: (name: string) => boolean }) {
  const totalItems = anatomy.groups.reduce((sum, group) => sum + group.items.length, 0);
  const stacked = totalItems > 6;
  const contextValue = useMemo(() => ({ byId, outline }), [byId, outline]);
  return (
    <FamilyAnatomyContext.Provider value={contextValue}>
      <View style={styles.anatomy}>
        <Text style={styles.anatomyHeadText}>Anatomy</Text>
        <View style={styles.anatomyCard}>
        {stacked ? (
          <View>
            <View style={styles.anatomyStage}>{anatomy.picture}</View>
            <View style={styles.anatomyColumns}>
              {anatomyColumns(anatomy.groups, 3).map((column, i) => (
                <View key={i} style={styles.anatomyColumn}>
                  {column.map((group, j) => (
                    <AnatomyGroup key={j} group={group} byId={byId} outline={outline} resolvesAddress={resolvesAddress} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.anatomyBody}>
            <View style={styles.anatomyStage}>{anatomy.picture}</View>
            <View style={styles.anatomyLegend}>
              {anatomy.groups.map((group, i) => (
                <AnatomyGroup key={i} group={group} byId={byId} outline={outline} resolvesAddress={resolvesAddress} />
              ))}
            </View>
          </View>
        )}
        </View>
      </View>
    </FamilyAnatomyContext.Provider>
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

      {family.anatomy && <AnatomyBox anatomy={family.anatomy} byId={byId} outline={family.outline} resolvesAddress={resolvesAddress} />}

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
                <WholeBelowLine name={wholeMember.id} fidelity={wholeMember.fidelity} source={wholeMember.source} />
                <View style={styles.disclosureSpacer}>
                  <MemberDisclosureToggle member={wholeMember} apiLabel={apiLabel} resolvesAddress={resolvesAddress} />
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
        openRows={openRows}
        onToggleRow={toggleRow}
        registerNode={registerNode}
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
        openRows={openRows}
        onToggleRow={toggleRow}
        registerNode={registerNode}
      />
    </View>
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
