import React, { useState, useRef } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_TEXT } from './tokens';
import { DEVICE_FRAME, DEVICE_SCALE_WARN_BELOW, deviceFrameScale } from './deviceFrame';
import { resolveOverlayViewport } from './overlayViewport';
import { useSpecimenAddress } from './SpecimenAddress';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/**
 * A real phone screen for a live demo: a screen, a sheet, a dialog, a toast sliding in.
 *
 * - **Real dimensions.** The demo lays out in a viewport of exactly `DEVICE_FRAME` (iPhone SE,
 *   375 × 667 points). A cell narrower than that scales the whole device down rather than
 *   squeezing its layout.
 * - **A real viewport on the web.** Inside a catalog example, the frame opens that one example in
 *   its own child document at device size (the same mechanism as `BoundedOverlayViewport`). Its
 *   window is the device: anything that portals to the document body, such as React Native's
 *   `Modal`, opens inside the phone instead of over the whole catalog, and the window reports the
 *   device's size.
 * - **Elsewhere** (native, or a frame outside a catalog example) it renders inline at the same
 *   size; overlays that portal to the body are then not contained.
 *
 * Centred in its cell by its own full-width measuring wrapper, whatever the cell's alignment.
 * Purely a documentation device: a real app screen never frames itself, so this lives in the
 * catalog framework rather than in an app's component library.
 */
export function PhoneFrame({
  children,
  intentionalScale = false,
}: {
  children: React.ReactNode;
  /** This example is *about* the scaling — a page demonstrating that a narrow cell shrinks the
   *  device rather than reflowing it. Declared here, in the example itself, so the exemption is
   *  visible where the decision was made instead of hidden in config. */
  intentionalScale?: boolean;
}) {
  const address = useSpecimenAddress();
  const [available, setAvailable] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0 && width !== available) setAvailable(width);
  };
  const scale = deviceFrameScale(available);
  // A scaled device is a page that under-declared its width: the cell it was given is narrower
  // than the phone, so the whole viewport shrinks and the example's own text shrinks with it,
  // which is not the size anyone reads the component at. The scale is already computed, so this
  // needs no measurement of its own. Guarded to once per transition, like TokenSections' own
  // degradation warning; `check:catalog` fails on any [Catalog] warning, so this blocks CI.
  const warnedScale = useRef<string | undefined>(undefined);
  if (!intentionalScale && available > 0 && scale < DEVICE_SCALE_WARN_BELOW && (globalThis as { __DEV__?: boolean }).__DEV__) {
    const key = `${available}`;
    if (warnedScale.current !== key) {
      warnedScale.current = key;
      const where = address ? `${address.pageId} (${address.slot}/${address.itemKey})` : 'a PhoneFrame';
      console.warn(
        `[Catalog] ${where} is shown at ${Math.round(scale * 100)}% of device size: its cell is ${available}px, ` +
          `narrower than the ${DEVICE_FRAME.width}px device. Declare a larger specimenSize so the example keeps the width it is used at.`,
      );
    }
  }
  // Until the cell is measured, fit it at the device's proportions rather than drawing at full size
  // for a frame (which would briefly overflow a cell narrower than the device).
  const box = available > 0
    ? { width: DEVICE_FRAME.width * scale, height: DEVICE_FRAME.height * scale }
    : { width: '100%' as const, maxWidth: DEVICE_FRAME.width, aspectRatio: DEVICE_FRAME.width / DEVICE_FRAME.height };

  if (isWeb() && address) {
    const decision = resolveOverlayViewport({
      address,
      isWeb: true,
      currentSearch: window.location.search,
      pathname: window.location.pathname,
    });
    // This document is the device itself: fill it edge to edge.
    if (decision.mode === 'inline') return <View style={styles.screenFill}>{children}</View>;
    return (
      <View style={styles.measure} onLayout={onLayout}>
        <View style={[styles.device, box]}>
          {status !== 'ready' && (
            <Text style={styles.status}>{status === 'unavailable' ? 'This example is unavailable right now.' : 'Loading…'}</Text>
          )}
          {
            // react-native-web has no iframe primitive; this is a plain same-origin iframe.
            React.createElement('iframe' as unknown as string, {
              src: decision.href,
              title: `${address.pageId} on ${DEVICE_FRAME.name} (${DEVICE_FRAME.width} × ${DEVICE_FRAME.height})`,
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: DEVICE_FRAME.width,
                height: DEVICE_FRAME.height,
                border: 0,
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
                visibility: status === 'ready' ? 'visible' : 'hidden',
              },
              onLoad: () => setStatus('ready'),
              onError: () => setStatus('unavailable'),
            })
          }
        </View>
      </View>
    );
  }

  return (
    <View style={styles.measure} onLayout={onLayout}>
      <View style={[styles.device, box]}>
        <View style={[styles.screenInline, { transform: [{ scale }], transformOrigin: 'top left' } as object]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Spans the cell so the device can be measured against it and centred in it.
  measure: { width: '100%', alignItems: 'center' },
  device: {
    borderRadius: CATALOG_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CATALOG_COLOR.border,
    backgroundColor: CATALOG_COLOR.surfacePressed,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenInline: {
    width: DEVICE_FRAME.width,
    height: DEVICE_FRAME.height,
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // The child document's whole window is the device screen: exactly the device's height, never
  // more, so a `flex: 1` scroll area inside a demo shrinks to fit and scrolls instead of growing.
  screenFill: {
    width: '100%',
    height: DEVICE_FRAME.height,
    backgroundColor: CATALOG_COLOR.surfacePressed,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  status: { position: 'absolute', ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
});
