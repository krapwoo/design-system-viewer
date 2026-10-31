/**
 * Pure model of SwiftUI's built-in `.transition(...)` values for `MotionSpecimen`'s `transition`
 * kind, kept free of any `react-native` import so `node --test` can assert on it directly (see
 * `native/catalog/__tests__/transitionModel.test.ts`).
 *
 * A transition describes how a view looks while it is *not* on screen; inserting animates from that
 * look to the normal one, removing animates from the normal one back to it. So each transition
 * resolves, per phase, to one "off" state (`transitionOffState`); the on state is always
 * `IDENTITY_STATE`. Translations are in px for a sample element of a given size, because SwiftUI's
 * `move(edge:)`, `slide` and `push(from:)` offset a view by its own size.
 *
 * Layout is left-to-right: `leading` is the left edge and `trailing` the right.
 */

/** A SwiftUI edge, as `Edge`/`Edge.Set` names it. */
export type TransitionEdge = 'top' | 'bottom' | 'leading' | 'trailing';

/** A SwiftUI `UnitPoint` by name. `center` is `scale`'s default. */
export type TransitionAnchor =
  | 'center' | 'top' | 'bottom' | 'leading' | 'trailing'
  | 'topLeading' | 'topTrailing' | 'bottomLeading' | 'bottomTrailing';

/**
 * A SwiftUI built-in transition, written declaratively:
 *
 * | SwiftUI                                   | here                                              |
 * | ----------------------------------------- | ------------------------------------------------- |
 * | `.opacity`                                | `{ type: 'opacity' }`                             |
 * | `.identity`                               | `{ type: 'identity' }`                            |
 * | `.move(edge: .bottom)`                    | `{ type: 'move', edge: 'bottom' }`                |
 * | `.slide`                                  | `{ type: 'slide' }`                               |
 * | `.push(from: .trailing)`                  | `{ type: 'push', from: 'trailing' }`              |
 * | `.scale` / `.scale(scale: 0.8, anchor: .top)` | `{ type: 'scale' }` / `{ type: 'scale', scale: 0.8, anchor: 'top' }` |
 * | `.offset(x: 0, y: 24)`                    | `{ type: 'offset', y: 24 }`                       |
 * | `.opacity.combined(with: .scale)`         | `{ type: 'combined', of: [{ type: 'opacity' }, { type: 'scale' }] }` |
 * | `.asymmetric(insertion:removal:)`         | `{ type: 'asymmetric', insertion, removal }`      |
 */
export type SwiftUITransition =
  | { type: 'opacity' }
  | { type: 'identity' }
  | { type: 'move'; edge: TransitionEdge }
  | { type: 'slide' }
  | { type: 'push'; from: TransitionEdge }
  | { type: 'scale'; /** @default 0 */ scale?: number; /** @default 'center' */ anchor?: TransitionAnchor }
  | { type: 'offset'; /** @default 0 */ x?: number; /** @default 0 */ y?: number }
  | { type: 'combined'; of: readonly SwiftUITransition[] }
  | { type: 'asymmetric'; insertion: SwiftUITransition; removal: SwiftUITransition };

/** A transition in plain words, for an accessible name: `move from bottom and fade`,
 *  `scale from 0.45 and fade`, `insert: fade; remove: fade and move to top`. A symmetric transition is
 *  described as it inserts; an `asymmetric` one describes its removal as a removal (`move to top`). */
export function describeTransition(transition: SwiftUITransition, phase: 'insertion' | 'removal' = 'insertion'): string {
  const toward = phase === 'insertion' ? 'from' : 'to';
  switch (transition.type) {
    case 'opacity': return 'fade';
    case 'identity': return 'no change';
    case 'move': return `move ${toward} ${transition.edge}`;
    case 'slide': return 'slide';
    case 'push': return phase === 'insertion' ? `push from ${transition.from}` : `push to ${OPPOSITE_EDGE[transition.from]}`;
    case 'scale': return `scale ${toward} ${transition.scale ?? 0}`;
    case 'offset': return `offset ${transition.x ?? 0}, ${transition.y ?? 0}`;
    case 'combined': return transition.of.map((part) => describeTransition(part, phase)).join(' and ');
    case 'asymmetric': return `insert: ${describeTransition(transition.insertion, 'insertion')}; remove: ${describeTransition(transition.removal, 'removal')}`;
  }
}

const OPPOSITE_EDGE: Record<TransitionEdge, TransitionEdge> = { top: 'bottom', bottom: 'top', leading: 'trailing', trailing: 'leading' };

export type TransitionPhase = 'insertion' | 'removal';

/** How a sample element looks at one moment of a transition: its opacity, its offset in px from its
 *  normal place, and its scale about its own centre. */
export interface TransitionState {
  opacity: number;
  x: number;
  y: number;
  scale: number;
}

