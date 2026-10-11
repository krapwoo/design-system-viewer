import React from 'react';
import { UpdatePanel, defineCatalogPage, type UpdateNotice } from '@krapwoo/ds-viewer';

const DEMO_UPDATE: UpdateNotice = {
  current: '0.4.0',
  latest: '0.5.0',
  breaking: false,
  summary: ['Faster sync for large kits', 'New Tabs component in the starter kit'],
  releasedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description:
    'The update page (design §5, `#ds-viewer-update`) — opened from the sidebar footer line or ' +
    'the major-update banner, never listed in the sidebar groups itself. Rendered here with no ' +
    'live local endpoint, so it stays in its "checking" phase; the full ten-state flow is only ' +
    'reachable from a real `npx ds-viewer dev` session (see the approved mockup, ' +
    'docs/design/2026-10-08-ds-viewer-update-panel-approved.html, for every state\'s exact copy).',
  render: () => <UpdatePanel update={DEMO_UPDATE} endpoint={undefined} appName="Design System Starter Kit" />,
});
