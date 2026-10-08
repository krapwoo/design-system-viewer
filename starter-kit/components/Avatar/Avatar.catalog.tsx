import React from 'react';
import { defineCatalogPage, type ComparisonDef } from '@krapwoo/ds-viewer';
import { Avatar } from './Avatar';
import { DS_SEMANTIC } from '../../tokens';

// Grid comparisons: each cell is a real instance with exactly the props its row and column name.
// Never build these by multiplying `variants` with `states` — those are pre-rendered nodes and
// cannot combine.
function grid(
  rowLabel: string,
  columnLabel: string,
  rows: { key: string; label: string }[],
  columns: { key: string; label: string }[],
  cell: (row: string, column: string) => React.ReactNode,
  size?: ComparisonDef['size'],
): ComparisonDef {
  return {
    rowLabel,
    columnLabel,
    rows,
    columns,
    cells: rows.flatMap((row) => columns.map((column) => ({ rowKey: row.key, columnKey: column.key, node: cell(row.key, column.key) }))),
    size,
  };
}

// Avatar: content Kind × Size (Avatar's `size` is continuous; 24 / 40 default / 64 is the sweep).
const AVATAR_COMPARISON = grid(
  'Kind',
  'Size',
  [
    { key: 'image', label: 'Image' },
    { key: 'icon', label: 'Icon' },
    { key: 'initials', label: 'Initials fallback' },
  ],
  [
    { key: 'small', label: 'Small · 24' },
    { key: 'medium', label: 'Medium · 40 (default)' },
    { key: 'large', label: 'Large · 64' },
  ],
  (row, column) => {
    const size = column === 'small' ? 24 : column === 'large' ? 64 : 40;
    if (row === 'image') return <Avatar imageUrl="https://i.pravatar.cc/100" accessibilityLabel="Jordan Lee" size={size} />;
    if (row === 'icon') return <Avatar iconName="users" accessibilityLabel="Guest" size={size} />;
    return <Avatar initials="JL" accessibilityLabel="Jordan Lee" size={size} />;
  },
  'compact',
);

export default defineCatalogPage({
  component: 'Avatar',
  group: 'Surfaces',
  specimenSize: 'compact',
  comparison: AVATAR_COMPARISON,
  description: 'A circular image, or an initials fallback on a solid fill when there\'s no image (or it fails to load).',
  a11y: 'Renders with accessibilityRole="image"; pass accessibilityLabel for a meaningful name, otherwise it falls back to the initials text.',
  variants: {
    items: [
      { key: 'image', name: 'Image', node: <Avatar imageUrl="https://i.pravatar.cc/100" accessibilityLabel="Jordan Lee" /> },
      { key: 'icon', name: 'Icon', node: <Avatar iconName="users" accessibilityLabel="Guest" /> },
      { key: 'initials', name: 'Initials fallback', node: <Avatar initials="JL" accessibilityLabel="Jordan Lee" /> },
    ],
  },
  states: {
    items: [
      { key: 'small', name: 'Small', node: <Avatar initials="JL" size={24} /> },
      { key: 'medium', name: 'Medium (default)', node: <Avatar initials="JL" size={40} /> },
      { key: 'large', name: 'Large', node: <Avatar initials="JL" size={64} /> },
      { key: 'custom-color', name: 'Custom colour', node: <Avatar initials="AC" backgroundColor={DS_SEMANTIC.emphasis.info} /> },
    ],
  },
});
