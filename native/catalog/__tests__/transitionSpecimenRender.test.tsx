// `MotionSpecimen`'s transition kind, mounted through react-native-web. The view rests inserted with
// no animation; Replay plays the removal, holds the empty stage, then plays the insertion.
// `Animated.timing` and `Animated.spring` are replaced by fakes that finish quickly and record the
// sample view's real style before and after, so each phase's start and end are read off the DOM, not computed. Reduce Motion is
// reported off here (react-native-web decides it once, at its first import; the on case is
// `transitionSpecimenReduceMotionRender.test.tsx`). jsdom has no `requestAnimationFrame`, so a no-op
// stands in; nothing steps unless a fake does it.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
// The Reduce Motion `change` listeners react-native-web registers, so a test can turn it on mid-play.
const mediaListeners: Array<(event: { matches: boolean }) => void> = [];
(warmup.window as unknown as { matchMedia: (query: string) => unknown }).matchMedia = (query: string) => ({
  matches: false, media: query,
  addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => { mediaListeners.push(listener); },
  removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => { const at = mediaListeners.indexOf(listener); if (at >= 0) mediaListeners.splice(at, 1); },
  addListener: () => {}, removeListener: () => {},
});
// react-native-web flushes an animated style to the DOM on an animation frame; the fakes below never
// ask for one, so this only has to let that flush run.
(globalThis as Record<string, unknown>).requestAnimationFrame = (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 0) as unknown as number;
(globalThis as Record<string, unknown>).cancelAnimationFrame = (id: number) => clearTimeout(id);

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { MotionSpecimen, TRANSITION_HOLD_MS, MOTION_SPRING_MAX_MS } = await import('../MotionSpecimen.tsx');
const { Animated, Easing } = await import('react-native');

/** How long a fake animation takes: long enough for react-native-web to write the new style. */
const FLUSH_MS = 30;
/** How long a fake animation waits before it moves, so the DOM shows the look it starts from. */
const START_MS = 15;
/** The whole replay: both animations, the hold between them, and a margin. */
const WHOLE_PLAY_MS = TRANSITION_HOLD_MS + 2 * (START_MS + FLUSH_MS) + 200;

/** Lets `ms` pass in short `act` slices: React holds a render back until its `act` scope exits, so one
 *  long scope would show nothing of the animated style until the whole play was over. */
async function pass(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
}

interface Look { opacity: number; x: number; y: number; scale: number }
interface Call { fn: 'timing' | 'spring'; config: Record<string, unknown>; before: Look; after: Look }

/** The sample view's look as the DOM has it: `opacity: 0; transform: translateX(0px) translateY(96px) scale(1);`. */
function lookOf(sample: HTMLElement): Look {
  const style = sample.getAttribute('style') ?? '';
  const num = (re: RegExp) => Number(re.exec(style)?.[1]);
  return {
    opacity: num(/opacity:\s*([-\d.e]+)/),
    x: num(/translateX\(([-\d.e]+)px\)/),
    y: num(/translateY\(([-\d.e]+)px\)/),
    scale: num(/scale\(([-\d.e]+)\)/),
  };
}

