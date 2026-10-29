import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dampingFractionForBounce, isSwiftUISpring, swiftUISpringPhysics } from '../swiftUISpring.ts';

function close(actual: number, expected: number, digits = 2) {
  assert.ok(Math.abs(actual - expected) < 0.5 * 10 ** -digits, `expected ${actual} to be about ${expected}`);
}

test('response/dampingFraction converts to stiffness (2π/response)² and damping 4π·dampingFraction/response, mass 1', () => {
  const physics = swiftUISpringPhysics({ response: 0.5, dampingFraction: 1 });
  close(physics.stiffness, 157.91);
  close(physics.damping, 25.13);
  assert.equal(physics.mass, 1);
  const bouncy = swiftUISpringPhysics({ response: 0.4, dampingFraction: 0.7 });
  close(bouncy.stiffness, 246.74);
  close(bouncy.damping, 21.99);
});

test('duration/bounce uses response = duration, dampingFraction = 1 - bounce for bounce >= 0', () => {
  const physics = swiftUISpringPhysics({ duration: 0.5, bounce: 0.3 });
  close(physics.stiffness, 157.91);
  close(physics.damping, 17.59);
  assert.deepEqual(swiftUISpringPhysics({ duration: 0.5 }), swiftUISpringPhysics({ response: 0.5, dampingFraction: 1 }), 'bounce defaults to 0, critically damped');
  assert.equal(dampingFractionForBounce(0.25), 0.75);
});

test('a negative bounce is overdamped: dampingFraction = 1 / (1 + bounce)', () => {
  assert.equal(dampingFractionForBounce(-0.5), 2);
  close(swiftUISpringPhysics({ duration: 0.5, bounce: -0.5 }).damping, 50.27);
});

test('a value SwiftUI has no spring for is rejected instead of animated', () => {
  assert.throws(() => swiftUISpringPhysics({ response: 0, dampingFraction: 1 }), RangeError);
  assert.throws(() => swiftUISpringPhysics({ response: 0.5, dampingFraction: -0.1 }), RangeError);
  assert.throws(() => swiftUISpringPhysics({ duration: 0.5, bounce: -1 }), RangeError);
  assert.throws(() => swiftUISpringPhysics({ duration: 0.5, bounce: 1.5 }), RangeError);
});

test('only the two SwiftUI forms are recognised; the stiffness/damping/mass form is left alone', () => {
  assert.equal(isSwiftUISpring({ response: 0.5, dampingFraction: 1 }), true);
  assert.equal(isSwiftUISpring({ duration: 0.5 }), true);
  assert.equal(isSwiftUISpring({ stiffness: 200, damping: 20, mass: 1 }), false);
});
