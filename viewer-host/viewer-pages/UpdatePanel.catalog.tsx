import React from 'react';
import { UpdatePanel, defineCatalogPage, type UpdateNotice, type VersionStatus } from '@krapwoo/ds-viewer';

const DEMO_UPDATE: UpdateNotice = {
  current: '0.4.9',
  latest: '0.5.0',
  breaking: false,
  summary: ['PhoneScreen and OverlayDemo for screen and overlay demos', 'doctor --render checks every page in a browser'],
  releasedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const status = (overrides: Partial<VersionStatus>): VersionStatus => ({
  current: '0.5.0', autoCheck: { enabled: true, source: 'default' }, lastOutcome: 'ok', lastCheckedAt: hoursAgo(2), update: null, ...overrides,
});
const panel = (update: UpdateNotice | null, versionStatus: VersionStatus) => (
  <UpdatePanel update={update} versionStatus={versionStatus} endpoint={undefined} appName="Design System Starter Kit" />
);

export default defineCatalogPage({
  component: 'UpdatePanel',
  group: 'Components',
  source: '../native/catalog/UpdatePanel.tsx',
  // Wider than a phone (its column is 512px), so its examples use page-width cells.
  specimenSize: 'page',
  hide: { props: true },
  description:
    'The update page (`#ds-viewer-update`), opened from the sidebar footer, which always shows the installed version. ' +
    "With no newer version it says which situation applies (latest, checks off, couldn't reach npm) with Check now and a switch for automatic checks; " +
    'with one, it shows the update and Update now. After an update, its result is a note at the top of this same page. ' +
    'Shown here with no local server, so the buttons do nothing; the result notes only appear in a real `npx ds-viewer dev` session. ' +
    'Approved mockups: docs/design/2026-10-10-ds-viewer-update-page-always-approved.html and 2026-10-11-ds-viewer-update-result-note-approved.html.',
  a11y: 'The page title is a level-1 heading. The automatic-check switch is named with its reason; result notes are role status.',
  composedOf: [{ component: 'CatalogButton', role: 'Uses the same button style for its actions.', relationship: 'related' }],
  variants: {
    items: [
      { key: 'latest', name: 'Latest', node: panel(null, status({})) },
      { key: 'off', name: 'Checks off', node: panel(null, status({ autoCheck: { enabled: false, source: 'project' }, lastOutcome: 'not-run', lastCheckedAt: undefined })) },
      { key: 'offline', name: "Couldn't reach npm", node: panel(null, status({ current: '0.4.9', lastOutcome: 'unreachable', lastCheckedAt: hoursAgo(72) })) },
      { key: 'update', name: 'Update available', node: panel(DEMO_UPDATE, status({ current: '0.4.9', update: DEMO_UPDATE })) },
    ],
  },
});
