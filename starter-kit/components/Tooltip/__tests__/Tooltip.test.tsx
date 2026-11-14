// Ported from QQ's `Tooltip.test.tsx`. QQ renders through a hand-written fake DOM with a stub
// `react-native`; here the real react-native-web renders into jsdom. The bubble is the element with
// `aria-live="polite"`; its slot's position is read from the CSS react-native-web generated for it.
// jsdom has no layout, so `layoutRig` scripts where `measureInWindow` says things are and fires the
// bubble's `onLayout`. Like the rest of these tests this proves structure and the numbers fed to
// the style, never real geometry.
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { act } from 'react';
// renderKit first: react-native-web reads `window` once, as it loads (see test/domBootstrap.ts).
import { declaredStyle, settle, withKitAsync, type KitRender } from '../../../../test/renderKit';
import { View } from 'react-native';
import { fireLayout, isBoxNone, isPointerNone, resizeWindow, scriptRects, setWindowSize, type Rect } from '../../OverlayHost/__tests__/layoutRig';
import { OverlayHost } from '../../OverlayHost';
import { Tooltip, computeTooltipPosition, type TooltipPositionInput } from '../Tooltip';

// GAP, EDGE_MARGIN and EDGE_OVERHANG are DS_SPACING[200] / [400] / [400]: 4, 8, 8 points.
const GAP = 4;
const MARGIN = 8;
const OVERHANG = 8;

const base: TooltipPositionInput = {
  trigger: { x: 150, y: 300, width: 40, height: 40 },
  bubble: { width: 80, height: 30 },
  windowWidth: 375,
  placement: 'top',
  align: 'center',
  origin: { x: 0, y: 0 },
};
const at = (over: Partial<TooltipPositionInput>) => computeTooltipPosition({ ...base, ...over });

describe('computeTooltipPosition', () => {
  it('centres the bubble on the trigger and points the arrow at the trigger centre', () => {
    // trigger centre 170, bubble 80 wide -> left 130; arrow at 170 - 130 = 40 (the bubble's middle)
    assert.deepEqual(at({}), { left: 130, top: 300 - GAP - 30, arrowLeft: 40 });
  });

  it('align="left" overhangs the trigger\'s left edge by EDGE_OVERHANG; the arrow still points at the true centre', () => {
    const p = at({ align: 'left' });
    assert.equal(p.left, 150 - OVERHANG);
    assert.equal(p.arrowLeft, 170 - p.left);
  });

  it('align="right" lines the bubble up past the trigger\'s right edge by EDGE_OVERHANG', () => {
    const p = at({ align: 'right' });
    assert.equal(p.left, 150 + 40 + OVERHANG - 80);
    assert.equal(p.arrowLeft, 170 - p.left);
  });

  it('clamps to the left screen edge by EDGE_MARGIN, keeping the arrow on the trigger', () => {
    const p = at({ trigger: { x: 0, y: 300, width: 24, height: 24 } });
    assert.equal(p.left, MARGIN);
    assert.equal(p.arrowLeft, 12 - MARGIN);
  });

  it('clamps to the right screen edge by EDGE_MARGIN, keeping the arrow on the trigger', () => {
    const p = at({ trigger: { x: 351, y: 300, width: 24, height: 24 } });
    assert.equal(p.left, 375 - 80 - MARGIN);
    assert.equal(p.arrowLeft, 363 - p.left);
  });

  it('keeps the arrow inside the bubble when the trigger is outside the clamped bubble', () => {
    assert.equal(at({ trigger: { x: 0, y: 300, width: 1, height: 1 }, bubble: { width: 20, height: 30 } }).arrowLeft, 0);
    assert.equal(at({ trigger: { x: 374, y: 300, width: 1, height: 1 }, bubble: { width: 20, height: 30 } }).arrowLeft, 20);
  });

  it('puts a bubble wider than the screen at the left margin instead of NaN or a negative offset', () => {
    const p = at({ bubble: { width: 400, height: 30 } });
    assert.equal(p.left, MARGIN);
    assert.equal(Number.isFinite(p.arrowLeft), true);
  });

  it('placement="top" sits GAP above the trigger; "bottom" sits GAP below it', () => {
    assert.equal(at({ placement: 'top' }).top, 300 - GAP - 30);
    assert.equal(at({ placement: 'bottom' }).top, 300 + 40 + GAP);
  });

  it('subtracts a non-zero host origin from both axes, without changing the arrow', () => {
    const shifted = at({ origin: { x: 20, y: 50 } });
    const plain = at({});
    assert.equal(shifted.left, plain.left - 20);
    assert.equal(shifted.top, plain.top - 50);
    assert.equal(shifted.arrowLeft, plain.arrowLeft);
  });

  it('clamps in window coordinates, then converts: an offset host does not move the clamp', () => {
    const p = at({ trigger: { x: 0, y: 300, width: 24, height: 24 }, origin: { x: 30, y: 0 } });
    assert.equal(p.left, MARGIN - 30);
  });
});

