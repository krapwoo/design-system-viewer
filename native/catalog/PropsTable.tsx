import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE } from './tokens';
import type { PropDef } from './types';

/** Renders a component's real prop interface as a table: each row holds name + type in a fixed-width
 *  first column, with the description (and default, if any) in a second column beside it — the Props
 *  column is wide enough now (see SectionBlock's `columnWide`) for this side-by-side layout to read
 *  comfortably instead of squeezing a description under a name/type pair. */
export function PropsTable({ props }: { props: PropDef[] }) {
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
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CATALOG_COLOR.borderHairline,
  },
  rowFirst: { paddingTop: 0 },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  header: { width: 140, gap: 2 },
  name: { fontSize: CATALOG_TYPE.sm, fontFamily: CATALOG_COLOR.code, fontWeight: '700', color: CATALOG_COLOR.text },
  optionalMark: { fontWeight: '400', color: CATALOG_COLOR.textMuted },
  type: { fontSize: CATALOG_TYPE.xs, fontFamily: CATALOG_COLOR.code, color: CATALOG_COLOR.accent },
  // The second column — description + default — sized by the row's remaining width.
  body: { flex: 1, gap: 2 },
  desc: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, lineHeight: 17 },
  default: { fontSize: CATALOG_TYPE.xs, color: CATALOG_COLOR.textMuted },
  defaultVal: { fontFamily: CATALOG_COLOR.code, color: CATALOG_COLOR.textMuted },
});
