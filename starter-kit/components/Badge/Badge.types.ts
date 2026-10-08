import type { StyleProp, ViewStyle } from 'react-native';
import type { IconName } from '../../icons';

export type BadgeVariant = 'neutral' | 'info' | 'positive' | 'warning' | 'negative';

export interface BadgeProps {
  /** Semantic color scheme. */
  variant?: BadgeVariant;
  /** Label text. Omit (with a single icon) for an icon-only chip. */
  label?: string;
  /** Icon before the label. */
  leadingIcon?: IconName;
  /** Icon after the label. */
  trailingIcon?: IconName;
  /** Accessible name — required for an icon-only badge (no `label`) so it can be announced. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}
