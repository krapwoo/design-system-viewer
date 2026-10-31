import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { addMemberTitles, memberNameScope } from './familyModel';
import type { CatalogMember } from './types';

/** The catalog-wide displayed names of titled family/group members, by id and alias
 *  (`memberTitleMap`). `CatalogShell` provides it so a link or label deep in a page (a Uses line, a
 *  part list, the anatomy legend) can show a member's title without a prop on every layer. */
const NO_OUTER_TITLES: ReadonlyMap<string, string> = new Map();
export const MemberTitlesContext = createContext<ReadonlyMap<string, string>>(NO_OUTER_TITLES);

/** `(name) => the member's title`, or `name` itself when it has none (or is not a member). */
export function useMemberTitle(): (name: string) => string {
  const titles = useContext(MemberTitlesContext);
  return (name) => titles.get(name) ?? name;
}

/** Names one page's titled members when the page is mounted on its own, outside the shell. Under the
 *  shell it passes the shell's catalog-wide map through untouched: that map already holds this page's
 *  members, and only it can see other pages' names, so a one-page rule must not override it. `whole` is
 *  the family's whole, which is left out; `pageId` keeps a member's `component` from taking the
 *  page's own name. The rule is `memberTitleMap`'s. */
export function MemberTitlesProvider({ members, whole, pageId, children }: { members: ReadonlyArray<Pick<CatalogMember, 'id' | 'title' | 'aliases' | 'component'>>; whole?: string; pageId?: string; children: ReactNode }) {
  const outer = useContext(MemberTitlesContext);
  const merged = useMemo(() => {
    if (outer !== NO_OUTER_TITLES) return outer;
    const titles = new Map<string, string>();
    addMemberTitles(titles, members, whole, memberNameScope([{ id: pageId ?? whole ?? '', members }]));
    return titles;
  }, [outer, members, whole, pageId]);
  return createElement(MemberTitlesContext.Provider, { value: merged }, children);
}
