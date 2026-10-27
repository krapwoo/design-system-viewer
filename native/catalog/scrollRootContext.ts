import { createContext } from 'react';

/** `CatalogShell` provides a way to reach its main column's scrollable DOM node here. A thumbnail's
 *  `IntersectionObserver` needs that node as its `root`: the cards scroll inside the column, which
 *  clips them, so a lookahead margin measured against the window would never take effect. Absent
 *  (or `null` back): the observer falls back to the window. */
export const ScrollRootContext = createContext<(() => Element | null) | null>(null);
