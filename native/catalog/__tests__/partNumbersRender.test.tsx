// Mounted regression for numbering used components as parts: the real `CatalogShell` (so the real reference
// navigation) around `SectionBlock`/`FamilyPage`, through react-native-web into jsdom. jsdom has no
// layout, so this proves structure, roles, routing and which entries become cards — never geometry.
// Same dynamic-import warmup and `Mount` wrapper `overviewRender.test.tsx` documents in full.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useLayoutEffect, useState } from 'react';
import { act } from 'react';
import type { ComposedOfEntry, NavGroup, SectionDef } from '../types.ts';

const warmup = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
(globalThis as Record<string, unknown>).window = warmup.window;
(globalThis as Record<string, unknown>).document = warmup.window.document;
Object.defineProperty(globalThis, 'navigator', { value: warmup.window.navigator, configurable: true });
(globalThis as Record<string, unknown>).ShadowRoot = warmup.window.ShadowRoot;
Object.defineProperty(globalThis, 'Node', { configurable: true, get: () => window.Node });

const { renderCatalog } = await import('../../../test/renderCatalog.tsx');
const { CatalogShell } = await import('../CatalogShell.tsx');
const { AnatomyPin } = await import('../Anatomy.tsx');

function click(el: Element) {
  act(() => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}
function goTo(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event('hashchange'));
  });
}

function Mount({ hash, children }: { hash?: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    try {
      window.localStorage.getItem('ds-viewer-probe');
    } catch {
      const store = new Map<string, string>();
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => { store.set(key, value); },
          removeItem: (key: string) => { store.delete(key); },
          clear: () => store.clear(),
        },
      });
    }
    Object.defineProperty(window.history, 'replaceState', {
      configurable: true,
      value: (_state: unknown, _title: string, url?: string | URL | null) => { if (url != null) window.location.hash = String(url); },
    });
    if (hash) window.location.hash = hash;
    setReady(true);
  }, [hash]);
  return ready ? <>{children}</> : null;
}


const item = (key: string) => ({ key, name: key, node: <span>{`${key} specimen`}</span> });
const base = (id: string) => ({ id, title: id, description: `${id} page.`, path: `${id}.tsx` });
const c = (component: string, relationship: ComposedOfEntry['relationship'], role = `${component} role`): ComposedOfEntry => ({ component, role, relationship });
const other = (name: string) => ({ other: name, description: `${name} sits here.` });

type Id = 'Frame' | 'Plain' | 'Aliased' | 'Sheet' | 'Bare' | 'Chip' | 'Banner' | 'Toggle' | 'Panel';

const SHEET_MEMBERS = [
  { id: 'Sheet', source: 's:1', path: 's:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'w', variants: { items: [item('sheet')] } },
  { id: 'SheetA', source: 's:2', path: 's:2', fidelity: 'replicated' as const, relationship: 'Part', parent: 'Sheet', description: 'a', variants: { items: [item('a')] } },
  { id: 'SheetB', source: 's:3', path: 's:3', fidelity: 'replicated' as const, relationship: 'Part', parent: 'Sheet', description: 'b', variants: { items: [item('b')] } },
  { id: 'SheetB1', source: 's:4', path: 's:4', fidelity: 'replicated' as const, relationship: 'Part', parent: 'SheetB', description: 'b1', variants: { items: [item('b1')] } },
];
const SHEET_OUTLINE = new Map([['SheetA', { number: '1', level: 2 }], ['SheetB', { number: '2', level: 2 }], ['SheetB1', { number: '2.1', level: 3 }]]);
const sheetFamily = () => ({
  whole: 'Sheet',
  outline: SHEET_OUTLINE,
  sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['SheetA', 'SheetB', 'SheetB1'] }],
  members: SHEET_MEMBERS,
});
const sheet = (withUsed: boolean): SectionDef<Id> => ({
  ...base('Sheet'),
  ...(withUsed ? { composedOf: [c('Chip', 'built-in'), c('Banner', 'slot')] } : {}),
  family: {
    ...sheetFamily(),
    ...(withUsed
      ? {
          anatomy: {
            picture: <span><AnatomyPin member="SheetA" /><AnatomyPin other="Toggle" /><AnatomyPin other="Chip" /></span>,
            groups: [
              { label: 'Own', items: [{ member: 'SheetA', description: 'a part' }, { member: 'SheetB', description: 'b part' }] },
              { label: 'Used', items: [other('Toggle'), other('Chip')] },
            ],
          },
        }
      : { anatomy: { picture: <span><AnatomyPin member="SheetA" /></span>, groups: [{ label: 'Own', items: [{ member: 'SheetA', description: 'a part' }, { member: 'SheetB', description: 'b part' }] }] } }),
  },
});

