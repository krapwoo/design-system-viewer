import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS } from './tokens';
import { PropsTable } from './PropsTable';
import type { SectionDef, VariantSlot } from './types';

const COLUMN_WIDTH = 512;
// The combined Props+Accessibility column carries far more content than a Variants/States column
// (a full prop table plus a11y notes vs. a handful of example instances) — it gets a bigger flex
// share AND a bigger cap so it doesn't end up as cramped as its siblings on a wide viewport.
const PROPS_COLUMN_WIDTH = 640;
const PROPS_COLUMN_FLEX = 1.4;
// Shared by the horizontal gap between columns AND the vertical gap between Props and Accessibility
// within the third column — one constant so the two can't drift apart.
const COLUMN_GAP = CATALOG_SPACE['2xl'];

/** One labeled block (a block label + a card) inside a column. */
interface BlockDef {
  label: string;
  content: React.ReactNode;
}

/** A `VariantSlot`'s items, stacked/centered (or left-aligned, or filled full-width) per its own
 *  `align`/`itemsFill`. Every item is captioned with its own `name` (e.g. "Primary", "Icon-only")
 *  so it's clear which variant/state each instance demonstrates — not just a bare, unlabeled row of
 *  look-alike components. An individual item's own `fill` stretches just that item's wrapper to the
 *  row's full width — independent of `itemsFill` — so a single wide-format instance (e.g. a
 *  `fullWidth` Button) can sit among otherwise-compact, centered siblings. */
function SlotItems({ slot }: { slot: VariantSlot }) {
  return (
    <View
      style={[
        slot.itemsFill ? styles.exampleStackFill : styles.exampleStack,
        slot.align === 'left' && styles.exampleStackLeft,
      ]}
    >
      {slot.items.map((item) => (
        <View key={item.key} style={[styles.exampleItem, item.fill && styles.exampleItemFill]}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.node}
        </View>
      ))}
    </View>
  );
}

function EmptyText({ children }: { children: string }) {
  return <Text style={styles.emptyText}>{children}</Text>;
}

// Matches a quoted-string-literal union type, e.g. "'primary' | 'secondary' | 'tertiary'" — anything
// else (string, boolean, IconName, () => void, …) has no fixed enum to sweep and is skipped.
const STRING_LITERAL_RE = /'([^']+)'/g;

/** Opt-in completeness check (rule 4 of the policy documented on `SectionDef.states`): once a
 *  section has at least one `VariantExample.props`-tagged item, warn about any enum value from
 *  `def.props` that no tagged item (across Variants + States) actually demonstrates. Sections that
 *  haven't started tagging are skipped entirely — annotating is gradual, not all-or-nothing. */
function checkCompleteness<TId extends string>(def: SectionDef<TId>): void {
  if (!def.props) return;
  const items = [...(def.variants?.items ?? []), ...(def.states?.items ?? [])];
  const tagged = items.filter((item) => item.props);
  if (tagged.length === 0) return;

  for (const prop of def.props) {
    const literals = prop.type.match(STRING_LITERAL_RE);
    if (!literals || literals.length < 2) continue; // not a multi-value enum
    const values = literals.map((s) => s.slice(1, -1));
    const covered = new Set(
      tagged
        .map((item) => item.props?.[prop.name])
        .filter((v): v is string => typeof v === 'string'),
    );
    const missing = values.filter((v) => !covered.has(v));
    if (missing.length > 0) {
      console.warn(
        `[Catalog] ${def.id}: prop "${prop.name}" has no tagged example for value(s) ${missing.map((v) => `"${v}"`).join(', ')} — ` +
          `add { props: { ${prop.name}: '${missing[0]}' } } to whichever VariantExample already demonstrates it, or add a new one.`,
      );
    }
  }
}

/** Lays out one column's blocks, stacked with `COLUMN_GAP` between them. The LAST block gets
 *  `flex: 1` so its card grows to fill any extra height flexbox's default `alignItems: 'stretch'`
 *  already gave this column (to match whichever sibling column is tallest) — that's what makes
 *  every column's bottom edge land flush, with no JS height measurement. `fill` drops the normal
 *  512px cap so a lone column (the `tokenGallery` case) spans the full row instead of sitting at a
 *  fixed width meant for sharing space with siblings that, here, don't exist. */
