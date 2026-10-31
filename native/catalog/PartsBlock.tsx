import React, { useId, useMemo } from 'react';
import { useMemberTitle } from './memberTitlesContext';
import { StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { hashForId } from './catalogNavigation';
import { referenceLinkProps, type ReferenceNavigation } from './catalogReferences';
import { OverviewCard, cardGrid } from './Overview';
import type { PartEntry } from './partsModel';
import { usePartNumbers } from './partNumbersContext';

/** The components a page is built from, as parts: a card for each entry that resolves to another
 *  page (the cards share one height and wrap), then a plain row for each that does not, so nothing
 *  declared is hidden. Renders nothing for no entries. A labelled region with its own heading. */
export function PartsBlock({ parts, navigation, title = 'Parts' }: { parts: readonly PartEntry[]; navigation?: ReferenceNavigation; title?: string }) {
  const headingId = useId();
  const numbers = usePartNumbers();
  const titleOf = useMemberTitle(navigation);
  // Resolved once per change of its inputs, not per render: the cards' page sources must stay the
  // same objects so a re-render does not re-run their live specimens.
  const { cards, plain } = useMemo(() => {
    // An entry resolving to a page that is not a component page is left out altogether.
    const counted = parts.filter((part) => {
      const target = navigation?.resolve(part.entry.component);
      return !target || (navigation?.isPart?.(target.pageId, target.memberId) ?? true);
    });
    const resolved = counted.map((part) => {
      const link = referenceLinkProps(navigation, part.entry.component, part.sourceMemberId);
      return { part, link, page: link && navigation?.page?.(link.pageId) };
    });
    return { cards: resolved.filter((item) => item.link), plain: resolved.filter((item) => !item.link) };
  }, [parts, navigation]);
  if (cards.length + plain.length === 0) return null;
  return (
    <View role="region" {...({ 'aria-labelledby': headingId } as Record<string, unknown>)} style={styles.block}>
      <Text nativeID={headingId} role="heading" {...({ 'aria-level': 2 } as Record<string, unknown>)} style={styles.heading}>{title}</Text>
      {cards.length > 0 && (
        <View role="list" style={cardGrid.list}>
          {cards.map(({ part, link, page }) => (
            <View key={part.entry.component} role="listitem" style={cardGrid.item}>
              <OverviewCard
                title={titleOf(part.entry.component) !== part.entry.component ? titleOf(part.entry.component) : page?.title ?? part.entry.component}
                number={numbers?.numberOf(part.entry.component)}
                caption={part.entry.role}
                source={page?.source}
                href={hashForId(link!.memberId ?? link!.pageId)}
                onPress={link!.onPress}
              />
            </View>
          ))}
        </View>
      )}
      {plain.length > 0 && (
        <View role="list" style={[styles.rows, cards.length > 0 && styles.rowsAfterCards]}>
          {plain.map(({ part }) => (
            <View key={part.entry.component} role="listitem" style={styles.row}>
              <Text style={styles.rowName}>{titleOf(part.entry.component)}</Text>
              <Text style={styles.rowRole}>{part.entry.role}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: CATALOG_LAYOUT.blockGap },
  heading: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text, marginBottom: CATALOG_SPACE.md },
  rows: { gap: CATALOG_SPACE.xs },
  rowsAfterCards: { marginTop: CATALOG_SPACE.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: CATALOG_SPACE.sm },
  rowName: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.text },
  rowRole: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
});
