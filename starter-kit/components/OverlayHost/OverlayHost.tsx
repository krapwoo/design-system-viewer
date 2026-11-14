import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

/** A point in window coordinates (what `measureInWindow` returns). */
export interface OverlayOrigin {
  x: number;
  y: number;
}

/** What a consumer gets from `useOverlayHost()`. Private-ish: Tooltip is its only consumer today. */
export interface OverlayHostApi {
  /** Adds `node` to the overlay layer and returns its id. */
  mount: (node: ReactNode) => number;
  /** Replaces what an id renders. A no-op for an id that was already unmounted. */
  update: (id: number, node: ReactNode) => void;
  /** Removes an id from the overlay layer. A no-op for an unknown id. */
  unmount: (id: number) => void;
  /** The host's own top-left corner in window coordinates. Content placed in the layer is
   *  positioned relative to the host, so a consumer working in window coordinates subtracts this. */
  origin: OverlayOrigin;
}

const OverlayHostContext = createContext<OverlayHostApi | null>(null);

/** The nearest OverlayHost's API, or `null` when there is none (callers fall back, never throw). */
export function useOverlayHost(): OverlayHostApi | null {
  return useContext(OverlayHostContext);
}

export interface OverlayHostProps {
  /** The app's content. The overlay layer is drawn above it. */
  children: ReactNode;
}

interface Entry {
  id: number;
  node: ReactNode;
}

/**
 * Mount once near the app root (like `SafeAreaProvider`). It wraps the app's content and draws one
 * overlay layer above it: an absolutely filled View with `pointerEvents="box-none"`, so touches pass
 * through wherever nothing is drawn. Content is added through context (`mount`/`update`/`unmount`, or
 * the `OverlayPortal` component built on them) and rendered inside that layer, outside every
 * ancestor of the component that asked for it, so a `ScrollView` or a rounded `overflow: 'hidden'`
 * card cannot clip it. It is not a Modal: it takes no focus and blocks no touches.
 *
 * Coordinates: the layer's origin is the host's own top-left corner, which is not necessarily the
 * window's (a phone frame in the catalog, a translucent Android status bar). The host measures its
 * own window position (`measureInWindow`, on layout and whenever the window size changes) and
 * exposes it as `origin`; a consumer positioning in window coordinates subtracts it.
 *
 * The app content sits in its own View so the layer is the later sibling of one View, and so beats
 * any elevated or z-indexed descendant of the content on Android, where `zIndex` only orders siblings.
 */
export function OverlayHost({ children }: OverlayHostProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [origin, setOrigin] = useState<OverlayOrigin>({ x: 0, y: 0 });
  const nextId = useRef(1);
  const layerRef = useRef<View>(null);

  const mount = useCallback((node: ReactNode) => {
    const id = nextId.current++;
    setEntries((current) => [...current, { id, node }]);
    return id;
  }, []);
  const update = useCallback((id: number, node: ReactNode) => {
    setEntries((current) => (current.some((e) => e.id === id) ? current.map((e) => (e.id === id ? { id, node } : e)) : current));
  }, []);
  const unmount = useCallback((id: number) => {
    setEntries((current) => (current.some((e) => e.id === id) ? current.filter((e) => e.id !== id) : current));
  }, []);

  const measureOrigin = useCallback(() => {
    layerRef.current?.measureInWindow((x, y) => setOrigin((o) => (o.x === x && o.y === y ? o : { x, y })));
  }, []);
  // onLayout only fires when the size changes, and a window resize can move the host without
  // resizing it, so the window size re-measures too.
  useEffect(measureOrigin, [measureOrigin, windowWidth, windowHeight]);

  const api = useMemo<OverlayHostApi>(() => ({ mount, update, unmount, origin }), [mount, update, unmount, origin]);

  return (
    <OverlayHostContext.Provider value={api}>
      <View style={styles.root}>
        <View style={styles.content}>{children}</View>
        <View ref={layerRef} pointerEvents="box-none" style={styles.layer} onLayout={measureOrigin}>
          {entries.map((e) => (
            <React.Fragment key={e.id}>{e.node}</React.Fragment>
          ))}
        </View>
      </View>
    </OverlayHostContext.Provider>
  );
}

/** Renders `children` into the nearest OverlayHost's layer (nothing, where there is no host). */
export function OverlayPortal({ children }: { children: ReactNode }) {
  const host = useOverlayHost();
  const mount = host?.mount;
  const update = host?.update;
  const unmount = host?.unmount;
  const idRef = useRef<number | null>(null);
  const latest = useRef(children);
  latest.current = children;

  useEffect(() => {
    if (!mount || !unmount) return undefined;
    idRef.current = mount(latest.current);
    return () => {
      if (idRef.current != null) unmount(idRef.current);
      idRef.current = null;
    };
  }, [mount, unmount]);

  // Runs after every render so the layer always shows the latest children; the host re-renders only
  // itself, not the app content (an unchanged `children` element bails out).
  useEffect(() => {
    if (update && idRef.current != null) update(idRef.current, children);
  });

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  layer: { ...StyleSheet.absoluteFill, zIndex: 1 },
});
