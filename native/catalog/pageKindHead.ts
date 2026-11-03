import React from 'react';
import { StyleSheet, View } from 'react-native';
import { STYLE_BADGE_TITLE_OFFSET, StyleBadgeButton } from './PageKindBadge';
import { CATALOG_SPACE } from './tokens';

// The head pieces of a style page (`pageKind: 'style'`). Plain functions in a `.ts` module, so a
// catalog that documents the viewer's own `*.tsx` components lists one part here, `StyleBadgeButton`.

/** A page head's title row: the title's own heading node, with the "Style" badge beside it. The
 *  badge is a button that opens a popover explaining what a style is (the page's `styleNote` first, if any). The
 *  row aligns to the top and the badge's hit area is offset to centre on the title's first line
 *  (`STYLE_BADGE_TITLE_OFFSET`), so a title that wraps keeps it beside its first line. */
export function styleTitleRow(heading: React.ReactNode, note?: string): React.ReactElement {
  // The heading shrinks to the column and wraps its own words; left at its one-line width a long
  // title would run past the column with the badge beside it.
  return React.createElement(View, { style: styles.titleRow },
    React.createElement(View, { style: styles.titleCell }, heading),
    React.createElement(View, { style: styles.badgeCell }, React.createElement(StyleBadgeButton, { note })));
}

const styles = StyleSheet.create({
  // No wrap: the title wraps its own words inside its cell and the badge stays beside its first line,
  // instead of dropping to a line of its own under a long title.
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', columnGap: CATALOG_SPACE.sm },
  titleCell: { flexShrink: 1, minWidth: 0 },
  badgeCell: { flexShrink: 0, marginTop: STYLE_BADGE_TITLE_OFFSET },
});
