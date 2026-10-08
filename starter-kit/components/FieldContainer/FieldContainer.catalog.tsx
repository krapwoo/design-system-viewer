import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { FieldContainer } from './FieldContainer';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../../tokens';

const styles = StyleSheet.create({
  // FieldContainer — a stand-in "field" body, since the real component only supplies the chrome.
  fieldContainerDemo: { height: 56, justifyContent: 'center', paddingHorizontal: DS_SPACING[800] },
  fieldContainerText: { ...DS_TYPOGRAPHY.bodyMd, color: DS_SEMANTIC.text.muted },
});

export default defineCatalogPage({
  component: 'FieldContainer',
  group: 'Sub-Parts',
  description: 'The shared field chrome — white surface, medium radius, a 1px border that darkens on focus and mutes when disabled — behind InputField, TextArea, Dropdown, and SearchField, so all four share one visually-consistent field look instead of each re-implementing it.',
  a11y: 'Renders a plain View by default. Passing onPress (without disabled) makes it a Pressable with accessibilityRole="button" and the given accessibilityLabel — a consumer building a real editable field (InputField\'s editable mode) relies on its own inner TextInput for accessibility instead.',
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'resting',
        name: 'Resting',
        node: (
          <FieldContainer style={styles.fieldContainerDemo}>
            <Text style={styles.fieldContainerText}>Field content</Text>
          </FieldContainer>
        ),
      },
      {
        key: 'focused',
        name: 'Focused',
        props: { focused: true },
        node: (
          <FieldContainer focused style={styles.fieldContainerDemo}>
            <Text style={styles.fieldContainerText}>Field content</Text>
          </FieldContainer>
        ),
      },
      {
        key: 'disabled',
        name: 'Disabled',
        props: { disabled: true },
        node: (
          <FieldContainer disabled style={styles.fieldContainerDemo}>
            <Text style={styles.fieldContainerText}>Field content</Text>
          </FieldContainer>
        ),
      },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'pressed',
        name: 'Pressed (caller-driven)',
        props: { pressed: true },
        node: (
          <FieldContainer pressed style={styles.fieldContainerDemo}>
            <Text style={styles.fieldContainerText}>Field content</Text>
          </FieldContainer>
        ),
      },
      {
        key: 'pressable',
        name: 'Pressable (with onPress)',
        node: (
          <FieldContainer onPress={() => {}} accessibilityLabel="Field content" style={styles.fieldContainerDemo}>
            <Text style={styles.fieldContainerText}>Field content</Text>
          </FieldContainer>
        ),
      },
    ],
  },
});
