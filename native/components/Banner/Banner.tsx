import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { DS_SEMANTIC, DS_RADIUS, DS_SPACING, DS_TYPOGRAPHY, DS_ICON_SIZE, DS_MOTION_DURATION, DS_MOTION_EASING } from '../../../tokens';
import { Icon } from '../../../icons/Icon.native';
import type { IconName } from '../../../icons';
import { AnimatedChevron } from '../AnimatedChevron';
import { STATUS_BG, STATUS_FG } from '../statusColors';
import type { BannerProps, BannerVariant } from './Banner.types';

// Shared with Badge (see ../statusColors) so a banner reads as the same status identity as a
// badge of the same variant — one map, matched by construction.

const BANNER_ICONS: Record<BannerVariant, IconName> = {
  neutral: 'info-circle',
  info: 'info-circle',
  positive: 'circle-check',
  warning: 'triangle-alert',
  negative: 'alert-circle',
};

const COLLAPSE_ANIM_MS = DS_MOTION_DURATION.base;

/**
 * A status callout in two layouts, chosen by props:
 *   • collapsible callout — the whole card toggles the description open/closed;
 *   • standard callout    — leading icon + title, optional description/link/action.
 */
export function Banner({
  variant = 'warning',
  title = 'Banner title',
  description = 'Description text goes here',
  collapsible = false,
  defaultExpanded = true,
  backgroundColor,
  onPress,
  trailingIcon,
  textColor,
  icon,
  link,
  action,
  style,
}: BannerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Real layout height + opacity via the core `Animated` API (`useNativeDriver: false`) — not
  // `LayoutAnimation`, which is unreliable on the New Architecture (Fabric) and a total no-op on
  // web, so the collapse used to just snap instantly there. Same measure-once-then-animate
  // technique used elsewhere in this DS: render in normal flow only on the very first pass while
  // already expanded (shows instantly, no flash, and captures the real height); every other pass —
  // including the very first while starting collapsed — positions the content absolutely so it can
  // self-measure without affecting layout, then animates between 0 and that measured height.
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const collapseAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  useEffect(() => {
    const anim = Animated.timing(collapseAnim, {
      toValue: expanded ? 1 : 0,
      duration: COLLAPSE_ANIM_MS,
      // `standard` — an in-place expand/collapse (a toggle), per DS_MOTION_EASING_USE.
      easing: Easing.bezier(...DS_MOTION_EASING.standard),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [expanded, collapseAnim]);

  const bg = backgroundColor ?? STATUS_BG[variant];
  const contentTextColor = textColor ?? STATUS_FG[variant];
  const iconName = icon ?? BANNER_ICONS[variant];

  // ── Collapsible callout: the whole banner toggles the description ─────────────
  if (collapsible) {
    const toggle = () => setExpanded(e => !e);
    const flowMeasure = measuredHeight === 0 && expanded;
    const onDescriptionLayout = (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && h !== measuredHeight) setMeasuredHeight(h);
    };
    return (
      <Pressable
        style={[styles.calloutContainer, { backgroundColor: bg }, style]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        {({ pressed }) => (
          <>
            {pressed && <View style={styles.pressOverlay} pointerEvents="none" />}
            <View style={styles.headerRow}>
              <Icon name={iconName} size={DS_ICON_SIZE.xs} color={contentTextColor} />
              <Text style={[styles.title, styles.titleFlex, { color: contentTextColor, marginBottom: 0 }]}>
                {title}
              </Text>
              <AnimatedChevron expanded={expanded} size={DS_ICON_SIZE.xs} color={contentTextColor} />
            </View>
            {!!description && (
              <Animated.View
                style={[
                  styles.collapseClip,
                  measuredHeight === 0
                    ? expanded
                      ? null
                      : styles.collapseHidden
                    : { height: Animated.multiply(collapseAnim, measuredHeight), opacity: collapseAnim },
                ]}
              >
                <View style={flowMeasure ? undefined : styles.collapseAbsolute} onLayout={onDescriptionLayout}>
                  <Text style={[styles.description, styles.descriptionPad, { color: contentTextColor }]}>
                    {description}
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </Pressable>
    );
  }

  // ── Standard callout (title + description) ────────────────────────────────────
  const body = (pressed: boolean) => (
    <>
      {onPress && pressed && <View style={styles.pressOverlay} pointerEvents="none" />}
      <View style={styles.headerRow}>
        <Icon name={iconName} size={DS_ICON_SIZE.xs} color={contentTextColor} />
        <Text style={[styles.title, styles.titleFlex, { color: contentTextColor, marginBottom: 0 }]}>
          {title}
        </Text>
        {trailingIcon ? <Icon name={trailingIcon} size={DS_ICON_SIZE.xs} color={contentTextColor} /> : null}
      </View>
      {description || link ? (
        <Text style={[styles.description, styles.descriptionPad, { color: contentTextColor }]}>
          {description ?? ''}
          {description && link ? ' ' : null}
          {link ? (
            <Text style={styles.linkText} onPress={link.onPress} accessibilityRole="link">
              {link.label}
            </Text>
          ) : null}
        </Text>
      ) : null}
      {action ? (
        <View style={[styles.actionRow, { paddingHorizontal: DS_SPACING[800] }]}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            // Pads the compact text button's visual ~26px height out to the 44pt touch-target minimum.
            hitSlop={10}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={[styles.actionLabel, { color: contentTextColor }]}>{action.label}</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={[styles.calloutContainer, { backgroundColor: bg }, style]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {({ pressed }) => body(pressed)}
      </Pressable>
    );
  }

  return (
    <View style={[styles.calloutContainer, { backgroundColor: bg }, style]}>{body(false)}</View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: DS_SPACING[400],
  },
  actionButton: {
    borderRadius: DS_RADIUS.xs,
    paddingVertical: DS_SPACING[200],
    paddingHorizontal: DS_SPACING[600],
  },
  actionButtonPressed: {
    backgroundColor: DS_SEMANTIC.interaction.pressed,
  },
  actionLabel: {
    ...DS_TYPOGRAPHY.labelSm,
  },
  // Was undistinguished from the surrounding description text (just inherited its color via
  // nested-Text color inheritance) — underline alone with no color difference is easy to miss at a
  // glance and gives nothing to fall back on if the underline is ever dropped.
  linkText: {
    textDecorationLine: 'underline',
    color: DS_SEMANTIC.text.link,
  },
  // Callout: the header carries the top + horizontal padding so the pressed state fills it; the
  // bottom padding lives on the container (constant) so nothing jumps when toggling — only the
  // description mounts/unmounts. overflow:hidden keeps the rounded corners.
  calloutContainer: {
    borderRadius: DS_RADIUS.medium,
    width: '100%',
    overflow: 'hidden',
    paddingBottom: DS_SPACING[800],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DS_SPACING[400],
    paddingTop: DS_SPACING[800],
    paddingHorizontal: DS_SPACING[800],
  },
  title: {
    ...DS_TYPOGRAPHY.labelSm,
    color: DS_SEMANTIC.text.regular,
    marginBottom: DS_SPACING[200],
  },
  titleFlex: {
    flex: 1,
  },
  description: {
    ...DS_TYPOGRAPHY.bodySm,
    color: DS_SEMANTIC.text.regular,
  },
  descriptionPad: {
    // Start-aligns with the title: headerRow padding (800) + icon + gap (400). Logical start/end
    // (not left/right) so the indent follows the icon+title when the layout mirrors in RTL.
    paddingStart: DS_SPACING[800] + DS_ICON_SIZE.xs + DS_SPACING[400],
    paddingEnd: DS_SPACING[800],
    paddingTop: DS_SPACING[200],
  },
  // Translucent pressed overlay — sits above the banner bg so the tinted bg shows through.
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DS_SEMANTIC.interaction.pressed,
    borderRadius: DS_RADIUS.medium,
  },
  // Collapsible description — clips the animated height; the child is pinned absolute (except on
  // its very first in-flow measuring pass) so shrinking the parent never re-measures/corrupts it.
  collapseClip: {
    overflow: 'hidden',
    width: '100%',
  },
  collapseHidden: {
    height: 0,
  },
  collapseAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});