async function replay(container: HTMLElement, name = 'Fixture') {
  const button = container.querySelector(`[aria-label="Replay ${name}"]`) as HTMLElement;
  assert.ok(button, 'expected the Replay button');
  await act(async () => { button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

type TransitionProps = Extract<React.ComponentProps<typeof MotionSpecimen>, { kind: 'transition' }>;

/** Mounts a transition specimen with quickly finishing fakes, checks it rests inserted without having
 *  animated, presses Replay, waits for the removal, the hold and the insertion, and returns every
 *  animation it ran with the sample's look around it. */
async function play(props: Omit<TransitionProps, 'kind'>, afterMount?: (api: { container: HTMLElement; calls: Call[]; sample: () => HTMLElement }) => Promise<void>) {
  const calls: Call[] = [];
  let sampleEl: HTMLElement | undefined;
  const sample = () => sampleEl!;
  const originals = { timing: Animated.timing, spring: Animated.spring };
  for (const fn of ['timing', 'spring'] as const) {
    (Animated as Record<string, unknown>)[fn] = (value: { setValue(n: number): void }, config: { toValue: number } & Record<string, unknown>) => ({
      start: (callback?: (result: { finished: boolean }) => void) => {
        const call: Call = { fn, config, before: lookOf(sample()), after: lookOf(sample()) };
        calls.push(call);
        // Moves a moment later, once the look it starts from has reached the DOM, so `before` is
        // what a reader would see as this animation begins; then finishes once the new style has
        // reached the DOM, so `after` is what they would see at its end.
        setTimeout(() => {
          call.before = lookOf(sample());
          value.setValue(config.toValue);
          setTimeout(() => {
            call.after = lookOf(sample());
            callback?.({ finished: true });
          }, FLUSH_MS);
        }, START_MS);
      },
      stop: () => {},
      reset: () => {},
    });
  }
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" label="Fixture" {...props} />);
  sampleEl = container.querySelector('[aria-hidden="true"] > div') as HTMLElement;
  try {
    await pass(WHOLE_PLAY_MS);
    assert.equal(calls.length, 0, 'nothing animates on mount');
    assert.deepEqual(lookOf(sample()), NORMAL, 'the view rests inserted');
    await replay(container);
    await pass(WHOLE_PLAY_MS);
    await afterMount?.({ container, calls, sample });
    return { container, calls, sample };
  } finally {
    cleanup();
    Object.assign(Animated, originals);
  }
}

const NORMAL: Look = { opacity: 1, x: 0, y: 0, scale: 1 };
const L = (partial: Partial<Look>): Look => ({ ...NORMAL, ...partial });

/** What each built-in does on a 200 × 96 sample: where the insertion starts and the removal ends. */
const CASES: [string, TransitionProps['transition'], Look, Look][] = [
  ['opacity', { type: 'opacity' }, L({ opacity: 0 }), L({ opacity: 0 })],
  ['identity', { type: 'identity' }, NORMAL, NORMAL],
  ['move top', { type: 'move', edge: 'top' }, L({ y: -96 }), L({ y: -96 })],
  ['move bottom', { type: 'move', edge: 'bottom' }, L({ y: 96 }), L({ y: 96 })],
  ['move leading', { type: 'move', edge: 'leading' }, L({ x: -200 }), L({ x: -200 })],
  ['move trailing', { type: 'move', edge: 'trailing' }, L({ x: 200 }), L({ x: 200 })],
  ['slide', { type: 'slide' }, L({ x: -200 }), L({ x: 200 })],
  ['push from bottom', { type: 'push', from: 'bottom' }, L({ y: 96, opacity: 0 }), L({ y: -96, opacity: 0 })],
  ['scale', { type: 'scale' }, L({ scale: 0 }), L({ scale: 0 })],
  ['scale 0.5 from the top leading corner', { type: 'scale', scale: 0.5, anchor: 'topLeading' }, L({ scale: 0.5, x: -50, y: -24 }), L({ scale: 0.5, x: -50, y: -24 })],
  ['offset', { type: 'offset', x: 12, y: -30 }, L({ x: 12, y: -30 }), L({ x: 12, y: -30 })],
];

for (const [name, transition, start, end] of CASES) {
  test(`${name}: Replay removes the view to its off look, then inserts it back to normal and rests there`, async () => {
    const { calls, sample } = await play({ transition });
    assert.equal(calls.length, 2, 'one removal and one insertion');
    assert.deepEqual(calls[0].before, NORMAL, 'removal starts normal');
    assert.deepEqual(calls[0].after, end, 'removal ends off screen');
    assert.deepEqual(calls[1].before, start, 'insertion starts off screen');
    assert.deepEqual(calls[1].after, NORMAL, 'insertion ends normal');
    assert.deepEqual(lookOf(sample()), NORMAL, 'and that is where it stays');
  });
}

for (const [name, transition] of [['identity', { type: 'identity' }], ['offset', { type: 'offset', y: 24 }], ['scale 0.8', { type: 'scale', scale: 0.8 }]] as const) {
  test(`${name}: once the removal ends the view is gone through the hold, even though its removal does not hide it`, async () => {
    const originals = { timing: Animated.timing, spring: Animated.spring };
    // Each animation lands at once: the removal is over immediately, so what follows is the hold.
    (Animated as Record<string, unknown>).spring = (value: { setValue(n: number): void }, config: { toValue: number }) => ({
      start: (callback?: (result: { finished: boolean }) => void) => { value.setValue(config.toValue); callback?.({ finished: true }); },
      stop: () => {}, reset: () => {},
    });
    const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={transition} label="Fixture" />);
    const sample = container.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    try {
      await replay(container);
      await pass(TRANSITION_HOLD_MS / 2);
      assert.equal(lookOf(sample).opacity, 0, 'the stage is empty during the hold');
      await pass(WHOLE_PLAY_MS);
      assert.deepEqual(lookOf(sample), NORMAL, 'and the view is back, normal, after the insertion');
    } finally {
      cleanup();
      Object.assign(Animated, originals);
    }
  });
}

test('without a label, Replay is named after the transition in words', async () => {
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'combined', of: [{ type: 'move', edge: 'bottom' }, { type: 'opacity' }] }} />);
  try {
    assert.ok(container.querySelector('[aria-label="Replay transition: move from bottom and fade"]'), 'the Replay button names the transition');
  } finally {
    cleanup();
  }
});

