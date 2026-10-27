import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, Platform, StyleSheet, type TextStyle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { TokenGrid, TokenTile, TokenSections } from './TokenLayouts';
import { TokenRow, TokenRowGroup } from './TokenRow';
import { Swatch } from './Swatch';
import { MotionSpecimen } from './MotionSpecimen';
import { JumpRow, type JumpItem } from './JumpRow';
import {
  consolidatedProvenanceCaption,
  isTokenKind,
  filteredKindEntriesFromList,
  pairLightDarkColorEntries,
  pairRendersAsOneSwatch,
  sectionEntryCount,
  tokenProvenanceCaption,
  validateTokenDefinition,
  type ColorTokenEntry,
  type DimensionsTokenEntry,
  type MotionTokenEntry,
  type OpacityTokenEntry,
  type RadiusTokenEntry,
  type ShadowTokenEntry,
  type SpacingTokenEntry,
  type TokenDefinition,
  type TokenDefinitionSection,
  type TokenEntry,
  type TokenEntryBase,
  type TokenKind,
  type TokenValueInfo,
  type TypographyTokenEntry,
} from './tokenDefinition';
import type { TokenSection } from './types';

/** `role`/`note`/`source` consolidated into one plain-text caption — the same single-line
 *  "usage · citation" convention `token-contract.md`'s own consumer references already use
 *  (`describeUsage(rows)` + a compact citation). Never a status badge (design R2: "no repetitive
 *  new status badges"); `undefined` when the entry authored none of the three. */
function entryNote(entry: Pick<TokenEntryBase, 'role' | 'note' | 'source'>): string | undefined {
  const parts = [entry.note ?? entry.role, entry.source].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** Correction C1: a value's own provenance/named line, plain muted caption text — never truncated
 *  (no `numberOfLines`), so a long expression/reason always wraps. */
function ProvenanceLine({ value }: { value: Pick<TokenValueInfo<unknown>, 'provenance' | 'named'> }) {
  return <Text style={styles.provenanceLine}>{tokenProvenanceCaption(value)}</Text>;
}

/** Correction C1: an unresolved value's real `reason`, and its real `expression` when one exists
 *  (monospace — `CATALOG_TEXT.codeMicro` — since that mono role already exists in this catalog).
 *  Never a fabricated classification; never truncated. */
function UnresolvedCaption({ resolution }: { resolution: { reason: string; expression?: string } }) {
  return (
    <>
      <Text style={styles.fallbackDetail}>{resolution.reason}</Text>
      {resolution.expression ? <Text style={styles.monoNote}>{resolution.expression}</Text> : null}
    </>
  );
}

/** Correction C1 for the four kinds built on `TokenTile` (spacing/radius/dimensions/opacity/
 *  shadows): `TokenTile` only has one `note` slot, so this composes `role`/`note`/`source`, the
 *  provenance/named line (when not already shown once at the section level) and — for an
 *  unresolved value — its real `expression` (monospace) into that one slot, newline-separated.
 *  `undefined` (never an empty node) when there is nothing to show, so `TokenTile`'s own `{note ?
 *  ... : null}` check still works unchanged. */
function tileProvenanceNote(entry: TokenEntryBase, value: TokenValueInfo<unknown>, showProvenance: boolean): React.ReactNode {
  const parts: string[] = [];
  const base = entryNote(entry);
  if (base) parts.push(base);
  if (showProvenance) parts.push(tokenProvenanceCaption(value));
  const expression = value.resolution.status === 'unresolved' ? value.resolution.expression : undefined;
  if (parts.length === 0 && !expression) return undefined;
  return (
    <>
      {parts.join('\n')}
      {expression ? <Text style={styles.monoNote}>{parts.length > 0 ? `\n${expression}` : expression}</Text> : null}
    </>
  );
}

function filteredKindEntries(kind: TokenKind, section: TokenDefinitionSection): TokenEntry[] {
  return filteredKindEntriesFromList(kind, section.entries);
}

/** Visible diagnostic for invalid opted-in data (design R3: "never a plausible fake specimen or
 *  silently render nothing") — a real, legible error, styled the same as the update page's own
 *  failure note-boxes (`UpdatePanel.tsx`'s `err`/`resultNoteErr`). */
function IssuesBanner({ issues }: { issues: readonly string[] }) {
  return (
    <View style={styles.issuesBox}>
      <Text style={styles.issuesTitle}>Invalid token data</Text>
      {issues.map((issueText, i) => (
        <Text key={i} style={styles.issuesText}>{issueText}</Text>
      ))}
    </View>
  );
}

/** One width for drawable and "No sample" color cells, so a section's row reads as one grid. */
const COLOR_CELL_WIDTH = 120;

function ColorEntryCell({ entry, showProvenance }: { entry: ColorTokenEntry; showProvenance: boolean }) {
  const note = entryNote(entry);
  const name = entry.appearance ? `${entry.name} (${entry.appearance})` : entry.name;
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <View style={styles.colorFallback}>
        <View style={styles.noSamplePreview}><Text style={styles.noSampleText}>No sample</Text></View>
        <Text style={styles.fallbackName}>{name}</Text>
        {showProvenance ? <ProvenanceLine value={entry.value} /> : null}
        <UnresolvedCaption resolution={entry.value.resolution} />
        {note ? <Text style={styles.fallbackNote}>{note}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.colorCell}>
      <Swatch name={name} value={entry.value.resolution.value.color} width={COLOR_CELL_WIDTH} wrapName />
      {showProvenance ? <ProvenanceLine value={entry.value} /> : null}
      {note ? <Text style={styles.swatchNote}>{note}</Text> : null}
    </View>
  );
}