const SECTIONS: SectionDef<Id>[] = [
  {
    ...base('Frame'),
    variants: { items: [item('frame')] },
    anatomy: {
      picture: <span><AnatomyPin other="Banner" /><AnatomyPin other="Chip" /></span>,
      groups: [{ label: 'Used', items: [other('Banner'), other('Chip'), other('Gadget')] }],
    },
    composedOf: [c('Chip', 'built-in'), c('Toggle', 'slot'), c('Banner', 'built-in'), c('Gizmo', 'built-in', 'No page.')],
  },
  { ...base('Plain'), variants: { items: [item('plain')] }, composedOf: [c('Chip', 'built-in')] },
  {
    ...base('Aliased'),
    variants: { items: [item('aliased')] },
    anatomy: { picture: <span><AnatomyPin other="HeaderAlias" /></span>, groups: [{ label: 'Used', items: [other('HeaderAlias')] }] },
    composedOf: [c('PanelHeader', 'built-in'), c('Chip', 'built-in')],
  },
  sheet(true),
  { ...base('Bare'), variants: { items: [item('bare')] } },
  { ...base('Chip'), variants: { items: [item('chip')] } },
  { ...base('Banner'), variants: { items: [item('banner')] } },
  { ...base('Toggle'), variants: { items: [item('toggle')] } },
  {
    ...base('Panel'),
    family: {
      whole: 'Panel',
      outline: new Map([['PanelHeader', { number: '1', level: 2 }]]),
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['PanelHeader'] }],
      members: [
        { id: 'Panel', source: 'p:1', path: 'p:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w', variants: { items: [item('panel')] } },
        { id: 'PanelHeader', source: 'p:2', path: 'p:2', fidelity: 'replicated', relationship: 'Part', parent: 'Panel', description: 'h', aliases: ['HeaderAlias'], variants: { items: [item('header')] } },
      ],
    },
  },
];
const GROUPS: NavGroup<Id>[] = [{ label: 'Components', ids: ['Frame', 'Plain', 'Aliased', 'Sheet', 'Bare', 'Chip', 'Banner', 'Toggle', 'Panel'] }];

function mount(hash: string, sections: SectionDef<Id>[] = SECTIONS, groups: NavGroup<Id>[] = GROUPS, partGroups?: string[]) {
  return renderCatalog(
    <Mount hash={hash}>
      <CatalogShell appName="App" title="Catalog" groups={groups} sections={sections} partGroups={partGroups} />
    </Mount>,
  );
}

/** The "3↗" / "3" text of an element that is a pin: a View holding one Text (and a glyph). */
const pinTexts = (root: ParentNode, selector: string) => [...root.querySelectorAll(selector)].map((el) => (el.textContent || '').trim());
/** Plain numeric member pins ("1", "2.1"), wherever they sit on the page, in document order. */
function memberPins(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[aria-hidden="true"]')]
    .filter((el) => /^\d+(\.\d+)*$/.test((el.textContent || '').trim()) && el.querySelectorAll('*').length === 1)
    .map((el) => (el.textContent || '').trim());
}
/** react-native-web's atomic classes for `position: absolute` and `pointer-events: none` (the hash
 *  is of the property and value, so these are stable). jsdom does not cascade the stylesheet into
 *  `getComputedStyle`, so the class on the node is what proves the style was applied. */