test('combined runs every part at once', async () => {
  const { calls } = await play({ transition: { type: 'combined', of: [{ type: 'opacity' }, { type: 'move', edge: 'bottom' }, { type: 'scale', scale: 0.5 }] } });
  assert.equal(calls.length, 2, 'one animation per phase, not one per part');
  assert.deepEqual(calls[0].after, L({ opacity: 0, y: 96, scale: 0.5 }));
  assert.deepEqual(calls[1].before, L({ opacity: 0, y: 96, scale: 0.5 }));
});

test('asymmetric plays its own insertion and its own removal', async () => {
  const { calls } = await play({ transition: { type: 'asymmetric', insertion: { type: 'move', edge: 'bottom' }, removal: { type: 'opacity' } } });
  assert.deepEqual(calls[0].after, L({ opacity: 0 }), 'removes by fading, without moving');
  assert.deepEqual(calls[1].before, L({ y: 96 }), 'inserts by moving up from the bottom, still opaque');
});

test('the stage is held empty for a moment between the removal and the insertion', async () => {
  const startedAt: number[] = [];
  const originals = { timing: Animated.timing, spring: Animated.spring };
  (Animated as Record<string, unknown>).spring = (value: { setValue(n: number): void }, config: { toValue: number }) => ({
    start: (callback?: (result: { finished: boolean }) => void) => { startedAt.push(Date.now()); value.setValue(config.toValue); callback?.({ finished: true }); },
    stop: () => {}, reset: () => {},
  });
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'opacity' }} label="Fixture" />);
  try {
    await pass(WHOLE_PLAY_MS);
    assert.equal(startedAt.length, 0, 'nothing starts on mount');
    await replay(container);
    await pass(WHOLE_PLAY_MS);
    assert.equal(startedAt.length, 2);
    assert.ok(startedAt[1] - startedAt[0] >= TRANSITION_HOLD_MS - 20, `held ${startedAt[1] - startedAt[0]} ms`);
  } finally {
    cleanup();
    Object.assign(Animated, originals);
  }
});

