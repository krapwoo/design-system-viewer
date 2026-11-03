import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TOKEN_LAYOUT_GAP } from './tokenLayout';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

// The pieces of a token page's layout that more than one component draws: a section (title and
// description outside, the section's own bordered box), sections one under another, and the row of
// chips above them. Plain functions in a `.ts` module, like `pageKindHead.ts`, so there is one
// definition of each and none of them is a component a catalog page has to document.

/** Marks the bordered box of a token section (`data-testid`), which `doctor --render` reads to tell a
 *  banner, filter chips or several groups drawn inside one box from the page-level layout. */
export const TOKEN_SECTION_BOX_ID = 'token-section-box';

/** One section of a token page: its uppercase title and description outside, then the section's own
 *  bordered box holding `children`. `TokenSections` draws every token section with it, and an
 *  `Inventory` draws every group with it, so the two are the same layout by construction. */
export function tokenSectionFrame({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }): React.ReactElement {
  return React.createElement(React.Fragment, null,
    React.createElement(Text, { style: styles.sectionLabel }, title),
    desc ? React.createElement(Text, { style: styles.sectionDesc }, desc) : null,
    React.createElement(View, { testID: TOKEN_SECTION_BOX_ID, style: styles.card }, children));
}

/** Sections one under another, with the gap `TokenSections` leaves between its rows. That is
 *  `TOKEN_LAYOUT_GAP` (20px) in the browser: `TokenSections` also sets `rowGap: blockGap`, but its `gap`
 *  shorthand is the rule that applies, so this takes the same value rather than the 28px the style
 *  names. A test pins that the two agree. */
export function tokenSectionStack(children: React.ReactNode): React.ReactElement {
  return React.createElement(View, { style: styles.stack }, children);
}

/** The row the chips sit in: the position, wrap, gap and space below of a token page's jump row. An
 *  `Inventory` at page level draws its filter chips in it too, so the two rows match. */
export function chipRow(props: Record<string, unknown>, children: React.ReactNode): React.ReactElement {
  return React.createElement(View, { ...props, style: styles.chipRow }, children);
}

export const styles = StyleSheet.create({
  stack: { gap: TOKEN_LAYOUT_GAP },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.sm, marginBottom: CATALOG_LAYOUT.blockLabelGap },
  sectionLabel: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text },
  sectionDesc: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginTop: CATALOG_SPACE.xs },
  card: {
    marginTop: CATALOG_LAYOUT.blockLabelGap,
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    padding: CATALOG_SPACE.xl,
    gap: CATALOG_SPACE.md,
  },
});
