import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { ComparisonGrid } from './ComparisonGrid';
import { ComparisonList } from './ComparisonList';
import { ReferenceDetails } from './ReferenceDetails';
import { presentationBlocks, type PresentationBlock } from './comparison';
import type { SectionDef } from './types';

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

export interface SectionPager<TId extends string> {
  previousId: TId | null;
  nextId: TId | null;
  onNavigate: (id: TId) => void;
}

function PagerButton<TId extends string>({
  direction,
  targetId,
  onNavigate,
}: {
  direction: 'previous' | 'next';
  targetId: TId | null;
  onNavigate: (id: TId) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const disabled = targetId == null;
  const label = disabled
    ? direction === 'previous' ? 'No previous page' : 'No next page'
    : `${direction === 'previous' ? 'Previous' : 'Next'}: ${targetId}`;
  return (
    <Pressable
      onPress={() => {
        if (targetId != null) onNavigate(targetId);
      }}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pagerButton,
        !disabled && (pressed || hovered) && styles.pagerButtonActive,
        focused && styles.focusRing,
        disabled && styles.pagerButtonDisabled,
      ]}
    >
      <Text style={[styles.pagerGlyph, disabled && styles.pagerGlyphDisabled]}>{direction === 'previous' ? '←' : '→'}</Text>
    </Pressable>
  );
}

function BlockContent<TId extends string>({ block, def }: { block: PresentationBlock; def: SectionDef<TId> }) {
  switch (block.kind) {
    case 'grid':
      return <ComparisonGrid def={block.comparison} size={block.size} sectionId={def.id} />;
    case 'list':
      return <ComparisonList items={block.items} size={block.size} label={`${def.id}: ${block.title}`} />;
    case 'preview':
      return <View style={styles.previewCard}>{def.render?.()}</View>;
    default:
      return (
        <View style={styles.previewCard}>
          <Text style={styles.emptyText}>{block.message}</Text>
        </View>
      );
  }
}

/**
 * One catalog page: breadcrumb, title, description, previous/next, then one or two specimen
 * blocks (grid, list, or preview), then always-visible reference details (not for token
 * galleries). Works standalone without a pager inside a host page, as the framework catalog's
 * own SectionBlock demo does.
 */
export function SectionBlock<TId extends string>({
  def,
  groupLabel,
  breadcrumbRoot,
  pager,
  headingRef,
  headingLevel = 1,
}: {
  def: SectionDef<TId>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  headingLevel?: 1 | 2;
}) {
  checkCompleteness(def);
  const blocks = presentationBlocks(def);
  // react-native-web reads `aria-level`; React Native's prop types do not declare it.
  const headingLevelProps = { 'aria-level': headingLevel } as Record<string, unknown>;

  return (
    <View>
      {groupLabel && (
        <Text style={styles.breadcrumb}>{breadcrumbRoot ? `${breadcrumbRoot} / ${groupLabel}` : groupLabel}</Text>
      )}
      <View style={styles.titlebar}>
        <View style={styles.titleText}>
          {/* The focus target is the heading itself, so assistive tech announces its role and level. */}
          <View ref={headingRef} tabIndex={-1} role="heading" {...headingLevelProps} style={styles.headingTarget}>
            <Text style={styles.title}>{def.id}</Text>
          </View>
          <Text style={styles.desc}>{def.description}</Text>
        </View>
        {pager && (
          <View style={styles.pager}>
            <PagerButton direction="previous" targetId={pager.previousId} onNavigate={pager.onNavigate} />
            <PagerButton direction="next" targetId={pager.nextId} onNavigate={pager.onNavigate} />
          </View>
        )}
      </View>

      {blocks.map((block) => (
        <View key={block.title} style={styles.block}>
          <Text style={styles.blockLabel}>{block.title}</Text>
          <BlockContent block={block} def={def} />
        </View>
      ))}

      {!def.tokenGallery && <ReferenceDetails def={def} />}
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  titlebar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: CATALOG_SPACE.xl,
    marginTop: 14,
    marginBottom: CATALOG_SPACE.xl,
  },
  titleText: { flex: 1 },
  headingTarget: { alignSelf: 'flex-start' },
  title: { fontSize: CATALOG_TYPE.pageTitle, fontWeight: '700', color: CATALOG_COLOR.text, marginBottom: 5 },
  desc: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  pager: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  pagerButton: {
    width: CATALOG_LAYOUT.controlSize,
    height: CATALOG_LAYOUT.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  pagerButtonActive: { backgroundColor: CATALOG_COLOR.surfacePressed },
  pagerButtonDisabled: { backgroundColor: CATALOG_COLOR.pageBackground },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  pagerGlyph: { fontSize: CATALOG_TYPE.lg, color: CATALOG_COLOR.text },
  pagerGlyphDisabled: { color: CATALOG_COLOR.textMuted },
  block: { marginBottom: CATALOG_LAYOUT.blockGap },
  blockLabel: {
    fontSize: CATALOG_TYPE.sm,
    fontWeight: '700',
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginBottom: CATALOG_LAYOUT.blockLabelGap,
  },
  previewCard: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    padding: CATALOG_SPACE.xl,
    gap: CATALOG_SPACE.md,
  },
  emptyText: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