test('with no animation named it models withAnimation\'s default (iOS 17+): a spring of response 0.55 and no bounce, for both phases', async () => {
  let text = '';
  const { calls } = await play({ transition: { type: 'opacity' } }, async ({ container }) => { text = container.textContent || ''; });
  assert.deepEqual(calls.map((c) => c.fn), ['spring', 'spring']);
  for (const call of calls) {
    const omega = (2 * Math.PI) / 0.55;
    assert.ok(Math.abs((call.config.stiffness as number) - omega * omega) < 1e-6, `stiffness ${String(call.config.stiffness)}`);
    assert.ok(Math.abs((call.config.damping as number) - 2 * omega) < 1e-6, `damping ${String(call.config.damping)}`);
    assert.equal(call.config.mass, 1);
    assert.equal(call.config.toValue, 1);
  }
  assert.ok(text.includes('Assumed: withAnimation default (iOS 17+) · spring, response 0.55, no bounce'), text);
});

test('a timing animation runs for its duration with its easing, for both phases', async () => {
  const easing = Easing.linear;
  let text = '';
  const { calls } = await play({ transition: { type: 'opacity' }, animation: { duration: 240, easing } }, async ({ container }) => { text = container.textContent || ''; });
  assert.deepEqual(calls.map((c) => [c.fn, c.config.duration, c.config.easing === easing]), [['timing', 240, true], ['timing', 240, true]]);
  assert.ok(text.includes('Timing · 240ms'), text);
});

test('a SwiftUI spring animation reaches Animated.spring converted, for both phases', async () => {
  const { calls } = await play({ transition: { type: 'opacity' }, animation: { spring: { response: 0.5, dampingFraction: 0.7 } } });
  assert.deepEqual(calls.map((c) => c.fn), ['spring', 'spring']);
  assert.ok(Math.abs((calls[0].config.stiffness as number) - 157.91) < 0.01);
  assert.ok(Math.abs((calls[0].config.damping as number) - 17.59) < 0.01 * 100, `damping ${String(calls[0].config.damping)}`);
});

test('nothing loops: one removal and one insertion per Replay, no Animated.loop, and nothing more once they have run', async () => {
  let loops = 0;
  const originalLoop = Animated.loop;
  (Animated as Record<string, unknown>).loop = (...args: unknown[]) => { loops += 1; return (originalLoop as (...a: unknown[]) => unknown)(...args); };
  try {
    const { calls } = await play({ transition: { type: 'slide' } }, async ({ calls: seen }) => {
      const settled = seen.length;
      await pass(WHOLE_PLAY_MS);
      assert.equal(seen.length, settled, 'no further animation after the insertion');
    });
    assert.equal(calls.length, 2);
  } finally {
    (Animated as Record<string, unknown>).loop = originalLoop;
  }
  assert.equal(loops, 0, 'Animated.loop is never called');
  const source = readFileSync(fileURLToPath(new URL('../MotionSpecimen.tsx', import.meta.url)), 'utf8');
  assert.equal(/Animated\.loop|Animated\.sequence\(\[[^\]]*\]\)\.start\(\s*\)/.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').split('function TransitionSpecimen')[1] ?? ''), false, 'the transition specimen never loops');
});

test('Replay plays the removal and then the insertion again, from the inserted look', async () => {
  await play({ transition: { type: 'move', edge: 'top' } }, async ({ container, calls, sample }) => {
    assert.equal(calls.length, 2);
    await replay(container);
    assert.equal(calls.length, 3, 'the removal runs at once');
    await pass(START_MS + FLUSH_MS + 20);
    assert.deepEqual(calls[2].before, NORMAL, 'it starts from the inserted look again');
    assert.deepEqual(calls[2].after, L({ y: -96 }));
    assert.deepEqual(lookOf(sample()), L({ y: -96, opacity: 0 }), 'and the stage is empty while it is held: the view is gone');
    await pass(WHOLE_PLAY_MS);
    assert.equal(calls.length, 4, 'then the insertion');
    assert.deepEqual(lookOf(sample()), NORMAL);
  });
});

