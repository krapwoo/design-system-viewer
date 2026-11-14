import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { View, Pressable, Modal, Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DS_SEMANTIC, DS_SPACING, DS_RADIUS, DS_SHADOW, DS_MOTION_DURATION, DS_MOTION_EASING } from '../../tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Runs the dialog's fade/scale towards `visible` and calls `onExited` once a CLOSE has played to the
 *  end — the only moment its Modal may unmount. An interrupted close (the dialog reopened mid-exit)
 *  reports `finished: false` and so never calls it. Returns a cleanup that stops the animation. */
export function animateDialog(progress: Animated.Value, visible: boolean, onExited: () => void): () => void {
  const anim = Animated.timing(progress, {
    toValue: visible ? 1 : 0,
    duration: visible ? DS_MOTION_DURATION.base : DS_MOTION_DURATION.fast,
    // `decelerate` — something entering the screen, per DS_MOTION_EASING_USE.
    easing: Easing.bezier(...DS_MOTION_EASING.decelerate),
    useNativeDriver: false,
  });
  anim.start(({ finished }) => {
    if (finished && !visible) onExited();
  });
  return () => anim.stop();
}

export interface DialogProps {
  /** Whether the dialog (and its backdrop) are shown. Going false plays the fade-out first; the
   *  dialog's Modal stays mounted until that finishes. */
  visible: boolean;
  /** Called when the backdrop is tapped, the Android hardware back button is pressed, or (web) Escape
   *  is pressed (the last two arrive as the Modal's `onRequestClose`) — the dialog doesn't close
   *  itself; the caller decides. */
  onDismiss: () => void;
  /** The dialog's content. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A card centred on screen over a dismissible backdrop — fades and scales in, distinct from
 * {@link BottomSheet}'s bottom-anchored slide. Named `Dialog` (not `Modal`) to avoid shadowing React
 * Native's own built-in `Modal`. Like BottomSheet, it renders inside its own RN `Modal`, so it covers
 * the whole screen — navigation (a tab bar, say) included — wherever the caller places it. The Modal
 * (`animationType="none"`) only supplies presentation; the fade and scale stay Dialog's own, and the
 * Modal is kept mounted until the exit animation has finished.
 */
export function Dialog({ visible, onDismiss, children, style }: DialogProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    return animateDialog(progress, visible, () => setMounted(false));
  }, [visible, progress]);

  if (!mounted) return null;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    // `onRequestClose` is Android's hardware back and, via react-native-web, Escape. The translucent
    // flags (Android only, ignored elsewhere) let the dialog reach the screen edges; the
    // navigation-bar flag is only valid alongside the status-bar one.
    <Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
        <AnimatedPressable
          style={[styles.backdrop, { opacity: progress }]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <Animated.View
          style={[styles.card, style, { opacity: progress, transform: [{ scale }] }]}
          // Contain assistive-tech focus while open (iOS) — without this, content behind the scrim
          // stays reachable by screen readers even though it's visually blocked.
          accessibilityViewIsModal
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** `StyleSheet.absoluteFill`, spelled out: React Native 0.81's types don't allow spreading
 *  `StyleSheet.absoluteFill` (and 0.86 removed `absoluteFillObject`), so this one form
 *  type-checks on both. */
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create({
  overlay: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    padding: DS_SPACING[800],
  },
  backdrop: { ...FILL, backgroundColor: DS_SEMANTIC.element.overlayBackdrop },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: DS_SEMANTIC.surface.white,
    borderRadius: DS_RADIUS.large,
    padding: DS_SPACING[800],
    ...DS_SHADOW.card,
  },
});
