/**
 * `tokenScale` — builds a `TokenDefinition` for a value-scale page (radius, dimensions, spacing,
 * opacity) from *findings*: the rows a scanner reads out of an app that has no tokens of its own,
 * only literals written inline (`cornerRadius: 6`, `.frame(maxWidth: 360)`). Pure data in, pure data
 * out — no React import, so it runs under the plain Node test runner and in a catalog page alike.
 *
 * One tile per value: findings with the same value, unit and constraint, the same standing (named
 * or plain) and, for plain ones, the same sub-scale become one entry, with
 * every way the value is written (`expressions`) and every call site (`usages`) kept in its
 * Details panel. Then, in order: values the code names (a component constant resolved to its
 * number), the literal values smallest to largest, and, last, what is not a fixed value, one group
 * per reason. Nothing is invented: a finding without a number stays unresolved, never a sample.
 *
 * The four kinds are the ones a single number can describe. Shadows (several fields per value),
 * colors, typography and motion are not scales of numbers, so they stay `tokenDefinition` pages.
 */
import type { DimensionTokenValue, TokenDefinition, TokenDefinitionGroup, TokenDefinitionSection, TokenEntry, TokenKind, TokenProvenance } from './tokenDefinition.ts';

export type TokenScaleKind = Extract<TokenKind, 'radius' | 'dimensions' | 'spacing' | 'opacity'>;

export const TOKEN_SCALE_KINDS: readonly TokenScaleKind[] = ['radius', 'dimensions', 'spacing', 'opacity'];

export function isTokenScaleKind(value: string): value is TokenScaleKind {
  return (TOKEN_SCALE_KINDS as readonly string[]).includes(value);
}

/** Why a finding has no single fixed value: it follows a size (`pill.height / 2`), follows state
 *  (`isExpanded ? 12 : 8`), or something else. */
export type TokenFindingUnresolvedReason = 'size' | 'state' | 'other';

/** One scanner row. Only `expression` is required. */
export interface TokenFinding {
  /** The source text as written, e.g. `cornerRadius: 6`. */
  expression: string;
  /** Every call site, one `path:line` each. */
  usages?: readonly string[];
  /** Where the literal is defined or first found (`path:line`). */
  source?: string;
  /** The number the expression resolves to. Leave out when `unresolved` is set; a finding with
   *  neither is shown as unresolved ("No value found"), never guessed. */
  value?: number;
  /** The unit (`pt`, `px`). Falls back to `options.unit`, then to none: a bare number. Ignored for
   *  `opacity`, a 0–1 ratio. */
  unit?: string;
  /** `'exact'` (default), or a bound: `'min'` (`minWidth: 360`) and `'max'` (`maxWidth: 360`) are
   *  different values from `360` and from each other. */
  constraint?: 'exact' | 'min' | 'max';
  /** What the code calls it, e.g. `ChatComposerMetrics.cardCornerRadius`. A named finding goes in
   *  the first section, apart from plain findings of the same number; without a value it keeps its
   *  name as the note of its "Not a fixed value" tile. It is not a design-system token unless
   *  `provenance` says `'named'`, which also counts as named without a `name`. */
  name?: string;
  /** Defaults to `'inline'`. Only `'named'` means a real design-system token; with one on the page the
   *  "no tokens yet" line disappears. */
  provenance?: TokenProvenance;
  /** Set when there is no single value. `detail` is the plain reason shown on the tile. */
  unresolved?: { reason: TokenFindingUnresolvedReason; detail?: string };
  /** Which of `options.scales` this literal belongs to. Absent or unknown: the default section. */
  scale?: string;
}

export interface TokenScaleOptions {
  /** A unit for findings that give none, e.g. `'pt'`. */
  unit?: string;
  /** Split the literal values into sub-scales (widths, heights, …), shown in this order. */
  scales?: readonly { id: string; title: string; desc?: string }[];
  /** `TokenDefinition.showNoTokensNote`; `true` unless set to `false`. */
  showNoTokensNote?: boolean;
}

