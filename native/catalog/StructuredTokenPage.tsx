import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, Platform, StyleSheet, type TextStyle } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { TokenGrid, TokenTile, TokenSections } from './TokenLayouts';
import { TokenRow, TokenRowGroup } from './TokenRow';
import { Swatch } from './Swatch';
import { MotionSpecimen } from './MotionSpecimen';
import { TokenDetails } from './TokenDetails';
import { JumpRow, type JumpItem } from './JumpRow';
import { WarningBanner } from './WarningBanner';
import {
  consolidatedProvenanceCaption,
  isTokenKind,
  filteredKindEntriesFromList,
  noTokensNote,
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

/** A token's own `note` — "when to use this", about the value itself, so it stays on the tile.
 *  Its `source` and `role` (usage) move into the token's `TokenDetails` panel instead. */
function entryNote(entry: Pick<TokenEntryBase, 'note'>): string | undefined {
  return entry.note || undefined;
}

/** What kind of token a panel is about, shown above its heading. */
const KIND_LABELS: Record<TokenKind, string> = {
  colors: 'Color',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Corner radius',
  dimensions: 'Dimension',
  opacity: 'Opacity',
  shadows: 'Shadow',
  motion: 'Motion',
};

/** Correction C1, moved into the panel: a token's provenance (`showProvenance` only — a section
 *  whose entries all share one shows it once above them instead), `source` and `role` (as the usage
 *  text) leave the tile for its "Details ›" panel. `null` when there is nothing to put in it, so a
 *  token with no provenance to show, no source and no role has no link. `dark` is a light/dark
 *  pair's other side: the panel covers both, and says so wherever the two differ. */
function entryDetails(
  kind: TokenKind,
  entry: TokenEntryBase & { value: TokenValueInfo<unknown> },
  showProvenance: boolean,
  options: { title?: string; kicker?: string; dark?: TokenEntryBase & { value: TokenValueInfo<unknown> } } = {},
): React.ReactNode {
  const { dark } = options;
  const source = entry.source ?? dark?.source;
  const sourcesDiffer = dark !== undefined && entry.source !== undefined && dark.source !== undefined && entry.source !== dark.source;
  const rolesDiffer = dark !== undefined && entry.role !== undefined && dark.role !== undefined && entry.role !== dark.role;
  const role = entry.role ?? dark?.role;
  const expressionsDiffer = dark !== undefined && entry.expression !== undefined && dark.expression !== undefined && entry.expression !== dark.expression;
  // Two or more distinct written forms of one value (`expression` plus `expressions`, each once) are
  // listed under "Written N ways"; one is the usual "Expression". A light/dark pair keeps `expression`.
  const forms = dark === undefined ? [...new Set([...(entry.expression ? [entry.expression] : []), ...(entry.expressions ?? [])])] : [];
  const written = forms.length > 1 ? forms : undefined;
  const expression = written ? undefined : forms[0] ?? entry.expression ?? dark?.expression;
  // A pair's two sides are used at different sites: the panel lists both, each site once.
  const usages = [...new Set([...(entry.usages ?? []), ...(dark?.usages ?? [])])];
  const lightProvenance = tokenProvenanceCaption(entry.value);
  const darkProvenance = dark ? tokenProvenanceCaption(dark.value) : lightProvenance;
  if (!showProvenance && !source && !role && !expression && !written && usages.length === 0) return null;
  return (
    <TokenDetails
      title={options.title ?? entry.name}
      kicker={options.kicker ?? KIND_LABELS[kind]}
      expression={expressionsDiffer ? undefined : expression}
      source={sourcesDiffer ? undefined : source}
      usages={usages}
      usageSummary={rolesDiffer ? undefined : role}
    >
      {written ? <PanelFact label={`Written ${written.length} ways`} value={written} /> : null}
      {expressionsDiffer ? (
        <>
          <PanelFact label="Expression (light)" value={entry.expression!} />
          <PanelFact label="Expression (dark)" value={dark!.expression!} />
        </>
      ) : null}
      {sourcesDiffer ? (
        <>
          <PanelFact label="Source (light)" value={entry.source!} />
          <PanelFact label="Source (dark)" value={dark!.source!} />
        </>
      ) : null}
      {rolesDiffer ? (
        <>
          <PanelFact label="Usage (light)" value={entry.role!} mono={false} />
          <PanelFact label="Usage (dark)" value={dark!.role!} mono={false} />
        </>
      ) : null}
      {showProvenance ? (
        <PanelFact
          label="Provenance"
          value={lightProvenance === darkProvenance ? lightProvenance : `Light: ${lightProvenance} · Dark: ${darkProvenance}`}
          mono={false}
        />
      ) : null}
    </TokenDetails>
  );
}

/** A labelled line in a `TokenDetails` panel's extra content, in the panel's own label/value style. */
function PanelFact({ label, value, mono = true }: { label: string; value: string | readonly string[]; mono?: boolean }) {
  return (
    <View style={styles.panelFact}>
      <Text style={styles.panelFactLabel}>{label}</Text>
      {(typeof value === 'string' ? [value] : value).map((line, index) => (
        <Text key={`${index}:${line}`} style={mono ? styles.panelFactMono : styles.panelFactText}>{line}</Text>
      ))}
    </View>
  );
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

/** The note slot of the kinds built on `TokenTile` (spacing/radius/dimensions/opacity/shadows):
 *  the token's own `note` and — for an unresolved value — its real `expression` (monospace), which
 *  is the value it has to show. `undefined` (never an empty node) when there is nothing to show, so
 *  `TokenTile`'s own `{note ? ... : null}` check still works unchanged. */
function tileNote(entry: TokenEntryBase, value: TokenValueInfo<unknown>): React.ReactNode {
  const base = entryNote(entry);
  const expression = value.resolution.status === 'unresolved' ? value.resolution.expression : undefined;
  if (!base && !expression) return undefined;
  return (
    <>
      {base}
      {expression ? <Text style={styles.monoNote}>{base ? `\n${expression}` : expression}</Text> : null}
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
        <UnresolvedCaption resolution={entry.value.resolution} />
        {note ? <Text style={styles.fallbackNote}>{note}</Text> : null}
        {entryDetails('colors', entry, showProvenance, { title: name })}
      </View>
    );
  }
  return (
    <View style={styles.colorCell}>
      <Swatch name={name} value={entry.value.resolution.value.color} width={COLOR_CELL_WIDTH} wrapName />
      {note ? <Text style={styles.swatchNote}>{note}</Text> : null}
      {entryDetails('colors', entry, showProvenance, { title: name })}
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
      {note ? <Text style={styles.swatchNote}>{note}</Text> : null}
      {entryDetails('colors', light, showProvenance, { title: name, kicker: 'Color · light and dark', dark })}
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
  const details = entryDetails('typography', entry, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenRow use={base} last={last} notePlacement="right" action={details}>
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
    <TokenRow use={`${base} · ${meta}`} last={last} notePlacement="right" action={details}>
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

/** The radius sample is a square, so every corner up to half its side draws differently (on a
 *  wider-than-tall box, anything over half its height looked like the same pill). Larger values,
 *  a full-round `999` included, draw as the circle they are. */
export const RADIUS_SAMPLE_SIZE = 56;
/** The sample's box, square by construction. */
export const RADIUS_SAMPLE_BOX = { width: RADIUS_SAMPLE_SIZE, height: RADIUS_SAMPLE_SIZE } as const;
export function radiusSampleCorner(amount: number): number {
  return Math.min(Math.max(amount, 0), RADIUS_SAMPLE_SIZE / 2);
}

/** The widest a length bar is drawn. A grid whose largest value is wider is drawn to scale instead,
 *  so `max 132pt` and `max 520pt` still look different; `dimensionBarScale` gives that factor. */
export const DIMENSION_BAR_MAX = 120;
export function dimensionBarScale(amounts: readonly number[]): number {
  const largest = Math.max(0, ...amounts.filter((a) => Number.isFinite(a)));
  return largest > DIMENSION_BAR_MAX ? DIMENSION_BAR_MAX / largest : 1;
}
export function dimensionBarWidth(amount: number, scale: number): number {
  return Math.min(Math.max(amount * scale, 1), DIMENSION_BAR_MAX);
}

/** The value line a tile shows, or `undefined` when its name already says it: `6pt` named `6pt`,
 *  or a capped value named `max 360pt` / `min 360pt`. */
export function dimensionValueText(name: string, valueText: string): string | undefined {
  return name === valueText || name.endsWith(` ${valueText}`) ? undefined : valueText;
}

/** A dotted code name (`BotPendingRequestCard.cornerRadius`) may wrap after each dot instead of
 *  mid-word: a zero-width space after every dot that is followed by a name character. */
export function breakableCodeName(text: string): string {
  return text.replace(/\.(?=[A-Za-z_$])/g, '.\u200B');
}

function DimensionTile({ kind, entry, showProvenance, barScale = 1 }: { kind: 'spacing' | 'radius' | 'dimensions'; entry: DimensionLikeEntry; showProvenance: boolean; barScale?: number }) {
  // Notes here are usually code names (`BotPendingRequestCard.cornerRadius`): let them wrap at a dot.
  const note = tileNote(entry.note === undefined ? entry : { ...entry, note: breakableCodeName(entry.note) }, entry.value);
  const action = entryDetails(kind, entry, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenTile name={entry.name} value={entry.value.resolution.reason} note={note} action={action}>
        <Text style={styles.dash}>—</Text>
      </TokenTile>
    );
  }
  const { amount, unit } = entry.value.resolution.value;
  // A tile named for its value (`6pt`, `max 360pt`) would print it twice, so the value is left off the tile.
  const valueText = dimensionValueText(entry.name, `${amount}${unit}`);
  if (kind === 'radius') {
    return (
      <TokenTile name={entry.name} value={valueText} note={note} action={action}>
        <View style={[styles.radiusSample, { borderRadius: radiusSampleCorner(amount) }]} />
      </TokenTile>
    );
  }
  return (
    <TokenTile name={entry.name} value={valueText} note={note} action={action}>
      <View style={[styles.spacingBar, { width: dimensionBarWidth(amount, barScale) }]} />
    </TokenTile>
  );
}

function DimensionEntries({ kind, entries, showProvenance }: { kind: 'spacing' | 'radius' | 'dimensions'; entries: DimensionLikeEntry[]; showProvenance: boolean }) {
  const lengths = entries.flatMap((e) => (e.value.resolution.status === 'resolved' ? [e.value.resolution.value] : []));
  const barScale = kind === 'radius' ? 1 : dimensionBarScale(lengths.map((v) => v.amount));
  const grid = <TokenGrid minTileWidth={140}>{entries.map((entry) => <DimensionTile key={entry.id} kind={kind} entry={entry} showProvenance={showProvenance} barScale={barScale} />)}</TokenGrid>;
  if (barScale === 1) return grid;
  const longest = lengths.reduce((a, b) => (b.amount > a.amount ? b : a));
  return (
    <View>
      <Text style={styles.scaleNote}>Bars are drawn to scale to fit; the longest is {longest.amount}{longest.unit}.</Text>
      {grid}
    </View>
  );
}

function OpacityTile({ entry, showProvenance }: { entry: OpacityTokenEntry; showProvenance: boolean }) {
  const note = tileNote(entry, entry.value);
  const action = entryDetails('opacity', entry, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenTile name={entry.name} value={entry.value.resolution.reason} note={note} action={action}>
        <Text style={styles.dash}>—</Text>
      </TokenTile>
    );
  }
  const { amount } = entry.value.resolution.value;
  return (
    <TokenTile name={entry.name} value={`${Math.round(amount * 100)}%`} note={note} action={action}>
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
  const note = tileNote(entry, entry.value);
  const action = entryDetails('shadows', entry, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <TokenTile name={entry.name} value={entry.value.resolution.reason} note={note} action={action}>
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
      action={action}
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
  const details = entryDetails('motion', entry, showProvenance);
  if (entry.value.resolution.status === 'unresolved') {
    return (
      <View style={styles.motionCell}>
        <UnresolvedCaption resolution={entry.value.resolution} />
        {note ? <Text style={styles.motionNote}>{note}</Text> : null}
        {details}
      </View>
    );
  }
  const value = entry.value.resolution.value;
  if (value.kind === 'timing') {
    return (
      <View style={styles.motionCell}>
        <MotionSpecimen kind="timing" duration={value.durationMs} label={`${value.sourceValue}${value.sourceUnit}`} />
        {note ? <Text style={styles.motionNote}>{note}</Text> : null}
        {details}
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
        {note ? <Text style={styles.motionNote}>{note}</Text> : null}
        {details}
      </View>
    );
  }
  return (
    <View style={styles.motionCell}>
      <Text style={styles.motionLabel}>native expression (not replayable as physics)</Text>
      <Text style={styles.motionDetail}>{value.expression}</Text>
      {value.detail ? <Text style={styles.motionDetail}>{value.detail}</Text> : null}
      {note ? <Text style={styles.motionNote}>{note}</Text> : null}
      {details}
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

/** The honesty line at the top of a page with no named design-system token on it (`noTokensNote`). */
function NoTokensNote({ definition }: { definition: TokenDefinition }) {
  const note = noTokensNote(definition);
  return note ? <WarningBanner tone="info" title={note.title}>{note.body}</WarningBanner> : null;
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
      <NoTokensNote definition={definition} />
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
      <NoTokensNote definition={definition} />
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

  // Correction C1: the section-level consolidated provenance line, shown once above every entry's
  // own body when every entry in the section shares the same provenance+named pair.
  sectionProvenance: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.sm },
  // Correction C1: an unresolved value's real source `expression`, monospace — the same
  // `CATALOG_TEXT.codeMicro` mono role `ReferenceDetails.tsx`'s own `mono` style already uses.
  monoNote: { ...CATALOG_TEXT.codeMicro, color: CATALOG_COLOR.textMuted },
  // The extra lines inside a `TokenDetails` panel, matching the lines the panel draws itself.
  panelFact: { gap: CATALOG_SPACE.xs },
  panelFactLabel: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.textMuted },
  panelFactMono: { ...CATALOG_TEXT.codeSmall, color: CATALOG_COLOR.text, wordBreak: 'break-word' } as TextStyle,
  panelFactText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.text },

  typographySample: { color: CATALOG_COLOR.text },
  unresolvedStack: { gap: CATALOG_SPACE.xs },
  unresolvedText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted },
  unresolvedExpression: { ...CATALOG_TEXT.codeMicro, color: CATALOG_COLOR.textMuted },

  dash: { ...CATALOG_TEXT.icon, color: CATALOG_COLOR.textMuted },
  spacingBar: { height: 12, borderRadius: CATALOG_RADIUS.sm, backgroundColor: CATALOG_COLOR.accent },
  scaleNote: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginBottom: CATALOG_SPACE.sm },
  radiusSample: { ...RADIUS_SAMPLE_BOX, backgroundColor: CATALOG_COLOR.accentSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.accent },
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