function Column({ blocks, fill, wide }: { blocks: BlockDef[]; fill?: boolean; wide?: boolean }) {
  return (
    <View style={fill ? styles.columnFull : wide ? styles.columnWide : styles.column}>
      {blocks.map((block, i) => {
        const isLast = i === blocks.length - 1;
        return (
          <View key={i} style={isLast && styles.blockFill}>
            <Text style={styles.blockLabel}>{block.label}</Text>
            <View style={[styles.card, isLast && styles.cardFill]}>{block.content}</View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One documented component or token group: an optional group heading (pass `groupLabel` on every
 * section in a sidebar group — not just the first — so each component's category is visible on its
 * own, without having to scroll up to find the nearest heading above it), then title, description,
 * an optional "VS" disambiguation note (`def.whenToUse` — the deciding question against this
 * component's closest look-alike, e.g. InputField vs SearchField), file path, then either —
 *   • a token-gallery section (`def.tokenGallery`): a single "Tokens" column, since there's no
 *     component API (no states/props/accessibility) to document; or
 *   • a component section: by default, a row of three 512px columns — Variants, States /
 *     Configurations, and a combined Props+Accessibility column — always in that order. A column
 *     with nothing to show (no `variants`/`states`/`props`/`a11y`) still renders, with a plain
 *     sentence saying so, rather than the layout silently reshaping itself per section. Pass
 *     `def.hide` to genuinely remove specific cards instead (not just blank them out) — e.g. a
 *     catalog whose sections have no meaningful states/props/accessibility story. Whichever columns
 *     remain share the row; if hiding leaves exactly one standing, it fills the whole row, the same
 *     way a `tokenGallery` section does.
 * Whichever column is tallest sets the row's height (flexbox's default `alignItems: 'stretch'`), and
 * every other column's last card grows to fill the rest, so the row's bottom edge lands flush.
 */
export function SectionBlock<TId extends string>({ def, groupLabel }: { def: SectionDef<TId>; groupLabel?: string }) {
  checkCompleteness(def);
  const hide = def.hide ?? {};

  const variantsContent = def.variants ? (
    <SlotItems slot={def.variants} />
  ) : def.render ? (
    def.render()
  ) : (
    <EmptyText>No variants documented.</EmptyText>
  );

  const header = (
    <>
      {groupLabel && <Text style={styles.groupHeading}>{groupLabel}</Text>}
      <Text style={styles.title}>{def.id}</Text>
      <Text style={styles.desc}>{def.description}</Text>
      {def.whenToUse && (
        <View style={styles.whenToUse}>
          <Text style={styles.whenToUseTag}>VS</Text>
          <Text style={styles.whenToUseText}>{def.whenToUse}</Text>
        </View>
      )}
      <Text style={styles.path}>{def.path}</Text>
    </>
  );

  if (def.tokenGallery) {
    return (
      <View style={styles.section}>
        {header}
        <View style={styles.columnsRow}>
          <Column blocks={[{ label: def.fullWidthLabel ?? 'Tokens', content: variantsContent }]} fill />
        </View>
      </View>
    );
  }

  const statesContent = def.states ? (
    <SlotItems slot={def.states} />
  ) : (
    <EmptyText>No additional states or configurations documented.</EmptyText>
  );

  const propsContent =
    def.props && def.props.length > 0 ? (
      <PropsTable props={def.props} />
    ) : (
      <EmptyText>This component takes no props.</EmptyText>
    );

  const a11yContent = def.a11y ? (
    <Text style={styles.a11yText}>{def.a11y}</Text>
  ) : (
    <EmptyText>No accessibility notes documented.</EmptyText>
  );

  const propsA11yBlocks: BlockDef[] = [
    ...(hide.props ? [] : [{ label: 'Props', content: propsContent }]),
    ...(hide.accessibility ? [] : [{ label: 'Accessibility', content: a11yContent }]),
  ];

  const columns: { blocks: BlockDef[]; wide?: boolean }[] = [
    ...(hide.variants ? [] : [{ blocks: [{ label: 'Variants', content: variantsContent }] }]),
    ...(hide.states ? [] : [{ blocks: [{ label: 'States / Configurations', content: statesContent }] }]),
    ...(propsA11yBlocks.length > 0 ? [{ blocks: propsA11yBlocks, wide: true }] : []),
  ];

  return (
    <View style={styles.section}>
      {header}
      {columns.length > 0 && (
        <View style={styles.columnsRow}>
          {columns.map((col) => (
            <Column key={col.blocks[0].label} blocks={col.blocks} fill={columns.length === 1} wide={col.wide} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingBottom: CATALOG_SPACE.sm },
  groupHeading: {
    fontSize: CATALOG_TYPE.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7,
    color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.xl,
  },
  title: { fontSize: CATALOG_TYPE['2xl'], fontWeight: '700', color: CATALOG_COLOR.text, marginBottom: CATALOG_SPACE.xs },
  desc: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, lineHeight: 18, marginBottom: CATALOG_SPACE.sm },
  path: {
    // Text is a flex child of `section` (a column, default `alignItems: 'stretch'`) — without this,
    // the chip's background would stretch to the section's full width instead of hugging its text.
    alignSelf: 'flex-start',
    fontSize: CATALOG_TYPE.sm, fontFamily: CATALOG_COLOR.code, color: CATALOG_COLOR.textMuted,
    backgroundColor: CATALOG_COLOR.chip, paddingHorizontal: CATALOG_SPACE.sm, paddingVertical: CATALOG_SPACE.xs,
    borderRadius: 6, overflow: 'hidden', marginBottom: COLUMN_GAP,
  },
  // "VS" disambiguation note — a small accent-coloured tag + sentence, distinct from the plain
  // description above it so it reads as "here's the one deciding fact", not more prose to skim past.
  whenToUse: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: CATALOG_SPACE.sm,
    marginBottom: CATALOG_SPACE.sm,
  },
  whenToUseTag: {
    fontSize: CATALOG_TYPE.xs, fontWeight: '800', color: CATALOG_COLOR.accent,
    borderWidth: 1, borderColor: CATALOG_COLOR.accent, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, marginTop: 1,
  },
  whenToUseText: {
    flex: 1, fontSize: CATALOG_TYPE.sm, lineHeight: 18, color: CATALOG_COLOR.text,
  },
  columnsRow: { flexDirection: 'row', gap: COLUMN_GAP },
  // Fixed 512px, shrinking below it (not growing past it) when the viewport can't fit 3 columns —
  // same mechanism the two-column layout used before the columns briefly filled the full page width.
  column: { flex: 1, maxWidth: COLUMN_WIDTH, gap: COLUMN_GAP },
  // Props+Accessibility column — a bigger flex share (not just a bigger cap) so it actually claims
  // more of the row's width even when no column is anywhere near hitting its maxWidth.
  columnWide: { flex: PROPS_COLUMN_FLEX, maxWidth: PROPS_COLUMN_WIDTH, gap: COLUMN_GAP },
  // No maxWidth — for a lone column (`tokenGallery`) with no siblings to share the row with, so its
  // card spans however much width `columnsRow` actually has (bounded only by the host page's own
  // container, e.g. CatalogShell's CATALOG_MAX_CONTENT_WIDTH).
  columnFull: { flex: 1, gap: COLUMN_GAP },
  // Only applied to a column's LAST block — grows to absorb whatever extra height `columnsRow`'s
  // stretch gave this column, so its card's bottom edge reaches the column's bottom.
  blockFill: { flex: 1 },
  cardFill: { flex: 1, justifyContent: 'center' },
  blockLabel: {
    fontSize: CATALOG_TYPE.xs, fontWeight: '700', color: CATALOG_COLOR.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: CATALOG_SPACE.sm,
  },
  card: {
    backgroundColor: CATALOG_COLOR.surfaceMuted,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.border,
    borderRadius: CATALOG_RADIUS.md,
    // Every card in every section, in both catalogs — Variants/States/Props/Accessibility/Tokens —
    // shares this one padding value, since they all render through this single Column/card path.
    padding: CATALOG_SPACE.xl,
    // Guarantees breathing room between whatever a card holds (multiple examples, prop rows, …)
    // at the SectionBlock level, so a SectionDef's render() doesn't have to remember its own gap.
    gap: CATALOG_SPACE.md,
  },
  a11yText: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, lineHeight: 18 },
  emptyText: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, fontStyle: 'italic' },
  // Layout for a slot's items: vertical, centered, at least 24px apart — for small instances meant
  // to sit as compact items (Button, Badge, Pill).
  exampleStack: { alignItems: 'center', gap: CATALOG_SPACE.xl },
  // Same, but each item stretches to the card's full width (flexbox's default `alignItems: 'stretch'`
  // — no override needed) — for wide block-level components (Banner, Card, Toast, InputField).
  exampleStackFill: { gap: CATALOG_SPACE.xl },
  exampleStackLeft: { alignItems: 'flex-start' },
  // One item + its name caption, stacked tightly and centered under the item. 6px sits between
  // CATALOG_SPACE.xs (4) and .sm (8) — no scale step lands on it, so it's a literal value here.
  exampleItem: { alignItems: 'center', gap: 6 },
  // Per-item override (VariantExample.fill) — `alignSelf` always wins over the parent's `alignItems`
  // regardless of whether that parent is a centered `exampleStack` or an already-stretched
  // `exampleStackFill`, so this works the same in either slot.
  exampleItemFill: { alignSelf: 'stretch' },
  itemName: { fontSize: CATALOG_TYPE.xs, color: CATALOG_COLOR.textMuted },
});
