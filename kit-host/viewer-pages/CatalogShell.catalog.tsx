import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_SPACING } from '../../starter-kit/tokens';

// Plain boxes standing in for the real, viewport-sized CatalogShell — a live instance here would
// fight the real catalog around it, not demonstrate the component.
const demo = StyleSheet.create({
  diagramFrame: {
    flexDirection: 'row',
    height: 180,
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
  diagramMainCol: {
    flex: 1,
    backgroundColor: DS_SEMANTIC.surface.main,
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
  diagramPageTitle: { fontSize: 9, fontWeight: '700', color: DS_SEMANTIC.text.regular },
  diagramBlock: {
    height: 40,
    borderRadius: 4,
    backgroundColor: DS_SEMANTIC.surface.white,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
  },
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

function ShellDiagram() {
  return (
    <View style={demo.diagramFrame}>
      <SidebarSwatch />
      <View style={demo.diagramMainCol}>
        <Text style={demo.diagramPageTitle}>Pill</Text>
        <View style={demo.diagramBlock} />
        <View style={demo.diagramBlock} />
      </View>
    </View>
  );
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'The whole catalog — a persistent, searchable sidebar plus one selected page. Selecting a page replaces the main content; on web the page is kept in the URL fragment (#Button) so refresh, deep links, and back/forward work. Desktop and laptop screens only. You\'re reading a live CatalogShell right now.',
  render: () => <ShellDiagram />,
});
