import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, CatalogSidebar, CATALOG_COLOR, type NavGroup } from '@krapwoo/ds-viewer';

// The real sidebar is as tall as the catalog window, so each example gives it a bounded frame —
// the same approach CatalogShell's page uses for its embedded shells.
type Id = 'Colors' | 'Spacing' | 'Button' | 'Card' | 'Toast';
const GROUPS: NavGroup<Id>[] = [
  { label: 'Tokens', ids: ['Colors', 'Spacing'] },
  { label: 'Components', ids: ['Button', 'Card', 'Toast'] },
];

const frame = StyleSheet.create({
  // A row, so the sidebar stretches to the frame's height the way it fills the catalog window:
  // its list scrolls and the footer link stays pinned at the bottom.
  box: { flexDirection: 'row', height: 420, borderWidth: 1, borderColor: CATALOG_COLOR.border, overflow: 'hidden' },
});

/** A live sidebar that owns its own selection, so the filter and the links really work here. */
function SidebarDemo({ footer, footerActive = false }: { footer: { label: string; kind: 'update' | 'version' }; footerActive?: boolean }) {
  const [active, setActive] = useState<Id | undefined>('Button');
  const [onUpdatePage, setOnUpdatePage] = useState(footerActive);
  return (
    <View style={frame.box}>
      <CatalogSidebar
        logo="Rider App"
        caption="Component Catalog"
        groups={GROUPS}
        active={onUpdatePage ? undefined : active}
        onPress={(id) => {
          setActive(id);
          setOnUpdatePage(false);
        }}
        footer={{ ...footer, active: onUpdatePage, onPress: () => setOnUpdatePage(true) }}
        // A demo sidebar inside another catalog: its links must not change this page's address.
        keepDocumentUrl
      />
    </View>
  );
}

export default defineCatalogPage({
  component: 'CatalogSidebar',
  group: 'Components',
  whenToUse: 'The navigation list on its own — grouped links and the filter field, with no page area. CatalogShell already contains one, so reach for this directly only when composing your own shell around it.',
  source: '../native/catalog/CatalogSidebar.tsx',
  composedOf: [
    { component: 'CatalogSearchInput', role: "The filter field above the page list.", relationship: 'built-in' },
  ],
  hide: { props: true },
  description: 'Catalog navigation: app name, caption, a filter field, and one link per page under grouped headings. Selecting a link opens that page (CatalogShell owns which page is shown); the filter narrows this list only and never changes the open page. These examples are live — type in the filter or select a link to see it respond. Below the list sits one footer link to the update page: the installed version, or an update notice with a dot.',
  a11y: 'A navigation landmark named "Catalog pages". Each entry is a link (a real anchor, so Enter works), and the open page carries `aria-current="page"`. The filter field is named "Filter components"; its group labels are plain text, and the empty result is visible text — neither is announced as a heading or a count yet.',
  variants: {
    items: [
      { key: 'version', name: 'Installed version in the footer', node: <SidebarDemo footer={{ label: 'DS Viewer 0.5.0', kind: 'version' }} /> },
      { key: 'update', name: 'Update available (dot)', node: <SidebarDemo footer={{ label: 'DS Viewer 1.0.0', kind: 'update' }} /> },
      { key: 'updateOpen', name: 'Update page open', node: <SidebarDemo footer={{ label: 'DS Viewer 1.0.0', kind: 'update' }} footerActive /> },
    ],
  },
});
