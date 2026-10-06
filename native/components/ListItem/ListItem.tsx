import React, { useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY, DS_A11Y_MIN_TOUCH_TARGET } from '../../../tokens';

export interface ListItemProps {
  title: string;
  /** Small secondary line below the title. */
  subtitle?: string;
  /** A third block below subtitle — for lower-priority extra content (a timestamp, a count, or a
   *  Badge/Button) that shouldn't compete with subtitle for attention. A plain string renders in the
   *  same small muted style as before; pass a Badge/Button/other node directly for anything richer. */
  footer?: ReactNode;
  /** Leading slot — typically an Avatar or Icon. */
  leading?: ReactNode;
  /** Compact right-aligned value shown before the trailing slot — e.g. a settings row's current
   *  value ("English") ahead of its chevron. */
  trailingText?: string;
  /** A second, more muted right-aligned line below `trailingText` — e.g. a unit or a status caption
   *  under the primary value. Only meaningful alongside `trailingText`. */
  trailingSubtext?: string;
  /** Trailing slot — typically a chevron Icon, a Switch, a Button, or a value label. */
  trailing?: ReactNode;
  /** Makes the whole row tappable. */
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A single row: optional leading/trailing slots flanking a title (+ optional subtitle/footer).
 *  Stack several inside a {@link List} for a settings screen, menu, or search-results list. */
export function ListItem({
  title,
  subtitle,
  footer,
  leading,
  trailingText,
  trailingSubtext,
  trailing,
  onPress,
  disabled = false,
  style,
}: ListItemProps) {
  const [focused, setFocused] = useState(false);
  const inner = (
    <>
      {leading && <View style={styles.slot}>{leading}</View>}
      <View style={styles.textGroup}>
        <Text style={[styles.title, disabled && styles.disabledText]} numberOfLines={1}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.subtitle, disabled && styles.disabledText]} numberOfLines={1}>{subtitle}</Text>
        )}
        {footer != null &&
          (typeof footer === 'string' ? (
            <Text style={[styles.footerText, disabled && styles.disabledText]} numberOfLines={1}>{footer}</Text>
          ) : (
            <View style={styles.footerNode}>{footer}</View>
          ))}
      </View>
      {(trailingText || trailing) && (
        <View style={styles.trailingGroup}>
          {!!trailingText && (
            <View style={styles.trailingTextGroup}>
              <Text style={[styles.trailingText, disabled && styles.disabledText]} numberOfLines={1}>{trailingText}</Text>
              {!!trailingSubtext && (
                <Text style={[styles.trailingSubtext, disabled && styles.disabledText]} numberOfLines={1}>{trailingSubtext}</Text>
              )}
            </View>
          )}
          {trailing && <View style={styles.slot}>{trailing}</View>}
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
        accessibilityState={{ disabled }}
        // Keyboard focus shows the same highlight as a press — a full-width row has no border to
        // recolor, so focus mirrors the pressed treatment (same policy as SegmentedToggle/UnderlineTabs).
        style={({ pressed }) => [styles.row, (pressed || focused) && !disabled && styles.pressed, style]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={[styles.row, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS_SPACING[600],
    minHeight: DS_A11Y_MIN_TOUCH_TARGET,
    paddingVertical: DS_SPACING[800],
    paddingHorizontal: DS_SPACING[400],
    backgroundColor: DS_SEMANTIC.surface.white,
  },
  pressed: {
    backgroundColor: DS_SEMANTIC.interaction.pressed,
  },
  slot: {
    flexShrink: 0,
  },
  textGroup: {
    flex: 1,
    minWidth: 0,
    gap: DS_SPACING[100],
  },
  title: {
    ...DS_TYPOGRAPHY.bodyMd,
    color: DS_SEMANTIC.text.regular,
  },
  subtitle: {
    ...DS_TYPOGRAPHY.bodyXs,
    color: DS_SEMANTIC.text.muted,
  },
  footerText: {
    ...DS_TYPOGRAPHY.labelXs,
    color: DS_SEMANTIC.text.muted,
  },
  // A node footer (Badge/Button) brings its own sizing/color — just a top nudge so it doesn't sit
  // flush against subtitle.
  footerNode: {
    marginTop: DS_SPACING[100],
    alignItems: 'flex-start',
  },
  trailingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS_SPACING[300],
    flexShrink: 0,
  },
  trailingTextGroup: {
    alignItems: 'flex-end',
    gap: DS_SPACING[100],
  },
  trailingText: {
    ...DS_TYPOGRAPHY.bodySm,
    color: DS_SEMANTIC.text.muted,
    flexShrink: 1,
  },
  trailingSubtext: {
    ...DS_TYPOGRAPHY.labelXs,
    color: DS_SEMANTIC.text.muted,
    flexShrink: 1,
  },
  // Disabled text — a step lighter than `text.muted` (which the subtitle/footer already use for
  // ordinary secondary text), so a disabled row reads as inactive rather than just secondary —
  // same reasoning as InputField/SearchField (see DS_SEMANTIC.text.disabled's own doc comment).
  disabledText: {
    color: DS_SEMANTIC.text.disabled,
  },
});
