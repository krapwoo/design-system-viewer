import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { motionTranslatesDirectly, motionValueTarget, type MotionValueRange } from './motionValueDomain';

/** `Animated.spring`'s physics fields — the same shape as a design system's own spring-config
 *  token (e.g. `DS_MOTION_SPRING`), kept local here rather than imported from any app's tokens so
 *  this stays an app-agnostic catalog piece. */
export interface MotionSpecimenSpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  overshootClamping?: boolean;
  restDisplacementThreshold?: number;
  restSpeedThreshold?: number;
}

export type MotionSpecimenProps =
  | {
      kind: 'timing';
      /** Duration in ms, e.g. a page's own `DS_MOTION_DURATION.base`. */
      duration: number;
      /** A real `Easing` function, e.g. `Easing.bezier(...DS_MOTION_EASING.standard)`. Defaults to
       *  linear when omitted. */
      easing?: (value: number) => number;
      /** Track length in px the dot travels, start to end. @default 160 */
      distance?: number;
      label?: string;
    }
  | {
      kind: 'spring';
      spring: MotionSpecimenSpringConfig;
      /** Which domain `spring`'s rest thresholds are scaled for (see `motionValueDomain.ts`):
       *  `'distance'` (default) for a config tuned for pixel-space points, e.g. a `BottomSheet`'s
       *  snap-point spring; `'unit'` for a config tuned for a normalized 0-to-1 progress/blend
       *  value — `'distance'`'s pixel-scale thresholds would otherwise end a unit-valued spring
       *  before it ever moves. Does not change the track's own pixel length (`distance`), only
       *  which domain the `Animated.Value` itself animates in. */
      valueRange?: MotionValueRange;
      distance?: number;
      label?: string;
    };

const DOT_SIZE = 20;
const DEFAULT_DISTANCE = 160;

/**
 * A reusable, bounded start-to-end motion demo for a duration/easing or spring token: a dot slides
 * once across a fixed track when the specimen mounts, and a "Replay" button plays it again on
 * demand. Respects the platform's reduce-motion preference — when enabled, every play (including
 * the initial one) jumps straight to the end state instead of animating, exactly as the real
 * product components built on these tokens should. Uses only `Animated`/`AccessibilityInfo` from
 * `react-native`, already a peer dependency — no new runtime dependency.
 */
export function MotionSpecimen(props: MotionSpecimenProps) {
  const { label, distance = DEFAULT_DISTANCE } = props;
  const valueRange: MotionValueRange = props.kind === 'spring' ? props.valueRange ?? 'distance' : 'distance';
  const target = motionValueTarget(valueRange, distance);
  const progress = useRef(new Animated.Value(0)).current;
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const play = useCallback(
    (instant: boolean) => {
      activeAnim.current?.stop();
      progress.setValue(0);
      if (instant) {
        progress.setValue(target);
        return;
      }
      const anim =
        props.kind === 'timing'
          ? Animated.timing(progress, { toValue: target, duration: props.duration, easing: props.easing, useNativeDriver: true })
          : Animated.spring(progress, { toValue: target, useNativeDriver: true, ...props.spring });
      activeAnim.current = anim;
      anim.start();
    },
    // `props` covers every field `play` reads (duration/easing/spring differ per kind); `target`
    // is derived from `props` (distance, kind, valueRange), not independent state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, props, target],
  );

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReduceMotion(enabled);
      play(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => setReduceMotion(enabled));
    return () => {
      mounted = false;
      subscription.remove();
      activeAnim.current?.stop();
    };
    // Plays exactly once on mount; `play` only needs to be re-created, never re-run, when props change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateX = motionTranslatesDirectly(valueRange)
    ? progress
    : progress.interpolate({ inputRange: [0, target], outputRange: [0, distance] });

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { width: distance + DOT_SIZE }]}>
        <Animated.View style={[styles.dot, { transform: [{ translateX }] }]} />
      </View>
      <View style={styles.footer}>
        {label ? <Text style={styles.label}>{label}</Text> : <View style={styles.labelSpacer} />}
        <Pressable
          onPress={() => play(reduceMotion)}
          accessibilityRole="button"
          accessibilityLabel="Replay"
          style={({ pressed }) => [styles.replayButton, pressed && styles.replayButtonPressed]}
        >
          <Text style={styles.replayText}>Replay</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: CATALOG_SPACE.sm, alignItems: 'flex-start' },
  track: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: CATALOG_COLOR.border,
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: CATALOG_COLOR.accent,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.md },
  label: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  labelSpacer: { flex: 1 },
  replayButton: {
    paddingHorizontal: CATALOG_SPACE.md,
    paddingVertical: CATALOG_SPACE.xs,
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  replayButtonPressed: { backgroundColor: CATALOG_COLOR.surfacePressed },
  replayText: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', color: CATALOG_COLOR.text },
});