export const IDENTITY_STATE: TransitionState = { opacity: 1, x: 0, y: 0, scale: 1 };

const EDGES: readonly TransitionEdge[] = ['top', 'bottom', 'leading', 'trailing'];
const ANCHORS: readonly TransitionAnchor[] = ['center', 'top', 'bottom', 'leading', 'trailing', 'topLeading', 'topTrailing', 'bottomLeading', 'bottomTrailing'];
const OPPOSITE: Record<TransitionEdge, TransitionEdge> = { top: 'bottom', bottom: 'top', leading: 'trailing', trailing: 'leading' };

/** Throws a `RangeError` for a transition value SwiftUI has no built-in for (unknown type, an edge or
 *  anchor that does not exist, a non-finite number, an empty `combined`), rather than animating
 *  something that isn't what was authored. Walks `combined`/`asymmetric` parts. */
export function assertTransition(transition: SwiftUITransition, path = 'transition'): void {
  const t = transition as { type?: unknown } & Record<string, unknown>;
  const finite = (name: string, value: unknown) => {
    if (value !== undefined && !(typeof value === 'number' && Number.isFinite(value))) throw new RangeError(`${path}.${name} must be a finite number, got ${String(value)}.`);
  };
  switch (t.type) {
    case 'opacity':
    case 'identity':
    case 'slide':
      return;
    case 'move':
      if (!EDGES.includes(t.edge as TransitionEdge)) throw new RangeError(`${path}.edge must be one of ${EDGES.join(', ')}, got ${String(t.edge)}.`);
      return;
    case 'push':
      if (!EDGES.includes(t.from as TransitionEdge)) throw new RangeError(`${path}.from must be one of ${EDGES.join(', ')}, got ${String(t.from)}.`);
      return;
    case 'scale':
      finite('scale', t.scale);
      if ((t.scale as number | undefined) !== undefined && (t.scale as number) < 0) throw new RangeError(`${path}.scale must be 0 or more, got ${String(t.scale)}.`);
      if (t.anchor !== undefined && !ANCHORS.includes(t.anchor as TransitionAnchor)) throw new RangeError(`${path}.anchor must be one of ${ANCHORS.join(', ')}, got ${String(t.anchor)}.`);
      return;
    case 'offset':
      finite('x', t.x);
      finite('y', t.y);
      return;
    case 'combined':
      if (!Array.isArray(t.of) || t.of.length === 0) throw new RangeError(`${path}.of must list at least one transition.`);
      t.of.forEach((part, index) => assertTransition(part as SwiftUITransition, `${path}.of[${index}]`));
      return;
    case 'asymmetric':
      if (!t.insertion || !t.removal) throw new RangeError(`${path} needs both an insertion and a removal.`);
      assertTransition(t.insertion as SwiftUITransition, `${path}.insertion`);
      assertTransition(t.removal as SwiftUITransition, `${path}.removal`);
      return;
    default:
      throw new RangeError(`${path}.type must be one of opacity, identity, move, slide, push, scale, offset, combined, asymmetric, got ${String(t.type)}.`);
  }
}

/** The offset that moves a view of `size` away towards `edge`, by its own size. */
function edgeOffset(edge: TransitionEdge, size: { width: number; height: number }): { x: number; y: number } {
  switch (edge) {
    case 'top': return { x: 0, y: -size.height };
    case 'bottom': return { x: 0, y: size.height };
    case 'leading': return { x: -size.width, y: 0 };
    case 'trailing': return { x: size.width, y: 0 };
  }
}

/** Where the anchor sits relative to the view's centre, as a fraction of its size (-0.5 to 0.5). */
function anchorFromCentre(anchor: TransitionAnchor): { x: number; y: number } {
  return {
    x: anchor.endsWith('Leading') || anchor === 'leading' ? -0.5 : anchor.endsWith('Trailing') || anchor === 'trailing' ? 0.5 : 0,
    y: anchor.startsWith('top') ? -0.5 : anchor.startsWith('bottom') ? 0.5 : 0,
  };
}

/**
 * The look of a sample element of `size` while it is off screen, for one phase of `transition`:
 * what an insertion starts from and a removal ends at.
 *
 * - `opacity` is transparent; `identity` is unchanged (the view just appears and disappears).
 * - `move(edge)` offsets the view by its own size towards the edge. `slide` is
 *   `asymmetric(insertion: move(leading), removal: move(trailing))`, SwiftUI's own definition.
 * - `push(from)` moves in from that edge while fading in, and out towards the opposite edge while
 *   fading out.
 * - `scale` scales about its anchor (default centre, to 0). Scaling about a point other than the
 *   centre is the centred scale plus an offset of `(1 - scale) × anchor`, so the same straight-line
 *   interpolation between the off and on states still moves the anchor point not at all.
 * - `offset` moves by the given px and does not fade.
 * - `combined` applies every part at once: opacities and scales multiply, offsets add.
 * - `asymmetric` plays its own insertion and its own removal.
 */
