import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeTransition,
  IDENTITY_STATE, assertTransition, describeTransitionAnimation, lerpState, transitionOffState, transitionStateAt,
  DEFAULT_TRANSITION_SPRING, type SwiftUITransition,
} from '../transitionModel.ts';
import { motionReplayLabel } from '../motionValueDomain.ts';

const SIZE = { width: 200, height: 96 };
const off = (t: SwiftUITransition, phase: 'insertion' | 'removal' = 'insertion') => transitionOffState(t, phase, SIZE);

test('opacity is transparent when off and otherwise unchanged; identity changes nothing', () => {
  assert.deepEqual(off({ type: 'opacity' }), { opacity: 0, x: 0, y: 0, scale: 1 });
  assert.deepEqual(off({ type: 'identity' }), IDENTITY_STATE);
});

test('move(edge) offsets the view by its own size towards that edge, without fading', () => {
  assert.deepEqual(off({ type: 'move', edge: 'top' }), { opacity: 1, x: 0, y: -96, scale: 1 });
  assert.deepEqual(off({ type: 'move', edge: 'bottom' }), { opacity: 1, x: 0, y: 96, scale: 1 });
  assert.deepEqual(off({ type: 'move', edge: 'leading' }), { opacity: 1, x: -200, y: 0, scale: 1 });
  assert.deepEqual(off({ type: 'move', edge: 'trailing' }), { opacity: 1, x: 200, y: 0, scale: 1 });
});

test('slide inserts from leading and removes towards trailing', () => {
  assert.equal(off({ type: 'slide' }, 'insertion').x, -200);
  assert.equal(off({ type: 'slide' }, 'removal').x, 200);
});

test('push(from) moves in from that edge and fades in, and moves out towards the opposite one and fades out', () => {
  assert.deepEqual([off({ type: 'push', from: 'bottom' }, 'insertion').y, off({ type: 'push', from: 'bottom' }, 'removal').y], [96, -96]);
  assert.deepEqual([off({ type: 'push', from: 'leading' }, 'insertion').x, off({ type: 'push', from: 'leading' }, 'removal').x], [-200, 200]);
  for (const phase of ['insertion', 'removal'] as const) assert.equal(off({ type: 'push', from: 'top' }, phase).opacity, 0, `${phase} fades`);
});

test('scale defaults to 0 about the centre; a given scale and anchor keep the anchor point still', () => {
  assert.deepEqual(off({ type: 'scale' }), { opacity: 1, x: 0, y: 0, scale: 0 });
  assert.deepEqual(off({ type: 'scale', scale: 0.8 }), { opacity: 1, x: 0, y: 0, scale: 0.8 });
  // About the top-leading corner (-100, -48 from the centre), a 0.5 scale moves the centre by half of that.
  const corner = off({ type: 'scale', scale: 0.5, anchor: 'topLeading' });
  assert.deepEqual([corner.x, corner.y, corner.scale], [-50, -24, 0.5]);
  const top = off({ type: 'scale', scale: 0, anchor: 'top' });
  assert.deepEqual([top.x, top.y], [0, -48]);
  const trailing = off({ type: 'scale', scale: 0.5, anchor: 'trailing' });
  assert.deepEqual([trailing.x, trailing.y], [50, 0]);
});

test('offset moves by the given px (default 0) and does not fade', () => {
  assert.deepEqual(off({ type: 'offset', x: 12, y: -30 }), { opacity: 1, x: 12, y: -30, scale: 1 });
  assert.deepEqual(off({ type: 'offset', y: 24 }), { opacity: 1, x: 0, y: 24, scale: 1 });
  assert.deepEqual(off({ type: 'offset' }), IDENTITY_STATE);
});

test('combined applies every part at once: opacities and scales multiply, offsets add', () => {
  const t: SwiftUITransition = { type: 'combined', of: [{ type: 'opacity' }, { type: 'move', edge: 'bottom' }, { type: 'scale', scale: 0.5 }, { type: 'offset', x: 10 }] };
  assert.deepEqual(off(t), { opacity: 0, x: 10, y: 96, scale: 0.5 });
  assert.deepEqual(off({ type: 'combined', of: [{ type: 'scale', scale: 0.5 }, { type: 'scale', scale: 0.5 }] }).scale, 0.25);
});

test('asymmetric plays its own insertion and its own removal', () => {
  const t: SwiftUITransition = { type: 'asymmetric', insertion: { type: 'move', edge: 'bottom' }, removal: { type: 'opacity' } };
  assert.deepEqual(off(t, 'insertion'), { opacity: 1, x: 0, y: 96, scale: 1 });
  assert.deepEqual(off(t, 'removal'), { opacity: 0, x: 0, y: 0, scale: 1 });
  const nested: SwiftUITransition = { type: 'combined', of: [{ type: 'opacity' }, t] };
  assert.deepEqual(off(nested, 'insertion'), { opacity: 0, x: 0, y: 96, scale: 1 });
  assert.deepEqual(off(nested, 'removal'), { opacity: 0, x: 0, y: 0, scale: 1 });
});