test('there is no phase line: the stage is followed by the animation line, the label and Replay only', async () => {
  await play({ transition: { type: 'opacity' } }, async ({ container }) => {
    const text = container.textContent || '';
    assert.doesNotMatch(text, /Inserting|Inserted|Removing|Removed/);
    assert.ok(text.includes('Assumed: withAnimation default'));
    assert.ok(text.includes('Fixture') && text.includes('Replay'));
  });
});

test('the stage is clipped, hidden from assistive technology, and Replay is named after the specimen', async () => {
  await play({ transition: { type: 'opacity' } }, async ({ container }) => {
    const stage = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    assert.ok(stage);
    // react-native-web writes one atomic rule per style into the first document it saw: the stage
    // has the one that clips (`overflow: hidden`, written as overflow-x and overflow-y), which is what cuts off a view moved out of its frame.
    const rules = [...warmup.window.document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText));
    const clips = [...stage.classList].some((name) => rules.some((rule) => rule.startsWith(`.${name}`) && /overflow-x:\s*hidden;\s*overflow-y:\s*hidden/.test(rule)));
    assert.ok(clips, 'the stage clips its sample');
    assert.ok(container.querySelector('[aria-label="Replay Fixture"]'));
  });
});

test('a transition SwiftUI has no built-in for throws while rendering', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.throws(() => renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'move', edge: 'left' } as never} />), RangeError);
    assert.throws(() => renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'opacity' }} animation={{ spring: { response: -1, dampingFraction: 1 } }} />), RangeError);
  } finally {
    console.error = originalError;
  }
});

/** Replaces `Animated.spring` with a spring that never finishes. Like React Native's, its `stop()`
 *  calls the `start` callback at once with `finished: false`. */
function neverFinishingSprings({ jumpToEnd = false } = {}) {
  const log = { started: 0, stopped: 0 };
  const original = Animated.spring;
  (Animated as Record<string, unknown>).spring = (value: { setValue(n: number): void }, config: { toValue: number }) => {
    let callback: ((result: { finished: boolean }) => void) | undefined;
    let ended = false;
    return {
      start: (cb?: (result: { finished: boolean }) => void) => { log.started += 1; callback = cb; if (jumpToEnd) value.setValue(config.toValue); },
      stop: () => { log.stopped += 1; if (!ended) { ended = true; callback?.({ finished: false }); } },
      reset: () => {},
    };
  };
  return { log, restore: () => { (Animated as Record<string, unknown>).spring = original; } };
}

test('a spring that never settles is cut off once per run: one removal, one insertion, no leaked timers', async () => {
  const fake = neverFinishingSprings();
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'opacity' }} animation={{ spring: { response: 0.5, dampingFraction: 0.001 } }} label="Forever" />);
  try {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const replay = container.querySelector('[aria-label="Replay Forever"]') as HTMLElement;
    const sample = container.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const base = fake.log.started;
      act(() => { replay.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
      act(() => { mock.timers.tick(MOTION_SPRING_MAX_MS); });
      assert.equal(fake.log.started - base, 1, 'the cut-off ends the removal; the insertion waits for the hold');
      act(() => { mock.timers.tick(TRANSITION_HOLD_MS); });
      assert.equal(fake.log.started - base, 2, 'the insertion starts once after the hold, not twice');
      act(() => { mock.timers.tick(MOTION_SPRING_MAX_MS); });
      act(() => { mock.timers.tick(4 * MOTION_SPRING_MAX_MS); });
      assert.equal(fake.log.started - base, 2, 'nothing more runs: no stale timer ends or restarts anything');
    } finally { mock.timers.reset(); }
    await pass(FLUSH_MS + 20);
    assert.deepEqual(lookOf(sample), NORMAL, 'and it rests inserted');
  } finally {
    cleanup();
    fake.restore();
  }
});

