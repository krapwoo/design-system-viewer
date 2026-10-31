import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { hashForId } from './catalogNavigation';
import { referenceLinkProps, type ReferenceNavigation } from './catalogReferences';
import { ANATOMY_PIN_GUTTER, anatomyColumns, anatomyLayout, anatomyPinFor } from './familyModel';
import { useMemberTitle } from './memberTitlesContext';
import { usePartNumbers } from './partNumbersContext';
import { ANATOMY_PINS_WRAPPER_TEST_ID, ANATOMY_PIN_LAYER_TEST_ID, SpecimenContent } from './SpecimenSurface';
import type { CatalogAnatomy, CatalogAnatomyGroup, CatalogMember, FamilyDef, SpecimenAlign } from './types';

const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;

/** Task 2B2: one path for every one of this file's own link producers (below-specimens/whole
 *  lines, Uses, related pages, anatomy legend) — `navigation` supplied: resolve+activate through
 *  the shell's own real `CatalogShell` journey (`referenceLinkProps`), the canonical address, even
 *  when it differs from `name` (an alias, or a component binding). `navigation` omitted (a
 *  standalone-mounted `FamilyPage`, this framework's own catalog demo included): keep the prior
 *  plain-`href`-only behavior, gated by the member's own `resolvesAddress` (sibling member ids,
 *  plus whatever `knownAddressIds` the caller passed) — never a dead link, same as before. */