const CONSTRAINT_ORDER = { exact: 0, min: 1, max: 2 } as const;
const PROVENANCE_RANK: Record<TokenProvenance, number> = { named: 3, platform: 2, 'unresolved-finding': 1, inline: 0 };
const REASONS: readonly { reason: TokenFindingUnresolvedReason; title: string }[] = [
  { reason: 'size', title: 'Depends on size' },
  { reason: 'state', title: 'Depends on state' },
  { reason: 'other', title: 'Other' },
];
const DEFAULT_SECTION_ID = 'values';
/** Sub-scale sections get this prefix, so a scale called `values`, `named` or `not-fixed` cannot collide with a built-in section. */
const SCALE_SECTION_PREFIX = 'scale-';

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function valueLabel(kind: TokenScaleKind, value: number, unit: string, constraint: 'exact' | 'min' | 'max'): string {
  const text = `${value}${kind === 'opacity' ? '' : unit}`;
  return constraint === 'exact' ? text : `${constraint} ${text}`;
}

interface Group {
  findings: TokenFinding[];
}

/** A finding the code names: it has a `name`, or says it is a real token (`provenance: 'named'`). */
function isNamedFinding(finding: TokenFinding): boolean {
  return Boolean(finding.name) || finding.provenance === 'named';
}

function mergedBase(findings: readonly TokenFinding[]) {
  const sources = unique(findings.flatMap((f) => (f.source ? [f.source] : [])));
  const usages = unique(findings.flatMap((f) => f.usages ?? []));
  const expressions = unique(findings.map((f) => f.expression));
  return {
    ...(sources.length > 0 ? { source: sources.join(', ') } : {}),
    ...(usages.length > 0 ? { usages } : {}),
    expression: expressions[0],
    ...(expressions.length > 1 ? { expressions } : {}),
  };
}

function strongestProvenance(findings: readonly TokenFinding[]): TokenProvenance {
  return findings.reduce<TokenProvenance>((best, f) => {
    const next = f.provenance ?? 'inline';
    return PROVENANCE_RANK[next] > PROVENANCE_RANK[best] ? next : best;
  }, 'inline');
}

/** Builds a `TokenDefinition` of `kind` from `findings`. See the file header and README's "Value
 *  scales from scanner findings". The result is a plain definition: pass it as a page's
 *  `tokenDefinition`, or edit it first. */
