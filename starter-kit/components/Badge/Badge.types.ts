import type { StyleProp, ViewStyle } from 'react-native';
import type { IconName } from '../../icons';

export type BadgeVariant = 'neutral' | 'info' | 'positive' | 'warning' | 'negative';

interface BadgeBaseProps {
  /** Semantic color scheme. */
  variant?: BadgeVariant;
  /** Icon before the label. */
  leadingIcon?: IconName;
  /** Icon after the label. */
  trailingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/** A badge with text. `accessibilityLabel` is optional; when set it replaces the announced name
 *  outright (the variant word is then not added — see BADGE_VARIANT_ANNOUNCEMENT). */
export interface LabelledBadgeProps extends BadgeBaseProps {
  /** Label text. */
  label: string;
  accessibilityLabel?: string;
}

/** An icon-only badge (no `label`). It has no text to read, so `accessibilityLabel` is required. */
export interface IconOnlyBadgeProps extends BadgeBaseProps {
  label?: undefined;
  accessibilityLabel: string;
}

export type BadgeProps = LabelledBadgeProps | IconOnlyBadgeProps;
