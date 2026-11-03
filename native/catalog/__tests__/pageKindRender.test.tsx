// A page that documents a style (`pageKind: 'style'`) says so: a "Style" badge beside its title and
// a plain sentence on the difference between a style and a view, on every page head (a standalone
// page, a family page and a group page). The word "Style" is the signal, not a colour.
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
const { FamilyPage } = await import('../FamilyPage.tsx');
const { GroupPage } = await import('../GroupPage.tsx');
const { SectionBlock } = await import('../SectionBlock.tsx');
const { STYLE_EXPLAINER, STYLE_BADGE_TITLE_OFFSET, StyleBadge, StyleBadgeButton } = await import('../PageKindBadge.tsx');
const { StyleSheet } = await import('react-native');

/** The rules react-native-web generated for an element's atomic classes: property -> value. */
function declared(el: Element): Record<string, string> {
  const rules = StyleSheet.getSheet().textContent.split('\n');
  const out: Record<string, string> = {};
  for (const cls of (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
    for (const rule of rules) {
      const m = rule.match(new RegExp(`^\\.${cls}\\{(.*)\\}$`));
      if (m) for (const d of m[1].split(';').filter(Boolean)) { const i = d.indexOf(':'); out[d.slice(0, i)] = d.slice(i + 1); }
    }
  }
  return out;
}

function member(id: string) {
  return { id, source: `${id}.tsx`, fidelity: 'replicated' as const, relationship: id, description: `${id}.` };
}
const base = { id: 'ChipLook', description: 'A page.', path: 'X.tsx' };
const family = { family: { whole: 'ChipLook', members: [member('ChipLook')], sections: [], outline: new Map() } };
const group = { family: { kind: 'group', whole: 'ChipLook', members: [member('One')], sections: [], outline: new Map(), topLevel: [{ member: member('One'), parts: [] }] } };

const cases: Array<[string, Record<string, unknown>, React.ComponentType<never>]> = [
  ['standalone page', {}, SectionBlock as never],
  ['family page', family, FamilyPage as never],
  ['group page', group, GroupPage as never],
];

for (const [name, extra, Page] of cases) {
  test(`${name}: pageKind 'style' puts a Style badge next to the title and no meaning line under it`, () => {
    const { container, cleanup } = renderCatalog(React.createElement(Page, { def: { ...base, ...extra, pageKind: 'style' } } as never));
    try {
      const heading = container.querySelector('[role="heading"]') as HTMLElement;
      assert.equal(heading.textContent, 'ChipLook', 'the heading itself stays just the title');
      const cell = heading.parentElement as HTMLElement;
      const row = cell.parentElement as HTMLElement;
      assert.ok((row.textContent ?? '').includes('Style'), 'the badge is beside the title, in the same row');
      assert.equal([...row.children].filter((el) => el !== cell).map((el) => el.textContent).join(), 'Style');
      // A long title wraps in its cell instead of running past the column.
      assert.equal(declared(cell)['flex-shrink'], '1', 'the heading shrinks to the column');
      assert.equal(declared(cell)['min-width'], '0px');
      // The meaning lives in the popover the badge opens, never in a line under the title.
      const text = container.textContent ?? '';
      for (const part of STYLE_EXPLAINER) assert.ok(!text.includes(part.text), `no inline line: ${part.heading}`);
      assert.ok(!text.includes("A style changes how something looks"), 'the one-line meaning under the title is gone');
      assert.equal(document.querySelectorAll('[role="dialog"]').length, 0, 'nothing is open until the badge is pressed');
    } finally { cleanup(); }
  });

  test(`${name}: the page's styleNote is not printed on the page; no pageKind means no badge`, () => {
    const custom = renderCatalog(React.createElement(Page, { def: { ...base, ...extra, pageKind: 'style', styleNote: 'Apply it with .chipLook().' } } as never));
    try {
      assert.ok(!(custom.container.textContent ?? '').includes('Apply it with .chipLook().'), 'the note is in the popover, not under the title');
    } finally { custom.cleanup(); }
    const plain = renderCatalog(React.createElement(Page, { def: { ...base, ...extra } } as never));
    try {
      const heading = plain.container.querySelector('[role="heading"]') as HTMLElement;
      assert.equal(heading.parentElement!.textContent!.includes('Style'), false, 'no badge');
      assert.equal(badgeButton(plain.container) === null, true, 'no badge button');
    } finally { plain.cleanup(); }
  });
}

// The page-head badge is a button that opens a popover explaining what a style is, and sits on the
// title's first line.
const POPOVER = '[role="dialog"]';
const press = (el: Element) => act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
const badgeButton = (c: HTMLElement) => c.querySelector('[aria-label="Style — what this means"]') as HTMLElement | null;
const popover = () => document.querySelector(POPOVER) as HTMLElement | null;
const key = (name: string) => act(() => { document.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true })); });

