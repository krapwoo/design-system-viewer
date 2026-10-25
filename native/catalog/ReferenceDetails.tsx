import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { PropsTable } from './PropsTable';
import { propsColumns, referenceColumns } from './comparison';
import { hashForId } from './catalogNavigation';
import { referenceLinkProps, type ReferenceNavigation } from './catalogReferences';
import { alsoUsedBySegments } from './familyModel';
import type { AlsoUsedByEntry, ComposedOfEntry, SectionDef } from './types';

/** `referenceLinkProps` returns the resolved target, not a ready-made `href` (see its own doc
 *  comment in `catalogReferences.ts`) — this builds the real link props every `Text role="link"`
 *  below actually spreads, the one place in this file that turns a target into `hashForId(memberId
 *  ?? pageId)`. */
function linkProps<TId extends string>(
  navigation: ReferenceNavigation<TId> | undefined,
  name: string,
): { href: string; onPress: (event?: { preventDefault?: () => void }) => void } | undefined {
  const activation = referenceLinkProps(navigation, name);
  return activation ? { href: hashForId(activation.memberId ?? activation.pageId), onPress: activation.onPress } : undefined;
}

// react-native-web reads `aria-level`; React Native's prop types do not declare it.
const HEADING_LEVEL_2 = { 'aria-level': 2 } as Record<string, unknown>;

/** `last` drops the trailing divider and its padding, the same convention `TokenRow`'s `last` and
 *  `PropsTable`'s `rowLast` already use. Without it the final fact's bottom padding stacks on the
 *  card's own `panelPadding`, so a card's contents sat ~10px lower than centred. */
function Fact({ label, value, mono = false, last = false }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.fact, last && styles.factLast]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

/** Props in their own full-width box. Two columns, filled across first, when there are 4+ props and
 *  each column keeps PROPS_MIN_COLUMN_WIDTH; otherwise one column. */
function PropsBox<TId extends string>({ def }: { def: SectionDef<TId> }) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };
  const props = def.props ?? [];
  return (
    <View style={styles.card}>
      <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Props</Text>
      <View onLayout={onLayout}>
        {props.length > 0 ? (
          <PropsTable props={props} columns={propsColumns(props.length, width)} />
        ) : (
          <Text style={styles.empty}>This component takes no props.</Text>
        )}
      </View>
    </View>
  );
}

// `built-in` is composition's assumed default relationship, so spelling it out reads redundantly
// (e.g. "TrainArrivalRemainingTime · built-in"); `slot`/`related` still need their own suffix to
// stay distinguishable from a plain built-in entry.
function compositionSuffix(entry: ComposedOfEntry): string {
  return entry.relationship === 'built-in' ? '' : ` · ${entry.relationship}`;
}

/** One Composition row: the name links to its real canonical address when `navigation` resolves it
 *  (plan #60: "Ordinary Composition references become real links when resolvable … unresolved
 *  names remain honest plain text") — a relationship suffix, when any, stays outside the link, the
 *  same way `UsesLine` in `FamilyPage.tsx` keeps its own `(role)` text unlinked. `navigation`
 *  omitted keeps the prior plain-text rendering untouched (a standalone-mounted `ReferenceDetails`,
 *  this framework's own catalog demo included). */
function CompositionFact<TId extends string>({
  entry,
  navigation,
  last = false,
}: {
  entry: ComposedOfEntry;
  navigation?: ReferenceNavigation<TId>;
  last?: boolean;
}) {
  const link = linkProps(navigation, entry.component);
  return (
    <View style={[styles.fact, last && styles.factLast]}>
      <Text style={styles.factLabel}>
        {link ? (
          <Text role="link" style={styles.factLabelLink} {...link}>{entry.component}</Text>
        ) : (
          entry.component
        )}
        {compositionSuffix(entry)}
      </Text>
      <Text style={styles.factValue}>{entry.role}</Text>
    </View>
  );
}

function CompositionFacts<TId extends string>({
  composedOf,
  lastIsFlush = false,
  navigation,
}: {
  composedOf: ComposedOfEntry[];
  lastIsFlush?: boolean;
  navigation?: ReferenceNavigation<TId>;
}) {
  return (
    <>
      {composedOf.map((entry, i) => (
        <CompositionFact
          key={`${entry.component}-${entry.relationship}-${i}`}
          entry={entry}
          navigation={navigation}
          last={lastIsFlush && i === composedOf.length - 1}
        />
      ))}
    </>
  );
}

