import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

type ReduceMotionSource = Pick<typeof AccessibilityInfo, 'isReduceMotionEnabled' | 'addEventListener'>;

/**
 * Reads the OS reduce-motion setting once, then follows `reduceMotionChanged` until the returned
 * cleanup runs. Split out from {@link useReduceMotion} so the subscription logic is testable without
 * a hook runner.
 */
export function subscribeReduceMotion(source: ReduceMotionSource, onChange: (enabled: boolean) => void): () => void {
  let active = true;
  source.isReduceMotionEnabled().then(
    (enabled) => {
      if (active) onChange(enabled);
    },
    () => {},
  );
  const subscription = source.addEventListener('reduceMotionChanged', (enabled) => {
    if (active) onChange(enabled);
  });
  return () => {
    active = false;
    subscription.remove();
  };
}

/**
 * True when the user has asked the OS to reduce motion. Starts `false` (the setting is only readable
 * asynchronously) and updates as soon as it resolves or changes — animated components should render
 * a static equivalent while this is true.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => subscribeReduceMotion(AccessibilityInfo, setReduceMotion), []);
  return reduceMotion;
}
