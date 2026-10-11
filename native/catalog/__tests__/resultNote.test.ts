import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultNote } from '../updatePanelState.ts';

test('success note: header, description, details, and a two-word button that dismisses', () => {
  const note = resultNote({ phase: 'success', doctorSummary: '0 errors, 15 warnings', files: ['package.json', 'package-lock.json'], latest: '0.4.9' }, '0.4.8');
  assert.deepEqual(note, {
    tone: 'ok',
    title: 'Updated to 0.4.9',
    description: "The changes aren't committed yet, so review them in your editor.",
    detail: 'Changed: package.json, package-lock.json · Doctor: 0 errors, 15 warnings',
    action: { label: 'Got it', kind: 'dismiss' },
    hasLog: false,
  });
});

test('failure notes recover from the failed step, with the terminal command as the detail', () => {
  const f = (step: 'install' | 'migrate' | 'doctor' | 'other') => resultNote({ phase: 'failure', log: 'boom', failedStep: 'x', step }, '0.4.8', '0.4.9');
  assert.deepEqual(f('install'), { tone: 'err', title: 'The update stopped while installing', description: 'Nothing was migrated. Retrying starts again from the download.', detail: 'You can also run npx ds-viewer update in your terminal.', command: 'npx ds-viewer update', action: { label: 'Retry update', kind: 'retry' }, hasLog: true });
  assert.equal(f('migrate').action.label, 'Finish migration');
  assert.equal(f('migrate').action.kind, 'resume');
  assert.equal(f('migrate').description, 'Your package is on 0.4.9, but your files still match 0.4.8.');
  assert.equal(f('migrate').command, 'npx ds-viewer migrate --from 0.4.8');
  assert.equal(f('doctor').action.label, 'Rerun doctor');
  assert.equal(f('doctor').action.kind, 'resume');
  assert.equal(f('other').action.kind, 'retry');
});

test('every note button is at most two words, and no copy uses an em dash', () => {
  const notes = [
    resultNote({ phase: 'success', doctorSummary: 's', files: [], latest: '1' }, '0'),
    ...(['install', 'migrate', 'doctor', 'other'] as const).map((step) => resultNote({ phase: 'failure', log: '', failedStep: '', step }, '0', '1')),
  ];
  for (const n of notes) {
    assert.ok(n.action.label.split(/\s+/).length <= 2, n.action.label);
    assert.ok(!JSON.stringify(n).includes('—'), n.title);
  }
});

test("the success detail keeps only doctor's counts, never its em-dash tail", () => {
  const note = resultNote({ phase: 'success', doctorSummary: '0 errors, 15 warnings — 37 components (37 with examples), 130 unbound examples.', files: ['package.json'], latest: '0.4.9' }, '0.4.8');
  assert.equal(note.detail, 'Changed: package.json · Doctor: 0 errors, 15 warnings');
});