/** #64 B3: a light/dark pair, one swatch — a split chip (light half left, dark half right), the
 *  bare shared `name`, and `<light value> · <dark value>` as the value line. Only ever called with
 *  a pair whose both sides are resolved (`ColorEntries` falls back to two plain cells otherwise —
 *  a split chip with no real colour to show on one side would misrepresent the data). */
function PairedColorCell({ name, light, dark, showProvenance }: { name: string; light: ColorTokenEntry; dark: ColorTokenEntry; showProvenance: boolean }) {
  const lightColor = (light.value.resolution as { status: 'resolved'; value: { color: string } }).value.color;
  const darkColor = (dark.value.resolution as { status: 'resolved'; value: { color: string } }).value.color;
  const note = entryNote(light) ?? entryNote(dark);
  return (
    <View style={styles.colorCell}>
      <Swatch name={name} value={lightColor} splitValue={darkColor} valueLabel={`${lightColor} · ${darkColor}`} width={COLOR_CELL_WIDTH} wrapName />
      {showProvenance ? <ProvenanceLine value={light.value} /> : null}
      {note ? <Text style={styles.swatchNote}>{note}</Text> : null}
    </View>
  );
}

function ColorEntries({ entries, showProvenance }: { entries: ColorTokenEntry[]; showProvenance: boolean }) {
  const paired = pairLightDarkColorEntries(entries);
  return (
    <View style={styles.wrapRow}>
      {paired.map((item) => {
        if (item.kind === 'single') return <ColorEntryCell key={item.entry.id} entry={item.entry} showProvenance={showProvenance} />;
        const { light, dark } = item;
        // A pair whose light or dark side has no real drawable value (unresolved) can't render a
        // meaningful split chip — fall back to each entry's own normal (unpaired-style) cell.
        if (!pairRendersAsOneSwatch(light, dark)) {
          return (
            <React.Fragment key={`${light.id}-${dark.id}`}>
              <ColorEntryCell entry={light} showProvenance={showProvenance} />
              <ColorEntryCell entry={dark} showProvenance={showProvenance} />
            </React.Fragment>
          );
        }
        return <PairedColorCell key={`${light.id}-${dark.id}`} name={item.name} light={light} dark={dark} showProvenance={showProvenance} />;
      })}
    </View>
  );
}

