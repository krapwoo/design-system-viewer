import React from 'react';
import { View, Text, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DS_SEMANTIC, DS_FONT_WEIGHT } from '../../tokens';
import { Icon } from '../../icons/Icon.native';
import type { IconName } from '../../icons';

export interface AvatarProps {
  /** Remote image URL. Takes precedence over `iconName`/`initials`; falls back to them when omitted
   *  or the image fails to load. */
  imageUrl?: string;
  /** Icon shown instead of initials — e.g. for a generic/anonymous avatar. Takes precedence over
   *  `initials` when there's no image. */
  iconName?: IconName;
  /** Shown when there's no image or icon — the first 1-2 characters are used, uppercased. */
  initials?: string;
  /** Diameter in px. @default 40 */
  size?: number;
  /** Fill colour behind the icon/initials. Defaults to a neutral muted surface (with dark
   *  foreground); passing a custom colour switches the icon/initials to light (inverse) text,
   *  assuming a saturated/dark fill — match that pairing if you override this. */
  backgroundColor?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** A circular image, icon, or initials fallback on a solid fill — in that order of precedence. */
export function Avatar({
  imageUrl,
  iconName,
  initials,
  size = 40,
  backgroundColor,
  accessibilityLabel,
  style,
}: AvatarProps) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = !!imageUrl && !imageFailed;
  const showIcon = !showImage && !!iconName;
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  // The default fill (surface.muted) is light, so its icon/initials need dark text; a caller-supplied
  // backgroundColor is assumed saturated/dark (the existing convention — see the "Custom colour"
  // catalog example), so it keeps the light inverse text that pairing needs.
  const contentColor = backgroundColor ? DS_SEMANTIC.text.inverse : DS_SEMANTIC.text.regular;

  return (
    <View
      style={[styles.circle, dimension, !showImage && { backgroundColor: backgroundColor ?? DS_SEMANTIC.surface.muted }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? initials}
    >
      {showImage ? (
        <Image source={{ uri: imageUrl }} style={dimension} onError={() => setImageFailed(true)} />
      ) : showIcon ? (
        <Icon name={iconName} size={Math.round(size * 0.5)} color={contentColor} />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.4), color: contentColor }]} numberOfLines={1}>
          {(initials ?? '?').slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: DS_FONT_WEIGHT.semibold,
  },
});
