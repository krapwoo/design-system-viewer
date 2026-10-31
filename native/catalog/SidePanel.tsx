import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';
import { CatalogButton } from './CatalogButton';
import type { ReferenceNavigation } from './catalogReferences';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

const PANEL_WIDTH = 440;
/** At or below this window width the panel takes the full width, as the approved design shows at
 *  768 (the viewer has no shared narrow breakpoint constant to reuse). */
const PANEL_FULL_WIDTH_AT_OR_BELOW = 768;
/** The light scrim behind the panel — no `CATALOG_COLOR` is a translucent overlay. */
const PANEL_SCRIM = 'rgba(20,20,20,.28)';

/** Wraps a `ReferenceNavigation` so following a link closes the panel first, then navigates. */
export function useClosingNavigation(navigation: ReferenceNavigation | undefined, onClose: () => void): ReferenceNavigation | undefined {
  return useMemo<ReferenceNavigation | undefined>(
    () =>
      navigation && {
        // Everything else the navigation offers (`page`, `isPart`) stays available inside the
        // panel: its links name pages by title, which needs `page`.
        ...navigation,
        resolve: (name) => navigation.resolve(name),
        open: (pageId, memberId, sourceMemberId) => {
          onClose();
          navigation.open(pageId, memberId, sourceMemberId);
        },
      },
    [navigation, onClose],
  );
}

/** The overlay side panel shell shared by a family member's "Notes and API" and a standalone
 *  page's: `role="dialog"`, `aria-modal`, named by its title, no animation. On web, `Modal`
 *  (transparent) supplies the dialog role, Esc to close, Tab containment, and returning focus to
 *  the trigger on close. React Native's own `Modal` does none of those on native (only
 *  `onRequestClose` for the hardware back button), so on native the panel moves screen-reader focus
 *  to the × itself on open (`AccessibilityInfo.setAccessibilityFocus`); it does not return focus to
 *  the trigger on close — that is left to the platform. */
export function SidePanel({ kicker, title, onClose, children }: { kicker: string; title: string; onClose: () => void; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const headingId = useId();
  const closeRef = useRef<View>(null);
  const focusClose = useCallback(() => {
    const node = closeRef.current;
    if (!node) return;
    if (Platform.OS === 'web') {
      node.focus?.();
      return;
    }
    const handle = findNodeHandle(node);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);
  // Locks the document's own scroll while the panel is open, for hosts whose body scrolls. The
  // shell's own pane needs nothing: `Modal` portals outside it, so wheel chaining from the scrim
  // never reaches it. Restores the previous overflow on close and on unmount. (iOS Safari ignores
  // body overflow for touch scrolling.)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => { body.style.overflow = previous; };
  }, []);
  // A plain-`href` link (no shell navigation) just changes the hash — close the panel on that too.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.addEventListener('hashchange', onClose);
    return () => window.removeEventListener('hashchange', onClose);
  }, [onClose]);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} onShow={focusClose} {...({ 'aria-labelledby': headingId } as Record<string, unknown>)}>
      <View style={styles.panelRoot}>
        {/* On web, a plain View, not a Pressable: the Modal's focus trap `focus()`es descendants in turn, and
            even a tabindex=-1 scrim would take focus — an unnamed, ringless stop. Press-to-close there is a
            click handler only (the × and Esc are the keyboard paths). */}
        {Platform.OS === 'web' ? (
          <View testID="member-panel-scrim" style={styles.panelScrim} {...({ onClick: onClose } as Record<string, unknown>)} />
        ) : (
          // Native has no DOM focus trap, so a Pressable is safe there and gives tap-to-close.
          <Pressable testID="member-panel-scrim" style={styles.panelScrim} onPress={onClose} accessible={false} />
        )}
        <View style={[styles.panel, width <= PANEL_FULL_WIDTH_AT_OR_BELOW && styles.panelFull]}>
          <View style={styles.panelHead}>
            <View style={styles.panelTitle}>
              <Text style={styles.panelKicker}>{kicker}</Text>
              <Text nativeID={headingId} role="heading" {...({ 'aria-level': 2 } as Record<string, unknown>)} style={styles.panelName}>
                {title}
              </Text>
            </View>
            <CatalogButton ref={closeRef} label="×" accessibilityLabel="Close" variant="secondary" onPress={onClose} />
          </View>
          <ScrollView style={styles.panelBody} contentContainerStyle={styles.panelBodyContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panelRoot: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  panelScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: PANEL_SCRIM },
  panel: { width: PANEL_WIDTH, maxWidth: '100%', height: '100%', backgroundColor: CATALOG_COLOR.surface, borderLeftWidth: 1, borderLeftColor: CATALOG_COLOR.borderStrong },
  panelFull: { width: '100%' },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: CATALOG_SPACE.md, padding: CATALOG_SPACE.lg, borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  panelTitle: { flex: 1, gap: 2 },
  panelKicker: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.textMuted },
  panelName: { ...CATALOG_TEXT.heading3, color: CATALOG_COLOR.text },
  panelBody: { flex: 1 },
  panelBodyContent: { padding: CATALOG_SPACE.lg },
});
