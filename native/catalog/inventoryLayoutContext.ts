// Kept out of Inventory.tsx so the component scanner doesn't read the context as a component.
import { createContext } from 'react';

/** How an `Inventory` draws: `'sections'` is the token-page layout (banner and filter chips at page
 *  level, each group its own section: title and description outside, tiles in the group's own box);
 *  `'inline'` is everything in the box it is placed in, chips on top and groups one under another. */
export type InventoryLayout = 'sections' | 'inline';

/** The layout an `Inventory` and its groups draw in unless the `Inventory` sets `layout`. A page whose
 *  content is an `Inventory` (after any banners) draws it unboxed and provides `'sections'` (`SectionBlock`);
 *  anywhere else it is `'inline'`, because the box around it is already the section. */
export const inventoryLayoutContext = createContext<InventoryLayout>('inline');
