import React, { createContext, useContext, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DS_SEMANTIC } from '../../tokens';

export type SurfaceTone = 'white' | 'muted';

// Defaults to 'white' — a screen with no explicit <SurfaceScope> ancestor is assumed to sit on a
// white background, the common case (matches e.g. Card's own default fill).
const SurfaceToneContext = createContext<SurfaceTone>('white');

/** What background tone the nearest ancestor `<SurfaceScope>` declared (or 'white' if there isn't
 *  one). Components that need to contrast with whatever's actually behind them — FieldContainer/
 *  InputField today — read this instead of assuming one fixed background. */
export function useSurfaceTone(): SurfaceTone {
  return useContext(SurfaceToneContext);
}

export interface SurfaceScopeProps {
  /** Which background this scope renders. Descendants read this via `useSurfaceTone()` to
   *  automatically pick a fill that contrasts with it (e.g. a field goes white on a muted page,
   *  recessed on a white one) instead of needing to be told individually. */
  tone: SurfaceTone;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Declares "this subtree's background is `tone`": renders a plain View filled with the matching
 * token (`surface.white` or `surface.main`) **and** publishes that tone to everything inside it.
 *
 * The second half is the reason this is a component and not just a token. `DS_SEMANTIC.surface.*`
 * already holds the values; what a value cannot do is tell a descendant what it is sitting on.
 * `FieldContainer` and `InputField` call `useSurfaceTone()` to choose between a translucent
 * recessed fill and an opaque white one, so a field stays visible either way — that only works
 * because something above them declared the tone. This is a scoped background declaration, which
 * is why it is named for the scope rather than for the surface itself.
 *
 * Wrap a screen (or any region) wherever its background isn't the default white.
 */
export function SurfaceScope({ tone, style, children }: SurfaceScopeProps) {
  return (
    <SurfaceToneContext.Provider value={tone}>
      <View style={[tone === 'white' ? styles.white : styles.muted, style]}>{children}</View>
    </SurfaceToneContext.Provider>
  );
}

const styles = StyleSheet.create({
  white: { backgroundColor: DS_SEMANTIC.surface.white },
  muted: { backgroundColor: DS_SEMANTIC.surface.main },
});
