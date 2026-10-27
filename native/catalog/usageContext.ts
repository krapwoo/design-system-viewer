import { createContext, useContext } from 'react';
import type { UsageData } from './usage';

/** `FamilyPage` and `GroupPage` provide the catalog's usage data here so a member deep in the part
 *  tree can look up its own entry without a prop on every layer in between. */
export const UsageContext = createContext<UsageData | null>(null);

export function useUsage(): UsageData | null {
  return useContext(UsageContext);
}