/** The derived "Also used by …" row (`SectionDef.alsoUsedBy`, plan #60's ordinary-page inverse of
 *  `FamilyDef.members[].alsoUsedBy`): the exact same sentence/segment shape
 *  `alsoUsedBySegments`/`WholeBelowLine` already render on a family page, so an ordinary page's own
 *  cross-use reads identically — a resolvable user links, an unresolvable one stays honest plain
 *  text. Renders nothing for an empty list (the overwhelming majority of pages): no row, no label,
 *  no gap — the same "nothing renders when nothing else uses it" rule the README already documents
 *  for a family member. */
function AlsoUsedByFact<TId extends string>({
  entries,
  navigation,
  last = false,
}: {
  entries: readonly AlsoUsedByEntry[];
  navigation?: ReferenceNavigation<TId>;
  last?: boolean;
}) {
  const segments = alsoUsedBySegments(entries);
  if (segments.length === 0) return null;
  return (
    <View style={[styles.fact, last && styles.factLast]}>
      <Text style={styles.factValue}>
        {segments.map((segment, i) => {
          const link = segment.component ? linkProps(navigation, segment.component) : undefined;
          return link ? (
            <Text key={i} role="link" style={styles.factLabelLink} {...link}>{segment.text}</Text>
          ) : (
            <Text key={i}>{segment.text}</Text>
          );
        })}
      </Text>
    </View>
  );
}

/**
 * Always-visible reference below a page's specimens: a card with Guidance, Quick reference
 * (source path, accessibility), and — only when the page has confirmed composition to disclose —
 * Composition, then Props in their own box. Token galleries show only Quick reference with the
 * source path. No collapse control by design.
 *
 * Guidance/Quick reference/Composition lay out from the card's own measured INNER width
 * (`referenceColumns`), not viewport width alone: three columns only when there is confirmed
 * composition and the card is wide enough for all three (Composition gets its own column only
 * then — otherwise it stays nested under Quick reference, as it always has); two when there's
 * room for Guidance and Quick reference side by side; one (stacked, full document order, nothing
 * dropped) when the card is too narrow even for two. `minWidth: 0` on every column lets its facts
 * and source path actually shrink and wrap at that width instead of pushing the card wider than
 * its own container.
 *
 * `onLayout` sits on the `columns` row itself, not the padded/bordered `card` around it:
 * `referenceColumns` fits each column against `REFERENCE_MIN_COLUMN_WIDTH`, an INNER measurement —
 * the card's own padding (`panelPadding`) and 1px border never belong in that budget. Measuring the
 * outer card previously fed `referenceColumns` an outer width up to ~42px wider than what the three
 * columns' content actually has, which can report a column count the inner content doesn't fit.
 */