export function familyLink(
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


/** `doctor --render` finds every pin in a picture by this id (`ANATOMY_PICTURE_SCRIPT`): the pin
 *  itself, never the ↗ badge a pin carries. `ANATOMY_CARD_TEST_ID` is the box that holds both the
 *  picture's stage and its legend, so the script can find the legend from the stage. */
export const ANATOMY_PIN_TEST_ID = 'anatomy-pin';
export const ANATOMY_CARD_TEST_ID = 'anatomy-card';

/** Slice D1 item 7: a numbered pin, a filled accent pill — used both by a Part's own header and by
 *  the anatomy legend/picture (`AnatomyPin`, which also allows the dashed, no-area-of-their-own
 *  style spec §"Pins" describes). Decorative: the member's own name (not the number) is what
 *  assistive tech announces. */
export function Pin({ number, dashed, opens, label }: { number: string; dashed?: boolean; opens?: boolean; label?: string }) {
  // `opens`: a used component with a page of its own — a small ↗ in the pin's top-right corner,
  // absolutely positioned so it never changes the pin's size, hit area or layout. `label`: the pin
  // stands alone in a picture, so it carries its own accessible name (otherwise it is decorative).
  const a11y = label !== undefined ? ({ role: 'img', 'aria-label': label } as Record<string, unknown>) : ARIA_HIDDEN;
  return (
    <View style={[styles.pin, dashed && styles.pinDashed]} testID={ANATOMY_PIN_TEST_ID} {...a11y}>
      <Text style={[styles.pinText, dashed && styles.pinTextDashed]}>{number}</Text>
      {opens && (
        <View style={styles.pinOpens} {...ARIA_HIDDEN}>
          <Text style={styles.pinOpensText} {...ARIA_HIDDEN}>↗</Text>
        </View>
      )}
    </View>
  );
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


/** What an anatomy pin looks up by member id: only the `fidelity` (dashed or solid). An own member
 *  satisfies it as is; an external part is represented by a stub carrying its owner's fidelity
 *  (`pinMembersWithExternal`). */
export type PinMembers = ReadonlyMap<string, Pick<CatalogMember, 'fidelity'>>;

/** `byId` plus one fidelity-only entry per external part (a member documented on a group page), so
 *  its anatomy pin is dashed or solid by its owner's fidelity, exactly like an own part's. */
export function pinMembersWithExternal(byId: ReadonlyMap<string, Pick<CatalogMember, 'fidelity'>>, externalParts: FamilyDef['externalParts']): PinMembers {
  if (!externalParts || externalParts.size === 0) return byId;
  const merged = new Map<string, Pick<CatalogMember, 'fidelity'>>(byId);
  for (const [id, external] of externalParts) if (!merged.has(id) && external.fidelity) merged.set(id, { fidelity: external.fidelity });
  return merged;
}

type PinRect = { top: number; bottom: number };

/** The anatomy's preview width (`AnatomyBox`'s `previewWidth`), for `AnatomySpecimen`. */
const AnatomyPreviewWidthContext = createContext<number | undefined>(undefined);

/** Draws an anatomy picture's specimen the way a variant cell draws it: at the page's preview
 *  width (the anatomy's own), through the same `SpecimenContent` centring — a small or narrow
 *  specimen sits centred, a full-width one fills. `fill`/`align` mean what they mean on a variant
 *  item; pass the same values the matching variant uses. Without a preview width it adds no width,
 *  except on web with `pins`, where it adds the pin gutter on both sides (so the pins sit inside
 *  the measured picture column, not over the legend beside it). Native keeps the measured picture.
 *
 *  `pins`: the picture's pins, drawn in a `ANATOMY_PIN_GUTTER`-wide column that rides on the
 *  specimen's own right edge — right beside a small specimen, in the frame's right margin for a
 *  full-width one. Position each pin inside it as before (`position: 'absolute', right: 0, top: y`,
 *  `top` measured from the specimen's top). The column is left out of the centring measurement,
 *  so pins never move the specimen. A column taller than the specimen (web) makes the specimen's
 *  block taller to hold it, still centred on the specimen. */
export function AnatomySpecimen({ fill, align, pins, children }: { fill?: boolean; align?: SpecimenAlign; pins?: React.ReactNode; children: React.ReactNode }) {
  const width = useContext(AnatomyPreviewWidthContext);
  const layerRef = useRef<View>(null);
  const [pinOverhang, setPinOverhang] = useState(0);
  // The pins are absolutely positioned, so they add no height of their own: a column taller than
  // the specimen would be cut off by the picture area. Web only: measure how far the pins reach
  // past the specimen's top or bottom (the layer is exactly the specimen's height) and pad the
  // specimen block by the larger overhang on both sides, so the column stays centred on it and
  // the block is at least as tall as the column. Pins that fit measure 0: nothing changes.
  const measurePins = useCallback(() => {
    const node = layerRef.current as unknown as { getBoundingClientRect?: () => PinRect; querySelectorAll?: (selector: string) => ArrayLike<{ getBoundingClientRect: () => PinRect }> } | null;
    if (!node?.getBoundingClientRect || !node.querySelectorAll) return;
    const layer = node.getBoundingClientRect();
    let overhang = 0;
    for (const el of Array.from(node.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.bottom - r.top < 1) continue;
      overhang = Math.max(overhang, layer.top - r.top, r.bottom - layer.bottom);
    }
    const next = Math.max(0, Math.ceil(overhang));
    setPinOverhang((previous) => (previous === next ? previous : next));
  }, []);
  useLayoutEffect(() => {
    if (pins !== undefined) measurePins();
  });
  return (
    // On web without a preview width the picture keeps its own measured width, and the pin column
    // hangs `ANATOMY_PIN_GUTTER` past the specimen's right edge: reserve that space here, on both
    // sides so the specimen stays centred, so the pins sit inside the measured picture column
    // instead of overflowing into the legend beside it (and the side-by-side decision counts them).
    // Native, and any preview width, are unchanged.
    <View style={width !== undefined ? { width } : pins !== undefined && Platform.OS === 'web' ? { paddingHorizontal: ANATOMY_PIN_GUTTER } : undefined} testID="anatomy-specimen">
      <SpecimenContent fill={fill} align={align}>
        {pins === undefined ? children : (
          <View style={[styles.specimenWithPins, pinOverhang > 0 && { paddingVertical: pinOverhang }]} testID={ANATOMY_PINS_WRAPPER_TEST_ID}>
            {children}
            <View ref={layerRef} onLayout={measurePins} style={[styles.specimenPins, pinOverhang > 0 && { top: pinOverhang, bottom: pinOverhang }]} testID={ANATOMY_PIN_LAYER_TEST_ID}>{pins}</View>
          </View>
        )}
      </SpecimenContent>
    </View>
  );
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
  const numbers = usePartNumbers();
  if (other !== undefined) {
    const number = numbers?.numberOf(other);
    // Numbered by the page (it is in the legend or the Parts block): the number plus a ↗ when it
    // opens a page. A name the page did not number keeps the bare, unnumbered ↗ pin.
    if (number !== undefined) {
      const opens = numbers!.opens(other);
      return <Pin number={number} opens={opens} label={`Part ${number}, ${opens ? 'opens ' : ''}${numbers!.titleOf(other) ?? other}`} />;
    }
    return (
      <View style={styles.extPin} testID={ANATOMY_PIN_TEST_ID} {...ARIA_HIDDEN}>
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
  const name = useMemberTitle()(memberId);
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
            {name}
          </Text>
        ) : (
          <Text style={styles.legendName}>{name}</Text>
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
  const numbers = usePartNumbers();
  const number = numbers?.numberOf(name);
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendPinSlot} {...ARIA_HIDDEN} testID="legend-pin-slot">
        {number !== undefined ? (
          <Pin number={number} opens={numbers!.opens(name)} />
        ) : (
          <View style={styles.extPin}>
            <Text style={styles.extPinText}>↗</Text>
          </View>
        )}
      </View>
      <View style={styles.legendBody}>
        <View style={styles.legendNameRow}>
          {link ? (
            <Text
              role="link"
              style={styles.legendName}
              ref={(node) => legendFocus.register(focusKey, node as unknown as FocusableNode)}
              {...({ ...link, ...(number !== undefined ? { 'aria-label': `Part ${number}, ${name}` } : {}), onFocus: () => legendFocus.onFocus(focusKey), onBlur: () => legendFocus.onBlur(focusKey) } as Record<string, unknown>)}
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
export function AnatomyBox({ anatomy, byId, outline, resolvesAddress, navigation, previewWidth }: {
  anatomy: CatalogAnatomy;
  byId: PinMembers;
  outline: FamilyDef['outline'];
  resolvesAddress: (name: string) => boolean;
  navigation?: ReferenceNavigation;
  /** The width the picture is laid out at (`anatomyPreviewWidth`): the page's (or member's) first
   *  `previewWidths` entry, the width its specimens use; the frame adds `ANATOMY_PIN_GUTTER` on each
   *  side (the pins use the right one), so its content box is exactly this wide and the specimen itself
   *  sits centred, as in the variant cells. Beside the legend the picture column is
   *  half the box, and the box stacks when half cannot hold this width. Omitted: the picture keeps
   *  its own measured width and the legend its old share, as before. Web only, like the measuring. */
  previewWidth?: number;
}) {
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
  const fixedWidth = Platform.OS === 'web' ? previewWidth : undefined;
  const { stacked, legendColumns } = anatomyLayout(totalItems, cardWidth, pictureWidth, fixedWidth);
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
    <View style={[styles.anatomyStage, fixedWidth !== undefined && !stacked && styles.anatomyStageHalf, fixedWidth !== undefined && styles.anatomyStageFixed]} testID="anatomy-stage">
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
        <View onLayout={onPictureLayout} testID="anatomy-picture-measure" style={fixedWidth !== undefined ? { width: fixedWidth + 2 * ANATOMY_PIN_GUTTER, paddingHorizontal: ANATOMY_PIN_GUTTER, marginHorizontal: 'auto', flexShrink: 0, alignItems: 'center' } : undefined}>
          {anatomy.picture}
        </View>
      ) : (
        anatomy.picture
      )}
    </View>
  );

  return (
    <FamilyAnatomyContext.Provider value={contextValue}>
    <AnatomyPreviewWidthContext.Provider value={fixedWidth}>
      <View style={styles.anatomy}>
        <Text style={styles.anatomyHeadText}>Anatomy</Text>
        <View style={styles.anatomyCard} testID={ANATOMY_CARD_TEST_ID}>
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
              <View style={[styles.anatomyLegend, fixedWidth !== undefined && styles.anatomyLegendHalf]} testID="anatomy-legend">
                {anatomy.groups.map((group, i) => (
                  <AnatomyGroup key={i} group={group} byId={byId} outline={outline} resolvesAddress={resolvesAddress} navigation={navigation} legendFocus={legendFocus} />
                ))}
              </View>
            )}
          </View>
          )}
        </View>
      </View>
    </AnatomyPreviewWidthContext.Provider>
    </FamilyAnatomyContext.Provider>
  );
}