export function transitionOffState(transition: SwiftUITransition, phase: TransitionPhase, size: { width: number; height: number }): TransitionState {
  switch (transition.type) {
    case 'opacity':
      return { ...IDENTITY_STATE, opacity: 0 };
    case 'identity':
      return { ...IDENTITY_STATE };
    case 'move':
      return { ...IDENTITY_STATE, ...edgeOffset(transition.edge, size) };
    case 'slide':
      return transitionOffState({ type: 'move', edge: phase === 'insertion' ? 'leading' : 'trailing' }, phase, size);
    case 'push':
      return transitionOffState(
        { type: 'combined', of: [{ type: 'move', edge: phase === 'insertion' ? transition.from : OPPOSITE[transition.from] }, { type: 'opacity' }] },
        phase,
        size,
      );
    case 'scale': {
      const scale = transition.scale ?? 0;
      const anchor = anchorFromCentre(transition.anchor ?? 'center');
      return { opacity: 1, x: (1 - scale) * anchor.x * size.width, y: (1 - scale) * anchor.y * size.height, scale };
    }
    case 'offset':
      return { ...IDENTITY_STATE, x: transition.x ?? 0, y: transition.y ?? 0 };
    case 'combined':
      return transition.of.map((part) => transitionOffState(part, phase, size)).reduce(
        (all, part) => ({ opacity: all.opacity * part.opacity, x: all.x + part.x, y: all.y + part.y, scale: all.scale * part.scale }),
        IDENTITY_STATE,
      );
    case 'asymmetric':
      return transitionOffState(phase === 'insertion' ? transition.insertion : transition.removal, phase, size);
  }
}

/** The state `progress` of the way from `from` to `to` (0 is `from`, 1 is `to`; outside 0–1 it goes
 *  past, as a spring's overshoot does). */
export function lerpState(from: TransitionState, to: TransitionState, progress: number): TransitionState {
  const mix = (a: number, b: number) => a + (b - a) * progress;
  return { opacity: mix(from.opacity, to.opacity), x: mix(from.x, to.x), y: mix(from.y, to.y), scale: mix(from.scale, to.scale) };
}

/**
 * The sample element's look at a moment of a whole play: `insertion` is how far the insertion has
 * got (0 = still off screen, 1 = fully in) and `removal` how far the removal has (0 = not started,
 * 1 = gone). The two compose, as `MotionSpecimen` animates one value for each, so a spring's
 * overshoot in either phase goes past its own end state in its own direction.
 */
export function transitionStateAt(transition: SwiftUITransition, size: { width: number; height: number }, insertion: number, removal: number): TransitionState {
  const entering = lerpState(transitionOffState(transition, 'insertion', size), IDENTITY_STATE, insertion);
  const leaving = lerpState(IDENTITY_STATE, transitionOffState(transition, 'removal', size), removal);
  return { opacity: entering.opacity * leaving.opacity, x: entering.x + leaving.x, y: entering.y + leaving.y, scale: entering.scale * leaving.scale };
}

/**
 * The animation a transition runs in when the author names none. In SwiftUI a transition runs in the
 * animation of the change that inserts or removes the view (`withAnimation`, `.animation`); with no
 * animation on that change there is no transition at all, the view just appears. Leaving `animation`
 * out therefore models `withAnimation { … }` with no argument: since iOS 17 that is a critically
 * damped spring of about half a second (before iOS 17 it was ease-in-out over 0.35 s). The figures
 * used here — `response` 0.55 and no bounce (`dampingFraction` 1) — are an assumption, not a
 * published constant; name the real animation with `animation` when it matters.
 */
export const DEFAULT_TRANSITION_SPRING = { response: 0.55, dampingFraction: 1 } as const;

/** What the on-stage line says when no animation is named. */
export const DEFAULT_TRANSITION_ANIMATION_NOTE = `Assumed: withAnimation default (iOS 17+) · spring, response ${DEFAULT_TRANSITION_SPRING.response}, no bounce`;

/** One line saying which animation a transition specimen runs, shown under its stage. */
export function describeTransitionAnimation(animation: unknown): string {
  if (animation === undefined) return DEFAULT_TRANSITION_ANIMATION_NOTE;
  const a = animation as { duration?: number; spring?: Record<string, number> };
  if (a.spring) {
    const s = a.spring;
    if ('response' in s) return `Spring · response ${s.response}, damping ${s.dampingFraction}`;
    if ('duration' in s) return `Spring · duration ${s.duration}, bounce ${s.bounce ?? 0}`;
    return `Spring · stiffness ${s.stiffness ?? 100}, damping ${s.damping ?? 10}`;
  }
  return `Timing · ${a.duration}ms`;
}