const ABSOLUTE = 'r-position-u8s1d';
const NO_POINTER_EVENTS = 'r-pointerEvents-633pao';
const hasClass = (el: Element, name: string) => el.className.split(/\s+/).includes(name);
const legendPins = (container: HTMLElement) => pinTexts(container, '[data-testid="legend-pin-slot"]');
const pictureLabels = (container: HTMLElement) => [...container.querySelectorAll('[role="img"][aria-label^="Part "]')].map((el) => el.getAttribute('aria-label')!);
const badges = (container: HTMLElement) => pinTexts(container, '[data-testid="part-badge"]');
const cardLabels = (container: HTMLElement) => [...container.querySelectorAll('a[aria-label^="Part "]')].filter((a) => !a.closest('[data-testid="anatomy-body"]')).map((a) => a.getAttribute('aria-label')!);
/** The numbered legend name links ("Part 2, Chip"), which live in the anatomy box. */
const legendLinkLabels = (container: HTMLElement) => [...container.querySelectorAll('[data-testid="anatomy-body"] a[aria-label^="Part "]')].map((a) => a.getAttribute('aria-label')!);

test('standalone page: the anatomy box draws first after the page head, with pins and a legend', () => {
  const { container, cleanup } = mount('#Frame');
  const text = container.textContent || '';
  assert.ok(text.includes('Anatomy'), 'the Anatomy label');
  assert.ok(container.querySelector('[data-testid="anatomy-body"]'), 'the anatomy box');
  assert.equal(pictureLabels(container).length, 2, 'both picture pins');
  assert.equal(container.querySelectorAll('[data-testid="legend-pin-slot"]').length, 3, 'one legend row per item');
  const heading = container.querySelector('[role="heading"][aria-level="1"]')!;
  const anatomyBody = container.querySelector('[data-testid="anatomy-body"]')!;
  const specimen = [...container.querySelectorAll('span')].find((s) => s.textContent === 'frame specimen')!;
  assert.ok(heading.compareDocumentPosition(anatomyBody) & 4, 'after the page head');
  assert.ok(anatomyBody.compareDocumentPosition(specimen) & 4, 'before the specimens');
  cleanup();
});

test('standalone page without anatomy draws no anatomy box', () => {
  const { container, cleanup } = mount('#Plain');
  assert.equal(container.querySelector('[data-testid="anatomy-body"]'), null);
  assert.equal(container.querySelector('[data-testid="legend-pin-slot"]'), null);
  assert.ok(!(container.textContent || '').includes('Anatomy'));
  cleanup();
});

test('numbering: anatomy others in legend order, then Parts-only entries in block order; a name with no page has no number', () => {
  const { container, cleanup } = mount('#Frame');
  // Anatomy: Banner 1, Chip 2. Gadget is in the legend but has no page: unnumbered, no claim to open
  // one. Parts-only: Toggle 3. Gizmo has no page: a plain row.
  assert.deepEqual(legendPins(container), ['1↗', '2↗', '↗']);
  assert.deepEqual(pictureLabels(container), ['Part 1, opens Banner', 'Part 2, opens Chip']);
  assert.deepEqual(cardLabels(container).map((l) => l.split(',').slice(0, 2).join(',')), ['Part 2, Chip', 'Part 3, Toggle', 'Part 1, Banner']);
  assert.deepEqual(badges(container), ['2', '3', '1']);
  assert.ok(![...container.querySelectorAll('[role="listitem"]')].some((li) => !li.querySelector('a') && badges(li as HTMLElement).length), 'a plain row carries no badge');
  cleanup();
});

test('one number per used component: its pin, legend row and Parts card agree', () => {
  const { container, cleanup } = mount('#Frame');
  const chipPin = pictureLabels(container).find((l) => l.endsWith('Chip'))!;
  const chipCard = cardLabels(container).find((l) => l.includes(', Chip,'))!;
  const row = [...container.querySelectorAll('[data-testid="legend-pin-slot"]')].find((slot) => slot.parentElement!.textContent!.includes('Chip sits here'))!;
  assert.equal(chipPin.split(',')[0], 'Part 2');
  assert.equal(chipCard.split(',')[0], 'Part 2');
  assert.equal((row.textContent || '').trim(), '2↗');
  cleanup();
});

