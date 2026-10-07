import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { PropsTable } from './PropsTable';
import { propsColumns } from './comparison';
import type { SectionDef } from './types';

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

/**
 * Always-visible reference below a page's specimens: a card with Guidance and Quick reference
 * (source path, accessibility), then Props in their own box. Token galleries show only Quick
 * reference with the source path. No collapse control by design.
 */
export function ReferenceDetails<TId extends string>({ def }: { def: SectionDef<TId> }) {
  const hide = def.hide ?? {};
  if (def.tokenGallery) {
    return (
      <View style={styles.card}>
        <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Quick reference</Text>
        <Fact label="Source" value={def.path} mono />
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Guidance</Text>
            <Text style={styles.body}>{def.whenToUse ?? 'No usage guidance documented.'}</Text>
          </View>
          <View style={styles.column}>
            <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Quick reference</Text>
            <Fact label="Source" value={def.path} mono />
            {!hide.accessibility && <Fact label="Accessibility" value={def.a11y ?? 'No accessibility notes documented.'} />}
          </View>
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
  column: { flex: 1 },
  heading: {
    fontSize: CATALOG_TYPE.panelHeading,
    fontWeight: '700',
    letterSpacing: 0.52,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginBottom: 10,
  },
  body: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: CATALOG_SPACE.lg,
    paddingVertical: CATALOG_LAYOUT.factPaddingY,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.borderSubtle,
  },
  factLabel: { fontSize: CATALOG_TYPE.md, fontWeight: '700', color: CATALOG_COLOR.text },
  factValue: { flex: 1, fontSize: CATALOG_TYPE.md, lineHeight: 20, textAlign: 'right', color: CATALOG_COLOR.textMuted },
  mono: { fontFamily: CATALOG_COLOR.code },
  empty: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
