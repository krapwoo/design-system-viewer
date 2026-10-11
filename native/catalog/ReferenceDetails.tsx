import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { PropsTable } from './PropsTable';
import { propsColumns, referenceColumns } from './comparison';
import type { ComposedOfEntry, SectionDef } from './types';

// react-native-web reads `aria-level`; React Native's prop types do not declare it.
const HEADING_LEVEL_2 = { 'aria-level': 2 } as Record<string, unknown>;

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.fact}>
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
function compositionLabel(entry: ComposedOfEntry): string {
  return entry.relationship === 'built-in' ? entry.component : `${entry.component} · ${entry.relationship}`;
}

function CompositionFacts({ composedOf }: { composedOf: ComposedOfEntry[] }) {
  return (
    <>
      {composedOf.map((entry, i) => (
        <Fact key={`${entry.component}-${entry.relationship}-${i}`} label={compositionLabel(entry)} value={entry.role} />
      ))}
    </>
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
export function ReferenceDetails<TId extends string>({ def }: { def: SectionDef<TId> }) {
  const hide = def.hide ?? {};
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };
  if (def.tokenGallery) {
    return (
      <View style={styles.card}>
        <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Quick reference</Text>
        {def.path && <Fact label="Source" value={def.path} mono />}
      </View>
    );
  }
  const hasComposition = Boolean(def.composedOf && def.composedOf.length > 0);
  const columns = referenceColumns(width, hasComposition);
  const stacked = columns === 1;
  const compositionIsOwnColumn = columns === 3 && hasComposition;
  const columnStyle = stacked ? styles.columnStacked : styles.column;

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
            {def.path && <Fact label="Source" value={def.path} mono />}
            {!hide.accessibility && <Fact label="Accessibility" value={def.a11y ?? 'No accessibility notes documented.'} />}
            {!compositionIsOwnColumn && hasComposition && def.composedOf && (
              <>
                <Text style={styles.subheading}>Composition</Text>
                <CompositionFacts composedOf={def.composedOf} />
              </>
            )}
          </View>
          {compositionIsOwnColumn && def.composedOf && (
            <View style={columnStyle}>
              <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Composition</Text>
              <CompositionFacts composedOf={def.composedOf} />
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
    fontSize: CATALOG_TYPE.panelHeading,
    fontWeight: '700',
    letterSpacing: 0.52,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginBottom: 10,
  },
  body: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted },
  subheading: {
    fontSize: CATALOG_TYPE.sm,
    fontWeight: '700',
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
  factLabel: { flexShrink: 1, minWidth: 0, fontSize: CATALOG_TYPE.md, fontWeight: '700', color: CATALOG_COLOR.text },
  factValue: { minWidth: 0, fontSize: CATALOG_TYPE.md, lineHeight: 20, textAlign: 'left', color: CATALOG_COLOR.textMuted },
  // `wordBreak` isn't in the installed `TextStyle` type (RN's own, not RNW's — RNW's own
  // `Text/types.js` declares it; a browser applies any valid CSS property name it recognizes
  // regardless), so a bare literal here would report an unknown property under `--noEmit` even
  // though it genuinely works: a long unbroken token (a source path with no spaces, e.g.
  // `AnimatedChevron.tsx`) has no space for the browser's default line-breaking to use, so without
  // this it stays one unbroken run and overflows a narrow card instead of wrapping at its '/'s.
  mono: { fontFamily: CATALOG_COLOR.code, wordBreak: 'break-word' } as TextStyle,
  empty: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
