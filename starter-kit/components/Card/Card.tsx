import React, { type ReactNode } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type AccessibilityState,
} from 'react-native';
import { DS_SEMANTIC, DS_RADIUS, DS_SPACING, DS_SHADOW } from '../../tokens';

// Dev-only fill for the Figma slot placeholders (shown when no `children` are passed). Deliberately
// vivid so it always reads as scaffolding, never as a real surface — not a themed token.
const DEV_PLACEHOLDER_BG = '#f4c3ff';

interface CardBaseProps {
  /** Card content. */
  children?: ReactNode;
  /** Figma slot visibility toggles — prefer `children` for real content. */
  showSlot1?: boolean;
  showSlot2?: boolean;
  showSlot3?: boolean;
  showSlot4?: boolean;
  showSlot5?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
}

// `disabled` only means something on a pressable card — a plain (non-`onPress`) card can't be
// disabled, so that combination is a type error here instead of a silently-ignored prop.
export type CardProps =
  | (CardBaseProps & {
      /** Makes the whole card a tappable button. */
      onPress: () => void;
      /** Only valid on a pressable card. */
      disabled?: boolean;
    })
  | (CardBaseProps & { onPress?: undefined; disabled?: undefined });

/**
 * The primary content surface: a rounded white card with a soft resting shadow. Pass `children`
 * for real content, or `onPress` to make the whole card a tappable button (pressed + focus states).
 */
export function Card({
  children,
  showSlot1 = true,
  showSlot2 = true,
  showSlot3 = true,
  showSlot4 = true,
  showSlot5 = true,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  style,
}: CardProps) {
  const [focused, setFocused] = React.useState(false);
  const cardStyle = ({ pressed }: { pressed: boolean }) => [
    styles.card,
    pressed && !disabled && styles.cardOnTap,
    focused && !disabled && styles.cardFocused,
    disabled && styles.cardDisabled,
    style,
  ];

  const inner = children ?? renderSlots(showSlot1, showSlot2, showSlot3, showSlot4, showSlot5);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ ...accessibilityState, disabled }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={cardStyle}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.card, style]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
    >
      {inner}
    </View>
  );
}

function renderSlots(
  showSlot1: boolean,
  showSlot2: boolean,
  showSlot3: boolean,
  showSlot4: boolean,
  showSlot5: boolean,
) {
  const slots = [showSlot1, showSlot2, showSlot3, showSlot4, showSlot5].filter(Boolean);
  return slots.map((_, index) => <View key={index} style={styles.placeholder} />);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DS_SEMANTIC.surface.white,
    borderRadius: DS_RADIUS.medium,
    padding: DS_SPACING[800],
    width: '100%',
    ...DS_SHADOW.resting,
  },
  cardOnTap: {
    backgroundColor: DS_SEMANTIC.interaction.pressed,
  },
  cardFocused: {
    borderWidth: 2,
    borderColor: DS_SEMANTIC.interaction.focused,
  },
  cardDisabled: {
    opacity: DS_SEMANTIC.interaction.disabledOpacity,
  },
  placeholder: {
    height: 59,
    backgroundColor: DEV_PLACEHOLDER_BG,
    borderRadius: DS_RADIUS.xs,
    width: '100%',
  },
});
