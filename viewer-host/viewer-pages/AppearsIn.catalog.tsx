import React from 'react';
import { AppearsIn, defineCatalogPage } from '@krapwoo/ds-viewer';
import type { UsageEntry } from '@krapwoo/ds-viewer';

// Fixture usage, invented for this page: not read from any project's usage file.
const FEW: UsageEntry = {
  area: 'Chat',
  uses: [
    { area: 'Chat', file: 'ChatView.swift', line: 41 },
    { area: 'Chat', file: 'ChatComposer.swift', line: 118 },
    { area: 'Chat', file: 'ChatRow.swift', line: 9 },
    { area: 'Bots', file: 'BotRoomView.swift', line: 152 },
    { area: 'Settings', file: 'SettingsView.swift' },
  ],
};

const MANY: UsageEntry = {
  area: 'Chat',
  uses: [
    ...Array.from({ length: 7 }, (_, i) => ({ area: 'Chat', file: `ChatScreen${i + 1}.swift`, line: 10 + i })),
    ...Array.from({ length: 3 }, (_, i) => ({ area: 'Bots', file: `BotScreen${i + 1}.swift`, line: 20 + i })),
    { area: 'Settings', file: 'SettingsView.swift', line: 5 },
  ],
};

export default defineCatalogPage({
  component: 'AppearsIn',
  group: 'Components',
  standalone: 'Exported on its own, so a catalog can use it outside SectionBlock.',
  whenToUse: 'The "Appears in" block: where a component is used, per product area, then the files. SectionBlock and the family and group pages render one themselves when the project has usage data, so use it directly only when composing a page yourself.',
  source: '../native/catalog/AppearsIn.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: 'How many times a component is used in each area (a decorative bar and a count, most-used first), then the files that use it as file:line. Past eight files the list collapses behind "Show all N". It renders nothing for an entry with no uses, so a page without usage looks unchanged. The numbers on this page are fixture data, not a real project\'s.',
  a11y: 'Each area row reads as one item, e.g. "Chat, 3 uses"; the bars are hidden from assistive technology. "Show all N" is a button that reports whether the list is expanded.',
  variants: {
    items: [
      { key: 'few', name: 'Fixture usage: 5 uses in 3 areas', node: <AppearsIn entry={FEW} /> },
      { key: 'many', name: 'Fixture usage: 11 uses, files collapsed', node: <AppearsIn entry={MANY} /> },
    ],
  },
});