test('an alias and a page id for the same member share one number', () => {
  const { container, cleanup } = mount('#Aliased');
  // `HeaderAlias` (anatomy) and `PanelHeader` (Parts block) resolve to the same member: 1; Chip: 2.
  // The pin names the destination page's title, not the authored alias.
  assert.deepEqual(pictureLabels(container), ['Part 1, opens Panel']);
  assert.deepEqual(legendPins(container), ['1↗']);
  // The numbered legend name link says which part it is.
  assert.deepEqual(legendLinkLabels(container), ['Part 1, HeaderAlias']);
  assert.deepEqual(cardLabels(container).map((l) => l.split(',').slice(0, 2).join(',')), ['Part 1, Panel', 'Part 2, Chip']);
  cleanup();
});

test('a Parts block without anatomy numbers its cards from 1, in block order', () => {
  const { container, cleanup } = mount('#Plain');
  assert.deepEqual(badges(container), ['1']);
  cleanup();
});

test('family page: used components continue after the members; the members\' own numbers are unchanged', () => {
  const withUsed = mount('#Sheet');
  const pinsWith = memberPins(withUsed.container);
  // Toggle and Chip are anatomy others (3, 4); Banner is Parts-only (5).
  assert.deepEqual(legendPins(withUsed.container), ['1', '2', '3↗', '4↗']);
  assert.deepEqual(pictureLabels(withUsed.container), ['Part 3, opens Toggle', 'Part 4, opens Chip']);
  assert.deepEqual(badges(withUsed.container).sort(), ['4', '5']);
  withUsed.cleanup();

  const without = mount('#Sheet', SECTIONS.map((s) => (s.id === 'Sheet' ? sheet(false) : s)));
  const pinsWithout = memberPins(without.container);
  assert.ok(pinsWithout.includes('1') && pinsWithout.includes('2') && pinsWithout.includes('2.1'), `member pins present: ${pinsWithout}`);
  assert.deepEqual(pinsWith, pinsWithout, 'the members\' numbers are identical with and without used components');
  assert.equal(badges(without.container).length, 0);
  without.cleanup();
});

test('the ↗ glyph is hidden from assistive technology and is a corner badge, not part of the pin\'s flow', () => {
  const { container, cleanup } = mount('#Frame');
  const glyphs = [...container.querySelectorAll('div')].filter((el) => (el.textContent || '') === '↗' && el.children.length === 0);
  assert.ok(glyphs.length >= 5, 'glyphs in the picture pins and the legend rows');
  // The glyph itself, or the bare pin / pin slot it sits in, is hidden.
  for (const glyph of glyphs) assert.ok(glyph.closest('[aria-hidden="true"]'), 'every glyph is hidden from assistive technology');
  const pin = container.querySelector('[role="img"][aria-label="Part 1, opens Banner"]')!;
  assert.equal(pin.getAttribute('aria-hidden'), null, 'the picture pin is announced');
  const corner = pin.querySelector('[aria-hidden="true"]')!;
  assert.ok(hasClass(corner, ABSOLUTE), 'the glyph is out of the pin\'s layout');
  cleanup();
});

test('a card\'s badge is click-through and hidden, and the card keeps one tab stop', () => {
  const { container, cleanup } = mount('#Plain');
  const badge = container.querySelector('[data-testid="part-badge"]')!;
  assert.equal(badge.getAttribute('aria-hidden'), 'true');
  assert.ok(hasClass(badge, NO_POINTER_EVENTS), 'clicks go through to the stretched link');
  assert.ok(hasClass(badge, ABSOLUTE));
  const links = [...container.querySelectorAll('a[aria-label^="Part 1"]')];
  assert.equal(links.length, 1);
  cleanup();
});

// `partGroups`: only components count as parts. Banner and Toggle sit in a "Behaviors" group.
const SPLIT_GROUPS: NavGroup<Id>[] = [
  { label: 'Components', ids: ['Frame', 'Plain', 'Aliased', 'Sheet', 'Bare', 'Chip', 'Panel'] },
  { label: 'Behaviors', ids: ['Banner', 'Toggle'] },
];
const cardNames = (container: HTMLElement) => cardLabels(container).map((l) => l.split(',').slice(0, 2).join(','));

