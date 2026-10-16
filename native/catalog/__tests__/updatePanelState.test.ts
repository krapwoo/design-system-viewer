import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptsDeliveredStatus,
  backgroundPlanFetchOutcome,
  classifyRejectedFetch,
  daysAgoLabel,
  isAlreadyUpToDateError,
  isRemoteOrigin,
  nextWaitingAttempt,
  phaseFromPlanResult,
  PLAN_FETCH_ERROR,
  planShowsError,
  reachabilityNote,
  REACHABILITY_MAX_ATTEMPTS,
  recoveredReachabilityState,
  remoteOriginLocalErrorMessage,
  requestOrUnreachable,
  resolvePanelPhase,
  restartReachability,
  statusPollFailureOutcome,
  type ReachabilityState,
  type UpdatePlanView,
  type UpdateStatusView,
} from '../updatePanelState.ts';

function plan(overrides: Partial<UpdatePlanView> = {}): UpdatePlanView {
  return { current: '0.4.0', latest: '0.5.0', breaking: false, summary: [], files: [], dirtyFiles: [], kitFilesDiffering: 0, outsideGitRepo: false, ...overrides };
}

test('phaseFromPlanResult: offline for an error result', () => {
  assert.equal(phaseFromPlanResult({ error: 'offline' }), 'offline');
});

test('phaseFromPlanResult: dirty when any file is dirty, ready otherwise', () => {
  assert.equal(phaseFromPlanResult(plan({ dirtyFiles: ['package.json'] })), 'dirty');
  assert.equal(phaseFromPlanResult(plan()), 'ready');
});

const IDLE: UpdateStatusView = { phase: 'idle' };

test('resolvePanelPhase: checking while the plan has not resolved yet', () => {
  assert.equal(resolvePanelPhase(IDLE, undefined), 'checking');
});

test('resolvePanelPhase: delegates to phaseFromPlanResult once idle and the plan has resolved', () => {
  assert.equal(resolvePanelPhase(IDLE, { error: 'offline' }), 'offline');
  assert.equal(resolvePanelPhase(IDLE, plan({ dirtyFiles: ['x'] })), 'dirty');
  assert.equal(resolvePanelPhase(IDLE, plan()), 'ready');
});

test('resolvePanelPhase: status always wins over a resolved plan once an update is in flight or finished', () => {
  assert.equal(resolvePanelPhase({ phase: 'updating', steps: [] }, plan()), 'updating');
  assert.equal(resolvePanelPhase({ phase: 'restarting' }, plan({ dirtyFiles: ['x'] })), 'restarting');
  assert.equal(resolvePanelPhase({ phase: 'success', doctorSummary: '0 errors', files: [], latest: '0.5.0' }, undefined), 'success');
  assert.equal(resolvePanelPhase({ phase: 'failure', log: '', failedStep: 'install' }, undefined), 'failure');
});

test('daysAgoLabel: today, one day, and N days', () => {
  const now = Date.parse('2026-10-08T00:00:00Z');
  assert.equal(daysAgoLabel('2026-10-08T00:00:00Z', now), 'Released today.');
  assert.equal(daysAgoLabel('2026-10-07T00:00:00Z', now), 'Released 1 day ago.');
  assert.equal(daysAgoLabel('2026-10-06T00:00:00Z', now), 'Released 2 days ago.');
});

test('isAlreadyUpToDateError: true only for the exact "Already on the latest version" message, never a real offline failure', () => {
  assert.equal(isAlreadyUpToDateError({ error: 'Already on the latest version (0.5.0).' }), true);
  assert.equal(isAlreadyUpToDateError({ error: "Couldn't prepare the update." }), false);
  assert.equal(isAlreadyUpToDateError(plan()), false);
});

