import { createContext } from 'react';

/** The component address the shell last opened on this page (`#HeaderLogo`), and the nonce it bumps
 *  on every activation so a repeat press scrolls again. `SectionBlock` provides it and
 *  `DocumentedAnchor` reads it; a standalone mount has none, so an anchor there never highlights. */
export interface DocumentedFocus {
  memberId?: string;
  nonce?: number;
}
export const DocumentedFocusContext = createContext<DocumentedFocus | undefined>(undefined);
