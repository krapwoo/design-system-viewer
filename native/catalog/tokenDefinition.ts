/**
 * Pure data model for `CatalogPageInput.tokenDefinition` — an optional, opt-in structured shape for
 * a token page's real entries (name, value, provenance, source) instead of a hand-built `render()`.
 * No React or React Native import: this module is shared by the runtime (`pageApi.ts`), the real
 * renderer (`StructuredTokenPage.tsx`), and the CLI's static reader (`cli/tokenDefinition.ts`), and
 * is itself tested directly under the plain Node `--experimental-strip-types` runner.
 *
 * Omitting `tokenDefinition` leaves every existing `tokenGallery`/`tokenSections`/`render` page
 * exactly as it was — nothing here changes unless a page opts in.
 */

/** The eight kinds a structured token page can declare, each with one fixed canonical title. */
export type TokenKind = 'colors' | 'typography' | 'spacing' | 'radius' | 'dimensions' | 'shadows' | 'opacity' | 'motion';

export const TOKEN_KINDS: readonly TokenKind[] = ['colors', 'typography', 'spacing', 'radius', 'dimensions', 'shadows', 'opacity', 'motion'];

const TOKEN_KIND_TITLES: Record<TokenKind, string> = {
  colors: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radius',
  dimensions: 'Dimensions',
  shadows: 'Shadows',
  opacity: 'Opacity',
  motion: 'Motion',
};

export function isTokenKind(value: string): value is TokenKind {
  return Object.prototype.hasOwnProperty.call(TOKEN_KIND_TITLES, value);
}

/** The one fixed title a kind renders under — an opted-in page's own explicit `title` must equal
 *  this (see `validateTokenDefinitionUsage`), or omit `title` entirely to get it for free. */
export function canonicalTokenTitle(kind: TokenKind): string {
  return TOKEN_KIND_TITLES[kind];
}

/** How a value's identity relates to the design system — independent of whether a concrete sample
 *  can be drawn (see `TokenResolution`): `'named'` (a real exported design-system token), `'inline'`
 *  (a one-off literal with no shared name — the common case), `'platform'` (the real value comes
 *  from the OS/platform at runtime, not a literal this catalog can read), or `'unresolved-finding'`
 *  (a real, source-backed literal/expression found in code with no shipped design token behind it
 *  yet). `named` on `TokenValueInfo` lets a 'platform'/'unresolved-finding' value still say it is
 *  *also* exposed through a real token name — see that field's own doc comment. */
export type TokenProvenance = 'named' | 'inline' | 'platform' | 'unresolved-finding';

/** Whether a value resolves to something drawable. `'unresolved'` never carries a fabricated
 *  sample — only the real reason (and, when one exists, the real source expression) a human would
 *  read at the call site. */
export type TokenResolution<V> = { status: 'resolved'; value: V } | { status: 'unresolved'; reason: string; expression?: string };

export interface TokenValueInfo<V> {
  provenance: TokenProvenance;
  /** True when this value is *also* exposed through a real named design-system token even though
   *  `provenance` is `'platform'` or `'unresolved-finding'` (token-contract.md: "a named exported
   *  token may itself have a platform-provided or unresolved value"). Omit for `'named'`/`'inline'`
   *  provenance, which already say so by themselves. */
  named?: boolean;
  resolution: TokenResolution<V>;
}

const TOKEN_PROVENANCE_LABELS: Record<TokenProvenance, string> = {
  named: 'Named token',
  inline: 'Inline value',
  platform: 'Platform-provided',
  'unresolved-finding': 'Unresolved finding',
};

/** The fixed caption vocabulary for a value's own `provenance`/`named` pair — plain muted caption
 *  text, never a status badge (correction C1: provenance must be visible, but never as a pill/tag).
 *  Appends " · named token" only when `named` is true (`TokenValueInfo.named`'s own doc comment:
 *  meaningful only alongside `'platform'`/`'unresolved-finding'`). */
export function tokenProvenanceCaption(value: Pick<TokenValueInfo<unknown>, 'provenance' | 'named'>): string {
  const label = TOKEN_PROVENANCE_LABELS[value.provenance];
  return value.named ? `${label} · named token` : label;
}

/** When every one of `entries` shares the same `tokenProvenanceCaption`, returns it once — the
 *  renderer's own section-level consolidation (correction C1: show a shared provenance+named pair
 *  once under the section instead of repeating it on every entry). `undefined` for an empty list,
 *  or when the entries disagree — either way the caller shows it per entry instead. */
export function consolidatedProvenanceCaption(
  entries: readonly { value: Pick<TokenValueInfo<unknown>, 'provenance' | 'named'> }[],
): string | undefined {
  if (entries.length === 0) return undefined;
  const first = tokenProvenanceCaption(entries[0].value);
  return entries.every((entry) => tokenProvenanceCaption(entry.value) === first) ? first : undefined;
}