test('Replay and unmount cancel everything a cut-off run left pending', async () => {
  const fake = neverFinishingSprings();
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'opacity' }} animation={{ spring: { response: 0.5, dampingFraction: 0.001 } }} label="Forever" />);
  let unmounted = false;
  try {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const replay = container.querySelector('[aria-label="Replay Forever"]') as HTMLElement;
    const click = () => act(() => { replay.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      click();
      act(() => { mock.timers.tick(MOTION_SPRING_MAX_MS + TRANSITION_HOLD_MS + 100); });
      let base = fake.log.started;
      click(); // in the middle of the insertion
      assert.equal(fake.log.started - base, 1, 'Replay starts one new removal');
      act(() => { mock.timers.tick(MOTION_SPRING_MAX_MS); });
      act(() => { mock.timers.tick(TRANSITION_HOLD_MS); });
      assert.equal(fake.log.started - base, 2, 'and it plays through exactly once');
      click();
      base = fake.log.started;
      cleanup();
      unmounted = true;
      act(() => { mock.timers.tick(10 * MOTION_SPRING_MAX_MS); });
      assert.equal(fake.log.started, base, 'nothing starts after unmount');
    } finally { mock.timers.reset(); }
  } finally {
    if (!unmounted) cleanup();
    fake.restore();
  }
});

test('the style is not rebuilt when the parent renders again with equal props', async () => {
  let bump: (() => void) | undefined;
  function Host() {
    const [, setCount] = React.useState(0);
    bump = () => setCount((n) => n + 1);
    // Fresh object props on every render, as an inline page writes them.
    return <MotionSpecimen kind="transition" transition={{ type: 'combined', of: [{ type: 'opacity' }, { type: 'move', edge: 'bottom' }] }} animation={{ spring: { response: 0.5, dampingFraction: 0.8 } }} />;
  }
  let builds = 0;
  const originalMultiply = Animated.multiply;
  (Animated as Record<string, unknown>).multiply = (...args: unknown[]) => { builds += 1; return (originalMultiply as (...a: unknown[]) => unknown)(...args); };
  const { cleanup } = renderCatalog(<Host />);
  try {
    await pass(WHOLE_PLAY_MS);
    const settled = builds;
    assert.ok(settled > 0, 'the style was built');
    for (let i = 0; i < 3; i += 1) await act(async () => { bump!(); });
    assert.equal(builds, settled, 'equal props reuse the style');
  } finally {
    cleanup();
    (Animated as Record<string, unknown>).multiply = originalMultiply;
  }
});

test('Reduce Motion turned on mid-play jumps to the inserted view and stops animating', async () => {
  const fake = neverFinishingSprings({ jumpToEnd: true });
  const { container, cleanup } = renderCatalog(<MotionSpecimen kind="transition" transition={{ type: 'opacity' }} animation={{ spring: { response: 0.5, dampingFraction: 0.8 } }} label="Fixture" />);
  try {
    await pass(50);
    const sample = container.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    assert.equal(fake.log.started, 0, 'nothing animates on mount');
    await replay(container);
    await pass(50);
    assert.equal(fake.log.started, 1, 'the removal is under way');
    assert.equal(lookOf(sample).opacity, 0, 'and the view is off screen');
    const listener = mediaListeners[mediaListeners.length - 1];
    assert.ok(listener, 'expected a Reduce Motion listener');
    await act(async () => { listener({ matches: true }); });
    await pass(50);
    assert.deepEqual(lookOf(sample), NORMAL, 'the inserted look, not wherever the animation had got to');
    assert.equal(fake.log.stopped, 1, 'the running animation was stopped');
    assert.ok((container.textContent || '').includes('Reduce Motion is on'), 'with the note');
    await pass(TRANSITION_HOLD_MS + 200);
    assert.equal(fake.log.started, 1, 'no insertion follows');
    assert.deepEqual(lookOf(sample), NORMAL);
  } finally {
    cleanup();
    fake.restore();
  }
});
