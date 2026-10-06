import React, { isValidElement, type ReactNode } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY, DS_A11Y_MIN_TOUCH_TARGET } from '../../../tokens';
import { Button, type ButtonProps } from '../Button';

// Both slots reserve this width whether populated or empty, so the title stays centered
// regardless of which side(s) actually have content.
const SLOT_SIZE = DS_A11Y_MIN_TOUCH_TARGET;

/** Dev-time consistency check (same policy as ButtonGroup's `checkConsistency`) — a nav bar's own
 *  leading/trailing actions read as one quiet, uniform family (back arrow, close, overflow menu),
 *  never as a prominent CTA. Warns (never throws) if a slot's Button doesn't follow that: `small`
 *  size, and not `ghost` (which reads as an inline text action, not a nav icon — see Button's own
 *  variant-choice doc). */
function checkSlotButton(node: ReactNode, slotName: 'leading' | 'trailing'): void {
  if (!isValidElement(node) || node.type !== Button) return;
  const props = node.props as ButtonProps;
  if (props.size && props.size !== 'small') {
    console.warn(`[TopNav] ${slotName} button uses size="${props.size}" — TopNav slot buttons should use size="small".`);
  }
  if (props.variant === 'ghost') {
    console.warn(
      `[TopNav] ${slotName} button uses variant="ghost" — that reads as an inline text action, not a nav icon. Use variant="secondary" (TopNav's default) instead.`,
    );
  }
}

export interface TopNavProps {
  /** Centered title text. Ignored when `center` is set. */
  title?: string;
  /** Custom content overriding the centered title — e.g. a search field or segmented toggle. */
  center?: ReactNode;
  /** Leading slot — typically a back/close icon Button. Keep it `size="small"` and
   *  `variant="secondary"` (TopNav's default) unless there's a specific reason to deviate — never
   *  `ghost`, which reads as an inline text action rather than a nav icon. */
  leading?: ReactNode;
  /** Trailing slot — typically an action icon Button. Same size/variant guidance as `leading`. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A screen's top bar: fixed-width leading/trailing slots flanking a centered title (or custom
 *  `center` content). Slots reserve their layout space even when empty, so the title stays
 *  centered whether one, both, or neither side has content. */
export function TopNav({ title, center, leading, trailing, style }: TopNavProps) {
  checkSlotButton(leading, 'leading');
  checkSlotButton(trailing, 'trailing');
  return (
    <View style={[styles.row, style]}>
      <View style={styles.slot}>{leading}</View>
      <View style={styles.center}>
        {center ?? (title != null && (
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ))}
      </View>
      <View style={[styles.slot, styles.slotTrailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS_SPACING[800],
    paddingTop: DS_SPACING[800],
    paddingBottom: DS_SPACING[400],
    backgroundColor: DS_SEMANTIC.surface.white,
  },
  slot: { width: SLOT_SIZE, height: SLOT_SIZE, alignItems: 'flex-start', justifyContent: 'center' },
  slotTrailing: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  title: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
});
