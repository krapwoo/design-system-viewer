import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { ButtonGroup } from '../ButtonGroup';
import { Dialog } from './Dialog';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  cardTitle: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
  cardBody: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
  dialogActions: { marginTop: DS_SPACING[800] },
});

function DialogDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <PhoneFrame>
      {!visible && <Button label="Open dialog" onPress={() => setVisible(true)} />}
      <Dialog visible={visible} onDismiss={() => setVisible(false)}>
        <Text style={styles.cardTitle}>Delete this trip?</Text>
        <Text style={styles.cardBody}>This can't be undone.</Text>
        <View style={styles.dialogActions}>
          <ButtonGroup>
            <Button label="Cancel" variant="tertiary" onPress={() => setVisible(false)} />
            <Button label="Delete" onPress={() => setVisible(false)} />
          </ButtonGroup>
        </View>
      </Dialog>
    </PhoneFrame>
  );
}

export default defineCatalogPage({
  component: 'Dialog',
  group: 'Overlays',
  description: 'A card centred on screen over a dismissible backdrop — fades and scales in, distinct from BottomSheet\'s bottom-anchored slide. Named Dialog (not Modal) to avoid shadowing React Native\'s own built-in Modal.',
  whenToUse: 'A short, focused decision that interrupts the flow (confirm/cancel, a single form). For anything longer, browsable, or that needs its own internal scrolling, use BottomSheet.',
  a11y: 'The backdrop is a Pressable with accessibilityRole="button" and accessibilityLabel="Dismiss"; content you pass as children carries its own accessibility.',
  render: () => <DialogDemo />,
});
