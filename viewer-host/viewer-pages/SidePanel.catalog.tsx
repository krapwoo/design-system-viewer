import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame, SidePanel, SidePanelTrigger, CATALOG_COLOR, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  body: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
});

function PanelDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SidePanelTrigger label="Notes and API" open={open} onPress={() => setOpen(true)} />
      {open && (
        <SidePanel kicker="Notes and API" title="Example" onClose={() => setOpen(false)}>
          <Text style={demo.body}>Anything can go here. Esc, the × and a press on the dimmed page all close it, and focus goes back to the control that opened it.</Text>
        </SidePanel>
      )}
    </>
  );
}

export default defineCatalogPage({
  component: 'SidePanel',
  group: 'Components',
  standalone: 'Also the shell behind the family and group member panels, not a part of ReferenceDetailsPanel alone.',
  source: '../native/catalog/SidePanel.tsx',
  specimenSize: 'compact',
  hide: { props: true },
  description: 'The overlay panel that slides in from the right edge (no animation): a small kicker, a title, a × and a scrolling body, over a dimmed page. 440px wide, full width at 768px and below. It is the one shell behind every "Notes and API" — a family or group member\'s, and a standalone page\'s — so focus handling lives in one place.',
  whenToUse: 'Detail that should stay one press away without crowding the page. Open it from a SidePanelTrigger; keep the page itself to the specimens.',
  a11y: 'A modal dialog named by its title. On the web, focus moves into the panel, stays inside it, and returns to the control that opened it on close; Esc, the × (named "Close") and a press on the scrim all close it. On native the × receives screen-reader focus on open. The page behind does not scroll while it is open.',
  notes: ['`useClosingNavigation(navigation, onClose)` wraps a reference navigation so following a link inside the panel closes it first, then navigates.'],
  composedOf: [
    { component: 'CatalogButton', role: 'The × close control.', relationship: 'built-in' },
    { component: 'PhoneFrame', role: 'Bounds this documentation demonstration; not part of the panel.', relationship: 'related' },
  ],
  states: {
    items: [
      { key: 'open', name: 'Press the control to open it', node: <PhoneFrame><PanelDemo /></PhoneFrame> },
    ],
  },
});
