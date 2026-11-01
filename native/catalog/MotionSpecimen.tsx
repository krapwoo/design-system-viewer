import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { motionReplayLabel, motionTranslatesDirectly, motionValueTarget, type MotionValueRange } from './motionValueDomain';
import { isSwiftUISpring, swiftUISpringPhysics, type SwiftUISpring } from './swiftUISpring';
import {
  describeTransition,
  DEFAULT_TRANSITION_SPRING, assertTransition, describeTransitionAnimation, transitionOffState,
  type SwiftUITransition, type TransitionState,
} from './transitionModel';

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

/** How a transition specimen animates: a duration with an optional easing, as `kind: 'timing'` takes
 *  them, or a spring as `kind: 'spring'` takes it. The spring's rest thresholds are for the 0-to-1
 *  value the transition animates (a `valueRange` of `'unit'`). */
export type MotionSpecimenTransitionAnimation =
  | { duration: number; easing?: (value: number) => number }
  | { spring: MotionSpecimenSpringConfig | SwiftUISpring };

export type MotionSpecimenProps =
  | {
      kind: 'transition';
      /** A SwiftUI built-in `.transition(...)`, written declaratively (see `SwiftUITransition`):
       *  `{ type: 'move', edge: 'bottom' }`, `{ type: 'combined', of: [...] }`, … */
      transition: SwiftUITransition;
      /** The animation of the change that inserts or removes the view. Omitted, the specimen models
       *  `withAnimation` with no argument on iOS 17+: a spring of response 0.55 with no bounce (an
       *  assumption, not a published constant; see `DEFAULT_TRANSITION_SPRING`). With no animation at
       *  all SwiftUI shows no transition, and before iOS 17 the default was ease-in-out over 0.35 s. */
      animation?: MotionSpecimenTransitionAnimation;
      label?: string;
    }
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

/** The longest period of one undamped swing: `UNDAMPED_SWINGS` of them, with a margin, finish before
 *  the `MOTION_SPRING_MAX_MS` cut-off, so the note's "3 swings" is always what was shown. */
const UNDAMPED_MAX_PERIOD_MS = Math.floor((MOTION_SPRING_MAX_MS * 0.9) / UNDAMPED_SWINGS);
/** `Animated.spring`'s own default stiffness, used when the config names none. */
const ANIMATED_DEFAULT_STIFFNESS = 100;

/** The period of one undamped swing: the spring's own (`2π·√(mass / stiffness)`, with `Animated`'s
 *  default stiffness when none is given), capped at `UNDAMPED_MAX_PERIOD_MS`. */
export function undampedPeriodMs(config: MotionSpecimenSpringConfig): number {
  const stiffness = config.stiffness ?? ANIMATED_DEFAULT_STIFFNESS;
  const periodMs = stiffness > 0 ? 2 * Math.PI * Math.sqrt((config.mass ?? 1) / stiffness) * 1000 : 1000;
  return Math.min(periodMs, UNDAMPED_MAX_PERIOD_MS);
}

/** `Animated.spring` refuses a damping of 0 (it throws), so a spring with none gets this bounded
 *  stand-in instead: `UNDAMPED_SWINGS` sine-eased swings, each one the spring's own period long
 *  (capped, see `undampedPeriodMs`). */
function undampedDemo(progress: Animated.Value, target: number, config: MotionSpecimenSpringConfig): Animated.CompositeAnimation {
  const periodMs = undampedPeriodMs(config);
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
  return props.kind === 'transition' ? <TransitionSpecimen {...props} /> : <DotSpecimen {...props} />;
}

