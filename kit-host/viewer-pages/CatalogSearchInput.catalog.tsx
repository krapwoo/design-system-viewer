import React, { useState } from 'react';
import { defineCatalogPage, CatalogSearchInput } from '@krapwoo/ds-viewer';

function CatalogSearchInputDemo() {
  const [value, setValue] = useState('');
  return <CatalogSearchInput value={value} onChangeText={setValue} placeholder="Filter components…" />;
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'A plain filter input, deliberately built from bare RN primitives rather than the host app\'s own search field — the catalog\'s own chrome shouldn\'t depend on (or break alongside) the thing it\'s documenting.',
  render: () => <CatalogSearchInputDemo />,
});