test('isRemoteOrigin tells a tunnelled page from a local one, by what the endpoint will accept', () => {
  // The endpoint allows exactly http://localhost:<dev port>, so only that page can act.
  assert.equal(isRemoteOrigin('http:', 'localhost'), false);
  // Tailscale, a LAN address, a reverse proxy, a Codespace: all refused by the endpoint, so the
  // panel must not blame a dead server.
  assert.equal(isRemoteOrigin('https:', 'woohos-mac-mini.tail242f06.ts.net'), true);
  assert.equal(isRemoteOrigin('http:', '192.168.4.20'), true);
  assert.equal(isRemoteOrigin('https:', 'localhost'), true);
  // 127.0.0.1 is a different origin string from localhost, and the endpoint compares strings.
  assert.equal(isRemoteOrigin('http:', '127.0.0.1'), true);
});

test('requestOrUnreachable: a rejected fetch (the endpoint socket is gone) classifies as unreachable', async () => {
  const outcome = await requestOrUnreachable(() => Promise.reject(new TypeError('Failed to fetch')));
  assert.equal(outcome.kind, 'unreachable');
});

test('requestOrUnreachable: an HTTP error response keeps its existing non-unreachable handling', async () => {
  const response = { ok: false, status: 401 } as Response;
  const outcome = await requestOrUnreachable(() => Promise.resolve(response));
  assert.deepEqual(outcome, { kind: 'ok', response });
});

const WAITING_ZERO: ReachabilityState = { phase: 'waiting', attempts: 0 };

// Final slice: with a stable endpoint address, the `waiting` poller's own direct endpoint retry
// recovers in place — reload and its marker/durability-gate machinery are gone. What remains is
// just the bounded attempt counter.
test('nextWaitingAttempt: a failed attempt advances the counter and stays waiting below the cap', () => {
  assert.deepEqual(nextWaitingAttempt(WAITING_ZERO), { phase: 'waiting', attempts: 1 });
});

test('nextWaitingAttempt: bounded attempts reaching gave-up', () => {
  let state = WAITING_ZERO;
  for (let i = 0; i < REACHABILITY_MAX_ATTEMPTS - 1; i++) {
    state = nextWaitingAttempt(state);
    assert.equal(state.phase, 'waiting');
  }
  const last = nextWaitingAttempt(state);
  assert.deepEqual(last, { phase: 'stuck', attempts: REACHABILITY_MAX_ATTEMPTS });
});

test('restartReachability: Reconnect restarts the cycle at zero attempts', () => {
  assert.deepEqual(restartReachability(), { phase: 'waiting', attempts: 0 });
});

test('recoveredReachabilityState: a success while mid-flow (no reload involved) recovers', () => {
  const next = recoveredReachabilityState({ phase: 'waiting', attempts: 3 });
  assert.deepEqual(next, { phase: 'recovered', attempts: 0 });
});

test('recoveredReachabilityState: an ordinary successful poll, with nothing unreachable, is a no-op', () => {
  assert.equal(recoveredReachabilityState(undefined), undefined);
});

test('reachabilityNote: the three approved strings, verbatim', () => {
  assert.deepEqual(reachabilityNote('waiting'), {
    variant: 'muted',
    spinner: true,
    bold: 'The viewer isn’t running.',
    text: ' Nothing was changed. This page reconnects by itself as soon as it’s back.',
    hint: { prefix: 'Start it with ', command: 'npx ds-viewer dev' },
  });
  assert.deepEqual(reachabilityNote('recovered'), {
    variant: 'ok',
    spinner: false,
    text: 'Reconnected. Everything below is current.',
  });
  assert.deepEqual(reachabilityNote('stuck'), {
    variant: 'muted',
    spinner: false,
    bold: 'The viewer still isn’t answering.',
    text: ' Nothing was changed.',
    hint: { prefix: 'or start it with ', command: 'npx ds-viewer dev' },
  });
});