function TypographyRow({ entry, last, showProvenance }: { entry: TypographyTokenEntry; last: boolean; showProvenance: boolean }) {
  const base = entryNote(entry) ?? entry.name;
  const provenanceSuffix = showProvenance ? ` · ${tokenProvenanceCaption(entry.value)}` : '';
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenRow use={`${base}${provenanceSuffix}`} last={last} notePlacement="right">
        <View style={styles.unresolvedStack}>
          <Text style={styles.unresolvedText}>{entry.value.resolution.reason}</Text>
          {entry.value.resolution.expression ? <Text style={styles.unresolvedExpression}>{entry.value.resolution.expression}</Text> : null}
        </View>
      </TokenRow>
    );
  }
  const value = entry.value.resolution.value;
  const meta = `${value.fontSize}${value.fontSizeUnit}${value.fontWeight !== undefined ? `/${value.fontWeight}` : ''}`;
  // The sample is drawn with the token's own authored text-style values, passed through unchanged
  // like TypeScaleGallery's author-supplied `sampleStyle` — data, not catalog chrome. The unit label
  // stays out of the style. The cast covers React Native's closed `fontWeight` union for a real
  // authored weight such as a numeric 600.
  const { fontSizeUnit: _unit, ...authoredTextStyle } = value;
  return (
    <TokenRow use={`${base} · ${meta}${provenanceSuffix}`} last={last} notePlacement="right">
      <Text
        style={[styles.typographySample, authoredTextStyle as TextStyle]}
        numberOfLines={1}
      >
        {entry.name}
      </Text>
    </TokenRow>
  );
}

function TypographyEntries({ entries, showProvenance }: { entries: TypographyTokenEntry[]; showProvenance: boolean }) {
  return (
    <TokenRowGroup>
      <View style={styles.rowStack}>
        {entries.map((entry, i) => <TypographyRow key={entry.id} entry={entry} last={i === entries.length - 1} showProvenance={showProvenance} />)}
      </View>
    </TokenRowGroup>
  );
}

type DimensionLikeEntry = SpacingTokenEntry | RadiusTokenEntry | DimensionsTokenEntry;

function DimensionTile({ kind, entry, showProvenance }: { kind: 'spacing' | 'radius' | 'dimensions'; entry: DimensionLikeEntry; showProvenance: boolean }) {
  const note = tileProvenanceNote(entry, entry.value, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenTile name={entry.name} value={entry.value.resolution.reason} note={note}>
        <Text style={styles.dash}>—</Text>
      </TokenTile>
    );
  }
  const { amount, unit } = entry.value.resolution.value;
  if (kind === 'radius') {
    return (
      <TokenTile name={entry.name} value={`${amount}${unit}`} note={note}>
        <View style={[styles.radiusSample, { borderRadius: Math.min(Math.max(amount, 0), 28) }]} />
      </TokenTile>
    );
  }
  return (
    <TokenTile name={entry.name} value={`${amount}${unit}`} note={note}>
      <View style={[styles.spacingBar, { width: Math.min(Math.max(amount, 1), 120) }]} />
    </TokenTile>
  );
}

function DimensionEntries({ kind, entries, showProvenance }: { kind: 'spacing' | 'radius' | 'dimensions'; entries: DimensionLikeEntry[]; showProvenance: boolean }) {
  return <TokenGrid minTileWidth={140}>{entries.map((entry) => <DimensionTile key={entry.id} kind={kind} entry={entry} showProvenance={showProvenance} />)}</TokenGrid>;
}

function OpacityTile({ entry, showProvenance }: { entry: OpacityTokenEntry; showProvenance: boolean }) {
  const note = tileProvenanceNote(entry, entry.value, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenTile name={entry.name} value={entry.value.resolution.reason} note={note}>
        <Text style={styles.dash}>—</Text>
      </TokenTile>
    );
  }
  const { amount } = entry.value.resolution.value;
  return (
    <TokenTile name={entry.name} value={`${Math.round(amount * 100)}%`} note={note}>
      <View style={styles.opacityBase}>
        <View style={[styles.opacityFill, { opacity: amount }]} />
      </View>
    </TokenTile>
  );
}

function OpacityEntries({ entries, showProvenance }: { entries: OpacityTokenEntry[]; showProvenance: boolean }) {
  return <TokenGrid minTileWidth={120}>{entries.map((entry) => <OpacityTile key={entry.id} entry={entry} showProvenance={showProvenance} />)}</TokenGrid>;
}

/** Same literal `.shadow(color:radius:x:y:)` preview `token-contract.md`'s own Shadow consumer
 *  reference already draws — a real box at the entry's own radius/offset/opacity. */
