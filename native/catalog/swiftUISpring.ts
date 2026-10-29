/**
 * Pure conversion from SwiftUI's two spring parameterizations to the stiffness/damping/mass physics
 * `Animated.spring` takes, kept free of any `react-native` import so `node --test` can assert on it
 * directly (see `native/catalog/__tests__/swiftUISpring.test.ts`).
 *
 * Both forms describe the same damped spring with mass 1: `response` is the undamped period in
 * seconds, so `stiffness = (2π / response)²`, and `dampingFraction` scales the critical damping
 * `2·√stiffness = 4π / response`. `Spring(duration:bounce:)` maps onto it with `response = duration`
 * and a `dampingFraction` taken from `bounce`. The curve matches SwiftUI's spring model; the moment
 * `Animated.spring` decides it has settled can differ slightly from SwiftUI's.
 */

/** SwiftUI `.spring(response:dampingFraction:)`. */
export interface SwiftUIResponseSpring {
  /** Seconds one undamped oscillation takes. Must be greater than 0. */
  response: number;
  /** 1 is critically damped, below 1 overshoots, 0 never settles. Must be 0 or more. */
  dampingFraction: number;
}

/** SwiftUI `Spring(duration:bounce:)`, as in `.spring(duration:bounce:)`. */
export interface SwiftUIDurationSpring {
  /** Seconds one undamped oscillation takes. Must be greater than 0. */
  duration: number;
  /** -1 (exclusive) to 1: 0 is critically damped, positive overshoots, negative is overdamped. @default 0 */
  bounce?: number;
}

export type SwiftUISpring = SwiftUIResponseSpring | SwiftUIDurationSpring;

export interface SpringPhysics {
  stiffness: number;
  damping: number;
  mass: 1;
}

export function isSwiftUISpring(spring: object): spring is SwiftUISpring {
  return 'response' in spring || 'duration' in spring;
}

/** `Spring(duration:bounce:)` expressed as `response`/`dampingFraction`. */
export function dampingFractionForBounce(bounce: number): number {
  return bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
}

/** The `Animated.spring` physics (mass 1) for a SwiftUI spring. Throws a `RangeError` for a value
 *  SwiftUI itself has no spring for, rather than animating something that isn't what was authored. */
export function swiftUISpringPhysics(spring: SwiftUISpring): SpringPhysics {
  let response: number;
  let dampingFraction: number;
  if ('response' in spring) {
    response = spring.response;
    dampingFraction = spring.dampingFraction;
  } else {
    const bounce = spring.bounce ?? 0;
    if (!(bounce > -1 && bounce <= 1)) throw new RangeError(`SwiftUI spring bounce must be greater than -1 and at most 1, got ${bounce}.`);
    response = spring.duration;
    dampingFraction = dampingFractionForBounce(bounce);
  }
  if (!(Number.isFinite(response) && response > 0)) throw new RangeError(`SwiftUI spring response/duration must be greater than 0, got ${response}.`);
  if (!(Number.isFinite(dampingFraction) && dampingFraction >= 0)) throw new RangeError(`SwiftUI spring dampingFraction must be 0 or more, got ${dampingFraction}.`);
  const omega = (2 * Math.PI) / response;
  return { stiffness: omega * omega, damping: 2 * omega * dampingFraction, mass: 1 };
}
