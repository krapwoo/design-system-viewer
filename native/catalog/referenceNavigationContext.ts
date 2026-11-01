import { createContext, useContext } from 'react';
import type { ReferenceNavigation } from './catalogReferences';

/** The shell's own address resolution, opening and page titles, for a block deep in a page (an
 *  `InventoryTile` inside a category page's `render()`) that has no prop to receive it through.
 *  `CatalogShell` provides it; outside a shell it is `undefined`. */
export const ReferenceNavigationContext = createContext<ReferenceNavigation | undefined>(undefined);

export function useReferenceNavigation(): ReferenceNavigation | undefined {
  return useContext(ReferenceNavigationContext);
}
