import { createContext, useContext, useMemo } from 'react';
import type { ReferenceNavigation } from './catalogReferences';
import { partNumbering, type PartEntry, type PartNumbering } from './partsModel';
import type { CatalogAnatomy } from './types';

/** A page provides its used components' numbers here, so an anatomy pin, a legend row and a Parts
 *  card read the same number without a prop on every layer in between. `undefined` outside a page. */
export const PartNumbersContext = createContext<PartNumbering | undefined>(undefined);

export function usePartNumbers(): PartNumbering | undefined {
  return useContext(PartNumbersContext);
}

/** A name's identity for numbering: the page (and member) it resolves to, so an alias or component
 *  name shares the number of the page id; a name that does not resolve is its own identity. */
function identityOf(navigation: ReferenceNavigation | undefined, name: string): string {
  const target = navigation?.resolve(name);
  return target ? `page:${target.pageId}:${target.memberId ?? ''}` : `name:${name}`;
}

/** Whether `name` counts as a part: only a component does, not a style, layout or behavior, so a
 *  name resolving to a page outside the configured part groups does not (`navigation.isPart`). A
 *  name that resolves nowhere counts only when not `requireResolved`; the page numbering requires a
 *  page for every name (an anatomy `other` item or a Parts-block entry), so a name with no page
 *  keeps the unnumbered treatment and never claims to open one. */
export function countsAsPart(navigation: ReferenceNavigation | undefined, name: string, requireResolved: boolean): boolean {
  const target = navigation?.resolve(name);
  if (!target) return !requireResolved;
  return navigation?.isPart?.(target.pageId) ?? true;
}

/** `partNumbering` for a page: its anatomies' `other` items, then the Parts-block entries that open
 *  a page of their own (a plain row is not a part), resolved through `navigation`. */
export function usePagePartNumbering(first: number, anatomies: ReadonlyArray<CatalogAnatomy | undefined>, parts: readonly PartEntry[], navigation: ReferenceNavigation | undefined): PartNumbering {
  return useMemo(
    () => partNumbering({
      first,
      anatomies,
      partNames: parts.map((part) => part.entry.component).filter((name) => countsAsPart(navigation, name, true)),
      keyOf: (name) => identityOf(navigation, name),
      opens: (name) => Boolean(navigation?.resolve(name)),
      titleOf: (name) => {
        const target = navigation?.resolve(name);
        return target ? navigation?.page?.(target.pageId)?.title : undefined;
      },
      counts: (name) => countsAsPart(navigation, name, true),
    }),
    // `anatomies` is a fresh array each render; its members are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [first, ...anatomies, parts, navigation],
  );
}