test('partGroups absent: a page in any group is numbered exactly as before', () => {
  const read = (groups: NavGroup<Id>[]) => {
    const { container, cleanup } = mount('#Frame', SECTIONS, groups);
    const seen = { legend: legendPins(container), cards: cardNames(container) };
    cleanup();
    return seen;
  };
  const plain = read(GROUPS);
  const split = read(SPLIT_GROUPS);
  assert.deepEqual(split, plain);
  assert.deepEqual(split.legend, ['1↗', '2↗', '↗']);
  assert.deepEqual(split.cards, ['Part 2, Chip', 'Part 3, Toggle', 'Part 1, Banner']);
});

test('partGroups set: a page outside the groups is left out of the Parts block and unnumbered; the rest are numbered', () => {
  // Case-insensitive: 'components' matches the 'Components' group.
  const { container, cleanup } = mount('#Frame', SECTIONS, SPLIT_GROUPS, ['components']);
  // Banner (anatomy) and Toggle (Parts-only) are behaviors: no number, no card. Chip is 1; the
  // unresolved Gadget has no page: unnumbered. Gizmo has no page: a plain row.
  assert.deepEqual(cardNames(container), ['Part 1, Chip']);
  assert.deepEqual(badges(container), ['1']);
  assert.ok(!(container.textContent || '').includes('Toggle role'), 'the excluded entry is not in the Parts block');
  assert.ok((container.textContent || '').includes('Gizmo'), 'an unresolved entry stays a plain row');
  // The anatomy keeps every authored legend row, the excluded one with the unnumbered ↗ pin.
  assert.deepEqual(legendPins(container), ['↗', '1↗', '↗']);
  assert.deepEqual(pictureLabels(container), ['Part 1, opens Chip'], 'the excluded picture pin has no number label');
  assert.equal(container.querySelectorAll('[data-testid="legend-pin-slot"]').length, 3, 'nothing authored disappears');
  cleanup();
});

test('partGroups set: an included group is numbered as before, and a family page follows the same rule', () => {
  const { container, cleanup } = mount('#Sheet', SECTIONS, SPLIT_GROUPS, ['Components']);
  // Sheet's own parts are 1 and 2; Toggle (behavior) is unnumbered, Chip continues at 3.
  assert.deepEqual(legendPins(container).slice(-2), ['↗', '3↗']);
  assert.deepEqual(cardNames(container), ['Part 3, Chip']);
  cleanup();
});

test('an anatomy name that resolves to no page stays unnumbered even when no navigation is supplied', async () => {
  // A standalone-mounted FamilyPage has no `navigation`: nothing resolves, so nothing may claim a
  // number or the ↗ "opens its own page" mark.
  const { FamilyPage } = await import('../FamilyPage.tsx');
  const def = { ...base('Lone'), family: {
    whole: 'Lone', outline: new Map(),
    sections: [],
    members: [{ id: 'Lone', source: 'l:1', path: 'l:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w' }],
    anatomy: { picture: <span><AnatomyPin other="Chip" /></span>, groups: [{ label: 'Used', items: [other('Chip')] }] },
  } } as unknown as SectionDef<Id>;
  const { container, cleanup } = renderCatalog(<FamilyPage def={def as never} />);
  assert.deepEqual(legendPins(container), ['↗']);
  assert.deepEqual(pictureLabels(container), []);
  assert.equal(container.querySelectorAll('[role="img"][aria-label^="Part "]').length, 0);
  cleanup();
});

test('family page: a Parts entry that resolves to the page itself (an alias of its own member) is left out', () => {
  const aliased = SECTIONS.map((s): SectionDef<Id> => {
    if (s.id !== 'Sheet') return s;
    return {
      ...s,
      composedOf: [c('Chip', 'built-in'), c('SheetAlias', 'built-in'), c('Sheet', 'slot')],
      family: { ...s.family!, members: s.family!.members.map((m) => (m.id === 'SheetA' ? { ...m, aliases: ['SheetAlias'] } : m)) },
    };
  });
  const { container, cleanup } = mount('#Sheet', aliased);
  assert.deepEqual(cardNames(container).map((l) => l.split(',')[1].trim()), ['Chip'], 'only Chip: SheetAlias and Sheet both resolve to this page');
  cleanup();
});
