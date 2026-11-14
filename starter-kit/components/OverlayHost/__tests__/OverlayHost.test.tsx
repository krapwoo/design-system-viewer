// Ported from QQ's `OverlayHost.test.tsx`. QQ renders through a hand-written fake DOM with a stub
// `react-native`. Here the real react-native-web renders into jsdom: the layer is the DOM element
// `OverlayHost` draws, `pointerEvents="box-none"` is read from the CSS react-native-web generated for
// it, and window positions and `onLayout` are scripted by `layoutRig` (jsdom has no layout).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { act } from 'react';
// renderKit first: react-native-web reads `window` once, as it loads (see test/domBootstrap.ts).
import { declaredStyle, settle, withKit, withKitAsync, type KitRender } from '../../../../test/renderKit';
import { Text, View } from 'react-native';
import { fireLayout, isBoxNone, resizeWindow, scriptRects, setWindowSize } from './layoutRig';
import { OverlayHost, OverlayPortal, useOverlayHost, type OverlayHostApi } from '../OverlayHost';

beforeEach(() => setWindowSize(375, 667));

const app = (r: KitRender) => r.container.querySelector<HTMLElement>('[data-testid="app"]')!;
/** The host's root is `[content, layer]`; the layer is the box-none one. */
const layerOf = (r: KitRender) => {
  const layer = Array.from(r.container.querySelectorAll<HTMLElement>('div')).find(isBoxNone);
  assert.ok(layer, 'the host draws a box-none layer');
  return layer;
};
const layerText = (r: KitRender) => layerOf(r).textContent;

describe('OverlayHost layer', () => {
  it('draws one absolutely filled, box-none layer after (above) the app content, so touches pass through', async () => {
    await withKitAsync(<OverlayHost><View testID="app" /></OverlayHost>, async (r) => {
      await settle();
      const layer = layerOf(r);
      const style = declaredStyle(layer);
      assert.equal(style.position, 'absolute');
      for (const edge of ['left', 'right', 'top', 'bottom']) assert.equal(style[edge], '0px', `${edge}: 0`);
      // The layer is the later sibling of the content wrapper.
      const siblings = Array.from(layer.parentElement!.children);
      assert.equal(siblings.indexOf(layer), siblings.length - 1);
      assert.equal(Array.from(r.container.querySelectorAll('div')).filter(isBoxNone).length, 1, 'exactly one box-none layer');
    });
  });

  it('renders the app content inside the host, not in the overlay layer', async () => {
    await withKitAsync(<OverlayHost><View testID="app" /></OverlayHost>, async (r) => {
      await settle();
      assert.ok(app(r), 'the app content is rendered');
      assert.equal(layerOf(r).contains(app(r)), false);
    });
  });
});

describe('OverlayHost portal', () => {
  // `renderKit` has no rerender, so the props live in state and the test sets them through `set`.
  let set!: (next: { text: string; show: boolean }) => void;
  function Harness() {
    const [{ text, show }, setState] = useState({ text: 'first', show: true });
    set = setState;
    return (
      <OverlayHost>
        <View testID="app" />
        {show && (
          <OverlayPortal>
            <View testID="in-layer" />
            <Text>{text}</Text>
          </OverlayPortal>
        )}
      </OverlayHost>
    );
  }

  it('renders registered content in the layer, updates it, and removes it on unmount', async () => {
    await withKitAsync(<Harness />, async (r) => {
      await settle();
      assert.equal(layerText(r), 'first');
      assert.equal(layerOf(r).querySelectorAll('[data-testid="in-layer"]').length, 1);
      assert.equal(app(r).querySelectorAll('[data-testid="in-layer"]').length, 0, 'not rendered where the portal sits');
      await act(async () => set({ text: 'second', show: true }));
      assert.equal(layerText(r), 'second');
      await act(async () => set({ text: 'second', show: false }));
      assert.equal(layerText(r), '');
      assert.equal(r.container.querySelectorAll('[data-testid="in-layer"]').length, 0);
    });
  });

  it('mount/update/unmount work directly, and update/unmount of an unknown id are no-ops', async () => {
    let api!: OverlayHostApi;
    const Grab = () => { api = useOverlayHost()!; return null; };
    await withKitAsync(<OverlayHost><Grab /></OverlayHost>, async (r) => {
      await settle();
      let a = 0;
      let b = 0;
      await act(async () => { a = api.mount('A'); b = api.mount('B'); });
      assert.notEqual(a, b);
      assert.equal(layerText(r), 'AB');
      await act(async () => api.update(a, 'A2'));
      assert.equal(layerText(r), 'A2B');
      await act(async () => api.unmount(a));
      assert.equal(layerText(r), 'B');
      await act(async () => { api.unmount(999); api.update(999, 'ghost'); });
      assert.equal(layerText(r), 'B');
    });
  });

  it('a portal with no host renders nothing and does not throw', () => {
    withKit(<OverlayPortal><Text>in-layer</Text></OverlayPortal>, ({ container }) => {
      assert.equal(container.innerHTML, '');
    });
  });

  it('useOverlayHost is null without a host', () => {
    let seen: OverlayHostApi | null | undefined;
    const Probe = () => { seen = useOverlayHost(); return null; };
    withKit(<Probe />, () => {});
    assert.equal(seen, null);
  });
});

describe('OverlayHost origin', () => {
  const Grab = ({ onApi }: { onApi: (api: OverlayHostApi) => void }) => { onApi(useOverlayHost()!); return null; };

  it('measures its own window origin on layout and exposes it', async () => {
    let api!: OverlayHostApi;
    let rect = { x: 12, y: 34, width: 375, height: 667 };
    await withKitAsync(<OverlayHost><Grab onApi={(a) => { api = a; }} /></OverlayHost>, async (r) => {
      scriptRects(r.container, (el) => (isBoxNone(el) ? rect : undefined));
      // The mount-time measurement ran in an effect; `measureInWindow` answers one timer later.
      await settle();
      assert.deepEqual(api.origin, { x: 12, y: 34 });
      // The layer's onLayout re-measures too.
      rect = { x: 0, y: 24, width: 375, height: 643 };
      await fireLayout(layerOf(r), 375, 643);
      await settle();
      assert.deepEqual(api.origin, { x: 0, y: 24 });
    });
  });

  it('re-measures when the window size changes', async () => {
    let api!: OverlayHostApi;
    let rect = { x: 5, y: 5, width: 375, height: 667 };
    await withKitAsync(<OverlayHost><Grab onApi={(a) => { api = a; }} /></OverlayHost>, async (r) => {
      scriptRects(r.container, (el) => (isBoxNone(el) ? rect : undefined));
      await settle();
      assert.deepEqual(api.origin, { x: 5, y: 5 });
      // The host moves without being resized: only the window changed, so only that can trigger this.
      rect = { x: 50, y: 5, width: 375, height: 667 };
      await resizeWindow(r.container, 600, 667);
      await settle();
      assert.deepEqual(api.origin, { x: 50, y: 5 });
    });
  });
});
