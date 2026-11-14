// Ported from QQ's `useReduceMotion.test.ts`: the pure subscription function, against a fake source.
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeReduceMotion } from '../useReduceMotion';

function fakeSource(initial: boolean | Error) {
  let listener: ((enabled: boolean) => void) | undefined;
  const remove = mock.fn();
  const source = {
    isReduceMotionEnabled: mock.fn(() => (initial instanceof Error ? Promise.reject(initial) : Promise.resolve(initial))),
    addEventListener: mock.fn((_event: string, callback: (enabled: boolean) => void) => {
      listener = callback;
      return { remove };
    }),
  };
  return { source: source as never, emit: (value: boolean) => listener?.(value), remove };
}

describe('subscribeReduceMotion', () => {
  it('reports the initial OS setting', async () => {
    const { source } = fakeSource(true);
    const onChange = mock.fn();
    subscribeReduceMotion(source, onChange);
    await Promise.resolve();
    assert.deepEqual(onChange.mock.calls.map((call) => call.arguments), [[true]]);
  });

  it('follows reduceMotionChanged', () => {
    const { source, emit } = fakeSource(false);
    const onChange = mock.fn();
    subscribeReduceMotion(source, onChange);
    emit(true);
    assert.deepEqual(onChange.mock.calls.at(-1)?.arguments, [true]);
  });

  it('ignores a late initial read and later events after cleanup, and removes the subscription', async () => {
    const { source, emit, remove } = fakeSource(true);
    const onChange = mock.fn();
    const cleanup = subscribeReduceMotion(source, onChange);
    cleanup();
    await Promise.resolve();
    emit(true);
    assert.equal(onChange.mock.callCount(), 0);
    assert.equal(remove.mock.callCount(), 1);
  });

  it('survives a rejected initial read', async () => {
    const { source } = fakeSource(new Error('unsupported'));
    const onChange = mock.fn();
    subscribeReduceMotion(source, onChange);
    await Promise.resolve();
    assert.equal(onChange.mock.callCount(), 0);
  });
});
