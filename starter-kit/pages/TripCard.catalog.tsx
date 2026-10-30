import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, AnatomySpecimen, AnatomyPin } from '@krapwoo/ds-viewer';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY } from '../tokens';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  text: { flex: 1 },
  title: { ...DS_TYPOGRAPHY.labelMd, color: DS_SEMANTIC.text.regular },
  subtitle: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, marginTop: DS_SPACING[200] },
  // Pins sit in the column `AnatomySpecimen` hangs on the specimen's right edge: `right: 0`, and
  // `top` measured from the specimen's top. One per part, spaced so they never touch.
  pin: { position: 'absolute', right: 0 },
});

// The card, drawn once so the anatomy picture and the States specimens show the same thing.
function TripCardView({ status, label }: { status: 'positive' | 'warning' | 'negative'; label: string }) {
  return (
    <Card>
      <View style={styles.row}>
        <Avatar initials="JL" size={40} />
        <View style={styles.text}>
          <Text style={styles.title}>Uptown & The Bronx</Text>
          <Text style={styles.subtitle}>Next train in 4 min</Text>
        </View>
        <Badge variant={status} label={label} />
      </View>
    </Card>
  );
}

// The anatomy picture is the pattern itself, drawn with `AnatomySpecimen` so it takes the page's
// preview width and is centred like the variant cells (`fill`, because a card fills its cell). The
// pins go in `pins`, beside the specimen — not inside the card, and not on a wrapper of your own.
// The parts are real components the card builds, each with its own page, so they are `other` items
// and pins (numbered, with a small ↗, and linking to that page). Plain text is not a component, so
// the title and subtitle are not parts. Numbers follow the legend, which follows the card's
// left-to-right order: Avatar, then Badge.
const picture = (
  <AnatomySpecimen
    fill
    pins={(
      <>
        <View style={[styles.pin, { top: 4 }]}><AnatomyPin other="Avatar" /></View>
        <View style={[styles.pin, { top: 28 }]}><AnatomyPin other="Badge" /></View>
      </>
    )}
  >
    <TripCardView status="positive" label="On time" />
  </AnatomySpecimen>
);

// A family page with one member: the whole (the card). Its parts are other pages' components, named
// in the anatomy. The shadow and corner radius the Card applies are styles, not parts — they have no
// area of their own to point at, so they live on their own pages and are named in `relatedPages`.
export default defineCatalogPage({
  id: 'TripCard',
  group: 'Patterns',
  title: 'Trip card',
  description: 'A trip summarised on a Card: who or what it is for, the route and its next departure, and a status. Shows how to draw an anatomy picture the way the variant cells are drawn, with its pins beside it.',
  previewWidths: [360],
  whole: 'TripCard',
  anatomy: {
    picture: picture,
    groups: [
      {
        label: 'Components it uses',
        items: [
          { other: 'Avatar', description: 'The leading Avatar: the mode or the person the trip is for.' },
          { other: 'Badge', description: 'A Badge at the trailing edge; its variant says whether the trip is running to time.' },
        ],
      },
    ],
  },
  // No member of this page is a part: its parts are the Avatar and Badge pages' components, which are
  // named in the anatomy. A family still needs `sections`, so it is empty.
  sections: [],
  relatedPages: [
    { page: 'Shadow', note: "The card's resting shadow is a style the Card applies, not a part of this pattern." },
    { page: 'Radius', note: "So are its rounded corners." },
  ],
  members: [
    {
      id: 'TripCard',
      source: 'pages/TripCard.catalog.tsx',
      fidelity: 'documentation-only',
      relationship: 'Main pattern',
      description: 'A Card holding one row: an Avatar, a title with a subtitle, and a Badge.',
      states: {
        items: [
          { key: 'on-time', name: 'On time', node: <TripCardView status="positive" label="On time" /> },
          { key: 'delayed', name: 'Delayed', node: <TripCardView status="warning" label="Delayed" /> },
          { key: 'cancelled', name: 'Cancelled', node: <TripCardView status="negative" label="Cancelled" /> },
        ],
      },
    },
  ],
});
