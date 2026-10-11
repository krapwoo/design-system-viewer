import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Divider } from '../components/Divider';
import { InputField } from '../components/InputField';
import { DS_SPACING } from '../tokens';

const styles = StyleSheet.create({
  // Trip planner recipe — fills PhoneFrame edge-to-edge (`flex:1` + `alignSelf:'stretch'` override
  // PhoneFrame's own `alignItems/justifyContent:'center'`).
  recipeFrameContent: { flex: 1, alignSelf: 'stretch', padding: DS_SPACING[800] },
  recipeFields: { gap: DS_SPACING[600] },
  recipeDivider: { marginVertical: DS_SPACING[600] },
  recipeActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

function TripPlannerFormDemo() {
  const [from, setFrom] = useState('Current location');
  const [to, setTo] = useState('');
  return (
    <PhoneFrame>
      <View style={styles.recipeFrameContent}>
        <Card>
          <View style={styles.recipeFields}>
            <InputField label="From" value={from} onChangeText={setFrom} editable />
            <InputField label="To" value={to} onChangeText={setTo} editable placeholder="Where to?" />
          </View>
          <Divider style={styles.recipeDivider} />
          <View style={styles.recipeActions}>
            <Button variant="tertiary" size="medium" label="Add stop" onPress={() => {}} />
            {/* trim() so a whitespace-only "destination" can't enable Continue. */}
            <Button variant="primary" size="medium" label="Continue" onPress={() => {}} disabled={!to.trim()} />
          </View>
        </Card>
      </View>
    </PhoneFrame>
  );
}

export default defineCatalogPage({
  group: 'Patterns',
  composedOf: [
    { component: 'Card', role: "Frames the whole form.", relationship: 'built-in' },
    { component: 'InputField', role: "The From and To fields.", relationship: 'built-in' },
    { component: 'Divider', role: "Separates the fields from the actions.", relationship: 'built-in' },
    { component: 'Button', role: "Add stop (tertiary) and Continue (primary, disabled until To is filled).", relationship: 'built-in' },
  ],
  description: 'A composed real screen — not one component in isolation — showing how Card, InputField, Divider, and Button actually fit together: a From/To trip form with a secondary "Add stop" action and a primary "Continue" that\'s disabled until a destination is entered.',
  tokenGallery: true,
  fullWidthLabel: 'Preview',
  render: () => <TripPlannerFormDemo />,
});