const styles = StyleSheet.create({
  // Slice D1 item 5: the anatomy box's own "Anatomy" label sits outside, above a plain card —
  // the same treatment the specimen grids below it use (SectionBlock's blockLabel and
  // ComparisonList's card).
  anatomy: { marginTop: CATALOG_SPACE.xl, marginBottom: CATALOG_LAYOUT.blockGap },
  anatomyCard: { backgroundColor: CATALOG_COLOR.surface, borderWidth: 1, borderColor: CATALOG_COLOR.borderStrong, borderRadius: CATALOG_RADIUS.card, overflow: 'hidden' },
  specimenWithPins: { position: 'relative' },
  specimenPins: { position: 'absolute', left: '100%', top: 0, bottom: 0, width: ANATOMY_PIN_GUTTER },
  anatomyHeadText: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text, marginBottom: CATALOG_LAYOUT.blockLabelGap },
  anatomyBody: { flexDirection: 'row', alignItems: 'flex-start' },
  anatomyStage: { padding: CATALOG_SPACE.xl, alignItems: 'center', justifyContent: 'center' },
  // With a fixed picture width the stage and the legend split the box evenly; the stage scrolls
  // inside itself (never the page) when the picture is wider than it, and `marginHorizontal: auto`
  // on the picture centres it without ever clipping its left edge.
  // `alignSelf: 'stretch'`: the stage spans the row's full height, so its own centring puts the
  // picture in the middle of the box beside a taller legend, as the variant cells centre theirs.
  anatomyStageHalf: { width: '50%', flexShrink: 0, alignSelf: 'stretch' },
  anatomyStageFixed: { alignItems: 'stretch', overflowX: 'auto', minWidth: 0 } as object,
  // Takes the half the stage leaves. Not `flex: 0` + `width: '50%'`: react-native-web compiles
  // `flex: 0` to `flex-basis: 0%`, which overrides the width and collapses the legend to 1px.
  anatomyLegendHalf: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
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
  // The ↗ on a pin that opens a page: a corner badge, absolutely positioned so the pin's own size,
  // hit area and layout are unchanged.
  pinOpens: { position: 'absolute', top: -7, right: -7, width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: CATALOG_COLOR.accent, backgroundColor: CATALOG_COLOR.surface, alignItems: 'center', justifyContent: 'center' },
  pinOpensText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.accent },
  extPinText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.accent },

  // Slice D1 item 7: a filled accent pin; dashed when the member has no area of its own
  // (documentation-only).
  pin: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: CATALOG_COLOR.accent, alignItems: 'center', justifyContent: 'center' },
  pinDashed: { backgroundColor: CATALOG_COLOR.surface, borderWidth: 1.5, borderColor: CATALOG_COLOR.accent, borderStyle: 'dashed' },
  pinText: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.surface },
  pinTextDashed: { color: CATALOG_COLOR.accent },

});
