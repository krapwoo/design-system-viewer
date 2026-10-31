import { AccessibilityInfo, Platform, findNodeHandle, type View } from 'react-native';

/** Scrolls a member's node into view and moves focus to it (spec §5.3 "Member address"). The jump
 *  is always instant, like a normal anchor link: a smooth `scrollIntoView` does not reliably move
 *  the shell's nested scroll container on web (the same limitation `CatalogShell`'s
 *  `resetMainScroll` works around), and an instant jump also satisfies Reduce Motion. Native has
 *  no scroll-into-view of its own; `AccessibilityInfo`'s focus call is enough there.
 *
 *  #63 R2: `GroupPage.tsx` reuses the exact same jump mechanics for its own member addresses, and
 *  `DocumentedAnchor.tsx` for a documented component's tile — one implementation. */
export function scrollAndFocusMember(node: View): void {
  if (Platform.OS === 'web') {
    const dom = node as unknown as { scrollIntoView?: (options: { behavior: 'auto'; block: 'start' }) => void; focus?: (options?: { preventScroll?: boolean }) => void };
    dom.scrollIntoView?.({ behavior: 'auto', block: 'start' });
    dom.focus?.({ preventScroll: true });
    return;
  }
  const handle = findNodeHandle(node as unknown as View);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}
