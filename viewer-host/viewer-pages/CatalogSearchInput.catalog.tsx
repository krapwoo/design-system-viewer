import React, { useState } from 'react';
import { defineCatalogPage, CatalogSearchInput } from '@krapwoo/ds-viewer';

/** Live, so the clear button really appears as you type and really clears the field. */
function SearchDemo({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <CatalogSearchInput value={value} onChangeText={setValue} placeholder="Filter components…" />;
}

export default defineCatalogPage({
  component: 'CatalogSearchInput',
  group: 'Components',
  whenToUse: 'Use for the catalog sidebar and other catalog-owned search surfaces. It is built from bare RN primitives so the documentation does not depend on the host app\'s own field component.',
  source: '../native/catalog/CatalogSearchInput.tsx',
  hide: { props: true },
  description: 'A plain filter input, deliberately built from bare RN primitives rather than the host app\'s own search field — the catalog\'s own chrome shouldn\'t depend on (or break alongside) the thing it\'s documenting. It has no width of its own: it fills whatever column it sits in, 264px in the sidebar and a phone\'s content width here. A clear button appears as soon as there is something to clear.',
  a11y: 'The field keeps a durable name: "Filter components" by default, or the caller\'s accessibilityLabel. The 44×44 Clear filter control empties the field and restores its focus. autoFocus is off by default. Modal callers should focus inputRef from the modal\'s onShow callback, after it has remembered the initiating control.',
  variants: {
    items: [
      // Filled, because the field has no intrinsic width — filling caps it at a phone's content
      // width (370px) and centres it, the same as any other full-width control.
      { key: 'empty', name: 'Empty (placeholder)', fill: true, node: <SearchDemo /> },
      { key: 'filtering', name: 'With a filter (clear button)', fill: true, node: <SearchDemo initial="but" /> },
    ],
  },
});