function ShadowTile({ entry, showProvenance }: { entry: ShadowTokenEntry; showProvenance: boolean }) {
  const note = tileProvenanceNote(entry, entry.value, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenTile name={entry.name} value={entry.value.resolution.reason} note={note}>
        <Text style={styles.dash}>—</Text>
      </TokenTile>
    );
  }
  const { color, opacity, radius, x, y } = entry.value.resolution.value;
  return (
    <TokenTile
      name={entry.name}
      value={`y ${y}${x !== 0 ? ` · x ${x}` : ''} · ${Math.round(opacity * 100)}% ${color}`}
      note={note}
    >
      <View
        style={[
          styles.shadowSample,
          { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: x, height: y }, elevation: Math.max(1, Math.round(radius / 2)) },
        ]}
      />
    </TokenTile>
  );
}

function ShadowEntries({ entries, showProvenance }: { entries: ShadowTokenEntry[]; showProvenance: boolean }) {
  return <TokenGrid minTileWidth={160}>{entries.map((entry) => <ShadowTile key={entry.id} entry={entry} showProvenance={showProvenance} />)}</TokenGrid>;
}

/** A real timing/spring value is replayed with `MotionSpecimen`; a real native expression that
 *  isn't replayable as that physics model (SwiftUI duration/bounce, response/dampingFraction) is
 *  shown as its own text, never a guessed conversion (`MotionNativeExpressionValue`'s own doc
 *  comment, `tokenDefinition.ts`) — that label names a true property of the type, unlike the
 *  removed "symbolic / conditional" classification below (correction C2: an unresolved value shows
 *  only its real provenance/reason/expression, never an invented category). */
function MotionCell({ entry, showProvenance }: { entry: MotionTokenEntry; showProvenance: boolean }) {
  const note = entryNote(entry);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <View style={styles.motionCell}>
        {showProvenance ? <ProvenanceLine value={entry.value} /> : null}
        <UnresolvedCaption resolution={entry.value.resolution} />
        {note ? <Text style={styles.motionNote}>{note}</Text> : null}
      </View>
    );
  }
  const value = entry.value.resolution.value;
  if (value.kind === 'timing') {
    return (
      <View style={styles.motionCell}>
        <MotionSpecimen kind="timing" duration={value.durationMs} label={`${value.sourceValue}${value.sourceUnit}`} />
        {showProvenance ? <ProvenanceLine value={entry.value} /> : null}
        {note ? <Text style={styles.motionNote}>{note}</Text> : null}
      </View>
    );
  }
  if (value.kind === 'spring') {
    return (
      <View style={styles.motionCell}>
        <MotionSpecimen
          kind="spring"
          spring={{ stiffness: value.stiffness, damping: value.damping, mass: value.mass }}
          valueRange={value.valueRange}
          label={entry.name}
        />
        {showProvenance ? <ProvenanceLine value={entry.value} /> : null}
        {note ? <Text style={styles.motionNote}>{note}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.motionCell}>
      <Text style={styles.motionLabel}>native expression (not replayable as physics)</Text>
      <Text style={styles.motionDetail}>{value.expression}</Text>
      {value.detail ? <Text style={styles.motionDetail}>{value.detail}</Text> : null}
      {showProvenance ? <ProvenanceLine value={entry.value} /> : null}
      {note ? <Text style={styles.motionNote}>{note}</Text> : null}
    </View>
  );
}

function MotionEntries({ entries, showProvenance }: { entries: MotionTokenEntry[]; showProvenance: boolean }) {
  return <View style={styles.wrapRow}>{entries.map((entry) => <MotionCell key={entry.id} entry={entry} showProvenance={showProvenance} />)}</View>;
}

/** One entries list's real body, dispatched by the page's own `kind` — shared by a section's own
 *  entries and, #64 B1, each of its groups' own entries, so both render through the exact same
 *  per-kind grammar. */