for (const [name, extra, Page] of cases) {
  test(`${name}: the Style badge is a button named "Style — what this means" that opens a popover with the explanation`, () => {
    const { container, cleanup } = renderCatalog(React.createElement(Page, { def: { ...base, ...extra, pageKind: 'style', styleNote: 'Apply it with .chipLook().' } } as never));
    try {
      const button = badgeButton(container);
      assert.ok(button, 'the badge has the accessible name');
      assert.equal(button!.getAttribute('role'), 'button');
      assert.equal(button!.getAttribute('aria-expanded'), 'false');
      assert.equal(button!.getAttribute('aria-haspopup'), 'dialog');
      assert.ok(button!.getAttribute('aria-hidden') === null, 'not hidden from assistive technology');
      assert.notEqual(button!.getAttribute('tabindex'), '-1', 'reachable by keyboard');
      assert.ok(popover() === null, 'nothing is open yet');
      press(button!);
      const panel = popover()!;
      assert.ok(panel, 'pressing the badge opens the popover');
      assert.equal(button!.getAttribute('aria-expanded'), 'true');
      assert.equal(panel.getAttribute('aria-label'), 'About styles', 'the dialog has a label');
      assert.equal(panel.getAttribute('aria-modal'), null, 'it is not modal: the page behind stays usable');
      assert.ok(document.querySelector('[data-testid="member-panel-scrim"]') === null, 'the side panel is not what opens');
      const text = (panel.textContent ?? '').replace(/\s+/g, ' ');
      for (const part of STYLE_EXPLAINER) assert.ok(text.includes(part.text), `explains: ${part.heading}`);
      for (const word of ['ButtonStyle', 'ViewModifier', 'TextRenderer', 'component', 'specimens']) assert.ok(text.includes(word), `mentions ${word}`);
      assert.ok(text.startsWith('About this styleApply it with .chipLook().'), "the page's own styleNote comes first");
      assert.ok(document.activeElement === panel, 'focus moves into the popover on open');
      assert.ok(panel.parentElement === document.body, 'drawn in a portal on the body, over any stacking context or transform the badge sits in');
      assert.equal(container.contains(panel), false);
    } finally { cleanup(); }
  });

  test(`${name}: a second press, Escape, a press outside and scrolling each close the popover, and focus returns to the badge`, () => {
    const { container, cleanup } = renderCatalog(React.createElement(Page, { def: { ...base, ...extra, pageKind: 'style' } } as never));
    try {
      const button = badgeButton(container)!;
      const open = () => { press(button); assert.ok(popover(), 'open'); };
      open();
      press(button);
      assert.ok(popover() === null, 'a second press closes it');
      assert.equal(button.getAttribute('aria-expanded'), 'false');
      open();
      key('Escape');
      assert.ok(popover() === null, 'Escape closes it');
      assert.ok(document.activeElement === button, 'and focus returns to the badge');
      open();
      key('Enter');
      assert.ok(popover(), 'other keys leave it open');
      act(() => { container.dispatchEvent(new window.Event('pointerdown', { bubbles: true })); });
      assert.ok(popover() === null, 'a press outside closes it');
      open();
      act(() => { popover()!.dispatchEvent(new window.Event('pointerdown', { bubbles: true })); });
      assert.ok(popover(), 'a press inside it does not');
      act(() => { document.dispatchEvent(new window.Event('scroll')); });
      assert.ok(popover() === null, 'scrolling away closes it');
      assert.ok(document.activeElement === button, 'focus is back on the badge');
    } finally { cleanup(); }
  });

  test(`${name}: the badge sits on the title's first line: the row does not wrap, and the 44px hit area is offset to the title's line box`, () => {
    const { container, cleanup } = renderCatalog(React.createElement(Page, { def: { ...base, ...extra, pageKind: 'style' } } as never));
    try {
      const button = badgeButton(container)!;
      const heading = container.querySelector('[role="heading"]') as HTMLElement;
      const row = heading.parentElement!.parentElement as HTMLElement;
      const rowStyle = declared(row);
      assert.notEqual(rowStyle['flex-wrap'], 'wrap', 'a long title wraps inside its cell, never drops the badge to a line of its own');
      assert.equal(rowStyle['align-items'], 'flex-start');
      assert.equal(declared(button.parentElement!)['flex-shrink'], '0', 'the badge keeps its size');
      // 34px title line, 44px hit area: -5px puts their centres together; the title's 5px bottom margin
      // takes up the 5px that then hangs below, so the head does not grow.
      assert.equal(declared(button.parentElement!)['margin-top'], '-5px', 'the page head\'s cell carries the offset');
      assert.equal(declared(button)['margin-top'], undefined, 'the button itself carries none');
      assert.equal(declared(button)['min-height'], '44px', 'a 44px hit area');
      assert.equal(declared(button)['min-width'], '44px');
      const pill = button.firstElementChild as HTMLElement;
      assert.equal(declared(pill)['min-height'], '24px', 'around the 24px pill');
      assert.equal(STYLE_BADGE_TITLE_OFFSET, -5);
    } finally { cleanup(); }
  });
}