function DotSpecimen(props: Exclude<MotionSpecimenProps, { kind: 'transition' }>) {
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

/** How long the stage stays empty between the removal and the insertion. */
export const TRANSITION_HOLD_MS = 500;
/** Plain note shown when Reduce Motion is on: there is no animation, only the inserted view. */
export const TRANSITION_REDUCE_MOTION_NOTE = 'Reduce Motion is on, so the transition is not animated. Showing the view as inserted.';
/** The sample view, which also fills the clipped stage: a view moves away by its own size, so one
 *  the size of its stage leaves it completely. */
const STAGE_WIDTH = 200;
const STAGE_HEIGHT = 96;

/** The animation `Animated` runs to take one 0-to-1 value from 0 to 1. A spring gets
 *  `MOTION_SPRING_MAX_MS` to settle before it is cut off and placed at 1; a spring with no damping gets
 *  the bounded swing demo. Returns a function that cancels it. */
function runUnitAnimation(value: Animated.Value, animation: MotionSpecimenTransitionAnimation | undefined, onEnd: () => void): () => void {
  const plan = animation ?? { spring: DEFAULT_TRANSITION_SPRING };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let anim: Animated.CompositeAnimation;
  let cancelled = false;
  // Set before the cut-off stops the animation: `stop()` calls the `start` callback at once, and that
  // callback must not end the run a second time.
  let cutOff = false;
  const undamped = 'spring' in plan && springPhysics(plan.spring).damping === 0;
  if ('spring' in plan) {
    const config = springPhysics(plan.spring);
    anim = undamped ? undampedDemo(value, 1, config) : Animated.spring(value, { toValue: 1, useNativeDriver: true, ...config });
    timer = setTimeout(() => {
      timer = null;
      if (cancelled) return;
      cutOff = true;
      anim.stop();
      value.setValue(1);
      onEnd();
    }, MOTION_SPRING_MAX_MS);
  } else {
    anim = Animated.timing(value, { toValue: 1, duration: plan.duration, easing: plan.easing, useNativeDriver: true });
  }
  anim.start(({ finished }) => {
    if (cancelled || cutOff) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    // The swings end back at the start: place the value at the end, like the cut-off does.
    if (undamped && finished) value.setValue(1);
    onEnd();
  });
  return () => {
    cancelled = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    anim.stop();
  };
}

/** The Animated style for a sample view whose insertion and removal progress are `inserted` and
 *  `removed` (each 0 to 1): the off state of each phase, mixed straight to the normal look. The two
 *  compose — opacity and scale multiply, offsets add — so a spring's overshoot in a phase goes past
 *  that phase's end state, in its own direction. `present` (1 or 0) is whether the view exists at all:
 *  once a removal ends SwiftUI drops the view, so it is 0 through the hold even for a transition whose
 *  removal does not hide it (`identity`, `offset`, a partial `scale`). */
function transitionStyle(transition: SwiftUITransition, inserted: Animated.Value, removed: Animated.Value, present: Animated.Value) {
  const size = { width: STAGE_WIDTH, height: STAGE_HEIGHT };
  const entering: TransitionState = transitionOffState(transition, 'insertion', size);
  const leaving: TransitionState = transitionOffState(transition, 'removal', size);
  const map = (value: Animated.Value, from: number, to: number, clamp = false) =>
    value.interpolate({ inputRange: [0, 1], outputRange: [from, to], ...(clamp && { extrapolate: 'clamp' as const }) });
  return {
    opacity: Animated.multiply(Animated.multiply(map(inserted, entering.opacity, 1, true), map(removed, 1, leaving.opacity, true)), present),
    transform: [
      { translateX: Animated.add(map(inserted, entering.x, 0), map(removed, 0, leaving.x)) },
      { translateY: Animated.add(map(inserted, entering.y, 0), map(removed, 0, leaving.y)) },
      { scale: Animated.multiply(map(inserted, entering.scale, 1), map(removed, 1, leaving.scale)) },
    ],
  };
}

/**
 * `MotionSpecimen`'s transition kind: a sample view inside a clipped stage, drawn inserted and at rest,
 * with the transition and animation the source names. Nothing animates on mount. Replay removes the
 * view, holds the empty stage for `TRANSITION_HOLD_MS`, then inserts it again, ending inserted; pressing
 * it mid-play restarts from the removal. Nothing loops. With Reduce Motion on the view stays inserted,
 * with a note, and Replay does not animate.
 */
function TransitionSpecimen({ transition, animation, label }: Extract<MotionSpecimenProps, { kind: 'transition' }>) {
  // Rest state: insertion complete, removal not started.
  const inserted = useRef(new Animated.Value(1)).current;
  const removed = useRef(new Animated.Value(0)).current;
  // Whether the view exists: 0 only while the stage is held empty between removal and insertion.
  const present = useRef(new Animated.Value(1)).current;
  const cancel = useRef<(() => void) | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Checked while rendering, so a transition SwiftUI has no built-in for (or an out-of-range spring)
  // throws here whatever the reduce-motion setting, not later inside an effect or event handler.
  // Keyed on the serialized props, not their identity: inline object props are new on every parent
  // render, and the style's interpolation nodes should not be rebuilt while an animation runs.
  const transitionKey = JSON.stringify(transition);
  const springKey = animation && 'spring' in animation ? JSON.stringify(animation.spring) : '';
  const style = useMemo(() => {
    assertTransition(transition);
    if (animation && 'spring' in animation) springPhysics(animation.spring);
    return transitionStyle(transition, inserted, removed, present);
    // `transitionKey` and `springKey` stand for `transition` and `animation`'s spring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionKey, springKey, inserted, removed, present]);

  const stopAll = () => {
    cancel.current?.();
    cancel.current = null;
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const rest = () => {
    inserted.setValue(1);
    removed.setValue(0);
    present.setValue(1);
  };

  const play = useCallback(
    (instant: boolean) => {
      stopAll();
      rest();
      if (instant) return;
      cancel.current = runUnitAnimation(removed, animation, () => {
        // The removal is over, so the view is gone: hold the empty stage, then bring the view back from
        // its insertion's off look.
        present.setValue(0);
        holdTimer.current = setTimeout(() => {
          holdTimer.current = null;
          inserted.setValue(0);
          removed.setValue(0);
          present.setValue(1);
          cancel.current = runUnitAnimation(inserted, animation, () => {
            cancel.current = null;
          });
        }, TRANSITION_HOLD_MS);
      });
    },
    // `animation` is the only prop `play` reads; the Animated values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inserted, removed, present, animation],
  );

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      setReduceMotion(enabled);
      // Turned on mid-play: end on the inserted view the note describes, not wherever the animation was.
      if (enabled) play(true);
    });
    return () => {
      mounted = false;
      subscription.remove();
      stopAll();
    };
    // Subscribes once on mount; nothing plays until Replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undamped = animation !== undefined && 'spring' in animation && springPhysics(animation.spring).damping === 0;
  return (
    <View style={[styles.wrap, styles.transitionWrap]}>
      <View style={styles.transitionStage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...({ 'aria-hidden': true } as Record<string, unknown>)}>
        <Animated.View style={[styles.transitionSample, style]}>
          <Text style={styles.transitionSampleText}>Sample view</Text>
        </Animated.View>
      </View>
      <Text style={styles.label}>{describeTransitionAnimation(animation)}</Text>
      <View style={[styles.footer, styles.transitionFooter]}>
        {label ? <Text style={[styles.label, styles.transitionLabel]}>{label}</Text> : <View style={styles.labelSpacer} />}
        <Pressable
          onPress={() => play(reduceMotion)}
          accessibilityRole="button"
          accessibilityLabel={motionReplayLabel({ kind: 'transition', label, description: describeTransition(transition) })}
          style={({ pressed }) => [styles.replayButton, pressed && styles.replayButtonPressed]}
        >
          <Text style={styles.replayText}>Replay</Text>
        </Pressable>
      </View>
      {reduceMotion && <Text style={styles.label}>{TRANSITION_REDUCE_MOTION_NOTE}</Text>}
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
  // The stage clips the sample, so a view that moves out of its own frame is cut off there.
  transitionStage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
    borderRadius: CATALOG_RADIUS.md,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.border,
    backgroundColor: CATALOG_COLOR.specimenStage,
  },
  transitionSample: {
    width: STAGE_WIDTH - 2,
    height: STAGE_HEIGHT - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATALOG_RADIUS.md,
    backgroundColor: CATALOG_COLOR.accentSubtle,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.accent,
  },
  // A long label or note wraps inside the cell instead of widening the specimen past it.
  transitionWrap: { maxWidth: '100%' },
  transitionFooter: { flexWrap: 'wrap', maxWidth: '100%' },
  transitionLabel: { flexShrink: 1 },
  transitionSampleText: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.accent },
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
