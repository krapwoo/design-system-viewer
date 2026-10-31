import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { addMemberTitles, memberNameScope } from './familyModel';
import type { ReferenceNavigation } from './catalogReferences';
import type { CatalogMember } from './types';

/** The catalog-wide displayed names of titled family/group members, by id and alias
 *  (`memberTitleMap`), and the ids of the pages that map was built over. `CatalogShell` provides it so
 *  a link or label deep in a page (a Uses line, a part list, the anatomy legend) can show a member's
 *  title without a prop on every layer. The page ids let a page tell whether the map is its own
 *  catalog's: a family page drawn as a specimen on a page inside some shell gets that shell's map,
 *  which does not cover the specimen's family. */
export interface MemberTitles {
  titles: ReadonlyMap<string, string>;
  pageIds: ReadonlySet<string>;
}
const NO_OUTER_TITLES: MemberTitles = { titles: new Map(), pageIds: new Set() };
export const MemberTitlesContext = createContext<MemberTitles>(NO_OUTER_TITLES);

/** `(name) => the name a link or label should show`: a titled member's (or documented component's)
 *  title; else, given the page's `navigation`, the title of the page `name` is the id of — never the
 *  raw page id; else `name` itself. */
export function useMemberTitle(navigation?: ReferenceNavigation): (name: string) => string {
  const { titles } = useContext(MemberTitlesContext);
  return (name) => {
    const own = titles.get(name);
    if (own !== undefined) return own;
    // Only a name that IS a page id (not a component or alias that merely resolves to one).
    const target = navigation?.resolve(name);
    return target && target.pageId === name && target.memberId === undefined ? navigation?.page?.(name)?.title ?? name : name;
  };
}

/** Names one page's titled members. Under the shell that holds this page (`pageIds` has `pageId`) it
 *  passes the shell's catalog-wide map through untouched: that map already holds this page's members,
 *  and only it can see other pages' names, so a one-page rule must not override it. Mounted on its own,
 *  or drawn inside another catalog's shell, the page names its own members. `whole` is the family's
 *  whole, which is left out; `pageId` keeps a member's `component` from taking the page's own name.
 *  The rule is `memberTitleMap`'s. Known limit: a specimen family whose id equals one of the outer
 *  shell's page ids is taken to be that page and reads the shell's map. */
export function MemberTitlesProvider({ members, whole, pageId, children }: { members: ReadonlyArray<Pick<CatalogMember, 'id' | 'title' | 'aliases' | 'component'>>; whole?: string; pageId?: string; children: ReactNode }) {
  const outer = useContext(MemberTitlesContext);
  const value = useMemo<MemberTitles>(() => {
    if (pageId !== undefined && outer.pageIds.has(pageId)) return outer;
    const titles = new Map<string, string>();
    addMemberTitles(titles, members, whole, memberNameScope([{ id: pageId ?? whole ?? '', members }]));
    return { titles, pageIds: new Set(pageId !== undefined ? [pageId] : []) };
  }, [outer, members, whole, pageId]);
  return createElement(MemberTitlesContext.Provider, { value }, children);
}
