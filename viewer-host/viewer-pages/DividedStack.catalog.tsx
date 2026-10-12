import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DividedStack, CATALOG_SPACE } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_TYPOGRAPHY } from '../../starter-kit/tokens';

const demo = StyleSheet.create({
  mockText: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, fontStyle: 'italic' },
});

function Item({ children }: { children: string }) {
  return <Text style={demo.mockText}>{children}</Text>;
}

export default defineCatalogPage({
  component: 'DividedStack',
  group: 'Components',
  source: '../native/catalog/DividedStack.tsx',
  hide: { props: true },
  description: 'Stacks children vertically with a hairline divider automatically inserted between each consecutive pair — never after the last. Unlike TokenRow\'s divider (which each row draws itself, needing a manually-computed `last` prop), this one is guaranteed by construction: wrap any list of items and the dividers place themselves. `gap` is the space either side of each divider.',
  whenToUse: 'Any vertical list that needs separators between items. Reach for TokenRow instead when each row also carries a token\'s own note.',
  a11y: 'The dividers are plain views with no text, so a screen reader reads the items as the stack\'s own children and nothing else.',
  variants: {
    items: [
      {
        key: 'several',
        name: 'Several items',
        fill: true,
        node: (
          <DividedStack gap={CATALOG_SPACE.lg}>
            <Item>First item</Item>
            <Item>Second item — has a divider above it, not below</Item>
            <Item>Third item — the last one, no trailing divider</Item>
          </DividedStack>
        ),
      },
      // The contract's edge: nothing follows, so nothing is drawn. No `last` prop to remember.
      { key: 'one', name: 'A single item (no divider at all)', fill: true, node: <DividedStack gap={CATALOG_SPACE.lg}><Item>The only item</Item></DividedStack> },
      { key: 'tight', name: 'A smaller gap', fill: true, node: (
        <DividedStack gap={CATALOG_SPACE.xs}>
          <Item>Rows sit closer to their dividers</Item>
          <Item>…which suits a dense list</Item>
        </DividedStack>
      ) },
    ],
  },
});