function renderKindEntries(kind: TokenKind, entries: TokenEntry[], showProvenance: boolean): React.ReactNode {
  switch (kind) {
    case 'colors':
      return <ColorEntries entries={entries as ColorTokenEntry[]} showProvenance={showProvenance} />;
    case 'typography':
      return <TypographyEntries entries={entries as TypographyTokenEntry[]} showProvenance={showProvenance} />;
    case 'spacing':
    case 'radius':
    case 'dimensions':
      return <DimensionEntries kind={kind} entries={entries as DimensionLikeEntry[]} showProvenance={showProvenance} />;
    case 'opacity':
      return <OpacityEntries entries={entries as OpacityTokenEntry[]} showProvenance={showProvenance} />;
    case 'shadows':
      return <ShadowEntries entries={entries as ShadowTokenEntry[]} showProvenance={showProvenance} />;
    case 'motion':
      return <MotionEntries entries={entries as MotionTokenEntry[]} showProvenance={showProvenance} />;
    default:
      return null;
  }
}

/** One section's real entries, dispatched by the page's own `kind` — an entry whose own `kind`
 *  doesn't match (already reported by `validateTokenDefinition`) or whose `id` repeats another
 *  entry already rendered in this section (same) is skipped here rather than rendered twice or
 *  rendered as if it were a different kind. Correction C1: when every rendered entry shares the
 *  same provenance+named pair, it is shown once as a leading section-level caption instead of
 *  repeating it on each entry below — #64 B1 extends that same consolidation across the section's
 *  own entries AND every one of its groups, which then each render under their own sub-heading,
 *  after the section's own entries, in the same grid grammar. */
function StructuredTokenSectionBody({ kind, section }: { kind: TokenKind; section: TokenDefinitionSection }) {
  const ownEntries = filteredKindEntries(kind, section);
  const groups = (section.groups ?? []).map((group) => ({ group, entries: filteredKindEntriesFromList(kind, group.entries) }));
  const consolidated = consolidatedProvenanceCaption([...ownEntries, ...groups.flatMap((g) => g.entries)]);
  const showProvenance = consolidated === undefined;
  return (
    <>
      {consolidated ? <Text style={styles.sectionProvenance}>{consolidated}</Text> : null}
      {ownEntries.length > 0 ? renderKindEntries(kind, ownEntries, showProvenance) : null}
      {groups.map(({ group, entries }) => (
        <View key={group.id} style={styles.groupBlock}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.desc ? <Text style={styles.groupDesc}>{group.desc}</Text> : null}
          {renderKindEntries(kind, entries, showProvenance)}
        </View>
      ))}
    </>
  );
}

/** The real `TokenSection[]` for `tokenDefinition` — called only from `SectionBlock.tsx`'s own
 *  `tokenSections` block case (the existing JSX rendering boundary), never from `pageApi.ts` (a
 *  plain-TS module the Node `--experimental-strip-types` test runner must keep importing without a
 *  JSX transform). An unknown `kind` renders the clearly-labeled diagnostic card alone, since no
 *  renderer can dispatch on it. Any issue `validateTokenDefinition` finds for a valid kind (a
 *  duplicate section/entry id, a mismatched entry kind) renders that card plus every section's
 *  real, valid entries — never a fake specimen or nothing. */
export function tokenDefinitionSections(definition: TokenDefinition): TokenSection[] {
  if (!isTokenKind(definition.kind)) {
    return [{ id: '__token-definition-issues__', title: 'Invalid token data', wide: true, render: () => <IssuesBanner issues={[`tokenDefinition: unknown kind "${definition.kind}".`]} /> }];
  }
  const issues = validateTokenDefinition(definition);
  const sections: TokenSection[] = definition.sections.map((section) => ({
    id: section.id,
    title: section.title,
    desc: section.desc,
    wide: section.wide,
    render: () => <StructuredTokenSectionBody kind={definition.kind} section={section} />,
  }));
  if (issues.length === 0) return sections;
  return [{ id: '__token-definition-issues__', title: 'Invalid token data', wide: true, render: () => <IssuesBanner issues={issues} /> }, ...sections];
}

/** #64 B2/B5: scrolls a section's own node into view — the same instant, web-only
 *  `scrollIntoView` convention `FamilyPage.tsx`'s own `scrollAndFocusMember` already established
 *  for a member address; this is its section-level counterpart (no focus steal — a chip press or a
 *  section-alias arrival moves the viewport, not keyboard focus, since nothing here is itself a
 *  landable heading). Native has no scroll-into-view of its own; this is a no-op there, same as
 *  that function's own web-only half. */