test('only one popover is open at a time: opening a second closes the first', () => {
  const { container, cleanup } = renderCatalog(React.createElement('div', null, React.createElement(StyleBadgeButton, { note: 'First.' }), React.createElement(StyleBadgeButton, { note: 'Second.' })));
  try {
    const [first, second] = [...container.querySelectorAll('[aria-label="Style — what this means"]')] as HTMLElement[];
    press(first);
    assert.equal(document.querySelectorAll(POPOVER).length, 1);
    assert.ok(popover()!.textContent!.includes('First.'));
    press(second);
    assert.equal(document.querySelectorAll(POPOVER).length, 1, 'still just one');
    assert.ok(popover()!.textContent!.includes('Second.'));
    assert.equal(first.getAttribute('aria-expanded'), 'false');
    assert.equal(second.getAttribute('aria-expanded'), 'true');
  } finally { cleanup(); }
});

test('the popover fades in with opacity only, and not at all under prefers-reduced-motion', () => {
  const fadeWith = (reduce: boolean) => {
    const { container, cleanup } = renderCatalog(React.createElement(StyleBadgeButton, {}));
    // The popover asks when it opens, so the stub goes on this fresh window before the press.
    (window as unknown as Record<string, unknown>).matchMedia = (query: string) => ({ matches: reduce && query.includes('prefers-reduced-motion'), media: query });
    try {
      press(badgeButton(container)!);
      const { transitionProperty, transitionDuration } = popover()!.style;
      return { 'transition-property': transitionProperty, 'transition-duration': transitionDuration };
    } finally { cleanup(); }
  };
  const normal = fadeWith(false);
  assert.equal(normal['transition-property'], 'opacity', 'only opacity animates');
  assert.equal(normal['transition-duration'], '120ms');
  assert.equal(fadeWith(true)['transition-duration'], '0ms', 'reduced motion: it simply appears');
});

test('the Style badge on a page without a panel to open (decorative, as on an inventory tile) is not a button', () => {
  const { container, cleanup } = renderCatalog(React.createElement(StyleBadge, { decorative: true }));
  try {
    assert.equal(container.querySelector('[role="button"]'), null);
    assert.equal(container.querySelector('[aria-hidden="true"]')?.textContent, 'Style');
  } finally { cleanup(); }
});