/** Fields every token entry carries regardless of kind. `source`/`role`/`note` are prose/pointer
 *  strings, the same literal-string lane every other provenance pointer in this codebase already
 *  uses (`SectionDef.path`'s own `source: string` precedent) — never evaluated, never required to
 *  resolve to anything. */
export interface TokenEntryBase {
  /** Stable within its own section (see `findDuplicateEntryIds`) — may recur in a different
   *  section or a different page's definition; an address needs the page+section too (see
   *  `tokenEntryAddress`). */
  id: string;
  name: string;
  /** A literal pointer to where the real value lives (e.g. `'DS_SPACING.800'`, a file:line) — never
   *  evaluated, purely for a human/AI to cross-reference. */
  source?: string;
  /** Authored usage role, when one is known — never invented from a category or number. */
  role?: string;
  /** Short "when to use this" prose, when known. */
  note?: string;
}

export interface ColorTokenValue {
  /** A real, directly renderable CSS/React Native color string (hex, `rgba(...)`, a named color). */
  color: string;
}
export interface ColorTokenEntry extends TokenEntryBase {
  kind: 'colors';
  /** Independent light/dark sample — not a global color-scheme context. Omit for a color with one
   *  appearance. */
  appearance?: 'light' | 'dark';
  value: TokenValueInfo<ColorTokenValue>;
}

/** Shared by spacing/radius/dimensions — a bare number has no fixed unit; `unit` is always
 *  author-set (never guessed from the number). */
export interface DimensionTokenValue {
  amount: number;
  unit: string;
}
export interface SpacingTokenEntry extends TokenEntryBase {
  kind: 'spacing';
  value: TokenValueInfo<DimensionTokenValue>;
}
export interface RadiusTokenEntry extends TokenEntryBase {
  kind: 'radius';
  value: TokenValueInfo<DimensionTokenValue>;
}
export interface DimensionsTokenEntry extends TokenEntryBase {
  kind: 'dimensions';
  value: TokenValueInfo<DimensionTokenValue>;
}

/** Opacity's unit is intrinsic (a 0–1 ratio) — no separate `unit` field to author. */
export interface OpacityTokenValue {
  amount: number;
}
export interface OpacityTokenEntry extends TokenEntryBase {
  kind: 'opacity';
  value: TokenValueInfo<OpacityTokenValue>;
}

export interface TypographyTokenValue {
  fontSize: number;
  fontSizeUnit: string;
  lineHeight?: number;
  fontWeight?: string | number;
  letterSpacing?: number;
  fontFamily?: string;
}
export interface TypographyTokenEntry extends TokenEntryBase {
  kind: 'typography';
  value: TokenValueInfo<TypographyTokenValue>;
}

export interface ShadowTokenValue {
  color: string;
  opacity: number;
  radius: number;
  x: number;
  y: number;
}
export interface ShadowTokenEntry extends TokenEntryBase {
  kind: 'shadows';
  value: TokenValueInfo<ShadowTokenValue>;
}

/** A real, replayable timing value — `durationMs` is what `MotionSpecimen` actually animates;
 *  `sourceValue`/`sourceUnit` keep the authored value/unit (e.g. `0.3`/`'s'`) so a seconds source
 *  is never silently presented as if it had always been milliseconds. */
export interface MotionTimingValue {
  kind: 'timing';
  durationMs: number;
  sourceValue: number;
  sourceUnit: string;
}
/** A real, replayable spring — the same stiffness/damping/mass physics model `MotionSpecimen`
 *  already animates. Never built by converting a native duration/bounce or response/dampingFraction
 *  spring (see `MotionNativeExpressionValue`) — that conversion is not supported (token-contract.md,
 *  token-seams.reported.md §4). */
export interface MotionSpringValue {
  kind: 'spring';
  stiffness?: number;
  damping?: number;
  mass?: number;
  valueRange?: 'distance' | 'unit';
}
/** A real native expression (SwiftUI `.spring(duration:bounce:)`, `.spring(response:dampingFraction:)`,
 *  a conditional/symbolic value, …) that is honestly not replayable as `MotionSpecimen` physics —
 *  shown as its real text, never a guessed physics translation. */
export interface MotionNativeExpressionValue {
  kind: 'native-expression';
  expression: string;
  detail?: string;
}
export type MotionTokenValue = MotionTimingValue | MotionSpringValue | MotionNativeExpressionValue;
export interface MotionTokenEntry extends TokenEntryBase {
  kind: 'motion';
  value: TokenValueInfo<MotionTokenValue>;
}

export type TokenEntry =
  | ColorTokenEntry
  | SpacingTokenEntry
  | RadiusTokenEntry
  | DimensionsTokenEntry
  | OpacityTokenEntry
  | TypographyTokenEntry
  | ShadowTokenEntry
  | MotionTokenEntry;

