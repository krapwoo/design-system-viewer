import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_TEXT, CATALOG_COLOR, CATALOG_SPACE } from './tokens';
import { PROPS_COLUMN_GAP } from './comparison';
import type { PropDef } from './types';

/** One prop, stacked: name and type on one line, then description and default. Used by the
 *  two-column layout, where a side-by-side name column would wrap long union types. */
function PropCell({ prop, divider }: { prop: PropDef; divider: boolean }) {
  return (
    <View style={[styles.cell, divider && styles.cellDivider]}>
      <View style={styles.cellHead}>
        <Text style={styles.name}>
          {prop.name}
          <Text style={styles.optionalMark}>{prop.required ? '' : '?'}</Text>
        </Text>
        <Text style={styles.type}>{prop.type}</Text>
      </View>
      <Text style={styles.desc}>{prop.desc}</Text>
      {prop.default != null && (
        <Text style={styles.default}>
          Default: <Text style={styles.defaultVal}>{prop.default}</Text>
        </Text>
      )}
    </View>
  );
}

/** Renders a component's real prop interface. One column: each row holds name + type in a
 *  fixed-width first column with the description beside it. Two columns (`columns={2}`, chosen by
 *  ReferenceDetails through `propsColumns`): props fill across first, each stacked, so reading and
 *  focus order stay the declared order. */
export function PropsTable({ props, columns = 1 }: { props: PropDef[]; columns?: 1 | 2 }) {
  if (columns === 2) {
    const rows: PropDef[][] = [];
    for (let i = 0; i < props.length; i += 2) rows.push(props.slice(i, i + 2));
    return (
      <View style={styles.table}>
        {rows.map((row, ri) => (
          <View key={row[0].name} style={styles.gridRow}>
            {row.map((prop, ci) => (
              <PropCell key={prop.name} prop={prop} divider={ri * 2 + ci + 2 < props.length} />
            ))}
            {row.length === 1 && <View style={styles.cell} />}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.table}>
      {props.map((prop, i) => (
        <View
          key={prop.name}
          style={[styles.row, i === 0 && styles.rowFirst, i === props.length - 1 && styles.rowLast]}
        >
          <View style={styles.header}>
            <Text style={styles.name}>
              {prop.name}
              <Text style={styles.optionalMark}>{prop.required ? '' : '?'}</Text>
            </Text>
            <Text style={styles.type}>{prop.type}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.desc}>{prop.desc}</Text>
            {prop.default != null && (
              <Text style={styles.default}>
                Default: <Text style={styles.defaultVal}>{prop.default}</Text>
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: CATALOG_SPACE.md,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border,
  },
  rowFirst: { paddingTop: 0 },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  header: { width: 140, gap: 2 },
  name: { ...CATALOG_TEXT.codeSmallStrong, color: CATALOG_COLOR.text },
  optionalMark: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.textMuted },
  type: { ...CATALOG_TEXT.codeMicro, color: CATALOG_COLOR.accent },
  // The second column — description + default — sized by the row's remaining width.
  body: { flex: 1, gap: 2 },
  desc: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
  default: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
  defaultVal: { ...CATALOG_TEXT.codeMicro, color: CATALOG_COLOR.textMuted },
  gridRow: { flexDirection: 'row', gap: PROPS_COLUMN_GAP },
  cell: { flex: 1, minWidth: 0, paddingVertical: CATALOG_SPACE.md, gap: 4 },
  cellDivider: { borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  cellHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2 },
});
