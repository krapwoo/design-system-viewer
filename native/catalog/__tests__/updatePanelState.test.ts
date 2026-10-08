import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysAgoLabel, isAlreadyUpToDateError, phaseFromPlanResult, resolvePanelPhase, type UpdatePlanView, type UpdateStatusView } from '../updatePanelState.ts';

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
