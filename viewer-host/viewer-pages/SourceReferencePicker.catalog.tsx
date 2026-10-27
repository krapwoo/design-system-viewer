import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame, CatalogButton, SourceReferencePicker, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT } from '@krapwoo/ds-viewer';
import type { ReferenceEntry } from '@krapwoo/ds-viewer';

// Sample data only — standing in for a real catalog's own `buildReferenceIndex(sections)` output
// (plan Task 1), so this self-catalog demo can show real search/alias/path lookup without this
// file becoming a second, hand-maintained production registry. A real `CatalogShell` caller
// (Task 2B) passes its own catalog's real entries instead.
const SAMPLE_ENTRIES: ReferenceEntry[] = [
  { pageId: 'Button', title: 'Button', component: 'Button', aliases: [], path: 'src/components/Button/index.ts' },
  { pageId: 'PillButton', title: 'Pill button', component: 'PillButton', aliases: ['RoundedButton'], path: 'src/components/PillButton/index.ts' },
  {
    pageId: 'BotAvatarView', title: 'Bot avatar', component: 'BotAvatarView', aliases: ['OldBotAvatar'],
    path: 'native/Bots/BotAvatarView.swift',
  },
  {
    pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView', title: 'BotAnimatedFaceView', component: 'FaceComponent',
    aliases: ['OldFaceView'], path: 'native/Bots/BotFaceMotion.swift',
  },
];

function Demo({ entries, label }: { entries: ReferenceEntry[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <PhoneFrame>
      <CatalogButton label={label} onPress={() => setOpen(true)} />
      <Text style={demoStyles.status}>{selected ? `Selected: ${selected}` : 'No selection yet.'}</Text>
      <SourceReferencePicker
        visible={open}
        entries={entries}
        onDismiss={() => setOpen(false)}
        onSelect={(entry) => {
          setSelected(entry.memberId ?? entry.pageId);
          setOpen(false);
        }}
      />
    </PhoneFrame>
  );
}

const demoStyles = StyleSheet.create({
  status: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginTop: CATALOG_SPACE.sm },
});

export default defineCatalogPage({
  component: 'SourceReferencePicker',
  group: 'Components',
  standalone: 'Exported on its own, so a catalog can use it outside CatalogShell.',
  specimenSize: 'wide',
  source: '../native/catalog/SourceReferencePicker.tsx',
  hide: { props: true },
  description: 'A controlled picker for finding any registered page or family member by title, component, alias, or source path. The caller owns opening, closing, navigation, and destination focus. These demonstrations use explicitly sample references and report the selected address without navigating away.',
  whenToUse: 'Use for catalog-wide source lookup. Keep ordinary visual browsing and the sidebar\'s existing member search in their current places.',
  a11y: 'A quiet "Source reference" heading, a durable-labelled search field (autofocused), and a scrollable, A–Z-sorted result list of real links (`href`, Enter-activatable, modified-click-safe). Escape, the explicit Close button, or a native request-close all dismiss with no selection; keyboard focus is trapped inside the modal and returns to the button that opened it, reusing React Native Modal\'s own built-in focus handling.',
  composedOf: [
    { component: 'PhoneFrame', role: 'Bounds this documentation demonstration; not part of the picker.', relationship: 'related' },
    { component: 'CatalogButton', role: 'The picker\'s Close control.', relationship: 'built-in' },
    { component: 'CatalogSearchInput', role: 'The picker\'s own search field.', relationship: 'built-in' },
  ],
  variants: {
    items: [
      { key: 'typical', name: 'A typical catalog (search, alias, and path lookup)', node: <Demo entries={SAMPLE_ENTRIES} label="Open source reference" /> },
    ],
  },
  states: {
    items: [
      // Honest bounded feedback (spec: "no invented counts/data") when the catalog itself has no
      // registered source references at all — distinct from a nonempty catalog with no matches,
      // which the typical demo above shows by typing a query that matches nothing.
      { key: 'empty', name: 'An empty catalog', node: <Demo entries={[]} label="Open source reference (empty)" /> },
    ],
  },
});