// --- rendering ---------------------------------------------------------------------------------

const TRIGGER: Rect = { x: 100, y: 300, width: 40, height: 40 };
const HOST: Rect = { x: 10, y: 20, width: 375, height: 647 };

type Props = { visible?: boolean; placement?: 'top' | 'bottom'; align?: 'left' | 'center' | 'right'; host?: boolean };

// `renderKit` has no rerender, so the props live in state and the test sets them through `set`.
let set!: (next: Props) => void;
function Shell(initial: Props) {
  const [{ visible = true, placement = 'top', align = 'center', host = true }, setProps] = useState<Props>(initial);
  set = setProps;
  const tip = (
    <Tooltip visible={visible} label="Tip" placement={placement} align={align}>
      <View testID="trigger" />
    </Tooltip>
  );
  return host ? <OverlayHost>{tip}</OverlayHost> : tip;
}

/** What an element is drawn with: react-native-web's generated classes (`StyleSheet.create` styles), under
 *  the inline `style` it gives a plain object (the computed left/top and margins). */
const styleOf = (el: HTMLElement): Record<string, string> => {
  const inline: Record<string, string> = {};
  for (let i = 0; i < el.style.length; i++) inline[el.style[i]] = el.style.getPropertyValue(el.style[i]);
  return { ...declaredStyle(el), ...inline };
};

const bubbleOf = (r: KitRender) => r.container.querySelector<HTMLElement>('[aria-live="polite"]');
const bubble = (r: KitRender) => {
  const el = bubbleOf(r);
  assert.ok(el, 'the bubble is rendered');
  return el;
};
/** The slot the host draws the bubble in: bubble -> its wrapper -> the slot. */
const slotOf = (r: KitRender) => bubble(r).parentElement!.parentElement!;
const triggerWrap = (r: KitRender) => r.container.querySelector<HTMLElement>('[data-testid="trigger"]')!.parentElement!;
const layerOf = (r: KitRender) => Array.from(r.container.querySelectorAll<HTMLElement>('div')).find(isBoxNone);

let hostRect: Rect;
let triggerMeasures: number;
/** The host's layer reports `hostRect`; the Tooltip's wrapper (the trigger's parent) reports TRIGGER. */
function wire(r: KitRender) {
  hostRect = HOST;
  triggerMeasures = 0;
  scriptRects(r.container, (el) => {
    if (isBoxNone(el)) return hostRect;
    if (el.firstElementChild?.getAttribute('data-testid') === 'trigger') { triggerMeasures++; return TRIGGER; }
    return undefined;
  });
}
/** Past the animation frame the measurement waits for, and the timer `measureInWindow` answers on. */
const flush = () => settle(40);

let warn: ReturnType<typeof mock.method>;
/** react-native-web warns about other things (a deprecated prop); only Tooltip's own warning counts. */
const hostWarnings = () => warn.mock.calls.filter((c) => /OverlayHost/.test(String(c.arguments[0])));
beforeEach(() => {
  setWindowSize(375, 667);
  warn = mock.method(console, 'warn', () => {});
});
afterEach(() => mock.restoreAll());

// `warnedNoHost` is module state: the first development-mode Tooltip without a host warns, and no
// later one does. These two tests therefore come first, before any other test renders without a host.
describe('Tooltip without an OverlayHost', () => {
  it('does not warn outside development', async () => {
    const g = globalThis as Record<string, unknown>;
    g.__DEV__ = false;
    try {
      await withKitAsync(<Shell host={false} />, async () => { await flush(); });
    } finally {
      g.__DEV__ = true;
    }
    assert.equal(hostWarnings().length, 0);
  });

  it('warns once in development, naming OverlayHost, and never throws', async () => {
    await withKitAsync(<Shell host={false} />, async () => {
      await flush();
      assert.equal(hostWarnings().length, 1);
      await act(async () => set({ host: false, visible: false }));
      await act(async () => set({ host: false, visible: true }));
    });
    await withKitAsync(<Shell host={false} />, async () => { await flush(); });
    assert.equal(hostWarnings().length, 1, 'a second show, and a second Tooltip, do not warn again');
  });

  it('renders the bubble in place, beside the trigger, exactly as before', async () => {
    await withKitAsync(<Shell host={false} />, async (r) => {
      wire(r);
      await flush();
      assert.ok(triggerWrap(r).contains(bubble(r)), 'inside the trigger wrapper');
      assert.equal(layerOf(r), undefined, 'there is no overlay layer');
      const wrapper = bubble(r).parentElement!;
      const overlay = wrapper.parentElement!;
      assert.equal(isPointerNone(overlay), true);
      const overlayStyle = styleOf(overlay);
      assert.equal(overlayStyle.bottom, '100%');
      assert.equal(overlayStyle['margin-bottom'], `${GAP}px`);
      // Before the bubble has a size: the old flex-centred fallback.
      assert.equal(styleOf(wrapper)['align-self'], 'center');
      await fireLayout(bubble(r), 80, 30);
      const placed = styleOf(wrapper);
      assert.equal(placed['align-self'], 'flex-start');
      assert.equal(placed['margin-left'], `${80 - TRIGGER.x}px`);
    });
  });
});

