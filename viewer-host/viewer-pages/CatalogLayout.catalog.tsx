import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenRow, CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({ value: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text, fontFamily: 'Menlo, monospace' } });

// Notes from tokens.ts comments and a usage scan of native/catalog.
const NOTES: Partial<Record<keyof typeof CATALOG_LAYOUT, string>> = {
  sidebarWidth: 'The sidebar column (CatalogSidebar).',
  sidebarPaddingTop: 'Space above the sidebar header.',
  sidebarPaddingX: 'Sidebar side padding.',
  mainPaddingTop: 'Space above each page (CatalogShell).',
  mainPaddingX: 'Page side padding (CatalogShell).',
  controlSize: 'Height of controls: buttons, the filter field, nav rows, pager buttons.',
  focusRingWidth: 'The keyboard focus outline on every catalog control.',
  navItemPaddingY: 'Vertical padding of sidebar rows.',
  navItemPaddingX: 'Horizontal padding of sidebar rows.',
  panelPadding: 'Inside the reference card (ReferenceDetails).',
  factPaddingY: 'Between Quick reference rows.',
  blockLabelGap: 'Between a block label (Variants, States) and its card.',
  blockGap: 'Between blocks on a page and between reference cards.',
  logoMark: 'Size of a square logo in the sidebar header.',
  logoWordmarkHeight: 'Height of a wordmark logo in the sidebar header.',
  logoCaptionGap: 'Between the logo and the catalog caption.',
  updateContentMaxWidth: "Max width of the update page's column (approved mockup: 512px).",
};

export default defineCatalogPage({
  title: 'Layout',
  group: 'Tokens',
  source: '../native/catalog/tokens.ts',
  tokenGallery: true,
  previewWidths: 'full',
  description: "The viewer's own layout measurements (CATALOG_LAYOUT).",
  render: () => {
    const keys = Object.keys(CATALOG_LAYOUT) as (keyof typeof CATALOG_LAYOUT)[];
    return (
      <>
        {keys.map((name, i) => (
          <TokenRow key={name} use={NOTES[name] ?? ''} notePlacement="right" sampleWidth={260} last={i === keys.length - 1}>
            <Text style={demo.value}>{`${name} · ${CATALOG_LAYOUT[name]}px`}</Text>
          </TokenRow>
        ))}
      </>
    );
  },
});
