import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { motionReplayLabel, motionTranslatesDirectly, motionValueTarget, type MotionValueRange } from './motionValueDomain';
import { isSwiftUISpring, swiftUISpringPhysics, type SwiftUISpring } from './swiftUISpring';

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
       *  `Animated.timing`'s own ease-in-out when omitted; pass `Easing.linear` for linear. */
      easing?: (value: number) => number;
      /** Track length in px the dot travels, start to end. @default 160 */
      distance?: number;
      label?: string;
    }
  | {
      kind: 'spring';
      /** Either `Animated.spring`'s own physics (stiffness/damping/mass), or a SwiftUI spring as the
       *  source writes it: `{ response, dampingFraction }` or `{ duration, bounce? }`. The SwiftUI
       *  forms are converted to physics with mass 1 (see `swiftUISpring.ts`); the curve matches
       *  SwiftUI's spring model, while the moment it counts as settled may differ slightly. */
      spring: MotionSpecimenSpringConfig | SwiftUISpring;
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
/** A spring play is cut off after this long and the dot placed at the end, so a spring that never
 *  settles (`dampingFraction: 0`, `bounce: 1`) can't keep animating for as long as the page is open.
 *  A timing play is bounded by its own `duration`; this is the spring's equivalent. */
export const MOTION_SPRING_MAX_MS = 5000;
/** How many back-and-forth swings the demo of a spring with no damping shows. */
export const UNDAMPED_SWINGS = 3;
/** Plain label shown under a spring with no damping. */
export const UNDAMPED_NOTE = `Never settles (damping 0). Shown for ${UNDAMPED_SWINGS} swings, then stopped.`;

/** `Animated.spring` refuses a damping of 0 (it throws), so a spring with none gets this bounded
 *  stand-in instead: `UNDAMPED_SWINGS` sine-eased swings, each one the spring's own period long. */
function undampedDemo(progress: Animated.Value, target: number, config: MotionSpecimenSpringConfig): Animated.CompositeAnimation {
  const stiffness = config.stiffness ?? 0;
  const periodMs = stiffness > 0 ? 2 * Math.PI * Math.sqrt((config.mass ?? 1) / stiffness) * 1000 : 1000;
  const half = (toValue: number) => Animated.timing(progress, { toValue, duration: periodMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
  return Animated.sequence(Array.from({ length: UNDAMPED_SWINGS }, () => [half(target), half(0)]).flat());
}

/** The physics `Animated.spring` gets: a SwiftUI spring converted to stiffness/damping/mass, with any
 *  other field (`overshootClamping`, the rest thresholds) kept as written. */
function springPhysics(spring: MotionSpecimenSpringConfig | SwiftUISpring): MotionSpecimenSpringConfig {
  if (!isSwiftUISpring(spring)) return spring;
  const { response, dampingFraction, duration, bounce, ...rest } = spring as SwiftUISpring & { response?: number; dampingFraction?: number; duration?: number; bounce?: number };
  return { ...rest, ...swiftUISpringPhysics(spring) };
}

/**
 * A reusable, bounded start-to-end motion demo for a duration/easing or spring token: a dot slides
 * once across a fixed track when the specimen mounts, and a "Replay" button plays it again on
 * demand. Respects the platform's reduce-motion preference — when enabled, every play (including
 * the initial one) jumps straight to the end state instead of animating, exactly as the real
 * product components built on these tokens should. A spring play is cut off after
 * `MOTION_SPRING_MAX_MS`. Uses only `Animated`/`AccessibilityInfo` from
 * `react-native`, already a peer dependency — no new runtime dependency.
 */
export function MotionSpecimen(props: MotionSpecimenProps) {
  const { label, distance = DEFAULT_DISTANCE } = props;
  const valueRange: MotionValueRange = props.kind === 'spring' ? props.valueRange ?? 'distance' : 'distance';
  const target = motionValueTarget(valueRange, distance);
  const progress = useRef(new Animated.Value(0)).current;
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);
  const springTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Converted while rendering, so an out-of-range SwiftUI spring throws here (reaching an error
  // boundary) whatever the reduce-motion setting, not later inside an effect or event handler.
  const springConfig = useMemo(
    () => (props.kind === 'spring' ? springPhysics(props.spring) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.kind, props.kind === 'spring' ? props.spring : undefined],
  );
  const undamped = springConfig?.damping === 0;
  const clearSpringTimer = () => {
    if (springTimer.current !== null) clearTimeout(springTimer.current);
    springTimer.current = null;
  };

  const play = useCallback(
    (instant: boolean) => {
      activeAnim.current?.stop();
      clearSpringTimer();
      progress.setValue(0);
      if (instant) {
        progress.setValue(target);
        return;
      }
      const anim =
        props.kind === 'timing'
          ? Animated.timing(progress, { toValue: target, duration: props.duration, easing: props.easing, useNativeDriver: true })
          : undamped
            ? undampedDemo(progress, target, springConfig!)
            : Animated.spring(progress, {
                toValue: target,
                useNativeDriver: true,
                ...springConfig,
              });
      activeAnim.current = anim;
      if (props.kind === 'spring') {
        springTimer.current = setTimeout(() => {
          springTimer.current = null;
          anim.stop();
          progress.setValue(target);
        }, MOTION_SPRING_MAX_MS);
      }
      anim.start(({ finished }) => {
        if (activeAnim.current !== anim) return;
        clearSpringTimer();
        // The swings end back at the start: place the dot at the end, like the 5 s cut-off does.
        if (undamped && finished) progress.setValue(target);
      });
    },
    // `props` covers every field `play` reads (duration/easing/spring differ per kind); `target`
    // is derived from `props` (distance, kind, valueRange), not independent state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, props, springConfig, target, undamped],
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
      clearSpringTimer();
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
          accessibilityLabel={motionReplayLabel({ kind: props.kind, duration: props.kind === 'timing' ? props.duration : undefined, label })}
          style={({ pressed }) => [styles.replayButton, pressed && styles.replayButtonPressed]}
        >
          <Text style={styles.replayText}>Replay</Text>
        </Pressable>
      </View>
      {undamped && <Text style={styles.label}>{UNDAMPED_NOTE}</Text>}
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
  label: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
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
  replayText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
});
