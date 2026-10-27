/**
 * Static, literal-only reader for `CatalogPageInput.tokenDefinition` — the same posture
 * `cli/staticPage.ts`'s own `readStaticPage` already uses for every other field: no module
 * resolution, no execution, a same-file `const` chase only (`resolve`, reused from
 * `cli/staticPage.ts`). Reads structural metadata only (`kind`, section `id`/`title`/`desc`/`wide`,
 * and each entry's own literal `id`, for duplicate detection) — never an entry's real value, which
 * stays an opaque runtime import (design R4).
 */
import * as ts from 'typescript';
import { findProp, propertyStringLiteral, resolve } from './staticPage.ts';
import { canonicalTokenTitle, isTokenKind, type TokenKind } from '../native/catalog/tokenDefinition.ts';

export interface StaticTokenDefinitionSection {
  id: string;
  title: string;
  desc?: string;
  wide?: boolean;
  /** Each entry's own literal `id`, in authored order — duplicates are kept (never deduplicated),
   *  the same convention `StaticFamilySection.members` already uses, so a duplicate-counting rule
   *  can tell how many times an id actually appeared. An entry whose own `id` isn't itself a
   *  literal is simply skipped (informational leniency — see this file's own doc comment). */
  entryIds: string[];
  /** True when `entries` itself isn't a literal array (imported/computed), or at least one element
   *  isn't a literal object, or at least one element's own `id` isn't a literal — i.e. `entryIds`
   *  above is known to be incomplete for this section. `cli/doctor.ts` lists such sections in its
   *  informational runtime-only summary; a fully literal section (including one genuinely authored
   *  with zero entries) is `false`. */
  entriesOpaque: boolean;
}

export interface StaticTokenDefinition {
  /** The literal `kind` string exactly as authored — may be any string, including one that isn't
   *  one of the eight approved kinds (see `isTokenKind`); `cli/doctor.ts`'s own
   *  `token-definition-invalid-kind` rule is what actually reports that, not this reader. */
  kind: string;
  sections: StaticTokenDefinitionSection[];
}

/** Reads `node` (a `tokenDefinition:` property initializer) down to `kind` and each section's
 *  `id`/`title`/`desc`/`wide`/entry-ids. Returns `undefined` — never a partial read — when `kind`
 *  isn't a literal, `sections` isn't a literal array, or any one section isn't a literal object
 *  with a literal `id` and `title`: the same "never a partial read" contract every other array
 *  reader in `cli/staticPage.ts` already follows (`readComposedOf`, `readSections`, …). An entry
 *  whose own `id` isn't literal is simply omitted from `entryIds` — informational leniency, since
 *  only the *structural* shape (kind/sections/ids) needs to be checkable, never an entry's real
 *  value (design R4: "no blanket uncheckability of otherwise literal page geometry"). */
export function readStaticTokenDefinition(node: ts.Expression, consts: Map<string, ts.Expression>): StaticTokenDefinition | undefined {
  const resolved = resolve(node, consts, new Set());
  if (!ts.isObjectLiteralExpression(resolved)) return undefined;
  const kind = propertyStringLiteral(resolved, 'kind', consts);
  if (kind === undefined) return undefined;
  const sectionsProp = findProp(resolved, 'sections');
  if (!sectionsProp) return undefined;
  const sectionsResolved = resolve(sectionsProp.initializer, consts, new Set());
  if (!ts.isArrayLiteralExpression(sectionsResolved)) return undefined;

  const sections: StaticTokenDefinitionSection[] = [];
  for (const element of sectionsResolved.elements) {
    const sectionResolved = resolve(element, consts, new Set());
    if (!ts.isObjectLiteralExpression(sectionResolved)) return undefined;
    const id = propertyStringLiteral(sectionResolved, 'id', consts);
    const title = propertyStringLiteral(sectionResolved, 'title', consts);
    if (id === undefined || title === undefined) return undefined;
    const desc = propertyStringLiteral(sectionResolved, 'desc', consts);
    const wideProp = findProp(sectionResolved, 'wide');
    const wide = wideProp ? resolve(wideProp.initializer, consts, new Set()).kind === ts.SyntaxKind.TrueKeyword : false;
    const entryIds: string[] = [];
    let entriesOpaque = false;
    const entriesProp = findProp(sectionResolved, 'entries');
    if (entriesProp) {
      const entriesResolved = resolve(entriesProp.initializer, consts, new Set());
      if (ts.isArrayLiteralExpression(entriesResolved)) {
        for (const entryElement of entriesResolved.elements) {
          const entryResolved = resolve(entryElement, consts, new Set());
          if (!ts.isObjectLiteralExpression(entryResolved)) {
            entriesOpaque = true;
            continue;
          }
          const entryId = propertyStringLiteral(entryResolved, 'id', consts);
          if (entryId !== undefined) entryIds.push(entryId);
          else entriesOpaque = true;
        }
      } else {
        entriesOpaque = true;
      }
    }
    sections.push({ id, title, desc, wide, entryIds, entriesOpaque });
  }
  return { kind, sections };
}

export { canonicalTokenTitle, isTokenKind };
export type { TokenKind };
