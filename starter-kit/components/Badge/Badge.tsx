import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS_RADIUS, DS_SPACING, DS_TYPOGRAPHY, DS_ICON_SIZE } from '../../tokens';
import { Icon } from '../../icons/Icon.native';
import { STATUS_BG, STATUS_FG } from '../statusColors';
import type { BadgeProps, BadgeVariant } from './Badge.types';

/**
 * The word a screen reader adds after a labelled badge's text, so status isn't carried by colour
 * alone ("Delayed, warning"). One map so all five sit together and can be translated later.
 * `neutral` is empty on purpose: it has no status to announce, so the badge reads as its label.
 */
export const BADGE_VARIANT_ANNOUNCEMENT: Record<BadgeVariant, string> = {
  neutral: '',
  info: 'info',
  positive: 'positive',
  warning: 'warning',
  negative: 'negative',
};

/**
 * A small status pill. Composable: label-only, icon-only (a single icon, no label), or a label with
 * a leading and/or trailing icon. Text + icons sit on the variant background in the variant's own
 * emphasis colour.
 */
export function Badge({ variant = 'neutral', label, leadingIcon, trailingIcon, accessibilityLabel, style }: BadgeProps) {
  const hasLabel = label != null && label !== '';
  // Backstop for untyped JS callers: BadgeProps already makes `accessibilityLabel` a compile-time
  // requirement for an icon-only badge, but JS (or `label=""`) bypasses the type — warn instead of
  // silently rendering an unnameable status glyph.
  if (__DEV__ && !hasLabel && !accessibilityLabel) {
    console.warn('[Badge] Icon-only badge (no `label`) needs an `accessibilityLabel` — without one it has no accessible name.');
  }
  const fg = STATUS_FG[variant];
  // Compose the accessible name rather than use accessibilityValue: the badge is a text chip, not a
  // range/state control, and `accessibilityValue.text` is spoken inconsistently across VoiceOver,
  // TalkBack and web (aria-valuetext only means something on range roles). An explicit
  // `accessibilityLabel` is the caller's deliberate name and is passed through untouched.
  const announcement = BADGE_VARIANT_ANNOUNCEMENT[variant];
  const accessibleName = accessibilityLabel ?? (hasLabel && announcement ? `${label}, ${announcement}` : undefined);

  return (
    <View
      style={[styles.badge, !hasLabel && styles.iconOnly, { backgroundColor: STATUS_BG[variant] }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibleName}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={DS_ICON_SIZE.xs} color={fg} /> : null}
      {hasLabel ? (
        <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {trailingIcon ? <Icon name={trailingIcon} size={DS_ICON_SIZE.xs} color={fg} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS_SPACING[100],
    paddingVertical: DS_SPACING[200],
    paddingHorizontal: DS_SPACING[400],
    borderRadius: DS_RADIUS.round,
    alignSelf: 'flex-start',
  },
  iconOnly: {
    paddingHorizontal: DS_SPACING[200],
  },
  label: {
    ...DS_TYPOGRAPHY.labelXs,
  },
});