test('the exported button form has no margin of its own, so it sits true in a specimen cell (L4)', () => {
  const { container, cleanup } = renderCatalog(React.createElement(StyleBadgeButton, {}));
  try {
    assert.equal(declared(badgeButton(container)!)['margin-top'], undefined);
  } finally { cleanup(); }
});

// G6 re-review 5 (M1, M3, L6, L7): the Popover as a public API.
const { Popover } = await import('../Popover.tsx');
const { View } = await import('react-native');

let bump: () => void = () => {};
function Harness() {
  const [tick, setTick] = React.useState(0);
  bump = () => setTick((n) => n + 1);
  const [open, setOpen] = React.useState(true);
  const anchor = React.useRef<InstanceType<typeof View>>(null);
  return React.createElement('div', null,
    React.createElement('button', { ref: anchor as never, 'data-tick': tick }, 'anchor'),
    open ? React.createElement(Popover, { anchorRef: anchor, label: 'Inline', onClose: () => setOpen(false) }, React.createElement('span', null, 'text')) : null);
}

test('M1: a parent re-render with a new inline onClose does not move focus again or close the popover', () => {
  const { container, cleanup } = renderCatalog(React.createElement(Harness));
  try {
    const panel = popover()!;
    assert.ok(document.activeElement === panel, 'focus starts in the panel');
    const focuses: Element[] = [];
    const anchor = container.querySelector('button')!;
    anchor.addEventListener('focus', () => focuses.push(anchor));
    for (let i = 0; i < 3; i++) act(() => { bump(); });
    assert.equal(focuses.length, 0, 'the anchor was never refocused by a re-render');
    assert.ok(popover() === panel && document.activeElement === panel, 'same panel, focus still inside it');
    key('Escape');
    assert.ok(popover() === null, 'the latest onClose still closes it');
  } finally { cleanup(); }
});

test('M3: Tab and Shift+Tab from the open popover close it and leave focus on the anchor', () => {
  for (const shiftKey of [false, true]) {
    const { container, cleanup } = renderCatalog(React.createElement(StyleBadgeButton, {}));
    try {
      const button = badgeButton(container)!;
      press(button);
      assert.ok(document.activeElement === popover());
      act(() => { document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })); });
      assert.ok(popover() === null, `Tab (shift ${shiftKey}) closes it`);
      assert.ok(document.activeElement === button, 'and focus is on the badge, where the browser continues from');
    } finally { cleanup(); }
  }
});

test('L7: the panel never outgrows a short window: it scrolls inside', () => {
  const { container, cleanup } = renderCatalog(React.createElement(StyleBadgeButton, {}));
  try {
    press(badgeButton(container)!);
    assert.equal(popover()!.style.maxHeight, 'calc(100vh - 24px)');
    assert.equal(popover()!.style.overflowY, 'auto');
  } finally { cleanup(); }
});

test('L6: the popover is placed against the 24px pill, not the 44px hit area around it', () => {
  const { container, cleanup } = renderCatalog(React.createElement(StyleBadgeButton, {}));
  try {
    const button = badgeButton(container)!;
    const pill = button.firstElementChild as HTMLElement;
    const rects = new Map<Element, { left: number; top: number; right: number; bottom: number }>([
      [button, { left: 0, top: 0, right: 44, bottom: 44 }],
      [pill, { left: 10, top: 10, right: 40, bottom: 34 }],
    ]);
    const original = window.HTMLElement.prototype.getBoundingClientRect;
    window.HTMLElement.prototype.getBoundingClientRect = function (this: Element) { return (rects.get(this) ?? original.call(this)) as DOMRect; };
    try {
      press(button);
      assert.equal(popover()!.style.top, '38px', 'pill bottom (34) + the 4px gap');
    } finally { window.HTMLElement.prototype.getBoundingClientRect = original; }
  } finally { cleanup(); }
});
