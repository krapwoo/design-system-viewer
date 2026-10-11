import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_TYPE } from './tokens';
import { isFiniteOverlaySize, overlayStageDimensions, resolveOverlayViewport, type OverlaySlot } from './overlayViewport';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export interface BoundedOverlayViewportProps {
  /** This specimen's own page id — `SectionDef.id`. */
  pageId: string;
  /** Which block the demo wrapped here is authored in. */
  slot: OverlaySlot;
  /** That item's own key: `VariantExample.key` for `'variants'`/`'states'`, or
   *  `overlayViewport.ts`'s own `comparisonCellItemKey(rowKey, columnKey)` for a `'comparison'`
   *  cell — never inferred. */
  itemKey: string;
  /** `height` is the child document's exact usable viewport height, in CSS pixels — never
   *  renegotiated. `width` is only a MAXIMUM: this component adds no border or padding of its own
   *  (unlike `PhoneFrame`'s cosmetic hairline border), so this is the outer stage's widest possible
   *  size, but the stage still fills and shrinks to whatever its real owning specimen cell actually
   *  gives it at narrower widths — a fixed pixel width previously let the stage overflow a
   *  narrower owner and get silently clipped by it (see `overlayStageDimensions`). Both must be
   *  finite and strictly positive (`isFiniteOverlaySize`); an invalid value renders an honest
   *  unavailable state instead of an iframe sized to a meaningless bound. */
  width: number;
  height: number;
  /** The real, unmodified demo — the same node that would otherwise render directly on the page. */
  children: React.ReactNode;
}

/**
 * An opt-in, bounded browsing context for a specimen whose demo opens a modal/sheet/portal that
 * would otherwise escape its own card and cover the whole catalog page (RNW's Modal portals into
 * `document.body`, so no styled wrapper or `overflow: hidden` can give it a different boundary —
 * see the design's §5 "Bounded overlay viewport"). Opens a same-origin child document that boots
 * the SAME app entry/module/provider tree this catalog page itself runs under, sized to
 * `width`×`height`, so the demo's own overlay opens inside that rectangle instead of the outer
 * document's body — the real production component, unmodified: no renderer is copied, no prop is
 * mutated, no callback/source string is serialized or evaluated.
 *
 * Opt-in and additive: a page that never imports this renders exactly as it did before. Purely a
 * documentation device, like `PhoneFrame` — a real app screen never frames its own overlays this
 * way, since the actual device viewport already is the boundary.
 *
 * Browser-only containment: there is no native equivalent (React Native has no child-document
 * boundary to open), so on a native runtime this renders `children` directly, with no boundary.
 * Call sites must not read that fallback as native parity for the contained behavior.
 */
export function BoundedOverlayViewport({ pageId, slot, itemKey, width, height, children }: BoundedOverlayViewportProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const web = isWeb();
  const decision = resolveOverlayViewport({
    address: { pageId, slot, itemKey },
    isWeb: web,
    currentSearch: web ? window.location.search : '',
    pathname: web ? window.location.pathname : '',
  });

  // Not web, or this document IS the selected child for this exact address: render the real demo
  // directly — on native there is no containment to offer, and in the selected child document
  // framing again would recurse into another, identical child document forever.
  if (decision.mode === 'inline') return <>{children}</>;

  // An invalid bound (not finite, zero, negative — a measurement that hasn't settled yet, a
  // miscomputed layout value, an author typo) must never reach the iframe below: an honest
  // unavailable state, not a frame opened at some browser-decided fallback size.
  if (!isFiniteOverlaySize(width, height)) {
    return (
      <View style={styles.stage}>
        <Text style={styles.status}>This example is unavailable right now.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.stage, overlayStageDimensions(width, height)]}>
      {status !== 'ready' && (
        <Text style={styles.status}>{status === 'unavailable' ? 'This example is unavailable right now.' : 'Loading…'}</Text>
      )}
      {
        // react-native-web has no `<Iframe>` primitive; this is the one place this component
        // reaches past it for a genuine same-origin child document. `as unknown as string` only
        // bypasses React Native's own JSX.IntrinsicElements typing (which never declares host-web
        // tags) — the element itself, and every prop it's given, is still a plain, real iframe.
        React.createElement('iframe' as unknown as string, {
          src: decision.href,
          title: `${pageId}: ${itemKey}`,
          style: { ...StyleSheet.flatten(styles.frame), display: status === 'unavailable' ? 'none' : undefined },
          onLoad: () => setStatus('ready'),
          onError: () => setStatus('unavailable'),
        })
      }
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: CATALOG_COLOR.surfacePressed,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  status: { position: 'absolute', fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
});
