import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoCheckHelp, bumpLabel, checkedAgoLabel, versionOverview } from '../updatePanelState.ts';
import { footerLink } from '../catalogNavigation.ts';
import type { VersionStatus } from '../types.ts';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const base: VersionStatus = { current: '0.4.5', autoCheck: { enabled: true, source: 'default' }, lastOutcome: 'ok', lastCheckedAt: '2026-10-10T10:00:00Z', update: null };
const update = { current: '0.4.5', latest: '0.4.6', breaking: false, summary: [] };

test('footerLink: the blue notice when a newer version is known, else the quiet installed version', () => {
  assert.deepEqual(footerLink(update, base), { label: 'Update available · 0.4.6', kind: 'update' });
  assert.deepEqual(footerLink(null, base), { label: 'DS Viewer 0.4.5', kind: 'version' });
  assert.deepEqual(footerLink(null, { ...base, update }), { label: 'Update available · 0.4.6', kind: 'update' }, 'a Check now result counts too');
  // Older workspaces with no version status keep today's behaviour.
  assert.equal(footerLink(null, undefined), undefined);
  assert.deepEqual(footerLink(update, undefined), { label: 'Update available · 0.4.6', kind: 'update' });
});

test('checkedAgoLabel', () => {
  assert.equal(checkedAgoLabel(undefined, NOW), 'Never');
  assert.equal(checkedAgoLabel('2026-10-10T11:59:40Z', NOW), 'Just now');
  assert.equal(checkedAgoLabel('2026-10-10T11:59:00Z', NOW), '1 minute ago');
  assert.equal(checkedAgoLabel('2026-10-10T11:15:00Z', NOW), '45 minutes ago');
  assert.equal(checkedAgoLabel('2026-10-10T10:00:00Z', NOW), '2 hours ago');
  assert.equal(checkedAgoLabel('2026-10-09T11:00:00Z', NOW), '1 day ago');
  assert.equal(checkedAgoLabel('2026-10-07T12:00:00Z', NOW), '3 days ago');
});

test('versionOverview: up to date only when a check actually answered', () => {
  assert.deepEqual(versionOverview(base, false, NOW), { pill: 'latest', line: 'You’re on the latest version.', action: 'check' });
  assert.deepEqual(versionOverview(base, true, NOW), {
    pill: 'latest', line: 'You’re on the latest version.', action: 'check', note: { variant: 'ok', text: 'Checked just now. No newer version.' },
  });
});

test('versionOverview: checks off never claims "up to date"', () => {
  const off: VersionStatus = { ...base, current: '0.4.4', autoCheck: { enabled: false, source: 'project' }, lastOutcome: 'not-run' };
  assert.deepEqual(versionOverview(off, false, NOW), {
    pill: 'off', line: 'You’re on 0.4.4. Automatic checks are off, so this can’t tell whether a newer version exists.', action: 'check',
  });
  // Switched on in this session, but nothing checked yet.
  assert.deepEqual(versionOverview({ ...off, autoCheck: { enabled: true, source: 'personal' } }, false, NOW), {
    line: 'You’re on 0.4.4. Not checked yet: automatic checks run when the viewer starts.', action: 'check',
  });
});

test('versionOverview: npm unreachable says so, with the last good result when there is one', () => {
  const down: VersionStatus = { ...base, current: '0.4.4', lastOutcome: 'unreachable', lastCheckedAt: '2026-10-07T12:00:00Z' };
  assert.deepEqual(versionOverview(down, false, NOW), {
    line: 'You’re on 0.4.4.', action: 'retry',
    note: { variant: 'err', bold: 'Couldn’t reach npm.', text: ' You may be offline. The last successful check, 3 days ago, found no newer version.' },
  });
  assert.deepEqual(versionOverview({ ...down, lastCheckedAt: undefined }, false, NOW).note, { variant: 'err', bold: 'Couldn’t reach npm.', text: ' You may be offline.' });
});

test('autoCheckHelp names where the setting comes from, and only CI locks the switch', () => {
  assert.deepEqual(autoCheckHelp({ enabled: false, source: 'env' }), { text: 'Off in this environment (DS_VIEWER_NO_UPDATE_CHECK=1).', locked: true });
  assert.deepEqual(autoCheckHelp({ enabled: true, source: 'personal' }), { text: 'Once a day, when the viewer starts. Saved for you on this computer.', locked: false });
  assert.deepEqual(autoCheckHelp({ enabled: false, source: 'personal' }), { text: 'Turned off by you on this computer.', locked: false });
  assert.deepEqual(autoCheckHelp({ enabled: false, source: 'project' }), {
    text: 'Off for this project (updateCheck: false in ds-viewer.config.ts). Turning it on here applies to you only.', locked: false,
  });
  assert.deepEqual(autoCheckHelp({ enabled: true, source: 'project' }), { text: 'Once a day, when the viewer starts.', locked: false });
  assert.deepEqual(autoCheckHelp({ enabled: true, source: 'default' }), { text: 'Once a day, when the viewer starts.', locked: false });
});

test('bumpLabel: Major for a breaking update, else Minor or Patch from the version numbers', () => {
  assert.equal(bumpLabel('0.4.4', '0.4.5', false), 'Patch');
  assert.equal(bumpLabel('0.4.5', '0.5.0', false), 'Minor');
  assert.equal(bumpLabel('0.4.5', '1.0.0', true), 'Major');
  assert.equal(bumpLabel('1.2.3', '1.2.4-beta.1', false), 'Patch');
  assert.equal(bumpLabel('not', 'semver', false), 'Minor', 'unreadable versions keep the old label');
});

test('versionOverview: turned off after a check answered shows the Checks off pill (mockup 7b), not Latest', () => {
  const offAfterCheck: VersionStatus = { ...base, autoCheck: { enabled: false, source: 'personal' }, lastOutcome: 'ok' };
  assert.deepEqual(versionOverview(offAfterCheck, false, NOW), { pill: 'off', line: 'You’re on 0.4.5. Automatic checks are off.', action: 'check' });
  // Right after Check now, the fresh answer still wins.
  assert.equal(versionOverview(offAfterCheck, true, NOW).pill, 'latest');
});
