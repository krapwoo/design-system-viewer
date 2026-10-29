// Mounted regression for `TokenDetails`: a "Details ›" link that opens a token's source, expression
// and usages in the shared side panel. Same dynamic-import warmup `notesPanelRender.test.tsx`
// documents (nothing reaching `react-dom`/`react-native-web` may import before a real `window`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { TokenDetails } = await import('../TokenDetails.tsx');

const PANEL = '[role="dialog"][aria-modal="true"]';
const panels = () => [...document.querySelectorAll(PANEL)] as HTMLElement[];
const normalize = (text: string | null) => (text || '').replace(/\s+/g, ' ').trim();

function press(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}
function trigger(container: HTMLElement, title: string): HTMLElement {
  const el = container.querySelector(`[aria-label="Details for ${title}"]`) as HTMLElement | null;
  assert.ok(el, `expected a "Details for ${title}" trigger`);
  return el;
}

test('the trigger reads "Details ›", is named for its token, and mounts no panel content until opened', () => {
  const { container, cleanup } = renderCatalog(
    <TokenDetails title="8pt" kicker="Corner radius" source="Theme.swift:12" usages={['A.swift:1']}><div>Extra block</div></TokenDetails>,
  );
  try {
    const el = trigger(container, '8pt');
    // The label and the › glyph are separate spans, spaced by the trigger's gap, so no space in the DOM text.
    assert.equal(normalize(el.textContent), 'Details›');
    assert.equal(el.getAttribute('aria-expanded'), 'false');
    assert.equal(el.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(panels().length, 0, 'no dialog before opening');
    assert.ok(!normalize(document.body.textContent).includes('Theme.swift:12'), 'the source text is not mounted yet');
    assert.ok(!normalize(document.body.textContent).includes('Extra block'), 'children are not mounted yet');
  } finally { cleanup(); }
});

test('opening shows the kicker, title, expression, source and every usage, then children last', () => {
  const usages = Array.from({ length: 40 }, (_, i) => `Sources/Feature${i}/View.swift:${i + 1}`);
  const { container, cleanup } = renderCatalog(
    <TokenDetails title="8pt" kicker="Corner radius" expression="DS_RADIUS.md" source="Theme.swift:12" usages={usages}><div>Extra block</div></TokenDetails>,
  );
  try {
    press(trigger(container, '8pt'));
    const [panel] = panels();
    assert.ok(panel, 'the side panel opens');
    assert.equal(trigger(container, '8pt').getAttribute('aria-expanded'), 'true');
    const text = normalize(panel.textContent);
    assert.ok(text.includes('Corner radius') && text.includes('8pt'), 'kicker and heading');
    assert.equal(normalize(panel.querySelector('[role="heading"]')?.textContent ?? null), '8pt', 'the panel is headed by the title');
    assert.ok(text.includes('Expression') && text.includes('DS_RADIUS.md'));
    assert.ok(text.includes('Source') && text.includes('Theme.swift:12'));
    assert.ok(text.includes('Used at 40 sites'));
    for (const usage of usages) assert.ok(text.includes(usage), `usage ${usage} is listed`);
    assert.ok(!/\+\s*\d+\s*more/i.test(text), 'a long usage list is never truncated with "+N more"');
    assert.ok(text.indexOf('Extra block') > text.indexOf(usages[39]), 'children come last');
  } finally { cleanup(); }
});

test('a lone usage is singular, and a usageSummary stands in when no per-site list is known', () => {
  const one = renderCatalog(<TokenDetails title="One" usages={['A.swift:1']} />);
  try {
    press(trigger(one.container, 'One'));
    assert.ok(normalize(panels()[0].textContent).includes('Used at 1 site'));
    assert.ok(!normalize(panels()[0].textContent).includes('Used at 1 sites'));
  } finally { one.cleanup(); }
  const summary = renderCatalog(<TokenDetails title="Summary" usageSummary="Used by 12 components." />);
  try {
    press(trigger(summary.container, 'Summary'));
    const text = normalize(panels()[0].textContent);
    assert.ok(text.includes('Used by 12 components.'));
    assert.ok(!text.includes('Used at'), 'no site count is invented from a summary');
  } finally { summary.cleanup(); }
});

test('opening another token closes the first, and the × closes the panel', () => {
  const { container, cleanup } = renderCatalog(
    <>
      <TokenDetails title="4pt" source="First.swift:1" />
      <TokenDetails title="8pt" source="Second.swift:2" />
    </>,
  );
  try {
    press(trigger(container, '4pt'));
    assert.equal(panels().length, 1);
    assert.ok(normalize(panels()[0].textContent).includes('First.swift:1'));
    press(trigger(container, '8pt'));
    assert.equal(panels().length, 1, 'only one token\'s panel is open at a time');
    assert.ok(normalize(panels()[0].textContent).includes('Second.swift:2'));
    assert.equal(trigger(container, '4pt').getAttribute('aria-expanded'), 'false');
    const close = panels()[0].querySelector('[aria-label="Close"]') as HTMLElement;
    press(close);
    assert.equal(panels().length, 0, 'the × closes the panel');
    assert.equal(trigger(container, '8pt').getAttribute('aria-expanded'), 'false');
  } finally { cleanup(); }
});

test('opening and closing re-renders only the instances whose open state changes, not every token', () => {
  const renders: Record<string, number> = {};
  const onRender = (id: string) => { renders[id] = (renders[id] ?? 0) + 1; };
  const { container, cleanup } = renderCatalog(
    <>
      {['a', 'b', 'c', 'd'].map((id) => (
        <React.Profiler key={id} id={id} onRender={() => onRender(id)}>
          <TokenDetails title={id} source={`${id}.swift:1`} />
        </React.Profiler>
      ))}
    </>,
  );
  try {
    const snapshot = () => ({ ...renders });
    const delta = (before: Record<string, number>) => Object.keys(renders).filter((id) => renders[id] !== (before[id] ?? 0));
    let before = snapshot();
    press(trigger(container, 'a'));
    assert.deepEqual(delta(before), ['a'], 'opening one token re-renders only that token');
    before = snapshot();
    press(trigger(container, 'b'));
    assert.deepEqual(delta(before).sort(), ['a', 'b'], 'switching re-renders only the token closed and the token opened');
    before = snapshot();
    press(panels()[0].querySelector('[aria-label="Close"]') as HTMLElement);
    assert.deepEqual(delta(before), ['b'], 'closing re-renders only the open token');
  } finally { cleanup(); }
});

test('a token unmounted while open leaves the shared slot free: a new one starts closed and a sibling opens normally', () => {
  const first = renderCatalog(<TokenDetails title="Gone" source="Gone.swift:1" />);
  press(trigger(first.container, 'Gone'));
  assert.equal(panels().length, 1);
  first.cleanup();
  const next = renderCatalog(
    <>
      <TokenDetails title="Fresh" source="Fresh.swift:1" />
      <TokenDetails title="Sibling" source="Sibling.swift:1" />
    </>,
  );
  try {
    assert.equal(trigger(next.container, 'Fresh').getAttribute('aria-expanded'), 'false', 'a new token starts closed');
    assert.equal(trigger(next.container, 'Sibling').getAttribute('aria-expanded'), 'false');
    assert.equal(panels().length, 0);
    press(trigger(next.container, 'Sibling'));
    assert.equal(trigger(next.container, 'Sibling').getAttribute('aria-expanded'), 'true', 'a sibling opens normally');
    assert.equal(trigger(next.container, 'Fresh').getAttribute('aria-expanded'), 'false');
  } finally { next.cleanup(); }
});

test('two separately mounted roots keep the one-open rule between them', () => {
  const one = renderCatalog(<TokenDetails title="Root1" source="One.swift:1" />);
  const two = renderCatalog(<TokenDetails title="Root2" source="Two.swift:1" />);
  try {
    press(trigger(one.container, 'Root1'));
    press(trigger(two.container, 'Root2'));
    assert.equal(trigger(one.container, 'Root1').getAttribute('aria-expanded'), 'false');
    assert.equal(trigger(two.container, 'Root2').getAttribute('aria-expanded'), 'true');
    assert.equal(panels().length, 1);
  } finally { one.cleanup(); two.cleanup(); }
});
