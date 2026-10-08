import React, { useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { DS_SEMANTIC, DS_RADIUS, DS_SPACING, DS_TYPOGRAPHY, DS_FONT_WEIGHT, DS_A11Y_MIN_TOUCH_TARGET } from '../../tokens';
import { Icon } from '../../icons/Icon.native';
import { Loading } from '../Loading';
import type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types';

type SizeTokens = { paddingVertical: number; paddingHorizontal: number; fontSize: number; lineHeight: number; iconSize: number };

// The icon size tracks the label's line box so the icon stays proportionate to the text at every size.
const SIZE_TOKENS: Record<ButtonSize, SizeTokens> = {
  large:  { paddingVertical: DS_SPACING[800], paddingHorizontal: DS_SPACING[1200], fontSize: DS_TYPOGRAPHY.labelMd.fontSize, lineHeight: 20, iconSize: 20 },
  medium: { paddingVertical: DS_SPACING[600], paddingHorizontal: DS_SPACING[800],  fontSize: DS_TYPOGRAPHY.labelSm.fontSize, lineHeight: 18, iconSize: 18 },
  small:  { paddingVertical: DS_SPACING[400], paddingHorizontal: DS_SPACING[800],  fontSize: DS_TYPOGRAPHY.labelXs.fontSize, lineHeight: 16, iconSize: 16 },
};

type VariantStyles = { container: ViewStyle; containerPressed: ViewStyle; containerDisabled: ViewStyle; label: TextStyle };

const VARIANT_STYLES: Record<ButtonVariant, VariantStyles> = {
  primary: {
    container: { backgroundColor: DS_SEMANTIC.text.regular },
    containerPressed: { backgroundColor: DS_SEMANTIC.emphasis.neutral },
    containerDisabled: { backgroundColor: DS_SEMANTIC.border.light },
    label: { color: DS_SEMANTIC.text.inverse },
  },
  secondary: {
    container: { backgroundColor: DS_SEMANTIC.surface.recessed },
    // Not DS_SEMANTIC.interaction.pressed/disabledOpacity — this variant's resting background is
    // already the translucent surface.recessed overlay, so its pressed/disabled states are their own
    // tuned darker/lighter versions of that same overlay (recessedPressed/recessedDisabled) rather
    // than a second, independently-chosen overlay stacked on top.
    containerPressed: { backgroundColor: DS_SEMANTIC.surface.recessedPressed },
    containerDisabled: { backgroundColor: DS_SEMANTIC.surface.recessedDisabled },
    label: { color: DS_SEMANTIC.text.regular },
  },
  tertiary: {
    container: { backgroundColor: 'transparent' },
    containerPressed: { backgroundColor: DS_SEMANTIC.interaction.pressed },
    containerDisabled: { backgroundColor: 'transparent' },
    label: { color: DS_SEMANTIC.text.regular },
  },
  white: {
    container: { backgroundColor: DS_SEMANTIC.surface.white },
    containerPressed: { backgroundColor: DS_SEMANTIC.surface.main },
    containerDisabled: { backgroundColor: DS_SEMANTIC.surface.muted },
    label: { color: DS_SEMANTIC.text.regular },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    containerPressed: { backgroundColor: DS_SEMANTIC.interaction.pressed },
    containerDisabled: { backgroundColor: 'transparent' },
    label: { color: DS_SEMANTIC.text.regular },
  },
};

function ButtonImpl({
  label = 'Button',
  variant = 'primary',
  size = 'large',
  showIcon = false,
  iconName = 'add',
  iconPosition = 'leading',
  showLabel = true,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const isGhost = variant === 'ghost';
  const isIconOnly = showIcon && !showLabel;
  const sizeTokens = SIZE_TOKENS[size];
  const isDisabled = disabled || loading || !onPress;
  // Ghost reads text-first, so its icon is sized to the label's line box rather than the larger standard.
  const renderedIconSize = isGhost ? Math.min(sizeTokens.iconSize, sizeTokens.lineHeight) : sizeTokens.iconSize;
  const iconColor = variant === 'primary' ? DS_SEMANTIC.text.inverse : DS_SEMANTIC.text.regular;
  const spinnerColor = iconColor;
  // Match the loader to the resting content height so swapping in the spinner never changes the height.
  const loaderSize = Math.max(showIcon ? sizeTokens.iconSize : 0, showLabel ? sizeTokens.lineHeight : 0) || sizeTokens.iconSize;
  // small/medium icon-only buttons render under the touch-target minimum — pad the tap area out
  // with hitSlop rather than growing the visual button itself.
  const iconOnlyVisualSize = sizeTokens.paddingVertical * 2 + sizeTokens.iconSize;
  const iconOnlyHitSlop = Math.max(0, Math.ceil((DS_A11Y_MIN_TOUCH_TARGET - iconOnlyVisualSize) / 2));
  // Ghost has zero padding (`baseGhost`) — its visual height is just the content's own line box, so
  // every ghost button (label-only or icon-only alike — the icon is itself capped to this same
  // line-box height, see `renderedIconSize` above) needs hitSlop to reach the touch-target minimum,
  // not just the icon-only case the other variants need it for.
  const ghostHitSlop = Math.max(0, Math.ceil((DS_A11Y_MIN_TOUCH_TARGET - sizeTokens.lineHeight) / 2));

  const [focused, setFocused] = useState(false);
  const accessibilityState = useMemo(() => ({ disabled: isDisabled, busy: loading }), [isDisabled, loading]);

  const renderInner = () => (
    <View style={[styles.content, isGhost && styles.contentGhost, disabled && styles.contentDisabled]}>
      {showIcon && iconPosition === 'leading' && (
        <Icon name={iconName} size={renderedIconSize} color={iconColor} />
      )}
      {showLabel && (
        <Text
          style={[styles.label, { fontSize: sizeTokens.fontSize, lineHeight: sizeTokens.lineHeight }, variantStyle.label, textStyle]}
        >
          {label}
        </Text>
      )}
      {showIcon && iconPosition === 'trailing' && (
        <Icon name={iconName} size={renderedIconSize} color={iconColor} />
      )}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
      hitSlop={isGhost ? ghostHitSlop : isIconOnly ? iconOnlyHitSlop : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        isGhost ? styles.baseGhost : {
          paddingVertical: sizeTokens.paddingVertical,
          paddingHorizontal: isIconOnly ? sizeTokens.paddingVertical : sizeTokens.paddingHorizontal,
        },
        variantStyle.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && variantStyle.containerPressed,
        isDisabled && !loading && variantStyle.containerDisabled,
        focused && !isDisabled && styles.focused,
        style,
      ]}
    >
      {loading ? <Loading color={spinnerColor} size={loaderSize} /> : renderInner()}
    </Pressable>
  );
}

/** Skips re-rendering when this button's own props are unchanged. */
export const Button = React.memo(ButtonImpl);

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DS_RADIUS.round,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  baseGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DS_RADIUS.small,
    borderWidth: 0,
    padding: 0,
  },
  focused: { borderColor: DS_SEMANTIC.interaction.focused },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[200] },
  contentGhost: { gap: DS_SPACING[100] },
  // Dims the whole content (icon + label together) so an icon-only disabled button is still visibly
  // disabled, not just a disabled button with no label to dim.
  contentDisabled: { opacity: DS_SEMANTIC.interaction.disabledOpacity },
  label: { fontWeight: DS_FONT_WEIGHT.semibold, textAlign: 'center' },
});