test('the state at a moment of a play: off before the insertion, normal after it, off again after the removal', () => {
  const t: SwiftUITransition = { type: 'combined', of: [{ type: 'opacity' }, { type: 'move', edge: 'top' }] };
  assert.deepEqual(transitionStateAt(t, SIZE, 0, 0), { opacity: 0, x: 0, y: -96, scale: 1 });
  assert.deepEqual(transitionStateAt(t, SIZE, 0.5, 0), { opacity: 0.5, x: 0, y: -48, scale: 1 });
  assert.deepEqual(transitionStateAt(t, SIZE, 1, 0), IDENTITY_STATE);
  assert.deepEqual(transitionStateAt(t, SIZE, 1, 1), { opacity: 0, x: 0, y: -96, scale: 1 });
  // A spring's overshoot in the insertion goes past normal, away from the edge it came from.
  assert.ok(Math.abs(transitionStateAt(t, SIZE, 1.1, 0).y - 9.6) < 1e-9);
});

test('lerpState is a straight line between two states', () => {
  assert.deepEqual(lerpState(IDENTITY_STATE, { opacity: 0, x: 10, y: 20, scale: 0 }, 0.5), { opacity: 0.5, x: 5, y: 10, scale: 0.5 });
});

test('assertTransition accepts every built-in and rejects what SwiftUI has no built-in for', () => {
  const ok: SwiftUITransition[] = [
    { type: 'opacity' }, { type: 'identity' }, { type: 'slide' }, { type: 'move', edge: 'leading' }, { type: 'push', from: 'top' },
    { type: 'scale' }, { type: 'scale', scale: 0.9, anchor: 'bottomTrailing' }, { type: 'offset', x: 4 },
    { type: 'combined', of: [{ type: 'opacity' }] }, { type: 'asymmetric', insertion: { type: 'opacity' }, removal: { type: 'slide' } },
  ];
  for (const t of ok) assert.doesNotThrow(() => assertTransition(t), JSON.stringify(t));
  const bad: unknown[] = [
    { type: 'fade' }, { type: 'move', edge: 'left' }, { type: 'push' }, { type: 'scale', scale: -1 }, { type: 'scale', anchor: 'middle' },
    { type: 'offset', x: Number.NaN }, { type: 'combined', of: [] }, { type: 'combined', of: [{ type: 'bogus' }] },
    { type: 'asymmetric', insertion: { type: 'opacity' } },
  ];
  for (const t of bad) assert.throws(() => assertTransition(t as SwiftUITransition), RangeError, JSON.stringify(t));
});

test('the animation line names the default animation, a timing, or a spring', () => {
  assert.equal(describeTransitionAnimation(undefined), 'Assumed: withAnimation default (iOS 17+) · spring, response 0.55, no bounce');
  assert.equal(DEFAULT_TRANSITION_SPRING.response, 0.55);
  assert.equal(describeTransitionAnimation({ duration: 240 }), 'Timing · 240ms');
  assert.equal(describeTransitionAnimation({ spring: { response: 0.4, dampingFraction: 0.8 } }), 'Spring · response 0.4, damping 0.8');
  assert.equal(describeTransitionAnimation({ spring: { duration: 0.5, bounce: 0.3 } }), 'Spring · duration 0.5, bounce 0.3');
  assert.equal(describeTransitionAnimation({ spring: { stiffness: 200, damping: 20 } }), 'Spring · stiffness 200, damping 20');
});

test('a transition specimen\'s Replay button is named after its label, else "transition"', () => {
  assert.equal(motionReplayLabel({ kind: 'transition', label: 'move from bottom' }), 'Replay move from bottom');
  assert.equal(motionReplayLabel({ kind: 'transition' }), 'Replay transition');
  assert.equal(motionReplayLabel({ kind: 'transition', description: 'fade' }), 'Replay transition: fade');
});

test('describeTransition says a transition in plain words, for the Replay button\'s accessible name', () => {
  assert.equal(describeTransition({ type: 'combined', of: [{ type: 'move', edge: 'bottom' }, { type: 'opacity' }] }), 'move from bottom and fade');
  assert.equal(describeTransition({ type: 'combined', of: [{ type: 'scale', scale: 0.45 }, { type: 'opacity' }] }), 'scale from 0.45 and fade');
  assert.equal(
    describeTransition({ type: 'asymmetric', insertion: { type: 'opacity' }, removal: { type: 'combined', of: [{ type: 'opacity' }, { type: 'move', edge: 'top' }] } }),
    'insert: fade; remove: fade and move to top',
  );
  assert.equal(describeTransition({ type: 'push', from: 'leading' }), 'push from leading');
  assert.equal(describeTransition({ type: 'asymmetric', insertion: { type: 'identity' }, removal: { type: 'push', from: 'leading' } }), 'insert: no change; remove: push to trailing');
  assert.equal(describeTransition({ type: 'offset', y: 8 }), 'offset 0, 8');
});