// Strengthened (Fable correction pass): the original version of this test only asserted the
// string against an independent literal — real coverage, but it couldn't catch a regression in
// *when* that message applies. It now also pins the decision (`classifyRejectedFetch`) that
// routes a rejected fetch to this message instead of the reachability flow.
test('remoteOriginLocalErrorMessage: pinned exactly, and reachable only through classifyRejectedFetch\'s remote-origin branch', () => {
  assert.equal(
    remoteOriginLocalErrorMessage(),
    'This page is open from another address, and the viewer only takes actions from the machine it runs on. Open the catalog on that machine, or run npx ds-viewer update there.',
  );
  assert.equal(classifyRejectedFetch(true), 'remote-origin');
  assert.equal(classifyRejectedFetch(false), 'unreachable');
});

// Critical finding, Fable correction pass (C4): `isRemoteOrigin` treats `http://127.0.0.1:<port>`
// as remote, and `cli/endpoint.ts` answers a rejected `Origin` with no CORS headers at all — so
// the browser blocks the response and `fetch` rejects exactly like a dead socket. This drives the
// classification with that remote-origin case directly, independent of `isRemoteOrigin`'s own
// test above.
test('classifyRejectedFetch: a rejected fetch from a remote origin (including plain 127.0.0.1) keeps the tunnel message instead of entering the reachability flow', () => {
  assert.equal(classifyRejectedFetch(isRemoteOrigin('http:', '127.0.0.1')), 'remote-origin');
  assert.equal(classifyRejectedFetch(isRemoteOrigin('http:', 'localhost')), 'unreachable');
});

// Critical finding, Fable correction pass (C6): this used to be decided by reading a value
// assigned inside the very `setStatus` updater that decided it, during React's render phase —
// pulled out as a pure function of the already-committed phase so it's both correct and testable
// on its own.
test('statusPollFailureOutcome: a failed poll mid-update or mid-restart falls back to restarting; every other phase is left for the caller to classify', () => {
  assert.deepEqual(statusPollFailureOutcome('updating'), { phase: 'restarting' });
  assert.deepEqual(statusPollFailureOutcome('restarting'), { phase: 'restarting' });
  assert.equal(statusPollFailureOutcome('idle'), undefined);
  assert.equal(statusPollFailureOutcome('success'), undefined);
  assert.equal(statusPollFailureOutcome('failure'), undefined);
});

// Critical finding, correction pass 4: a stable endpoint address means the restarted server
// answers the already-open page's poll before Metro has served the new bundle — `restarting` must
// be terminal for the page, so a delivered status while restarting is accepted only if it is
// itself `restarting` (the Metro-origin reload poller delivering it right back changes nothing).
test('acceptsDeliveredStatus: restarting only accepts restarting back; every other current phase accepts anything', () => {
  assert.equal(acceptsDeliveredStatus('restarting', 'success'), false);
  assert.equal(acceptsDeliveredStatus('restarting', 'restarting'), true);
  assert.equal(acceptsDeliveredStatus('updating', 'success'), true);
});

// Correction pass 5 (Important): takes the plan straight from the fetch that produced it, never a
// ref a passive effect fills in later (which only updates after the already-resumed caller's read).
test('planShowsError: true for a real plan error, false for a usable plan, the already-up-to-date error, or no result yet', () => {
  assert.equal(planShowsError(PLAN_FETCH_ERROR), true);
  assert.equal(planShowsError(plan()), false);
  assert.equal(planShowsError({ error: 'Already on the latest version (0.5.0).' }), false);
  assert.equal(planShowsError(undefined), false);
});

// Correction pass 3: a background `fetchPlan` whose fetch was rejected routes through
// `routeUnreachableInBackground`, which declines to act (returns `false`, "not handled") for a
// remote-origin page rather than latching the page-wide `remoteOriginError` state. Before this
// fix, that `false` was silently dropped on the floor and `planResult` stayed `undefined`
// forever — `resolvePanelPhase` reads that as `'checking'`, with no button and no way out.
test('backgroundPlanFetchOutcome: an unhandled background failure falls back to the offline plan-error note; a handled one leaves planResult alone', () => {
  assert.deepEqual(backgroundPlanFetchOutcome(false), { error: "Couldn't prepare the update. You may be offline, or npm didn't respond. Nothing was changed." });
  assert.equal(backgroundPlanFetchOutcome(true), undefined);
});
