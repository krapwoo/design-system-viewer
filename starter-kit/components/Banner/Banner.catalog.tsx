import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AnatomyPin, AnatomySpecimen, defineCatalogPage } from '@krapwoo/ds-viewer';
import { Banner } from './Banner';

const styles = StyleSheet.create({
  pin: { position: 'absolute', right: 0 },
});

// The collapsible banner, drawn with `AnatomySpecimen` so it takes the page's width. The chevron is a
// component the Icons page documents (`documents` there), so it is an `other` item and pin: numbered,
// shown by that page's title ("Animated chevron"), and opening the Icons page at its tile.
const anatomyPicture = (
  <AnatomySpecimen fill pins={<View style={[styles.pin, { top: 14 }]}><AnatomyPin other="AnimatedChevron" /></View>}>
    <Banner variant="neutral" title="Trip details" description="Board at the front car for a faster transfer at Union Sq." collapsible />
  </AnatomySpecimen>
);

export default defineCatalogPage({
  component: 'Banner',
  group: 'Components',
  anatomy: {
    picture: anatomyPicture,
    groups: [{ label: 'Components it uses', items: [{ other: 'AnimatedChevron', description: 'The chevron at the end of a collapsible banner\'s header; it flips as the body opens and closes.' }] }],
  },
  // Spans the screen: 'wide' keeps a 402px minimum, so two blocks never share a row and each
  // specimen keeps a width the component is actually used at.
  specimenSize: 'wide',
  composedOf: [
    { component: 'AnimatedChevron', role: "The expand/collapse chevron in the header of a collapsible banner.", relationship: 'built-in' },
  ],
  description: 'An inline callout for status/announcements — five semantic variants, optional collapsible body, inline link, and action button.',
  whenToUse: "Persistent and in-flow, describing a standing condition about the screen's content. For a transient, self-contained event notification, use Toast instead.",
  a11y: 'When onPress/action is set the header/button are Pressables; the collapsible header toggles the description with a chevron affordance.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'neutral', name: 'Neutral', props: { variant: 'neutral' }, node: <Banner variant="neutral" title="Schedule notice" description="Holiday schedule in effect Monday." /> },
      { key: 'info', name: 'Info', props: { variant: 'info' }, node: <Banner variant="info" title="Weekend service change" description="The 6 runs express in both directions this weekend." /> },
      { key: 'positive', name: 'Positive', props: { variant: 'positive' }, node: <Banner variant="positive" title="Service restored" description="All lines are running on a normal schedule." /> },
      { key: 'warning', name: 'Warning', props: { variant: 'warning' }, node: <Banner variant="warning" title="Delays" description="Signal problems near 14 St." /> },
      { key: 'negative', name: 'Negative', props: { variant: 'negative' }, node: <Banner variant="negative" title="Line suspended" description="No service between 96 St and 137 St until further notice." /> },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'tappable',
        name: 'Tappable',
        node: (
          <Banner
            variant="neutral"
            title="Alert preferences"
            description="Tap to manage which alerts you receive."
            onPress={() => {}}
          />
        ),
      },
      {
        key: 'collapsible-expanded',
        name: 'Collapsible (expanded)',
        node: (
          <Banner
            variant="neutral"
            title="Trip details"
            description="Board at the front car for a faster transfer at Union Sq."
            collapsible
          />
        ),
      },
      {
        key: 'collapsible-collapsed',
        name: 'Collapsible (collapsed)',
        node: (
          <Banner
            variant="neutral"
            title="Trip details"
            description="Board at the front car for a faster transfer at Union Sq."
            collapsible
            defaultExpanded={false}
          />
        ),
      },
      {
        key: 'action',
        name: 'With action',
        node: (
          <Banner
            variant="info"
            title="App update available"
            description="Version 4.2 adds live bus tracking."
            action={{ label: 'Update', onPress: () => {} }}
          />
        ),
      },
      {
        key: 'link',
        name: 'With link',
        node: (
          <Banner
            variant="neutral"
            title="Fare increase"
            description="New fares start March 1."
            link={{ label: 'Learn more', onPress: () => {} }}
          />
        ),
      },
    ],
  },
});