function scrollSectionIntoView(node: unknown): void {
  if (Platform.OS !== 'web' || !node) return;
  (node as { scrollIntoView?: (options: { behavior: 'auto'; block: 'start' }) => void }).scrollIntoView?.({ behavior: 'auto', block: 'start' });
}

/** #64 B2 / #63 R1: one `JumpItem` per section — its title, its own entry count
 *  (`sectionEntryCount`, own entries plus every group's) as the chip's muted qualifier, and an
 *  accessible name like "Attention, 3 values" — the shared `JumpRow` (`JumpRow.tsx`) renders the
 *  actual chip/pill visual. `undefined` for a single-section page (nothing to jump between). */
function tokenJumpItems(definition: TokenDefinition, onJump: (id: string) => void): JumpItem[] | undefined {
  if (definition.sections.length <= 1) return undefined;
  return definition.sections.map((section) => {
    const count = sectionEntryCount(definition.kind, section);
    return {
      id: section.id,
      title: section.title,
      qualifier: String(count),
      accessibilityLabel: `${section.title}, ${count} value${count === 1 ? '' : 's'}`,
      onPress: () => onJump(section.id),
    };
  });
}

/** #64 B2/B5: the real per-page wrapper `SectionBlock.tsx`'s own `tokenSections` block case
 *  renders for an opted-in `tokenDefinition` — the jump row (above the first section, B2) plus the
 *  existing `TokenSections` grammar, unchanged, now also given each section's own mounted node so
 *  a chip press, or a section-alias arrival (`focusSectionId`/`focusNonce`, set by `CatalogShell`
 *  from `resolveRoute`'s own `sectionId`), can scroll that section into view. */
export function TokenDefinitionBlock({
  definition, columns, label, focusSectionId, focusNonce,
}: {
  definition: TokenDefinition;
  columns: 1 | 2 | 3;
  label?: string;
  focusSectionId?: string;
  focusNonce?: number;
}) {
  const sections = tokenDefinitionSections(definition);
  const nodesRef = useRef<Map<string, unknown>>(new Map());
  // A section arrival can land before `TokenSections` has measured its width and mounted any
  // section, so the requested id waits here and is scrolled to the moment its node registers.
  const pendingRef = useRef<string | undefined>(undefined);
  const registerNode = useCallback((id: string, node: unknown) => {
    if (node) {
      nodesRef.current.set(id, node);
      if (pendingRef.current === id) {
        pendingRef.current = undefined;
        scrollSectionIntoView(node);
      }
    } else nodesRef.current.delete(id);
  }, []);
  const scrollToSection = useCallback((id: string) => {
    scrollSectionIntoView(nodesRef.current.get(id));
  }, []);
  useEffect(() => {
    if (!focusSectionId) return;
    if (nodesRef.current.has(focusSectionId)) scrollToSection(focusSectionId);
    else pendingRef.current = focusSectionId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSectionId, focusNonce]);
  const jumpItems = tokenJumpItems(definition, scrollToSection);
  return (
    <>
      {jumpItems ? <JumpRow items={jumpItems} /> : null}
      <TokenSections sections={sections} columns={columns} label={label} onSectionNode={registerNode} />
    </>
  );
}

/** A standalone preview of a whole `tokenDefinition` — the same jump row `TokenDefinitionBlock`
 *  shows (B2) when there's more than one section, then every section, stacked, each with its own
 *  title/desc and real entries. `SectionBlock.tsx`'s own `tokenSections` block case is the real
 *  per-page rendering path (`tokenDefinitionSections`, above); this component exists for a direct
 *  preview outside that path — e.g. this framework's own self-catalog demonstration. */