describe('Tooltip through an OverlayHost', () => {
  it('renders the bubble in the host layer, not inside the trigger wrapper', async () => {
    await withKitAsync(<Shell />, async (r) => {
      wire(r);
      await flush();
      assert.ok(layerOf(r)!.contains(bubble(r)), 'inside the layer');
      assert.equal(triggerWrap(r).contains(bubble(r)), false, 'not inside the trigger wrapper');
      assert.equal(triggerWrap(r).querySelectorAll('[aria-live="polite"]').length, 0);
    });
  });

  it('keeps the bubble non-interactive and announced politely', async () => {
    await withKitAsync(<Shell />, async (r) => {
      wire(r);
      await flush();
      assert.equal(isPointerNone(slotOf(r)), true);
      assert.equal(bubble(r).getAttribute('aria-live'), 'polite');
    });
  });

  it('draws nothing visible at 0,0 before the trigger and bubble are measured', async () => {
    await withKitAsync(<Shell />, async (r) => {
      wire(r);
      const slot = styleOf(slotOf(r));
      assert.equal(slot.opacity, '0');
      assert.equal(slot.left, '0px');
      assert.equal(slot.top, '0px');
    });
  });

  it('positions the bubble at the trigger\'s window position minus the host origin', async () => {
    await withKitAsync(<Shell />, async (r) => {
      wire(r);
      await flush();
      await fireLayout(bubble(r), 80, 30);
      const slot = styleOf(slotOf(r));
      // centre: trigger centre 120 - 40 = 80 in the window -> 70 in the host; top: 300 - GAP - 30 = 266 -> 246
      assert.equal(slot.left, `${80 - HOST.x}px`);
      assert.equal(slot.top, `${300 - GAP - 30 - HOST.y}px`);
      assert.equal(slot.opacity, undefined, 'visible once both are measured');
    });
  });

  it('places a bottom bubble below the trigger', async () => {
    await withKitAsync(<Shell placement="bottom" />, async (r) => {
      wire(r);
      await flush();
      await fireLayout(bubble(r), 80, 30);
      const slot = styleOf(slotOf(r));
      assert.equal(slot.left, `${80 - HOST.x}px`);
      assert.equal(slot.top, `${300 + 40 + GAP - HOST.y}px`);
    });
  });

  it('follows the host when its origin changes', async () => {
    await withKitAsync(<Shell />, async (r) => {
      wire(r);
      await flush();
      await fireLayout(bubble(r), 80, 30);
      hostRect = { ...HOST, y: 0 };
      await fireLayout(layerOf(r)!, 375, 667);
      await settle();
      const slot = styleOf(slotOf(r));
      assert.equal(slot.left, `${80 - HOST.x}px`);
      assert.equal(slot.top, `${300 - GAP - 30}px`);
    });
  });

  it('re-measures when it becomes visible and when the window size changes', async () => {
    await withKitAsync(<Shell visible={false} />, async (r) => {
      wire(r);
      await flush();
      assert.equal(triggerMeasures, 0, 'a hidden tooltip does not measure its trigger');
      await act(async () => set({ visible: true }));
      await flush();
      assert.ok(triggerMeasures > 0, 'measured on show');
      const afterShow = triggerMeasures;
      await resizeWindow(r.container, 500, 667);
      await flush();
      assert.ok(triggerMeasures > afterShow, 'measured again on a window resize');
    });
  });

  it('removes the bubble from the layer when hidden, and shows nothing stale when shown again', async () => {
    await withKitAsync(<Shell />, async (r) => {
      wire(r);
      await flush();
      await fireLayout(bubble(r), 80, 30);
      await act(async () => set({ visible: false }));
      assert.equal(bubbleOf(r), null);
      await act(async () => set({ visible: true }));
      // Shown again, not yet re-measured: it must not reappear at the last position.
      assert.equal(styleOf(slotOf(r)).opacity, '0');
    });
  });

  it('does not warn when a host is present', async () => {
    await withKitAsync(<Shell />, async (r) => {
      wire(r);
      await flush();
    });
    assert.equal(hostWarnings().length, 0);
  });
});
