import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_TEXT, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS } from './tokens';

/** One token swatch: its rendered value (a colour chip) plus name/value as data — the shared shape
 *  behind every Colors gallery (this framework's own, and any host app's, e.g. the Native App DS
 *  Template's). `width` defaults to fit a typical semantic/palette name; widen it for a gallery whose
 *  longest name needs more room (e.g. `borderHairline`). `valueLabel` overrides only the displayed
 *  text (e.g. a resolved palette token like `green.700`) — the chip itself always renders `value`
 *  directly, since that's the real, renderable colour. */
export function Swatch({
  name,
  value,
  valueLabel,
  width = 84,
  wrapName = false,
  splitValue,
}: {
  name: string;
  value: string;
  valueLabel?: string;
  width?: number;
  /** Lets a long name wrap instead of truncating to one line. Off by default, so every existing
   *  gallery keeps its compact single-line labels. */
  wrapName?: boolean;
  /** #64 B3: a second colour, rendered as the right half of the chip (`value`'s own colour stays
   *  the left half) — for a light/dark pair rendered as one swatch. Omit for every existing
   *  single-appearance swatch, whose chip renders exactly as before (one solid fill). */
  splitValue?: string;
}) {
  return (
    <View style={[styles.swatch, { width }]}>
      {splitValue ? (
        <View style={styles.splitChip}>
          <View style={[styles.splitHalf, { backgroundColor: value }]} />
          <View style={[styles.splitHalf, { backgroundColor: splitValue }]} />
        </View>
      ) : (
        <View style={[styles.chip, { backgroundColor: value }]} />
      )}
      <Text style={styles.name} numberOfLines={wrapName ? undefined : 1}>{name}</Text>
      <Text style={styles.value} numberOfLines={1}>{valueLabel ?? value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { gap: CATALOG_SPACE.xs },
  chip: {
    height: 40,
    borderRadius: CATALOG_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CATALOG_COLOR.border,
  },
  // #64 B3: the same chip geometry as `chip` above, split into two equal halves for a light/dark
  // pair — `overflow: 'hidden'` keeps both halves inside the chip's own rounded corners.
  splitChip: {
    height: 40,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: CATALOG_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CATALOG_COLOR.border,
  },
  splitHalf: { flex: 1 },
  name: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  value: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
});