export function StructuredTokenPage({ definition }: { definition: TokenDefinition }) {
  const sections = tokenDefinitionSections(definition);
  const nodesRef = useRef<Map<string, unknown>>(new Map());
  const scrollToSection = useCallback((id: string) => {
    scrollSectionIntoView(nodesRef.current.get(id));
  }, []);
  const jumpItems = tokenJumpItems(definition, scrollToSection);
  return (
    <View style={styles.pageStack}>
      {jumpItems ? <JumpRow items={jumpItems} /> : null}
      {sections.map((section) => {
        const key = section.id ?? section.title;
        return (
          <View key={key} ref={(node: unknown) => { if (node) nodesRef.current.set(key, node); else nodesRef.current.delete(key); }}>
            <Text style={styles.pageSectionTitle}>{section.title}</Text>
            {section.desc ? <Text style={styles.pageSectionDesc}>{section.desc}</Text> : null}
            <View style={styles.pageSectionBody}>{section.render()}</View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: CATALOG_SPACE.lg },
  rowStack: { gap: CATALOG_SPACE.lg },

  // #63 R1: the category jump row moved to the shared `JumpRow.tsx` (used by group pages too).

  // #64 B1: a sub-group's own sub-heading — `microLabel`, a smaller step than the section's own
  // `label` role (`TokenLayouts.tsx`'s `sectionLabel`), the same role already used for a
  // variant-group name.
  groupBlock: { marginTop: CATALOG_SPACE.lg, gap: CATALOG_SPACE.sm },
  groupTitle: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.text },
  groupDesc: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },

  colorCell: { gap: CATALOG_SPACE.xs, width: COLOR_CELL_WIDTH },
  swatchNote: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted, width: COLOR_CELL_WIDTH },
  colorFallback: { width: COLOR_CELL_WIDTH, gap: CATALOG_SPACE.xs },
  noSamplePreview: { height: 40, borderRadius: CATALOG_RADIUS.sm, borderWidth: 1, borderColor: CATALOG_COLOR.border, backgroundColor: CATALOG_COLOR.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  noSampleText: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
  fallbackName: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.text },
  fallbackDetail: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
  fallbackNote: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },

  // Correction C1: a value's own provenance/named line — plain muted caption text, never a badge.
  provenanceLine: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
  // Correction C1: the section-level consolidated provenance line, shown once above every entry's
  // own body when every entry in the section shares the same provenance+named pair.
  sectionProvenance: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.sm },
  // Correction C1: an unresolved value's real source `expression`, monospace — the same
  // `CATALOG_TEXT.codeMicro` mono role `ReferenceDetails.tsx`'s own `mono` style already uses.
  monoNote: { ...CATALOG_TEXT.codeMicro, color: CATALOG_COLOR.textMuted },

  typographySample: { color: CATALOG_COLOR.text },
  unresolvedStack: { gap: CATALOG_SPACE.xs },
  unresolvedText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
  unresolvedExpression: { ...CATALOG_TEXT.codeMicro, color: CATALOG_COLOR.textMuted },

  dash: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.textMuted },
  spacingBar: { height: 12, borderRadius: CATALOG_RADIUS.sm, backgroundColor: CATALOG_COLOR.accent },
  radiusSample: { width: 56, height: 36, backgroundColor: CATALOG_COLOR.accentSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.accent },
  opacityBase: { width: 56, height: 36, borderRadius: CATALOG_RADIUS.sm, backgroundColor: CATALOG_COLOR.surfaceMuted, borderWidth: 1, borderColor: CATALOG_COLOR.border, overflow: 'hidden' },
  opacityFill: { flex: 1, backgroundColor: CATALOG_COLOR.accent },
  shadowSample: { width: 64, height: 36, backgroundColor: '#ffffff', borderRadius: 6 },

  motionCell: { gap: CATALOG_SPACE.xs, width: 220 },
  motionLabel: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  motionDetail: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.text },
  motionNote: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },

  issuesBox: {
    backgroundColor: CATALOG_COLOR.dangerSubtle,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.dangerBorder,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_SPACE.md,
    gap: CATALOG_SPACE.xs,
  },
  issuesTitle: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.danger },
  issuesText: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.danger },

  pageStack: { gap: CATALOG_SPACE.xl },
  pageSectionTitle: { ...CATALOG_TEXT.label, color: CATALOG_COLOR.text },
  pageSectionDesc: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginTop: CATALOG_SPACE.xs },
  pageSectionBody: { marginTop: CATALOG_SPACE.md },
});
