import React, { createContext, useContext } from 'react';
import type { OverlayAddress } from './overlayViewport';

const SpecimenAddressContext = createContext<OverlayAddress | undefined>(undefined);

/** Tells the example rendered inside it which catalog example it is (page, slot, item key), so a
 *  `PhoneFrame` in it can open that one example in its own device-sized document. Set by the
 *  catalog's own list, grid and preview renderers, and by the child document itself. */
export function SpecimenAddressProvider({ address, children }: { address: OverlayAddress | undefined; children: React.ReactNode }) {
  return <SpecimenAddressContext.Provider value={address}>{children}</SpecimenAddressContext.Provider>;
}

export function useSpecimenAddress(): OverlayAddress | undefined {
  return useContext(SpecimenAddressContext);
}
