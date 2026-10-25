import { useRef, useState, type RefObject } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { CATALOG_TEXT, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS, CATALOG_LAYOUT } from './tokens';

/**
 * Plain search input for filtering the catalog's own sidebar nav. Deliberately built from bare
 * RN primitives rather than the host app's own search/field component — the catalog is a
 * documentation tool for that component, not a consumer of it, so its own chrome shouldn't depend
 * on (or accidentally break alongside) whatever that component does.
 *
 * `accessibilityLabel` and `autoFocus` are optional and additive (#60): every existing caller
 * keeps today's default name ("Filter components") and no autofocus, unchanged. A caller naming a
 * genuinely different search surface — e.g. `SourceReferencePicker.tsx`'s catalog-wide picker,
 * which is not the sidebar's own filter — overrides the label so its own durable name stays
 * truthful, rather than three different filters all claiming to be "Filter components".
 */
export function CatalogSearchInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel = 'Filter components',
  autoFocus = false,
  inputRef: providedInputRef,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
  /** Focus after a surrounding modal has shown, without racing its trigger-focus capture. */
  inputRef?: RefObject<TextInput | null>;
}) {
  // Focus draws the catalog focus ring — react-native-web resets the browser's default input focus
  // ring, so the box has to draw its own indicator.
  const [focused, setFocused] = useState(false);
  const [clearFocused, setClearFocused] = useState(false);
  // Hover via onHoverIn/Out, not the style callback's `hovered` — same reasoning as NavItem: this
  // project's Pressable types (targeting native) don't expose that field, though RNW fires the events.
  const [clearHovered, setClearHovered] = useState(false);
  // Clearing unmounts the clear button that has focus; return focus to the field it cleared.
  const localInputRef = useRef<TextInput>(null);
  const inputRef = providedInputRef ?? localInputRef;
  return (
    <View style={[styles.box, focused && styles.boxFocused]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={CATALOG_COLOR.textMuted}
        // A durable name — the placeholder alone disappears the moment the user types.
        accessibilityLabel={accessibilityLabel}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            inputRef.current?.focus();
          }}
          onFocus={() => setClearFocused(true)}
          onBlur={() => setClearFocused(false)}
          onHoverIn={() => setClearHovered(true)}
          onHoverOut={() => setClearHovered(false)}
          accessibilityRole="button"
          accessibilityLabel="Clear filter"
          // Press/hover show the sidebar's highlight; keyboard focus shows the catalog focus ring.
          style={({ pressed }) => [
            styles.clearButton,
            (pressed || clearHovered) && styles.clearButtonActive,
            clearFocused && styles.focusRing,
          ]}
        >
          <Text style={styles.clear}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.xs,
    borderWidth: 1, borderColor: CATALOG_COLOR.borderHairline, borderRadius: CATALOG_RADIUS.control,
    paddingLeft: 10, height: CATALOG_LAYOUT.controlSize, marginBottom: CATALOG_SPACE.sm,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
  },
  boxFocused: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  input: { flex: 1, ...CATALOG_TEXT.body, color: CATALOG_COLOR.text, padding: 0 },
  // A full 44×44 target: react-native-web does not honor hitSlop for pointer or keyboard.
  clearButton: {
    width: CATALOG_LAYOUT.controlSize, height: CATALOG_LAYOUT.controlSize,
    alignItems: 'center', justifyContent: 'center', borderRadius: CATALOG_RADIUS.control,
  },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  clearButtonActive: { backgroundColor: CATALOG_COLOR.surfacePressed },
  clear: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.textMuted, paddingHorizontal: 2 },
});