export function ReferenceDetails<TId extends string>({
  def,
  navigation,
}: {
  def: SectionDef<TId>;
  /** Task 2B2: `CatalogShell`'s own shared reference navigation (see `catalogReferences.ts`'s
   *  `ReferenceNavigation`/`referenceLinkProps`) — turns a resolvable Composition name into a real
   *  canonical link. Omitted (a standalone-mounted `ReferenceDetails`, this framework's own catalog
   *  demo included) keeps every name as it always rendered: plain text, no link. */
  navigation?: ReferenceNavigation<TId>;
}) {
  const hide = def.hide ?? {};
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };
  const hasAlsoUsedBy = Boolean(def.alsoUsedBy && def.alsoUsedBy.length > 0);
  if (def.tokenGallery) {
    // Full-width pages with no component API (token galleries, and whole screens such as a
    // starter kit's Patterns) still disclose what they're built from when they say so.
    const hasComposition = Boolean(def.composedOf && def.composedOf.length > 0);
    return (
      <View style={styles.card}>
        <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Quick reference</Text>
        {def.path && <Fact label="Source" value={def.path} mono last={!hasComposition && !hasAlsoUsedBy} />}
        {hasComposition && def.composedOf && (
          <>
            <Text style={styles.subheading}>Composition</Text>
            <CompositionFacts composedOf={def.composedOf} lastIsFlush={!hasAlsoUsedBy} navigation={navigation} />
          </>
        )}
        {hasAlsoUsedBy && <AlsoUsedByFact entries={def.alsoUsedBy!} navigation={navigation} last />}
      </View>
    );
  }
  const hasComposition = Boolean(def.composedOf && def.composedOf.length > 0);
  const columns = referenceColumns(width, hasComposition);
  const stacked = columns === 1;
  const compositionIsOwnColumn = columns === 3 && hasComposition;
  const columnStyle = stacked ? styles.columnStacked : styles.column;
  // "Also used by" always sits in Quick reference, after Composition when nested there too — it
  // never gets its own column (plan #60: it's the always-visible inverse of an existing fact, not
  // a new confirmed-data column like Composition).
  const compositionNestedHere = !compositionIsOwnColumn && hasComposition;

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={[styles.columns, stacked && styles.columnsStacked]} onLayout={onLayout}>
          <View style={columnStyle}>
            <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Guidance</Text>
            <Text style={styles.body}>{def.whenToUse ?? 'No usage guidance documented.'}</Text>
          </View>
          <View style={columnStyle}>
            <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Quick reference</Text>
            {def.path && <Fact label="Source" value={def.path} mono last={hide.accessibility && !compositionNestedHere && !hasAlsoUsedBy} />}
            {!hide.accessibility && (
              <Fact
                label="Accessibility"
                value={def.a11y ?? 'No accessibility notes documented.'}
                last={!compositionNestedHere && !hasAlsoUsedBy}
              />
            )}
            {compositionNestedHere && def.composedOf && (
              <>
                <Text style={styles.subheading}>Composition</Text>
                <CompositionFacts composedOf={def.composedOf} lastIsFlush={!hasAlsoUsedBy} navigation={navigation} />
              </>
            )}
            {hasAlsoUsedBy && <AlsoUsedByFact entries={def.alsoUsedBy!} navigation={navigation} last />}
          </View>
          {compositionIsOwnColumn && def.composedOf && (
            <View style={columnStyle}>
              <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Composition</Text>
              <CompositionFacts composedOf={def.composedOf} lastIsFlush navigation={navigation} />
            </View>
          )}
        </View>
      </View>
      {!hide.props && <PropsBox def={def} />}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: CATALOG_LAYOUT.blockGap },
  card: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_LAYOUT.panelPadding,
  },
  columns: { flexDirection: 'row', gap: CATALOG_SPACE['2xl'] },
  columnsStacked: { flexDirection: 'column' },
  column: { flex: 1, minWidth: 0 },
  columnStacked: { minWidth: 0 },
  heading: {
    ...CATALOG_TEXT.label,
    color: CATALOG_COLOR.text,
    marginBottom: 10,
  },
  body: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
  subheading: {
    ...CATALOG_TEXT.captionStrong,
    color: CATALOG_COLOR.text,
    marginTop: CATALOG_SPACE.md,
    marginBottom: CATALOG_SPACE.xs,
  },
  fact: {
    flexDirection: 'column',
    gap: CATALOG_SPACE.xs,
    paddingVertical: CATALOG_LAYOUT.factPaddingY,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.borderSubtle,
  },
  factLast: { paddingBottom: 0, borderBottomWidth: 0 },
  factLabel: { flexShrink: 1, minWidth: 0, ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.text },
  // Same accent treatment every other in-app reference link already uses (`FamilyPage.tsx`'s own
  // `relatedLink`) — a linked Composition/"also used by" name reads the same way across both pages.
  factLabelLink: { ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.accent },
  factValue: { minWidth: 0, ...CATALOG_TEXT.body, textAlign: 'left', color: CATALOG_COLOR.textMuted },
  // `wordBreak` isn't in the installed `TextStyle` type (RN's own, not RNW's — RNW's own
  // `Text/types.js` declares it; a browser applies any valid CSS property name it recognizes
  // regardless), so a bare literal here would report an unknown property under `--noEmit` even
  // though it genuinely works: a long unbroken token (a source path with no spaces, e.g.
  // `AnimatedChevron.tsx`) has no space for the browser's default line-breaking to use, so without
  // this it stays one unbroken run and overflows a narrow card instead of wrapping at its '/'s.
  mono: { ...CATALOG_TEXT.code, wordBreak: 'break-word' } as TextStyle,
  empty: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
});