export function tokenScale(kind: TokenScaleKind, findings: readonly TokenFinding[], options: TokenScaleOptions = {}): TokenDefinition {
  const resolvedGroups = new Map<string, Group & { value: number; unit: string; constraint: 'exact' | 'min' | 'max'; named: boolean }>();
  const unresolvedGroups = new Map<string, Group & { reason: TokenFindingUnresolvedReason; details: string[] }>();
  const scaleIds = new Set((options.scales ?? []).map((s) => s.id));
  for (const finding of findings) {
    const hasValue = typeof finding.value === 'number' && Number.isFinite(finding.value) && !finding.unresolved;
    if (!hasValue) {
      const reason = finding.unresolved?.reason ?? 'other';
      const detail = finding.unresolved?.detail ?? (finding.unresolved ? undefined : 'No value found');
      const key = `${reason}\u0000${finding.expression}`;
      const group = unresolvedGroups.get(key) ?? { findings: [], reason, details: [] };
      group.findings.push(finding);
      if (detail !== undefined && !group.details.includes(detail)) group.details.push(detail);
      unresolvedGroups.set(key, group);
      continue;
    }
    const unit = kind === 'opacity' ? '' : finding.unit ?? options.unit ?? '';
    const constraint = finding.constraint ?? 'exact';
    // A named value and a plain one of the same number stay apart: the plain literal is still written inline.
    // Plain literals in different sub-scales stay apart too: a 44pt width and a 44pt height are two values.
    const named = isNamedFinding(finding);
    const scale = !named && finding.scale !== undefined && scaleIds.has(finding.scale) ? finding.scale : '';
    const key = `${named ? 'named' : 'plain'}\u0000${scale}\u0000${unit}\u0000${constraint}\u0000${finding.value}`;
    const group = resolvedGroups.get(key) ?? { findings: [], value: finding.value as number, unit, constraint, named };
    group.findings.push(finding);
    resolvedGroups.set(key, group);
  }

  // Smallest to largest within a unit (units in the order they first appear), then exact before min before max.
  const unitOrder = unique([...resolvedGroups.values()].map((g) => g.unit));
  const ordered = [...resolvedGroups.values()].sort((a, b) =>
    unitOrder.indexOf(a.unit) - unitOrder.indexOf(b.unit) || a.value - b.value || CONSTRAINT_ORDER[a.constraint] - CONSTRAINT_ORDER[b.constraint]);

  const toEntry = (group: (typeof ordered)[number]): TokenEntry => {
    const label = valueLabel(kind, group.value, group.unit, group.constraint);
    const names = unique(group.findings.flatMap((f) => (f.name ? [f.name] : [])));
    const base = { id: label, name: label, ...mergedBase(group.findings), ...(names.length > 0 ? { note: names.join(', ') } : {}) };
    const provenance = strongestProvenance(group.findings);
    if (kind === 'opacity') return { ...base, kind, value: { provenance, resolution: { status: 'resolved', value: { amount: group.value } } } };
    const value: DimensionTokenValue = { amount: group.value, unit: group.unit };
    return { ...base, kind, value: { provenance, resolution: { status: 'resolved', value } } };
  };

  const sections: TokenDefinitionSection[] = [];

  const named = ordered.filter((g) => g.named);
  if (named.length > 0) {
    sections.push({
      id: 'named', title: 'Named in code',
      desc: 'The code gives these a name, such as a component constant. They are not design-system tokens unless the project says so.',
      entries: named.map(toEntry),
    });
  }

  const literal = ordered.filter((g) => !g.named);
  const seen = new Set<string>();
  const scales = (options.scales ?? []).filter((s) => !seen.has(s.id) && seen.add(s.id));
  // The scale a literal belongs to, or `undefined` for the default section.
  const scaleOf = (group: (typeof ordered)[number]) => group.findings.map((f) => f.scale).find((s) => s !== undefined && seen.has(s));
  const defaultTitle = scales.length > 0 ? 'Other values' : 'Values written inline';
  const buckets = [
    ...scales.map((s) => ({ scale: s.id as string | undefined, id: `${SCALE_SECTION_PREFIX}${s.id}`, title: s.title, desc: s.desc })),
    { scale: undefined, id: DEFAULT_SECTION_ID, title: defaultTitle, desc: undefined },
  ];
  for (const bucket of buckets) {
    const groups = literal.filter((g) => scaleOf(g) === bucket.scale);
    if (groups.length === 0) continue;
    sections.push({ id: bucket.id, title: bucket.title, ...(bucket.desc ? { desc: bucket.desc } : {}), entries: groups.map(toEntry) });
  }

  if (unresolvedGroups.size > 0) {
    const groups: TokenDefinitionGroup[] = [];
    for (const { reason, title } of REASONS) {
      const entries: TokenEntry[] = [...unresolvedGroups.entries()]
        .filter(([, g]) => g.reason === reason)
        .map(([, g], index) => {
          const names = unique(g.findings.flatMap((f) => (f.name ? [f.name] : [])));
          const base = { id: `${reason}-${index}`, name: g.findings[0].expression, ...mergedBase(g.findings), ...(names.length > 0 ? { note: names.join(', ') } : {}) };
          const detail = g.details.length > 0 ? g.details.join('; ') : title;
          const provenance = strongestProvenance(g.findings);
          const value = { provenance: provenance === 'inline' ? ('unresolved-finding' as const) : provenance, resolution: { status: 'unresolved' as const, reason: detail } };
          return { ...base, kind, value };
        });
      if (entries.length > 0) groups.push({ id: reason, title, entries });
    }
    sections.push({
      id: 'not-fixed', title: 'Not a fixed value',
      desc: 'These depend on something at run time, so there is no one value to draw.',
      entries: [], groups,
    });
  }

  return { kind, sections, showNoTokensNote: options.showNoTokensNote ?? true };
}
