import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_SPACING } from '../../starter-kit/tokens';

// A plain box standing in for the real, viewport-sized CatalogSidebar — a live instance here would
// fight the real catalog around it, not demonstrate the component.
const demo = StyleSheet.create({
  diagramSidebarFrame: {
    height: 180,
    width: 140,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
    borderRadius: 8,
    overflow: 'hidden',
  },
  diagramSidebarCol: {
    width: 110,
    backgroundColor: DS_SEMANTIC.surface.white,
    borderRightWidth: 1,
    borderRightColor: DS_SEMANTIC.border.subtle,
    padding: DS_SPACING[400],
    gap: DS_SPACING[200],
  },
  diagramLogo: { fontSize: 9, fontWeight: '700', color: DS_SEMANTIC.text.regular },
  diagramCaption: { fontSize: 7, color: DS_SEMANTIC.text.muted, marginBottom: DS_SPACING[200] },
  diagramSearch: {
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
    backgroundColor: DS_SEMANTIC.surface.main,
  },
  diagramGroupLabel: { fontSize: 6, fontWeight: '700', color: DS_SEMANTIC.text.muted, letterSpacing: 0.4, marginTop: DS_SPACING[200] },
  diagramNavItem: { fontSize: 7, color: DS_SEMANTIC.text.muted },
  diagramNavActive: { color: DS_SEMANTIC.text.regular, fontWeight: '700' },
});

function SidebarSwatch() {
  return (
    <View style={demo.diagramSidebarCol}>
      <Text style={demo.diagramLogo}>Design System</Text>
      <Text style={demo.diagramCaption}>Component Catalog</Text>
      <View style={demo.diagramSearch} />
      <Text style={demo.diagramGroupLabel}>ACTIONS</Text>
      <Text style={demo.diagramNavItem}>Button</Text>
      <Text style={[demo.diagramNavItem, demo.diagramNavActive]}>Pill</Text>
    </View>
  );
}

function SidebarDiagram() {
  return (
    <View style={demo.diagramSidebarFrame}>
      <SidebarSwatch />
    </View>
  );
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Catalog navigation: app name, caption, a filter box, and grouped links, one per page. Selecting a link opens that page; the filter narrows this list only and never changes the open page. Used internally by CatalogShell.',
  render: () => <SidebarDiagram />,
});