/** One titled card of real entries, within a page's single `kind` — e.g. "Attention colors" and
 *  "Palette colors" as two scoped sections of one Colors-kind page (token-contract.md's own
 *  Hermex finding). `id` is this section's own stable, page-scoped identity (never shown); `title`
 *  is the human heading, which may legitimately repeat across sections without colliding (see
 *  `TokenSection.id` in `types.ts`, and `TokenLayouts.tsx`'s own key fix). */
export interface TokenDefinitionSection {
  id: string;
  title: string;
  desc?: string;
  wide?: boolean;
  entries: TokenEntry[];
}

export interface TokenDefinition {
  kind: TokenKind;
  sections: TokenDefinitionSection[];
}

/** Every id that appears more than once in `ids`, each listed once. Order-independent; used both for
 *  a section's own entry ids (must be unique within that section — ids may still recur in a
 *  *different* section, see `TokenEntryBase.id`) and for a definition's own section ids. */
export function findDuplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/** A collision-safe address for one entry: page, section, and entry id joined so that an escaped
 *  separator inside any one of the three can never be mistaken for a real boundary (`/` and `\`
 *  are escaped before joining) — never a flattened/concatenated name. Used wherever an entry needs
 *  one stable cross-page identity (future search/manifest indexing); not required for a React list
 *  key, which only ever needs sibling-level uniqueness. */
export function tokenEntryAddress(pageId: string, sectionId: string, entryId: string): string {
  const encode = (part: string) => part.replace(/\\/g, '\\\\').replace(/\//g, '\\/');
  return `${encode(pageId)}/${encode(sectionId)}/${encode(entryId)}`;
}

/** Structural problems with a `TokenDefinition` itself (design, Global Constraints: "never a
 *  partial read/silent precedence loss") — duplicate section ids, a section with duplicate entry
 *  ids, or an entry whose own `kind` doesn't match the page's declared `kind`. Empty when the
 *  definition is internally consistent. Both `buildCatalogSections` (dev console) and
 *  `cli/doctor.ts` (CI-failing errors) call this so the same rule applies at runtime and statically. */
export function validateTokenDefinition(def: TokenDefinition): string[] {
  const issues: string[] = [];
  for (const id of findDuplicateIds(def.sections.map((s) => s.id))) {
    issues.push(`tokenDefinition has more than one section with id "${id}".`);
  }
  for (const section of def.sections) {
    for (const id of findDuplicateIds(section.entries.map((e) => e.id))) {
      issues.push(`tokenDefinition section "${section.id}" has more than one entry with id "${id}".`);
    }
    for (const entry of section.entries) {
      if (entry.kind !== def.kind) {
        issues.push(`tokenDefinition section "${section.id}": entry "${entry.id}" has kind "${entry.kind}", but the page's kind is "${def.kind}".`);
      }
    }
  }
  return issues;
}

/** What else the hosting page authored, read down to only what a conflict check needs — a plain,
 *  presence-only shape so both the runtime (`CatalogPageInput`) and the static reader
 *  (`StaticPage`) can satisfy it without either importing the other's full type. */
export interface TokenDefinitionPageUsage {
  hasRender?: boolean;
  hasTokenGallery?: boolean;
  hasTokenSections?: boolean;
  hasFamily?: boolean;
  /** The page's own explicit `title`, when it set one — compared against the kind's canonical
   *  title (`canonicalTokenTitle`). Omitting `title` entirely never conflicts. */
  title?: string;
}

/** Actionable conflicts between an opted-in `tokenDefinition` and the rest of the page it sits on
 *  (design R1: "never silent precedence/data loss") — an explicit legacy `render`/`tokenGallery`/
 *  `tokenSections`, an incompatible family (`members`) recipe, or an explicit `title` that doesn't
 *  match the kind's canonical title. Empty when there is nothing to report. */
export function validateTokenDefinitionUsage(kind: TokenKind, usage: TokenDefinitionPageUsage): string[] {
  const issues: string[] = [];
  if (usage.hasRender) issues.push('tokenDefinition conflicts with this page\'s own "render" — remove one of them.');
  if (usage.hasTokenGallery) issues.push('tokenDefinition conflicts with this page\'s own "tokenGallery" — remove one of them.');
  if (usage.hasTokenSections) issues.push('tokenDefinition conflicts with this page\'s own "tokenSections" — remove one of them.');
  if (usage.hasFamily) issues.push('tokenDefinition conflicts with this page\'s own "members" (a family page) — remove one of them.');
  if (usage.title !== undefined && usage.title !== canonicalTokenTitle(kind)) {
    issues.push(`tokenDefinition: title "${usage.title}" conflicts with kind "${kind}" (expected "${canonicalTokenTitle(kind)}"). Omit "title" to use it automatically.`);
  }
  return issues;
}
