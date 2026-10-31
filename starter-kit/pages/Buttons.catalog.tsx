import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, CountStrip, WarningBanner, defineCatalogPage } from '@krapwoo/ds-viewer';
import { Button } from '../components/Button';
import { ButtonGroup } from '../components/ButtonGroup';

/** One inventory entry: the specimen, then its name. The name is the link to that page. */
function Entry({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: CATALOG_SPACE.md, alignItems: 'flex-start' }}>
      {children}
      <Pressable accessibilityRole="link" {...({ href: `#${encodeURIComponent(id)}` } as Record<string, unknown>)}>
        <Text style={{ ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.accent }}>{id}</Text>
      </Pressable>
    </View>
  );
}

// A category overview: the page the sidebar's "Buttons" entry opens, with the two button pages listed
// under it (`sidebarParent: 'Buttons'` on Button and ButtonGroup). It adds no components of its own.
// Its inventory is only the specimen and the name: no card per item and no description line.
export default defineCatalogPage({
  id: 'Buttons',
  group: 'Components',
  description: 'Start here for buttons: one Button for a single action, or ButtonGroup when two or three actions go together.',
  standalone: 'A category page for the sidebar: it documents no component of its own.',
  // Not a phone component: let the preview use the whole page width, so the stats sit on one row.
  previewWidths: 'full',
  render: () => (
    <View style={{ gap: CATALOG_SPACE.xl }}>
      <WarningBanner title="One primary per surface">
        Each screen, modal or sheet gets one primary Button, the one thing it most wants you to do. Make every other action secondary, tertiary or ghost.
      </WarningBanner>
      <CountStrip
        items={[
          { label: 'Pages', value: 2, sub: 'Button and ButtonGroup' },
          { label: 'Variants', value: 5, sub: 'primary to ghost' },
          { label: 'Sizes', value: 3, sub: 'large, medium, small' },
        ]}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.xl }}>
        <Entry id="Button">
          <Button label="Continue" onPress={() => {}} />
        </Entry>
        <Entry id="ButtonGroup">
          <ButtonGroup variant="horizontal">
            <Button label="Cancel" variant="tertiary" onPress={() => {}} />
            <Button label="Confirm" onPress={() => {}} />
          </ButtonGroup>
        </Entry>
      </View>
    </View>
  ),
});
