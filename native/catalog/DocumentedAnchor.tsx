import React, { useContext, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE } from './tokens';
import { DocumentedFocusContext } from './documentedFocusContext';
import { scrollAndFocusMember } from './scrollAndFocusMember';

/** Binds a tile to a component its page documents (`documents: [{ component, title }]`): opening
 *  that component's address — from a link, an anatomy pin, search or the URL — lands on this tile.
 *  It scrolls the tile to the top and outlines it until the reader goes somewhere else.
 *  `TokenTile` takes the same binding as its `documents` prop; wrap a custom tile in this. A name the
 *  page does not document is harmless: it simply never matches an address. */
export function DocumentedAnchor({ component, children }: { component: string; children: React.ReactNode }) {
  const focus = useContext(DocumentedFocusContext);
  const ref = useRef<View>(null);
  const focused = focus?.memberId === component;
  useEffect(() => {
    if (focused && ref.current) scrollAndFocusMember(ref.current);
  }, [focused, focus?.nonce]);
  return (
    <View ref={ref} tabIndex={-1} testID={`documented-${component}`} style={[styles.anchor, focused && styles.focused]} {...({ dataSet: { documented: component, focused: focused ? 'true' : undefined } } as Record<string, unknown>)}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { borderRadius: CATALOG_RADIUS.md, borderWidth: CATALOG_LAYOUT.focusRingWidth, borderColor: 'transparent', padding: CATALOG_SPACE.xs, margin: -(CATALOG_LAYOUT.focusRingWidth + CATALOG_SPACE.xs), outlineStyle: 'none' } as object,
  focused: { borderColor: CATALOG_COLOR.focusRing, backgroundColor: CATALOG_COLOR.accentSubtle },
});
