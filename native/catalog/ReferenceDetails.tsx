import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { PropsTable } from './PropsTable';
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

/**
 * Always-visible reference below a page's specimens: Guidance, Quick reference (source path,
 * accessibility), then the full Props table. No collapse control by design.
 */
export function ReferenceDetails<TId extends string>({ def }: { def: SectionDef<TId> }) {
  const hide = def.hide ?? {};
  return (
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
      {!hide.props && (
        <View style={styles.props}>
          <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Props</Text>
          {def.props && def.props.length > 0 ? (
            <PropsTable props={def.props} />
          ) : (
            <Text style={styles.empty}>This component takes no props.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_LAYOUT.panelPadding,
    gap: CATALOG_SPACE.xl,
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
  props: { gap: CATALOG_SPACE.sm },
  empty: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
