import React from 'react';
import { defineCatalogPage, PropsTable } from '@krapwoo/ds-viewer';

function PropsTableDemo() {
  return (
    <PropsTable
      props={[
        { name: 'label', type: 'string', desc: 'Button text.' },
        { name: 'variant', type: "'primary' | 'secondary'", default: 'primary', desc: 'Visual weight.' },
        { name: 'onPress', type: '() => void', required: true, desc: 'Tap handler.' },
      ]}
    />
  );
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Renders a component\'s real prop interface as a table: each row stacks name + type above its description (and default, if any) — top-to-bottom, not side by side, so a long description reads at the card\'s full width instead of being squeezed into a narrow leftover column.',
  render: () => <PropsTableDemo />,
});
